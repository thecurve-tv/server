import { ObjectId } from 'bson'
import { GraphQLFieldResolver } from 'graphql'
import { startSession } from 'mongoose'
import { IChat, Chat } from '../../model/chat'
import { IChatPlayer, ChatPlayer } from '../../model/chatPlayer'
import { Game, IGame } from '../../model/game'
import { IPlayer, Player } from '../../model/player'
import { IDraftDocument } from '../../model/_defaults'
import { MAX_GAME_DURATION, MIN_GAME_DURATION } from '../../util/rules'
import { GraphErrorResponse, ResolverContext } from '../graphql'

export interface GameStartMutationResolverArgs {
  hostPlayerName: string
  duration: number
}
export const GameStartMutationResolver: GraphQLFieldResolver<IGame, ResolverContext, GameStartMutationResolverArgs> =
  async (source, args, context, info) => {
    console.log('Got to resolver')
    if (args.duration < MIN_GAME_DURATION) {
      console.log('invalid dur <')
      throw new GraphErrorResponse(400, `Games cannot last < ${MIN_GAME_DURATION} milliseconds`)
    }
    if (args.duration > MAX_GAME_DURATION) {
      console.log('invalid dur >')
      throw new GraphErrorResponse(400, `Games cannot last > ${MAX_GAME_DURATION} milliseconds`)
    }
    const existingGame = await Game.findOne({ hostAccount: context.account?._id }, { _id: 1 })
    if (existingGame) console.log('existing game')
    if (existingGame) throw new GraphErrorResponse(403, 'You may not host > 1 Game at a time')
    const now = Date.now()
    const gameDoc: IDraftDocument<IGame> = {
      _id: new ObjectId(),
      hostAccount: context.account?._id,
      startTime: now,
      endTime: now + args.duration
    }
    const hostPlayerDoc: IDraftDocument<IPlayer> = {
      _id: new ObjectId(),
      game: gameDoc._id,
      account: context.account?._id,
      name: args.hostPlayerName,
      bio: ''
    }
    const curveChatDoc: IDraftDocument<IChat> = {
      _id: new ObjectId(),
      game: gameDoc._id,
      name: 'Curve Chat'
    }
    const curveChatHostPlayerDoc: IDraftDocument<IChatPlayer> = {
      chat: curveChatDoc._id,
      player: hostPlayerDoc._id
    }
    let result;
    const session = await startSession()
    const creationPromise: Promise<void> = Promise.all([
      Game.create([gameDoc], { validateBeforeSave: true, session }),
      Player.create([hostPlayerDoc], { validateBeforeSave: true, session }),
      Chat.create([curveChatDoc], { validateBeforeSave: true, session }),
      ChatPlayer.create([curveChatHostPlayerDoc], { validateBeforeSave: true, session })
    ]).then(docs => {
      result = {
        game: docs[0][0],
        hostPlayer: docs[1][0],
        chat: docs[2][0]
      }
    })
    console.log('with transac')
    await session.withTransaction(() => creationPromise).then(() => console.log('all done'))
    console.log('ret res')
    return result
  }
