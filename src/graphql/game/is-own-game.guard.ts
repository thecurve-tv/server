import { ObjectId } from 'bson'
import { IAccount } from '@thecurve-tv/mongo-models/src/account'
import { IGame } from '@thecurve-tv/mongo-models/src/game'
import { Player } from '@thecurve-tv/mongo-models/src/player'
import { ResolverContext } from "../resolver-context"
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
