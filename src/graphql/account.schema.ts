import { composeMongoose } from 'graphql-compose-mongoose'
import { ObjectTypeComposerFieldConfigMapDefinition } from 'graphql-compose'
import { Account } from '../model/account';

export const AccountTC = composeMongoose(Account)

export const accountQueries: ObjectTypeComposerFieldConfigMapDefinition<any, any> = {
  accountById: AccountTC.mongooseResolvers.findById()
};
