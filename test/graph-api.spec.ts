import { ResolverContext } from '../src/graphql/resolver-context'
import { Account, IAccount } from '../src/models/account'
import { environment } from './environment'
import { ensureMongoDBConnected } from './setup'
import { ensureMongoDBDisconnected } from './teardown'
import myAccountQueryResolver from '../src/graphql/account/my-account.query.resolver'

let account: IAccount

beforeAll(async () => {
  await ensureMongoDBConnected()
  await Account.deleteMany({ auth0Id: environment.AUTH0_USER.id })
  await Account.create([{
    auth0Id: environment.AUTH0_USER.id,
    email: environment.AUTH0_USER.email
  }])
  account = await Account.findOne({ auth0Id: environment.AUTH0_USER.id }).lean(true)
})
afterAll(ensureMongoDBDisconnected)

function getMockContext(): ResolverContext {
  let req: any, res: any
  return { account, req, res }
}

describe('GraphQL/account/myAccount', () => {
  it('works', async () => {
    const res = await myAccountQueryResolver.resolve({ context: getMockContext() })
    expect(res).toMatchObject(account)
  })
})
