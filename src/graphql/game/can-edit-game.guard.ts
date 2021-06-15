import { ObjectId } from 'bson'
import { Game, IGame } from '../../model/game'
import { GraphErrorResponse, ResolverContext } from '../graphql'
import { Guard, GuardInput, GuardOutput } from '../guard'
import { UpdateByIdArgs } from '../mongoose-resolvers'
import { getActiveGame } from './game-join.mutation.resolver'

export default class CanEditGameGuard extends Guard<ResolverContext, UpdateByIdArgs, IGame> {
  constructor() {
    super('ingress')
  }
  async check({ context, args }: GuardInput<ResolverContext, UpdateByIdArgs, IGame>): Promise<void | GuardOutput<UpdateByIdArgs, IGame>> {
    const now = Date.now()
    const game = await getActiveGame(args._id, now, true)
    if (!(<ObjectId>game.hostAccount).equals(context.account._id)) throw new GraphErrorResponse(403, 'You must be the game host to do that.')
    if (!game.pausedTime && game.endTime <= now) throw new GraphErrorResponse(403, 'You cannot edit the game after it has ended')
  }
}
