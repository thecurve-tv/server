import { ApolloServer } from 'apollo-server-express'
import { IAccount } from '../../src/models/account'
import {
  clearAllGames,
  expectOperationToFail,
  expectOperationToSucceed,
  forceEndGame,
  getValidJoinGameQuery,
  getValidStartGameQuery,
  maxGameDuration,
  minGameDuration,
  mockPlayers,
} from '../data'
import { prepareMongoDB, prepareApolloServer } from '../setup'
import { ensureMongoDBDisconnected } from '../teardown'

/* ==================== */

let account: IAccount
let server: ApolloServer
beforeAll(async () => {
  account = await prepareMongoDB()
  server = prepareApolloServer()
})
beforeEach(async () => await clearAllGames(account), 10000)
afterAll(ensureMongoDBDisconnected)

/* ==================== */

describe('relation/hostAccount', () => {
  it('works', async () => {
    const res = await expectOperationToSucceed(server, {
      query: `mutation {
          gameStart(
            hostPlayerName: "${mockPlayers[0].name}"
            maxPlayerCount: 4
            duration: ${minGameDuration}
          ) {
            game {
              hostAccount {
                _id
              }
            }
          }
        }`,
    })
    expect(res.data?.gameStart?.game?.hostAccount?._id).toEqual(mockPlayers[0].account._id)
  })
})

describe('relation/mainChat', () => {
  it('works', async () => {
    const res = await expectOperationToSucceed(server, {
      query: `mutation {
          gameStart(
            hostPlayerName: "${mockPlayers[0].name}"
            maxPlayerCount: 4
            duration: ${minGameDuration}
          ) {
            game {
              mainChat {
                _id
                name
              }
            }
          }
        }`,
    })
    const chat = res.data?.gameStart.game.mainChat
    expect(chat._id).toBeTruthy()
    expect(chat.name).toEqual('Curve Chat')
  })
})

describe('relation/chats', () => {
  it('works', async () => {
    const res = await expectOperationToSucceed(server, {
      query: `mutation {
          gameStart(
            hostPlayerName: "${mockPlayers[0].name}"
            maxPlayerCount: 4
            duration: ${minGameDuration}
          ) {
            game {
              chats {
                _id
                name
              }
            }
          }
        }`,
    })
    const chats = res.data?.gameStart.game.chats
    expect(chats).toHaveLength(1)
    expect(chats[0]._id).toBeTruthy()
    expect(chats[0].name).toEqual('Curve Chat')
  })
})

describe('relation/players', () => {
  it('works', async () => {
    const res = await expectOperationToSucceed(server, {
      query: `mutation {
          gameStart(
            hostPlayerName: "${mockPlayers[0].name}"
            maxPlayerCount: 4
            duration: ${minGameDuration}
          ) {
            game {
              players {
                _id
                name
              }
            }
          }
        }`,
    })
    const players = res.data?.gameStart.game.players
    expect(players).toHaveLength(1)
    expect(players[0]._id).toBeTruthy()
    expect(players[0].name).toEqual(mockPlayers[0].name)
  })
})

describe('query/gameById', () => {
  it('works', async () => {
    const res = await expectOperationToSucceed(server, { query: getValidStartGameQuery() })
    await expectOperationToSucceed(server, {
      query: `{
        gameById(
          _id: "${res.data?.gameStart?.game?._id}"
        ) {
          _id
        }
      }`,
    })
  })
  it('fails if not own game', async () => {
    // start game as p2
    let res = await expectOperationToSucceed(
      server,
      { query: getValidStartGameQuery(mockPlayers[1]) },
      { account: mockPlayers[1].account, req: {}, res: {} },
    )
    res = await expectOperationToSucceed(server, {
      query: `{
        gameById(
          _id: "${res.data?.gameStart?.game?._id}"
        ) {
          _id
        }
      }`,
    })
    expect(res.data?.gameById).toBeFalsy()
  })
})

describe('query/gameGetInvite', () => {
  it('works', async () => {
    let res = await expectOperationToSucceed(server, { query: getValidStartGameQuery() })
    res = await expectOperationToSucceed(server, {
      query: `{
        gameGetInvite(
          gameId: "${res.data?.gameStart?.game?._id}"
        ) {
          gameStatus
        }
      }`,
    })
    expect(res.data?.gameGetInvite?.gameStatus).toEqual('OPEN')
  })
})

describe('mutation/gameStart', () => {
  it('works', async () => {
    const res = await expectOperationToSucceed(server, { query: getValidStartGameQuery() })
    expect(res.data?.gameStart?.game?._id).toBeTruthy()
  })
  it('fails for duration < 3hrs', async () => {
    const res = await expectOperationToFail(
      server,
      `Games cannot last < ${minGameDuration} milliseconds`,
      {
        query: `mutation {
          gameStart(
            hostPlayerName: "${mockPlayers[0].name}"
            maxPlayerCount: 4
            duration: ${minGameDuration - 1}
          ) {
            game {
              _id
            }
          }
        }`,
      },
    )
    expect(res.data?.gameStart).toBeNull()
  })
  it('fails for duration > 5hrs', async () => {
    const res = await expectOperationToFail(
      server,
      `Games cannot last > ${maxGameDuration} milliseconds`,
      {
        query: `mutation {
          gameStart(
            hostPlayerName: "${mockPlayers[0].name}"
            maxPlayerCount: 4
            duration: ${maxGameDuration + 1}
          ) {
            game {
              _id
            }
          }
        }`,
      },
    )
    expect(res.data?.gameStart).toBeNull()
  })
  it('fails if already hosting game', async () => {
    await expectOperationToSucceed(server, { query: getValidStartGameQuery() })
    await expectOperationToFail(
      server,
      'You may not host > 1 Game at a time',
      { query: getValidStartGameQuery() },
    )
  })
})

