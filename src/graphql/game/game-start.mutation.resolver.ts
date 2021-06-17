import { ObjectId } from 'bson'
import { SchemaComposer, schemaComposer as _schemaComposer } from 'graphql-compose'
import { startSession } from 'mongoose'
import { IChat, Chat } from '../../model/chat'
import { Game, IGame } from '../../model/game'
import { IPlayer, Player } from '../../model/player'
import { IDraftDocument } from '../../model/_defaults'
import { MAX_GAME_DURATION, MIN_GAME_DURATION } from '../../util/rules'
import { GraphErrorResponse } from '../graphql'
import { ResolverContext } from "../resolver-context"
import { GameTC, PlayerTC, ChatTC } from '../types'

const schemaComposer: SchemaComposer<ResolverContext> = _schemaComposer

export interface GameStartMutationResolverArgs {
  hostPlayerName: string
  maxPlayerCount: number
  duration: number
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
  resolve: async ({ args, context }) => {
    const now = Date.now()
    if (args.duration < MIN_GAME_DURATION) {
      throw new GraphErrorResponse(400, `Games cannot last < ${MIN_GAME_DURATION} milliseconds`)
    }
    if (args.duration > MAX_GAME_DURATION) {
      throw new GraphErrorResponse(400, `Games cannot last > ${MAX_GAME_DURATION} milliseconds`)
    }
    const existingGame = await Game.findOne(
      {
        hostAccount: context.account?._id,
        $or: [{ endTime: { $gt: now } }, { pausedTime: { $not: { $eq: undefined } } }]
      },
      { _id: 1, endTime: 1, pausedTime: 1 }
    )
    if (existingGame) throw new GraphErrorResponse(403, 'You may not host > 1 Game at a time')
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
    let result
    const session = await startSession()
    const creationPromise: Promise<void> = Promise.all([
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
    await session.withTransaction(() => creationPromise)
    return result
  }
})
