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

describe('relation/player', () => {
  it.todo('works')
})
