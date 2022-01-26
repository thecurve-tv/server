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
  for (const _id of accountIds) {
    await clearGames(_id)
  }
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
        startTime
      }
    }
  }`
}
export function getValidJoinGameQuery(gameId: string, player: typeof mockPlayers[0]) {
  return `mutation {
    gameJoin(
      _id: "${gameId}"
      playerName: "${player.name}"
    ) {
      game {
        startTime
        endTime
      }
      player {
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
  const res = await server.executeOperation(request, {
    req: {},
    res: {},
    ...context,
  })
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

export async function forceEndGame(server: ApolloServer, gameId: string, startTime: number, account: typeof mockPlayers[0]['account']) {
  const endTime = startTime + 1
  const res = await expectOperationToSucceed(
    server,
    {
      query: `mutation {
        gameUpdateById(
          _id: "${gameId}"
          record: {
            endTime: ${endTime}
          }
        ) {
          record {
            endTime
          }
        }
      }`,
    },
    { account, req: {}, res: {} },
  )
  expect(res.data?.gameUpdateById?.record?.endTime).toEqual(endTime)
  await new Promise(resolve => setTimeout(resolve, Math.max(0, endTime - Date.now()))) // wait for endTime
}
