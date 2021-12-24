import axios from 'axios'
import { Account } from '../../src/models/account'
import { environment } from '../environment'
import { ensureMongoDBConnected } from '../setup'
import { ensureMongoDBDisconnected } from '../teardown'

beforeAll(ensureMongoDBConnected)
afterAll(ensureMongoDBDisconnected)

describe('REST/accounts', () => {
  it('POST ./', async () => {
    await Account.deleteMany({ auth0Id: environment.AUTH0_USER.id })
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
