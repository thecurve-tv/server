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

describe('relation/game', () => {
  it.todo('works')
})

describe('relation/players', () => {
  it.todo('works')
})

describe('query/chatMany', () => {
  it.todo('works')
  it.todo('redacts chats requester is not in')
})

describe('mutation/chatCreate', () => {
  it.todo('works')
})

describe('mutation/chatSendMessage', () => {
  it.todo('works')
})

describe('subscription/chatMessages', () => {
  it.todo('works')
})
