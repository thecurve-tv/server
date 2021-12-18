import { ApolloServer } from 'apollo-server-express'
import { Account, IAccount } from '../src/models/account'
import { environment } from './environment'
import { ensureMongoDBConnected } from './setup'
import { ensureMongoDBDisconnected } from './teardown'
import Schema from '../src/graphql/schema'

let account: IAccount
let server: ApolloServer

function getMockContext() {
  let req: any, res: any
  return { account, req, res }
}

beforeAll(async () => {
  await ensureMongoDBConnected()
  await Account.deleteMany({ auth0Id: environment.AUTH0_USER.id })
  await Account.create([{
    auth0Id: environment.AUTH0_USER.id,
    email: environment.AUTH0_USER.email
  }])
  account = <IAccount>(await Account.findOne({ auth0Id: environment.AUTH0_USER.id }))
  server = new ApolloServer({
    schema: Schema,
    context: getMockContext,
  })
})
afterAll(ensureMongoDBDisconnected)

describe('GraphQL/myAccount', () => {
  it('works', async () => {
    const res = await server.executeOperation({
      query: `{
        myAccount {
          _id
          auth0Id
          email
        }
      }`
    })
    expect(res.errors).toBeUndefined()
    expect(res.data?.myAccount).toMatchObject({
      _id: account.id,
      auth0Id: account.auth0Id,
      email: account.email
    })
  })
})

describe('GraphQL/accountById', () => {
  it('returns own account', async () => {
    const res = await server.executeOperation({
      query: `{
        accountById(_id: "${account.id}") {
          _id
          auth0Id
          email
        }
      }`
    })
    expect(res.errors).toBeUndefined()
    expect(res.data?.accountById).toMatchObject({
      _id: account.id,
      auth0Id: account.auth0Id,
      email: account.email
    })
  })
  it('blocks other accounts', async () => {
    const fakeId = account.id.charAt(0) == 'a' ? `b${account.id.substr(1)}` : `a${account.id.substr(1)}`
    const res = await server.executeOperation({
      query: `{
        accountById(_id: "${fakeId}") {
          _id
          auth0Id
          email
        }
      }`
    })
    expect(res.errors).toBeUndefined()
    expect(res.data?.accountById).toBeNull()
  })
})
