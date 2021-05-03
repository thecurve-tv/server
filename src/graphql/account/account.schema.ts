import { composeMongoose } from 'graphql-compose-mongoose'
import { ObjectTypeComposerFieldConfigMapDefinition } from 'graphql-compose'
import { Account, IAccount } from '../../model/account';
import { ResolverContext } from '../graphql';

export const AccountTC = composeMongoose(Account)

export const accountQueries: ObjectTypeComposerFieldConfigMapDefinition<IAccount, ResolverContext> = {
  accountById: AccountTC.mongooseResolvers.findById()
};
