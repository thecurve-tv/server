import { ObjectId } from 'bson'
import { GraphQLFieldResolver } from 'graphql'
import { SchemaComposer, ObjectTypeComposerFieldConfigDefinition, schemaComposer as _schemaComposer } from 'graphql-compose'
import { environment } from '../../environment'
import { IAccount } from '../../model/account'
import { Chat, IChat } from '../../model/chat'
import { ChatPlayer } from '../../model/chatPlayer'
import { IPlayer, Player } from '../../model/player'
import { getActiveGame } from '../game/game-join.mutation.resolver'
import { GooglePubSub } from '../google-pub-sub'
import { GraphErrorResponse } from '../graphql'
import { MongoID } from '../mongoose-resolvers'
import { ResolverContext } from '../resolver-context'

const schemaComposer: SchemaComposer<ResolverContext> = _schemaComposer

export interface ChatMessage {
  chatId: MongoID
  fromPlayerId: MongoID
  sentTime: number
  message: string
}

export const ChatMessageTC = schemaComposer.createObjectTC({
  name: 'ChatMessage',
  fields: {
    chatId: 'MongoID!',
    fromPlayerId: 'MongoID!',
    sentTime: 'Float!',
    message: 'String!'
  }
})

export interface ChatMessagesSubscriptionResolverArgs {
  chatId: MongoID
}

export const pubsub = new GooglePubSub<ChatMessage>({
  projectId: <string>environment.GOOGLE_PROJECT_ID,
  topicId: 'chat-messages',
  graphqlSubscriptionName: 'chatMessages',
  orderingKey: 'chat-messages'
})

const resolveChatMessagesSubscription: GraphQLFieldResolver<unknown, ResolverContext, ChatMessagesSubscriptionResolverArgs> = async (
  _source,
  args,
  context,
  _info
) => {
  /**
   * Validate:
   * - $chat must exist
   * - requester must be the host OR a player in the chat
   * - $game must be active
   * Do:
   * - $start unique subscription (deleting existing)
   */
  const now = Date.now()
  const [chat, playerId] = await validateChatMessagesSubscription(args, context.account._id, now)
  const chatId = chat._id.toHexString()
  const subscriptionId = `chat-messages%chatId~${chatId}%toPlayer~${playerId.toHexString()}`
  return pubsub.asyncIteratorWithOptions(subscriptionId, {
    filter: {
      keyEquals: { key: 'chatId', value: chatId }
    },
    deleteExistingSubscription: true
  })
}

async function validateChatMessagesSubscription(
  args: ChatMessagesSubscriptionResolverArgs,
  accountId: IAccount['_id'],
  now: number
): Promise<[IChat, IPlayer['_id']]> {
  const chat = await Chat.findById(args.chatId, { game: 1 })
  if (!chat) {
    throw new GraphErrorResponse(400, 'There is no chat with that id')
  }
  const throwIfActiveGameNotFound = true
  const game = await getActiveGame(chat.game, now, throwIfActiveGameNotFound, {hostAccount: 1})
  const requesterIsHost = accountId.toHexString() == (<ObjectId>game.hostAccount).toHexString()
  if (requesterIsHost) {
    const player = await Player.findOne({game: game._id, account: accountId}, {_id: 1})
    if (!player) throw new GraphErrorResponse(500, 'We failed to get your player id based on your account id')
    return [chat, player._id]
  }
  const aggregationResult: { player: { _id: IPlayer['_id'] } }[] = await ChatPlayer.aggregate([
    { $match: { chat: chat._id } },
    {
      $lookup: {
        from: Player.collection.name,
        localField: 'player',
        foreignField: '_id',
        as: 'player'
      }
    },
    { $unwind: '$player' }, // one player
    { $match: { 'player.account': accountId } },
    { $project: { 'player._id': 1 } }
  ])
  if (aggregationResult.length == 0) {
    throw new GraphErrorResponse(403, 'You must be a player in that chat to listen to its messages')
  }
  return [chat, aggregationResult[0].player._id]
}

export default <ObjectTypeComposerFieldConfigDefinition<unknown, ResolverContext, ChatMessagesSubscriptionResolverArgs>>{
  type: ChatMessageTC,
  args: {
    chatId: 'MongoID!'
  },
  subscribe: resolveChatMessagesSubscription
}
