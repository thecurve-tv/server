import { ApolloServer } from 'apollo-server-express'
import { IAccount } from '../../src/models/account'
import { clearAllGames } from '../data'
import { prepareMongoDB, prepareApolloServer } from '../setup'
import { ensureMongoDBDisconnected } from '../teardown'

/* ==================== */

let account: IAccount
let _server: ApolloServer
beforeAll(async () => {
  account = await prepareMongoDB()
  _server = prepareApolloServer()
})
beforeEach(async () => await clearAllGames(account))
afterAll(ensureMongoDBDisconnected)

/* ==================== */

describe('relation/account', () => {
  it.todo('works')
})

describe('relation/game', () => {
  it.todo('works')
})

describe('relation/photo', () => {
  it.todo('works')
})

describe('relation/chats', () => {
  it.todo('works')
})

describe('query/playerMany', () => {
  it.todo('works')
  it.todo('redacts players requester has not played with')
})

describe('mutation/playerUpdateById', () => {
  it.todo('works')
  it.todo('fails if game is closed')
  it.todo('fails if not editing own player')
})