describe('mutation/gameStop', () => {
  it('works', async () => {
    let res = await expectOperationToSucceed(server, { query: getValidStartGameQuery() })
    const gameId = res.data?.gameStart?.game?._id
    res = await expectOperationToSucceed(server, {
      query: `mutation {
        gameStop(
          _id: "${gameId}"
        ) {
          _id
        }
      }`,
    })
    expect(res.data?.gameStop._id).toEqual(gameId)
  })
  it('fails if requester is not host', async () => {
    // start game as p2
    let res = await expectOperationToSucceed(
      server,
      { query: getValidStartGameQuery(mockPlayers[1]) },
      { account: mockPlayers[1].account, req: {}, res: {} },
    )
    res = await expectOperationToFail(
      server,
      'You must be the game host to do that',
      {
        query: `mutation {
          gameStop(
            _id: "${res.data?.gameStart?.game?._id}"
          ) {
            _id
          }
        }`,
      },
    )
    expect(res.data?.gameStop).toBeFalsy()
  })
})

describe('mutation/gameJoin', () => {
  const joinGame = (gameId: string, player: typeof mockPlayers[0]) => expectOperationToSucceed(
    server,
    { query: getValidJoinGameQuery(gameId, player) },
    { account: player.account, req: {}, res: {} },
  )

  it('works', async () => {
    // start game as p2
    const res = await expectOperationToSucceed(
      server,
      { query: getValidStartGameQuery(mockPlayers[1]) },
      { account: mockPlayers[1].account, req: {}, res: {} },
    )
    await joinGame(res.data?.gameStart?.game?._id, mockPlayers[0])
  })
  it('fails if game is closed', async () => {
    // start game as p2
    const res = await expectOperationToSucceed(
      server,
      { query: getValidStartGameQuery(mockPlayers[1]) },
      { account: mockPlayers[1].account, req: {}, res: {} },
    )
    const game = res.data?.gameStart?.game
    await forceEndGame(server, game._id, game.startTime, mockPlayers[1].account)
    await expectOperationToFail(
      server,
      'There is no ongoing game with that id',
      { query: getValidJoinGameQuery(game._id, mockPlayers[0]) },
    )
  })
  it('fails if game is full', async () => {
    // start game as p2
    const res = await expectOperationToSucceed(
      server,
      { query: getValidStartGameQuery(mockPlayers[1]) },
      { account: mockPlayers[1].account, req: {}, res: {} },
    )
    const gameId = res.data?.gameStart?.game?._id
    await joinGame(gameId, mockPlayers[2]) // join as p3
    await joinGame(gameId, mockPlayers[3]) // join as p4
    await joinGame(gameId, mockPlayers[4]) // join as p5; game is now full
    // join as p1
    await expectOperationToFail(
      server,
      'This game is full',
      { query: getValidJoinGameQuery(gameId, mockPlayers[0]) },
    )
  })
})

describe('mutation/gameUpdateById', () => {
  it('works', async () => {
    const res = await expectOperationToSucceed(server, { query: getValidStartGameQuery(mockPlayers[1]) })
    await expectOperationToSucceed(
      server,
      {
        query: `mutation {
          gameUpdateById(
            _id: "${res.data?.gameStart?.game?._id}"
            record: {
              maxPlayerCount: 5
            }
          ) {
            record {
              _id
            }
          }
        }`,
      },
    )
  })
  it('fails if requester is not host', async () => {
    const res = await expectOperationToSucceed(
      server,
      { query: getValidStartGameQuery(mockPlayers[1]) },
      { account: mockPlayers[1].account },
    )
    await expectOperationToFail(
      server,
      'You must be the game host to do that',
      {
        query: `mutation {
          gameUpdateById(
            _id: "${res.data?.gameStart?.game?._id}"
            record: {
              maxPlayerCount: 5
            }
          ) {
            record {
              _id
            }
          }
        }`,
      },
    )
  })
  it('fails if game is closed', async () => {
    const res = await expectOperationToSucceed(
      server,
      { query: getValidStartGameQuery(mockPlayers[1]) },
      { account: mockPlayers[1].account, req: {}, res: {} },
    )
    const game = res.data?.gameStart?.game
    await forceEndGame(server, game._id, game.startTime, mockPlayers[1].account)
    await expectOperationToFail(
      server,
      'There is no ongoing game with that id',
      {
        query: `mutation {
          gameUpdateById(
            _id: "${game._id}"
            record: {
              maxPlayerCount: 5
            }
          ) {
            record {
              _id
            }
          }
        }`,
      },
    )
  })
})
