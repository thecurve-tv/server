import { SchemaComposer, schemaComposer as _schemaComposer } from 'graphql-compose'
import { Account } from '@thecurve-tv/mongo-models/account'
import { ResolverContext } from '../resolver-context'
import { AccountTC } from '../types'

const schemaComposer: SchemaComposer<ResolverContext> = _schemaComposer

export interface MyAccountQueryResolverArgs {}
export default schemaComposer.createResolver<any, MyAccountQueryResolverArgs>({
  name: 'MyAccountQueryResolver',
  type: AccountTC.getType(),
  args: {},
  resolve: async ({ context }) => {
    const fullAccountDoc = await Account.findById(context.account._id)
    return fullAccountDoc
  },
})
