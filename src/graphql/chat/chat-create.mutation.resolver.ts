import { ObjectId } from 'bson'
import { ResolverResolveParams, SchemaComposer, schemaComposer as _schemaComposer } from 'graphql-compose'
import { startSession } from 'mongoose'
import { Chat, IChat } from '../../model/chat'
import { ChatPlayer, IChatPlayer } from '../../model/chatPlayer'
import { IGame } from '../../model/game'
import { IPlayer, Player } from '../../model/player'
import { IDraftDocument } from '../../model/_defaults'
import { getActiveGame } from '../game/game-join.mutation.resolver'
import { GraphErrorResponse } from '../graphql'
import { ResolverContext } from "../resolver-context"
import { MongoID } from '../mongoose-resolvers'
import { ChatPlayerTC, ChatTC } from '../types'

const schemaComposer: SchemaComposer<ResolverContext> = _schemaComposer

export interface ChatCreateMutationResolverArgs {
  gameId: MongoID
  name: string
  playerIds: MongoID[]
}

export interface ChatCreateMutationResolverResult {
  chat: IChat
  chatPlayers: IChatPlayer[]
}

export default schemaComposer.createResolver<any, ChatCreateMutationResolverArgs>({
  name: 'ChatCreateMutationResolver',
  type: schemaComposer.createObjectTC({
    name: 'ChatCreateMutationResolverResult',
    fields: {
      chat: ChatTC,
      chatPlayers: [ChatPlayerTC]
    }
  }),
  args: {
    gameId: 'MongoID!',
    name: 'String!',
    playerIds: '[MongoID!]!'
  },
  resolve: resolveChatCreateMutation
})

async function resolveChatCreateMutation(
  { args, context }: ResolverResolveParams<any, ResolverContext, ChatCreateMutationResolverArgs>
): Promise<ChatCreateMutationResolverResult> {
  /**
   * Validate args
   * $- game must be active
   * $- requester must be a player in the game
   * $- name must be valid
   * $- playerIds must be of players in the game
   * $- no duplicate playerIds
   * $- at least 2 playerIds
   * $- playerIds must contain requester
   * $- requester cannot be the host
   * Create chat & chatPlayers
   * $- draft docs
   * $- start session
   * $- commit transaction
   * Send result
   */
  const now = Date.now()
  const throwIfGameNotFound = true
  const game = await getActiveGame(new ObjectId(args.gameId), now, throwIfGameNotFound)
  await validateArgs(game, context, args)
  const chatDoc: IDraftDocument<IChat> = {
    _id: new ObjectId(),
    game: game._id,
    name: args.name
  }
  const chatPlayerDocs: IDraftDocument<IChatPlayer>[] = args.playerIds.map(playerId => {
    return {
      chat: chatDoc._id,
      player: new ObjectId(playerId)
    }
  })
  let result: ChatCreateMutationResolverResult | unknown
  await (await startSession()).withTransaction(async session => {
    await Promise.all([
      Chat.create([chatDoc], { session }),
      ChatPlayer.create(chatPlayerDocs, { session })
    ]).then(([[chat], chatPlayers]) => {
      result = {
        chat,
        chatPlayers
      }
    })
  })
  return <ChatCreateMutationResolverResult>result
}

async function validateArgs(game: IGame, context: ResolverContext, args: ChatCreateMutationResolverArgs): Promise<void> {
  const requesterId = context.account._id
  if ((<ObjectId>game.hostAccount).toHexString() === requesterId.toHexString()) {
    throw new GraphErrorResponse(403, 'You cannot create chats as the game host')
  }
  const requesterPlayer: Pick<IPlayer, '_id'> | null = await Player.findOne(
    { game: game._id, account: requesterId },
    { _id: 1 }
  )
  if (!requesterPlayer) {
    throw new GraphErrorResponse(403, 'You must be a player in the Game to create a chat')
  }
  const chatPlayerIdStrs = args.playerIds
  if (chatPlayerIdStrs.length < 2) {
    throw new GraphErrorResponse(400, 'A chat must contain at least 2 players')
  }
  const uniqueChatPlayerIdStrs = new Set(chatPlayerIdStrs)
  if (uniqueChatPlayerIdStrs.size != chatPlayerIdStrs.length) {
    throw new GraphErrorResponse(400, 'The chat player list cannot contain duplicates')
  }
  const requesterIsAChatPlayer = chatPlayerIdStrs.find(playerId => playerId == requesterPlayer._id.toHexString())
  if (!requesterIsAChatPlayer) {
    throw new GraphErrorResponse(400, 'You must be a player in the new chat')
  }
  const gamePlayers: (Pick<IPlayer, '_id'> | null)[] = await Player.find({ _id: { $in: chatPlayerIdStrs } }, { _id: 1 })
  if (gamePlayers.length !== chatPlayerIdStrs.length) {
    throw new GraphErrorResponse(400, 'All chat players must also be players in the game')
  }
  const chatName = args.name
  if (!chatName || chatName.length > 50) {
    throw new GraphErrorResponse(400, 'The chat name must be between [1, 50] characters (inclusive)')
  }
}
