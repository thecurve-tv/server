import { ObjectId } from 'bson'
import { GraphQLFieldResolver } from 'graphql'
import { startSession } from 'mongoose'
import { IChat, Chat } from '../../model/chat'
import { ChatPlayer, IChatPlayer } from '../../model/chatPlayer'
import { Game, IGame } from '../../model/game'
import { IPlayer, Player } from '../../model/player'
import { IRoom, Room } from '../../model/room'
import { IDraftDocument } from '../../model/_defaults'
import { MAX_GAME_DURATION, MIN_GAME_DURATION } from '../../util/rules'
import { GraphErrorResponse, ResolverContext } from '../graphql'

export interface GameStartMutationResolverArgs {
  hostPlayerName: string
  maxPlayerCount: number
  duration: number
}
export const GameStartMutationResolver: GraphQLFieldResolver<IGame, ResolverContext, GameStartMutationResolverArgs> =
  async (source, args, context, info) => {
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
        $or: [
          { endTime: { $gt: now } },
          { pausedTime: { $not: { $eq: undefined } } }
        ]
      },
      { _id: 1, endTime: 1, pausedTime: 1 }
    )
    if (existingGame) throw new GraphErrorResponse(403, 'You may not host > 1 Game at a time')
    const gameId: IDraftDocument<IGame>['_id'] = new ObjectId()
    const chatId: IDraftDocument<IChat>['_id'] = new ObjectId()
    const gameDoc: IDraftDocument<IGame> = {
      _id: gameId,
      hostAccount: context.account?._id,
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
      account: context.account?._id,
      name: args.hostPlayerName,
      bio: ''
    }
    let result;
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

export interface GameStopMutationResolverArgs {
  _id: ObjectId
}
export const GameStopMutationResolver: GraphQLFieldResolver<IGame, ResolverContext, GameStopMutationResolverArgs> =
  async (source, args, context, info) => {
    const now = Date.now()
    const activeGame = await Game.findById(args._id)
    if (!activeGame) throw new GraphErrorResponse(400, 'There is no game with that id')
    const gameAlreadyEnded = activeGame.endTime <= now && activeGame.pausedTime == null
    if (!gameAlreadyEnded) {
      await Game.updateOne({ _id: args._id }, { endTime: now, $unset: { pausedTime: '' } })
    }
    return activeGame
  }

export interface GameJoinMutationResolverArgs {
  gameId: ObjectId
  playerName: string
}
export const GameJoinMutationResolver: GraphQLFieldResolver<IGame, ResolverContext, GameJoinMutationResolverArgs> =
  async (source, args, context, info) => {
    const now = Date.now()
    const activeGame = await Game.findOne(
      {
        _id: args.gameId,
        $and: [
          { endTime: { $gt: now } },
          { pausedTime: { $eq: undefined } }
        ]
      }
    )
    if (!activeGame) throw new GraphErrorResponse(
      400, 'There is no ongoing game with that id. It is possible the game has ended or is paused.'
    )
    const existingPlayer = await Player.findOne(
      { game: activeGame._id, account: context.account?._id },
      { _id: 1 }
    )
    if (existingPlayer) throw new GraphErrorResponse(403, 'You are already a player in this game.')
    const playerCount = await Player.countDocuments({ game: activeGame._id })
    if (playerCount == activeGame.maxPlayerCount) throw new GraphErrorResponse(403, 'This game is full.')
    const gameId: IDraftDocument<IPlayer>['_id'] = args.gameId
    const curveChatId: IDraftDocument<IChat>['_id'] = activeGame.mainChat
    const playerDoc: IDraftDocument<IPlayer> = {
      _id: new ObjectId(),
      game: gameId,
      account: context.account?._id,
      name: args.playerName,
      bio: ''
    }
    const chatPlayerDoc: IDraftDocument<IChatPlayer> = {
      chat: curveChatId,
      player: playerDoc._id
    }
    const roomDoc: IDraftDocument<IRoom> = {
      player: playerDoc._id
    }
    const session = await startSession()
    const creationPromise: Promise<void> = Promise.all([
      Player.create([playerDoc], { session }),
      ChatPlayer.create([chatPlayerDoc], { session }),
      Room.create([roomDoc], { session })
    ]).then(() => { })
    await session.withTransaction(() => creationPromise)
    return activeGame
  }
