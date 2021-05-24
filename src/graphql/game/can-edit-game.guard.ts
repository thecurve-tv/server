import { ObjectId } from 'bson'
import { Game, IGame } from '../../model/game'
import { GraphErrorResponse, ResolverContext } from '../graphql'
import { Guard, GuardInput, GuardOutput } from '../guard'
import { UpdateByIdArgs } from '../mongoose-resolvers'

export default class CanEditGameGuard extends Guard<ResolverContext, UpdateByIdArgs, IGame> {
  constructor() {
    super('ingress')
  }
  async check({ context, args }: GuardInput<ResolverContext, UpdateByIdArgs, IGame>): Promise<void | GuardOutput<UpdateByIdArgs, IGame>> {
    const now = Date.now()
    const game = await Game.findById(args._id, { hostAccount: 1, pausedTime: 1, endTime: 1 })
    if (!game) throw new GraphErrorResponse(404, 'There is no game with that id.')
    if (!(<ObjectId>game.hostAccount).equals(context.account._id)) throw new GraphErrorResponse(403, 'You must be the game host to do that.')
    if (!game.pausedTime && game.endTime <= now) throw new GraphErrorResponse(403, 'You cannot edit the game after it has ended')
  }
}
