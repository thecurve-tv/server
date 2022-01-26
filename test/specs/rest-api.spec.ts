import axios from 'axios'
import { Account } from '../../src/models/account'
import { environment } from '../environment'
import { ensureMongoDBConnected } from '../setup'
import { ensureMongoDBDisconnected } from '../teardown'

beforeAll(ensureMongoDBConnected)
afterAll(ensureMongoDBDisconnected)

describe('REST/accounts', () => {
  test('POST ./', async () => {
    await Account.deleteMany({ email: environment.AUTH0_USER.email })
    const reqData = {
      auth0Id: environment.AUTH0_USER.id,
      email: environment.AUTH0_USER.email,
    }
    const res = await axios.post(`${environment.TEST_SERVER_DOMAIN}/accounts`, reqData)
    expect(res.status).toEqual(201)
    const docId = res.data._id
    const doc = await Account.findById(docId)
    expect(doc).toBeTruthy()
    expect(doc).toMatchObject(reqData)
  })
})

describe('REST/players', () => {
  describe('GET ./:playerId/photo', () => {
    it.todo('works')
    it.todo('fails if player not found')
    it.todo('fails if requester not in same game as player')
    it.todo('fails if player has no photo')
  })
})
