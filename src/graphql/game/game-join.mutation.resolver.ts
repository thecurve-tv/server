import { ObjectId } from 'bson'
import { ResolverResolveParams, SchemaComposer, schemaComposer as _schemaComposer } from 'graphql-compose'
import { startSession } from 'mongoose'
import { IAccount } from '@thecurve-tv/mongo-models/account'
import { IChat } from '@thecurve-tv/mongo-models/chat'
import { ChatPlayer, IChatPlayer } from '@thecurve-tv/mongo-models/chatPlayer'
import { Game, IGame } from '@thecurve-tv/mongo-models/game'
import { IPlayer, Player } from '@thecurve-tv/mongo-models/player'
import { IRoom, Room } from '@thecurve-tv/mongo-models/room'
import { IDraftDocument } from '@thecurve-tv/mongo-models/_defaults'
import { GraphErrorResponse } from '../graphql'
import { ResolverContext } from '../resolver-context'
import { GameTC, PlayerTC } from '../types'

const schemaComposer: SchemaComposer<ResolverContext> = _schemaComposer

export interface GameJoinMutationResolverArgs {
  _id: ObjectId
  playerName: string
}

export interface GameJoinMutationResolverResult {
  game: IGame
  player: IPlayer
}

export default schemaComposer.createResolver<any, GameJoinMutationResolverArgs>({
  name: 'GameJoinMutationResolver',
  type: schemaComposer.createObjectTC({
    name: 'GameJoinMutationResolverResult',
    fields: {
      game: GameTC.getType(),
      player: PlayerTC.getType(),
    },
  }),
  args: {
    _id: 'MongoID!',
    playerName: 'String!',
  },
  resolve: resolveGameJoinMutation,
})

async function resolveGameJoinMutation({
  args,
  context,
}: ResolverResolveParams<any, ResolverContext, GameJoinMutationResolverArgs>): Promise<GameJoinMutationResolverResult> {
  /**
   * Validate:
   * $- game must be active
   * $- requester can't be a player in the game
   * $- game must not be full
   * Do:
   * $- build player
   * $- build chat player (for main chat)
   * $- build room doc
   * $- start session
   * $- create docs & commit transaction
   */
  const now = Date.now()
  const activeGame = await validateGameJoinMutation(args, context.account._id, now)
  const gameId: IDraftDocument<IGame>['_id'] = args._id
  const curveChatId: IDraftDocument<IChat>['_id'] = activeGame.mainChat
  const playerDoc: IDraftDocument<IPlayer> = {
    _id: new ObjectId(),
    game: gameId,
    account: context.account?._id,
    name: args.playerName,
    age: 18,
    job: '',
    bio: '',
  }
  const chatPlayerDoc: IDraftDocument<IChatPlayer> = {
    chat: curveChatId,
    player: playerDoc._id,
  }
  const roomDoc: IDraftDocument<IRoom> = {
    player: playerDoc._id,
  }
  let result: GameJoinMutationResolverResult | unknown
  const session = await startSession()
  await session.withTransaction(async session => {
    await Promise.all([Player.create([playerDoc], { session }), ChatPlayer.create([chatPlayerDoc], { session }), Room.create([roomDoc], { session })]).then(
      ([[player], _chatPlayers, _rooms]) => {
        result = {
          game: activeGame,
          player,
        }
      }
    )
  })
  return <GameJoinMutationResolverResult>result
}

async function validateGameJoinMutation(args: GameJoinMutationResolverArgs, accountId: IAccount['_id'], now: number): Promise<IGame> {
  const throwIfActiveGameNotFound = true
  const activeGame = await getActiveGame(args._id, now, throwIfActiveGameNotFound)
  const existingPlayer = await Player.findOne({ game: activeGame._id, account: accountId }, { _id: 1 })
  if (existingPlayer) throw new GraphErrorResponse(403, 'You are already a player in this game.')
  const playerCount = await Player.countDocuments({ game: activeGame._id })
  if (playerCount == activeGame.maxPlayerCount) throw new GraphErrorResponse(403, 'This game is full.')
  return activeGame
}

/**
 * A game that doesn't exist is considered inactive.
 * A game that is paused is inactive.
 * A game that has ended is inactive.
 * @returns 'null' if no active game was found
 * @throws 'GraphErrorResponse' if `throwIfActiveGameNotFound == true` & no active game was found
 */
export async function getActiveGame(_id: IGame['_id'], now: number, throwIfActiveGameNotFound: true, projection?: { [k: string]: number }): Promise<IGame>
export async function getActiveGame(
  _id: IGame['_id'],
  now: number,
  throwIfActiveGameNotFound: boolean,
  projection?: { [k: string]: number }
): Promise<IGame | null> {
  const game = await Game.findOne(
    {
      _id,
      $and: [{ endTime: { $gt: now } }, { pausedTime: { $eq: undefined } }],
    },
    projection
  )
  if (throwIfActiveGameNotFound && !game) {
    throw new GraphErrorResponse(400, 'There is no ongoing game with that id. It is possible the game has ended or is paused.')
  }
  return game
}
