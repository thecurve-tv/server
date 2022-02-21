import { Server } from 'http'
import { launchExpressServer } from '../setup'
import { shutdownExpressServer } from '../teardown'

let server: Server

beforeAll(async () => server = await launchExpressServer())
afterAll(async () => await shutdownExpressServer(server))

describe('REST/players', () => {
  describe('GET ./:playerId/photo', () => {
    it.todo('works')
    it.todo('fails if player not found')
    it.todo('fails if requester not in same game as player')
    it.todo('fails if player has no photo')
  })
})
