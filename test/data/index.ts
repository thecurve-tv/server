import { ApolloServer } from 'apollo-server-express'
import { GraphQLResponse } from 'graphql-extensions'
import { IAccount } from '../../src/models/account'
import { clearGames } from '../../src/routes/_test'
import mongo from './mongo-test-data.json'

export const mockPlayers = mongo.accounts.map(account => ({
  name: account.auth0Id.replace('auth0|', ''),
  account,
}))
export const minGameDuration = 3 * 60 * 60 * 1000
export const maxGameDuration = 5 * 60 * 60 * 1000

export async function clearAllGames(account: IAccount) {
  const accountIds = new Set([ account._id.toHexString(), ...mongo.accounts.map(a => a._id) ])
  const promises = []
  for (const _id of accountIds) promises.push(clearGames(_id))
  await Promise.all(promises)
}

export function getValidStartGameQuery(hostPlayer: typeof mockPlayers[0] = mockPlayers[0]) {
  return `mutation {
    gameStart(
      hostPlayerName: "${hostPlayer.name}"
      maxPlayerCount: 4
      duration: ${minGameDuration}
    ) {
      game {
        _id
      }
    }
  }`
}

/**
 * Awaits server operation & expects `res.errors` to be falsy
 */
export async function expectOperationToSucceed(
  server: ApolloServer,
  request: Parameters<typeof server.executeOperation>[0],
  context?: Parameters<typeof server.executeOperation>[1],
  debug?: (res: GraphQLResponse) => void,
) {
  const res = await server.executeOperation(request, context)
  if (debug) debug(res)
  expect(res.errors).toBeFalsy()
  return res
}

/**
 * Awaits server operation
 * & expects `res.errors` to have 1 element
 * & expects `res.errors[0].message` to contain `expectedError`
 */
export async function expectOperationToFail(
  server: ApolloServer,
  expectedError: string,
  request: Parameters<typeof server.executeOperation>[0],
  context?: Parameters<typeof server.executeOperation>[1],
  debug?: (res: GraphQLResponse) => void,
) {
  const res = await server.executeOperation(request, context)
  if (debug) debug(res)
  expect(res.errors).toHaveLength(1)
  expect(res.errors && res.errors[0].message).toContain(expectedError)
  return res
}
