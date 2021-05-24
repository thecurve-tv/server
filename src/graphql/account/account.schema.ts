import { ObjectTypeComposerFieldConfigMapDefinition } from 'graphql-compose'
import { IAccount } from '../../model/account'
import { ResolverContext } from '../graphql'
import { guardResolver } from '../guard'
import { AccountTC, PlayerTC } from '../types'
import IsOwnAccountGuard from './is-own-account.guard'
import myAccountQueryResolver from './my-account.query.resolver'

// non-normalised relations
AccountTC.addRelation('players', {
  resolver: () => PlayerTC.mongooseResolvers.findMany(),
  prepareArgs: {
    filter: account => ({ account: account._id })
  },
  projection: { _id: 1 }
})

export const accountQueries: ObjectTypeComposerFieldConfigMapDefinition<IAccount, ResolverContext> = {
  myAccount: myAccountQueryResolver,
  accountById: guardResolver(AccountTC.mongooseResolvers.findById(), new IsOwnAccountGuard())
}
