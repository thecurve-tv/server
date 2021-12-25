import { SchemaComposer, schemaComposer as _schemaComposer } from 'graphql-compose'
import { Account } from '../../models/account'
import { ResolverContext } from '../resolver-context'
import { AccountTC } from '../types'

const schemaComposer: SchemaComposer<ResolverContext> = _schemaComposer

export default schemaComposer.createResolver<unknown, Record<string, unknown>>({
  name: 'MyAccountQueryResolver',
  type: AccountTC.getType(),
  args: {},
  resolve: async ({ context }) => {
    const fullAccountDoc = await Account.findById(context.account._id).lean(true)
    return fullAccountDoc
  },
})
