import { ObjectId } from 'bson'
import { Game, IGame } from '@thecurve-tv/mongo-models/src/game'
import { GraphErrorResponse } from '../graphql'
import { ResolverContext } from "../resolver-context"
import { Guard, GuardInput, GuardOutput } from '../guard'

interface IsGameHostGuardArgs {
  _id?: string
}

export default class IsGameHostGuard extends Guard<ResolverContext, IsGameHostGuardArgs, IGame> {
  constructor() {
    super('ingress')
  }
  async check({ context, args }: GuardInput<ResolverContext, IsGameHostGuardArgs, IGame>): Promise<void | GuardOutput<IsGameHostGuardArgs, IGame>> {
    const game = await Game.findById(args._id, { hostAccount: 1 })
    if (!game) throw new GraphErrorResponse(404, 'There is no game with that id.')
    if (!(<ObjectId>game.hostAccount).equals(context.account._id)) throw new GraphErrorResponse(403, 'You must be the game host to do that.')
  }
}
