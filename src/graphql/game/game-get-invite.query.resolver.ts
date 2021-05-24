import { ObjectId } from 'bson'
import { SchemaComposer, schemaComposer as _schemaComposer } from 'graphql-compose'
import { Account, IAccount } from '../../model/account'
import { Game, IGame } from '../../model/game'
import { IPlayer, Player } from '../../model/player'
import { ResolverContext } from '../graphql'

const schemaComposer: SchemaComposer<ResolverContext> = _schemaComposer

export interface GameGetInviteQueryResolverArgs {
  gameId: ObjectId
}
export interface GameGetInviteQueryResolverResult {
  _id: ObjectId
  hostAccount: {
    _id: ObjectId
    email: string
  }
  maxPlayerCount: number
  endTime: number
  pausedTime?: number
  gameStatus: 'OPEN' | 'FULL' | 'CLOSED'
}
type GameInvite = IGame & { hostAccount: IAccount, players: IPlayer[] }
export default schemaComposer.createResolver<any, GameGetInviteQueryResolverArgs>({
  name: 'GameGetInviteQueryResolver',
  type: schemaComposer.createObjectTC({
    name: 'GameGetInviteQueryResolverResult',
    fields: {
      _id: 'MongoID!',
      hostAccount: schemaComposer.createObjectTC({
        name: 'GameGetInviteQueryResolverResultHostAccount',
        fields: {
          _id: 'MongoID!',
          email: 'String!'
        }
      }),
      maxPlayerCount: 'Float!',
      endTime: 'Float!',
      pausedTime: 'Float',
      gameStatus: schemaComposer.createEnumTC({
        name: 'GameGetInviteQueryResolverResultGameStatus',
        values: {
          OPEN: { value: 'OPEN' },
          FULL: { value: 'FULL' },
          CLOSED: { value: 'CLOSED' }
        }
      })
    }
  }),
  args: {
    gameId: 'MongoID!'
  },
  resolve: async ({ args }) => {
    const now = Date.now()
    const [game]: GameInvite[] = await Game.aggregate([
      {
        $match: { _id: new ObjectId(args.gameId) }
      },
      {
        $lookup: {
          from: Account.collection.name,
          localField: 'hostAccount',
          foreignField: '_id',
          as: 'hostAccount'
        }
      },
      { $unwind: '$hostAccount' }, // one account
      {
        $lookup: {
          from: Player.collection.name,
          localField: '_id',
          foreignField: 'game',
          as: 'players'
        }
      }
    ])
    if (!game) return null
    const hostAccount = <IAccount>game.hostAccount
    const gameStatus: GameGetInviteQueryResolverResult['gameStatus'] = getGameStatus(now, game)
    return <GameGetInviteQueryResolverResult>{
      _id: game._id,
      hostAccount: {
        _id: hostAccount._id,
        email: hostAccount.email
      },
      maxPlayerCount: game.maxPlayerCount,
      endTime: game.endTime,
      pausedTime: game.pausedTime,
      gameStatus
    }
  }
})

function getGameStatus(now: number, game: GameInvite) {
  const playerCount = game.players.length
  const cutOffTime = now - (60 * 1000)
  if (game.pausedTime || game.endTime <= cutOffTime) return 'CLOSED'
  else if (playerCount == game.maxPlayerCount) return 'FULL'
  return 'OPEN'
}
