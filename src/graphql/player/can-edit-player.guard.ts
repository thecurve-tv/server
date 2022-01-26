import { ObjectId } from 'bson'
import { IGame } from '../../models/game'
import { IPlayer, Player } from '../../models/player'
import { ResolverContext } from '../resolver-context'
import { Guard, GuardInput, GuardOutput } from '../guard'
import { UpdateByIdArgs } from '../mongoose-resolvers'
import { GraphErrorResponse } from '../types'

export default class CanEditPlayerGuard extends Guard<ResolverContext, UpdateByIdArgs, IPlayer> {
  constructor(
    /** the key to use as gameId when searching for the requester's player doc */
    private useGameId?: string,
  ) {
    super('ingress')
  }

  private async getPlayer(_args: unknown, accountId?: ObjectId): Promise<IPlayer | null> {
    const args = _args as (UpdateByIdArgs & Record<string, IGame['_id']>)
    let query
    if (this.useGameId && !args._id) {
      query = { game: new ObjectId(args[this.useGameId]), account: accountId }
    } else {
      query = { _id: args._id }
    }
    return await Player.findOne(query, { account: 1, game: 1 }).populate('game', { endTime: 1, pausedTime: 1 })
  }

  async check({ context, args }: GuardInput<ResolverContext, UpdateByIdArgs, IPlayer>): Promise<void | GuardOutput<UpdateByIdArgs, IPlayer>> {
    const now = Date.now()
    const player = await this.getPlayer(args, context.account._id)
    if (!player) throw new GraphErrorResponse(404, 'There is no player with that _id.')
    if (!(<ObjectId>player.account).equals(context.account._id)) throw new GraphErrorResponse(403, 'You can only modify your own Players.')
    const game = <IGame>player.game
    if (game.pausedTime) throw new GraphErrorResponse(403, 'You cannot edit your player while the game is paused')
    if (game.endTime <= now) throw new GraphErrorResponse(403, 'You cannot edit your player after the game has ended')
  }
}
