import { ApolloServer } from 'apollo-server-express'
import { IAccount } from '../../src/models/account'
import { prepareApolloServer, prepareMongoDB } from '../setup'
import { ensureMongoDBDisconnected } from '../teardown'

let account: IAccount
let server: ApolloServer
beforeAll(async () => {
  account = await prepareMongoDB()
  server = prepareApolloServer(account)
})
afterAll(ensureMongoDBDisconnected)

describe('relation/players', () => {
  it.todo('works')
})

describe('query/myAccount', () => {
  it('works', async () => {
    const res = await server.executeOperation({
      query: `{
          myAccount {
            _id
            auth0Id
            email
          }
        }`,
    })
    expect(res.errors).toBeUndefined()
    expect(res.data?.myAccount).toMatchObject({
      _id: account.id,
      auth0Id: account.auth0Id,
      email: account.email,
    })
  })
})

describe('query/accountById', () => {
  it('returns own account', async () => {
    const res = await server.executeOperation({
      query: `{
          accountById(_id: "${account.id}") {
            _id
            auth0Id
            email
          }
        }`,
    })
    expect(res.errors).toBeUndefined()
    expect(res.data?.accountById).toMatchObject({
      _id: account.id,
      auth0Id: account.auth0Id,
      email: account.email,
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
        }`,
    })
    expect(res.errors).toBeUndefined()
    expect(res.data?.accountById).toBeNull()
  })
})
