import { ObjectId } from 'bson'
import { ResolverResolveParams, SchemaComposer, schemaComposer as _schemaComposer } from 'graphql-compose'
import { IAccount } from '../../models/account'
import { Chat, IChat } from '../../models/chat'
import { ChatPlayer } from '../../models/chatPlayer'
import { IPlayer, Player } from '../../models/player'
import { getActiveGame } from '../game/game-join.mutation.resolver'
import { MongoID } from '../mongoose-resolvers'
import { ResolverContext } from '../resolver-context'
import { GraphErrorResponse } from '../types'
import { ChatMessage, ChatMessageTC, pubsub } from './chat-messages.subscription.resolver'

const schemaComposer: SchemaComposer<ResolverContext> = _schemaComposer

export interface ChatSendMessageMutationResolverArgs {
  chatId: MongoID
  message: string
}

export interface ChatSendMessageMutationResolverResult {
  chatId: MongoID
  message: string
}

export default schemaComposer.createResolver<unknown, ChatSendMessageMutationResolverArgs>({
  name: 'ChatTestMutationResolver',
  type: ChatMessageTC,
  args: {
    chatId: 'MongoID!',
    message: 'String!',
  },
  resolve: resolveChatSendMessageMutation,
})

async function resolveChatSendMessageMutation({
  args,
  context,
}: ResolverResolveParams<unknown, ResolverContext, ChatSendMessageMutationResolverArgs>): Promise<ChatSendMessageMutationResolverResult> {
  /**
   * Validate:
   * $- chat must exist
   * $- sender must be a player in the chat
   * $- chat.game must be active
   * $- 1 <= message.length <= 500
   * Do:
   * $- build chat message
   * $- publish message
   */
  const now = Date.now()
  const [ chat, playerId ] = await validateChatSendMessageMutation(args, context.account._id, now)
  const chatMessage: ChatMessage = {
    chatId: chat._id.toHexString(),
    fromPlayerId: playerId.toHexString(),
    sentTime: now,
    message: args.message,
  }
  await pubsub.publish(pubsub.DEFAULT_PUBLISH_TRIGGER_NAME, { payload: chatMessage })
  return chatMessage
}

async function validateChatSendMessageMutation(
  args: ChatSendMessageMutationResolverArgs,
  accountId: IAccount['_id'],
  now: number,
): Promise<[IChat, IPlayer['_id']]> {
  if (args.message.length < 1 || args.message.length > 500) {
    throw new GraphErrorResponse(400, 'Messages must be between 1 and 500 characters long (inclusive)')
  }
  const chat = await Chat.findById(args.chatId, { game: 1 })
  if (!chat) {
    throw new GraphErrorResponse(400, 'There is no chat with that id')
  }
  const throwIfActiveGameNotFound = true
  await getActiveGame(chat.game, now, throwIfActiveGameNotFound)
  const aggregationResult: { player: { _id: IPlayer['_id'] } }[] = await ChatPlayer.aggregate([
    { $match: { chat: chat._id } },
    {
      $lookup: {
        from: Player.collection.name,
        localField: 'player',
        foreignField: '_id',
        as: 'player',
      },
    },
    { $unwind: '$player' }, // one player
    { $match: { 'player.account': new ObjectId(accountId) } },
    { $project: { 'player._id': 1 } },
  ])
  if (aggregationResult.length == 0) {
    throw new GraphErrorResponse(403, 'You must be a player in that chat to send messages to it')
  }
  return [ chat, aggregationResult[0].player._id ]
}
