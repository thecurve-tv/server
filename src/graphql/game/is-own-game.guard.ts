import { ObjectId } from 'bson'
import { IAccount } from '../../model/account'
import { IGame } from '../../model/game'
import { Player } from '../../model/player'
import { ResolverContext } from '../graphql'
import { Guard, GuardInput, GuardOutput } from '../guard'
import { FindByIdArgs } from '../mongoose-resolvers'

export default class IsOwnGameGuard extends Guard<ResolverContext, FindByIdArgs, IGame> {
  constructor() {
    super('egress')
  }
  async check({ context, data }: GuardInput<ResolverContext, FindByIdArgs, IGame>): Promise<void | GuardOutput<FindByIdArgs, IGame>> {
    if (!data) return
    return await isOwnGame(data, context.account._id)
  }
}

export async function isOwnGame<TArgs, TReturn>(game: IGame, accountId: IAccount['_id']): Promise<void | GuardOutput<TArgs, TReturn>> {
  const isGameHost = accountId.equals(<ObjectId>game.hostAccount)
  if (isGameHost) return
  // this player check is enough even if the requester is the host but the above check prevents requesting any data
  const player = await Player.findOne({ game: game._id, account: accountId }, { _id: 1 })
  if (!player) return { data: false }
}
