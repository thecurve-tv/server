import { ExpressContext } from 'apollo-server-express'
import { IAccount } from '../models/account'

export interface ResolverContext extends ExpressContext {
  account: IAccount & { _id: NonNullable<IAccount['_id']> } // we assert that _id will always be available
}
