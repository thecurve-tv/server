import { ObjectId } from 'bson'
import { IGame } from '../../models/game'
import { IPlayer, Player } from '../../models/player'
import { GraphErrorResponse } from '../graphql'
import { ResolverContext } from '../resolver-context'
import { Guard, GuardInput, GuardOutput } from '../guard'
import { UpdateByIdArgs } from '../mongoose-resolvers'

export default class CanEditPlayerGuard extends Guard<ResolverContext, UpdateByIdArgs, IPlayer> {
  constructor() {
    super('ingress')
  }
  async check({ context, args }: GuardInput<ResolverContext, UpdateByIdArgs, IPlayer>): Promise<void | GuardOutput<UpdateByIdArgs, IPlayer>> {
    const now = Date.now()
    const player = await Player.findById(args._id, { account: 1, game: 1 }).populate('game', { endTime: 1, pausedTime: 1 })
    if (!player) throw new GraphErrorResponse(404, 'There is no player with that _id.')
    if (!(<ObjectId>player.account).equals(context.account._id)) throw new GraphErrorResponse(403, 'You can only modify your own Players.')
    const game = <IGame>player.game
    if (game.pausedTime) throw new GraphErrorResponse(403, 'You cannot edit your player while the game is paused')
    if (game.endTime <= now) throw new GraphErrorResponse(403, 'You cannot edit your player after the game has ended')
  }
}
