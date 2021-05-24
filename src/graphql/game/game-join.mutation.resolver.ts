import { ObjectId } from 'bson'
import { SchemaComposer, schemaComposer as _schemaComposer } from 'graphql-compose'
import { startSession } from 'mongoose'
import { IChat } from '../../model/chat'
import { ChatPlayer, IChatPlayer } from '../../model/chatPlayer'
import { Game, IGame } from '../../model/game'
import { IPlayer, Player } from '../../model/player'
import { IRoom, Room } from '../../model/room'
import { IDraftDocument } from '../../model/_defaults'
import { GraphErrorResponse, ResolverContext } from '../graphql'
import { GameTC, PlayerTC } from '../types'

const schemaComposer: SchemaComposer<ResolverContext> = _schemaComposer

export interface GameJoinMutationResolverArgs {
  _id: ObjectId
  playerName: string
}
export default schemaComposer.createResolver<any, GameJoinMutationResolverArgs>({
  name: 'GameJoinMutationResolver',
  type: schemaComposer.createObjectTC({
    name: 'GameJoinMutationResolverResult',
    fields: {
      game: GameTC.getType(),
      player: PlayerTC.getType()
    }
  }),
  args: {
    _id: 'MongoID!',
    playerName: 'String!'
  },
  resolve: async ({ args, context }) => {
    const now = Date.now()
    const activeGame = await Game.findOne({
      _id: args._id,
      $and: [{ endTime: { $gt: now } }, { pausedTime: { $eq: undefined } }]
    })
    if (!activeGame) throw new GraphErrorResponse(400, 'There is no ongoing game with that id. It is possible the game has ended or is paused.')
    const existingPlayer = await Player.findOne({ game: activeGame._id, account: context.account?._id }, { _id: 1 })
    if (existingPlayer) throw new GraphErrorResponse(403, 'You are already a player in this game.')
    const playerCount = await Player.countDocuments({ game: activeGame._id })
    if (playerCount == activeGame.maxPlayerCount) throw new GraphErrorResponse(403, 'This game is full.')
    const gameId: IDraftDocument<IGame>['_id'] = args._id
    const curveChatId: IDraftDocument<IChat>['_id'] = activeGame.mainChat
    const playerDoc: IDraftDocument<IPlayer> = {
      _id: new ObjectId(),
      game: gameId,
      account: context.account?._id,
      name: args.playerName,
      age: 18,
      job: '',
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
    let result
    const creationPromise: Promise<void> = Promise.all([
      Player.create([playerDoc], { session }),
      ChatPlayer.create([chatPlayerDoc], { session }),
      Room.create([roomDoc], { session })
    ]).then(([[player], _chatPlayers, _rooms]) => {
      result = {
        game: activeGame,
        player
      }
    })
    await session.withTransaction(() => creationPromise)
    return result
  }
})
