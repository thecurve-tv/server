import { IAccount } from '../../model/account'
import { ResolverContext } from '../graphql'
import { Guard, GuardInput, GuardOutput } from '../guard'
import { FindByIdArgs } from '../mongoose-resolvers'

export default class IsOwnAccountGuard extends Guard<ResolverContext, FindByIdArgs, IAccount> {
  constructor(
    private revealAccountId = false
  ) {
    super('egress')
  }
  async check({ context, data }: GuardInput<ResolverContext, FindByIdArgs, IAccount>): Promise<void | GuardOutput<FindByIdArgs, IAccount>> {
    if (!data) return
    const isOwnAccount = !!data?._id && context.account._id.equals(data._id)
    if (isOwnAccount) return
    if (this.revealAccountId) {
      data.email = ''
      return { data }
    }
    return { data: false }
  }
}
