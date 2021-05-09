import { ObjectTypeComposerFieldConfigMapDefinition } from 'graphql-compose'
import { IAccount } from '../../model/account'
import { ResolverContext } from '../graphql'
import { AccountTC } from '../types'

export const accountQueries: ObjectTypeComposerFieldConfigMapDefinition<IAccount, ResolverContext> = {
  accountById: AccountTC.mongooseResolvers.findById()
}
