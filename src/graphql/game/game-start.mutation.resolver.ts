import { ObjectId } from 'bson'
import { ResolverResolveParams, SchemaComposer, schemaComposer as _schemaComposer } from 'graphql-compose'
import { startSession } from 'mongoose'
import { IAccount } from '@thecurve-tv/mongo-models/src/account'
import { IChat, Chat } from '@thecurve-tv/mongo-models/src/chat'
import { Game, IGame } from '@thecurve-tv/mongo-models/src/game'
import { IPlayer, Player } from '@thecurve-tv/mongo-models/src/player'
import { IDraftDocument } from '@thecurve-tv/mongo-models/src/_defaults'
import { GraphErrorResponse } from '../graphql'
import { ResolverContext } from "../resolver-context"
import { GameTC, PlayerTC, ChatTC } from '../types'

const schemaComposer: SchemaComposer<ResolverContext> = _schemaComposer
const MIN_GAME_DURATION = 3 * 60 * 60 * 1000 // 3 hours
const MAX_GAME_DURATION = 5 * 60 * 60 * 1000 // 5 hours

export interface GameStartMutationResolverArgs {
  hostPlayerName: string
  maxPlayerCount: number
  duration: number
}

export interface GameStartMutationResolverResult {
  game: IGame
  hostPlayer: IPlayer
  chat: IChat
}

export default schemaComposer.createResolver<any, GameStartMutationResolverArgs>({
  name: 'GameStartMutationResolver',
  type: schemaComposer.createObjectTC({
    name: 'GameStartMutationResolverResult',
    fields: {
      game: GameTC.getType(),
      hostPlayer: PlayerTC.getType(),
      chat: ChatTC.getType()
    }
  }),
  args: {
    hostPlayerName: 'String!',
    maxPlayerCount: 'Int!',
    duration: 'Int!'
  },
  resolve: resolveGameStartMutation
})

async function resolveGameStartMutation(
  { args, context }: ResolverResolveParams<any, ResolverContext, GameStartMutationResolverArgs>
): Promise<GameStartMutationResolverResult> {
  const now = Date.now()
  await validateGameStartMutation(args, context.account._id, now)
  const gameId: IDraftDocument<IGame>['_id'] = new ObjectId()
  const chatId: IDraftDocument<IChat>['_id'] = new ObjectId()
  const gameDoc: IDraftDocument<IGame> = {
    _id: gameId,
    hostAccount: context.account._id,
    maxPlayerCount: args.maxPlayerCount,
    startTime: now,
    endTime: now + args.duration,
    mainChat: chatId
  }
  const curveChatDoc: IDraftDocument<IChat> = {
    _id: chatId,
    game: gameId,
    name: 'Curve Chat'
  }
  const hostPlayerDoc: IDraftDocument<IPlayer> = {
    _id: new ObjectId(),
    game: gameId,
    account: context.account._id,
    name: args.hostPlayerName,
    age: 18,
    job: '',
    bio: ''
  }
  let result: GameStartMutationResolverResult | unknown
  await (await startSession()).withTransaction(async session => {
    await Promise.all([
      Game.create([gameDoc], { validateBeforeSave: true, session }),
      Player.create([hostPlayerDoc], { validateBeforeSave: true, session }),
      Chat.create([curveChatDoc], { validateBeforeSave: true, session })
    ]).then(docs => {
      result = {
        game: docs[0][0],
        hostPlayer: docs[1][0],
        chat: docs[2][0]
      }
    })
  })
  return <GameStartMutationResolverResult>result
}

async function validateGameStartMutation(args: GameStartMutationResolverArgs, accountId: IAccount['_id'], now: number) {
  if (args.duration < MIN_GAME_DURATION) {
    throw new GraphErrorResponse(400, `Games cannot last < ${MIN_GAME_DURATION} milliseconds`)
  }
  if (args.duration > MAX_GAME_DURATION) {
    throw new GraphErrorResponse(400, `Games cannot last > ${MAX_GAME_DURATION} milliseconds`)
  }
  const existingGame = await Game.findOne(
    {
      hostAccount: accountId,
      $or: [{ endTime: { $gt: now } }, { pausedTime: { $not: { $eq: undefined } } }]
    },
    { _id: 1, endTime: 1, pausedTime: 1 }
  )
  if (existingGame) throw new GraphErrorResponse(403, 'You may not host > 1 Game at a time')
}
