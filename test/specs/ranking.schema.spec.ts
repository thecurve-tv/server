import { ApolloServer } from 'apollo-server-express'
import { IAccount } from '../../src/models/account'
import { IPlayer, Player } from '../../src/models/player'
import { IRanking, Ranking } from '../../src/models/ranking'
import {
  clearAllGames,
  expectOperationToFail,
  expectOperationToSucceed,
  forceEndGame,
  getValidJoinGameQuery,
  getValidStartGameQuery,
  mockPlayers,
} from '../data'
import { prepareMongoDB, prepareApolloServer } from '../setup'
import { ensureMongoDBDisconnected } from '../teardown'

function getValidStartRankingQuery(gameId: string) {
  return `mutation {
    rankingStart(
      game: "${gameId}"
    ) {
      _id
    }
  }`
}

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

describe('relation/game', () => {
  it('works', async () => {
    let res = await expectOperationToSucceed(server, { query: getValidStartGameQuery(mockPlayers[0]) })
    res = await expectOperationToSucceed(server, { query: getValidStartRankingQuery(res.data?.gameStart?.game?._id) })
    res = await expectOperationToSucceed(server, {
      query: `{
        rankingById(
          _id: "${res.data?.rankingStart?._id}"
        ) {
          game {
            _id
          }
        }
      }`,
    })
    expect(res.data?.rankingById?.game?._id).toBeTruthy()
  })
})

describe('query/rankingById', () => {
  let rankingByIdQuery: string
  beforeEach(async () => {
    let res = await expectOperationToSucceed(server, { query: getValidStartGameQuery(mockPlayers[0]) })
    res = await expectOperationToSucceed(server, { query: getValidStartRankingQuery(res.data?.gameStart?.game?._id) })
    rankingByIdQuery = `{
      rankingById(
        _id: "${res.data?.rankingStart?._id}"
      ) {
        _id
      }
    }`
  })

  it('works', async () => {
    const res = await expectOperationToSucceed(server, { query: rankingByIdQuery })
    expect(res.data?.rankingById?._id).toBeTruthy()
  })
  it('redacts if not game host', async () => {
    const res = await expectOperationToSucceed(
      server,
      { query: rankingByIdQuery },
      { account: mockPlayers[1].account, req: {}, res: {} },
    )
    expect(res.data?.rankingById).toBeFalsy()
  })
})

describe('query/rankingMany', () => {
  let gameId: string
  let ranking: IRanking
  let rankingManyQuery: string
  beforeEach(async () => {
    // start game as p2
    let res = await expectOperationToSucceed(
      server,
      { query: getValidStartGameQuery(mockPlayers[0]) },
      { account: mockPlayers[1].account, req: {}, res: {} },
    )
    gameId = res.data?.gameStart?.game?._id
    res = await expectOperationToSucceed(
      server,
      { query: getValidStartRankingQuery(gameId) },
      { account: mockPlayers[1].account, req: {}, res: {} },
    )
    ranking = res.data?.rankingStart
    rankingManyQuery = `{
      rankingMany(
        filter: {
          game: "${gameId}"
        }
      ) {
        _id
        ratings
      }
    }`
  })

  it('works', async () => {
    const res = await expectOperationToSucceed(
      server,
      { query: rankingManyQuery },
      { account: mockPlayers[1].account, req: {}, res: {} },
    )
    expect(res.data?.rankingMany).toHaveLength(1)
  })
  it('works if not game host and ranking closed', async () => {
    await Ranking.updateOne(
      { _id: ranking._id },
      { completedTime: (ranking._log?.createdDate || 0) + 1 },
    )
    const res = await expectOperationToSucceed(server, { query: rankingManyQuery })
    expect(res.data?.rankingMany).toHaveLength(1)
  })
  it('redacts if not game host and ranking open', async () => {
    await expectOperationToSucceed(server, { query: getValidJoinGameQuery(gameId, mockPlayers[0]) })
    const player = <IPlayer>await Player.findOne({ game: gameId, account: mockPlayers[0].account._id }, { _id: 1 })
    const playerId = player._id.toHexString()
    const fatRanking = <IRanking>await Ranking.findById(ranking._id)
    expect(fatRanking).toBeTruthy()
    // this rating should be visible
    fatRanking.ratings.set(playerId, new Map([ [ 'some other player', 1 ] ]))
    // this rating should NOT be visible
    fatRanking.ratings.set('someone other player id', new Map([ [ playerId, 1 ] ]))
    await fatRanking.save()
    const res = await expectOperationToSucceed(server, { query: rankingManyQuery })
    expect(res.data?.rankingMany).toHaveLength(1)
    const ratings = res.data?.rankingMany[0].ratings as IRanking['ratings']
    expect([ ...ratings.keys() ]).toMatchObject([ playerId ]) // only have my own rating
  })
})

describe('mutation/rankingPutRatings', () => {
  let game: {_id: string, startTime: number, hostAccount: typeof mockPlayers[0]['account']}
  let rankingId: string
  /** p1=player, p2=host, p3=player, p4=player */
  const players: Record<string, {_id: string}> = {}
  beforeEach(async () => {
    // start game as p2
    let res = await expectOperationToSucceed(
      server,
      { query: getValidStartGameQuery(mockPlayers[0]) },
      { account: mockPlayers[1].account, req: {}, res: {} },
    )
    game = res.data?.gameStart?.game
    game.hostAccount = mockPlayers[1].account
    const joinGame = async (gameId: string, player: typeof mockPlayers[0]) => {
      const res = await expectOperationToSucceed(
        server,
        { query: getValidJoinGameQuery(gameId, player) },
        { account: player.account, req: {}, res: {} },
      )
      players[player.name] =  res.data?.gameJoin?.player
      return res
    }
    await joinGame(game._id, mockPlayers[0]) // p1 (me) joins
    await joinGame(game._id, mockPlayers[2]) // p3 joins
    await joinGame(game._id, mockPlayers[3]) // p4 joins
    // p2 (host) starts a ranking
    res = await expectOperationToSucceed(
      server,
      { query: getValidStartRankingQuery(game._id) },
      { account: mockPlayers[1].account, req: {}, res: {} },
    )
    rankingId = res.data?.rankingStart?._id
  }, 10000)

  function getValidPutRankingsQuery() {
    return `mutation {
      rankingPutRatings(
        _id: "${rankingId}"
        ratings: [
          {
            player: "${players[mockPlayers[3].name]._id}",
            position: 2
          },
          {
            player: "${players[mockPlayers[2].name]._id}",
            position: 1
          }
        ]
      )
    }`
  }

  it('works', async () => {
    // p1 (me) submits ratings
    await expectOperationToSucceed(server, { query: getValidPutRankingsQuery() })
    const ranking = await Ranking.findById(rankingId, { ratings: 1 })
    expect(ranking?.ratings?.size).toEqual(1)
  })
  it('fails if game is closed', async () => {
    await forceEndGame(server, game._id, game.startTime, game.hostAccount)
    await expectOperationToFail(
      server,
      'You cannot submit ratings after the game has ended',
      { query: getValidPutRankingsQuery() },
      { account: game.hostAccount, req: {}, res: {} },
    )
  })
  it('fails if ranking is closed', async () => {
    const getPutRankingsQuery = (otherPlayerIds: string[]) => `mutation {
      rankingPutRatings(
        _id: "${rankingId}"
        ratings: [
          {
            player: "${otherPlayerIds[0]}",
            position: 2
          },
          {
            player: "${otherPlayerIds[1]}",
            position: 1
          }
        ]
      )
    }`
    await expectOperationToSucceed(server,
      {
        query: getPutRankingsQuery([ // put as mockPlayers[0]
          players[mockPlayers[2].name]._id,
          players[mockPlayers[3].name]._id,
        ]),
      },
      { account: mockPlayers[0].account, req: {}, res: {} },
    )
    // mockPlayers[1] is host
    await expectOperationToSucceed(server,
      {
        query: getPutRankingsQuery([ // put as mockPlayers[2]
          players[mockPlayers[0].name]._id,
          players[mockPlayers[3].name]._id,
        ]),
      },
      { account: mockPlayers[2].account, req: {}, res: {} },
    )
    await expectOperationToSucceed(server,
      {
        query: getPutRankingsQuery([ // put as mockPlayers[3]
          players[mockPlayers[0].name]._id,
          players[mockPlayers[2].name]._id,
        ]),
      },
      { account: mockPlayers[3].account, req: {}, res: {} },
    )
    // once all ratings are submitted, ranking is closed
    await expectOperationToFail(
      server,
      'You cannot submit ratings after the ranking has closed',
      {
        query: getPutRankingsQuery([ // put as mockPlayers[0]
          players[mockPlayers[2].name]._id,
          players[mockPlayers[3].name]._id,
        ]),
      },
      { account: mockPlayers[0].account, req: {}, res: {} },
    )
  })
  it.todo('fails if requester not in game')
  it.todo('fails if requester is host')
  describe.each([
    { desc: 'You must rate all other players', ratings: [
      { player: mockPlayers[2].name, position: 1 },
    ] },
    { desc: 'Each rating must refer to a player in this game', ratings: [
      { player: 'name-not-registered', position: 1 },
      { player: mockPlayers[3].name, position: 2 },
    ] },
    { desc: 'Positions must start at 1', ratings: [
      { player: mockPlayers[2].name, position: 0 },
      { player: mockPlayers[3].name, position: 1 },
    ] },
    { desc: 'Positions must be consecutive', ratings: [
      { player: mockPlayers[2].name, position: 1 },
      { player: mockPlayers[3].name, position: 1 },
    ] },
  ])('invalid ratings', ({ desc, ratings: _ratings }) => {
    it.todo(`fails for ${desc}`)
  })
})

describe('mutation/rankingStart', () => {
  it('works', async () => {
    let res = await expectOperationToSucceed(server, { query: getValidStartGameQuery(mockPlayers[0]) })
    res = await expectOperationToSucceed(server, { query: getValidStartRankingQuery(res.data?.gameStart?.game?._id) })
    expect(res.data?.rankingStart?._id).toBeTruthy()
  })
  it('fails if game is closed', async () => {
    const res = await expectOperationToSucceed(server, { query: getValidStartGameQuery(mockPlayers[0]) })
    const game = res.data?.gameStart?.game
    await forceEndGame(server, game._id, game.startTime, mockPlayers[0].account)
    await expectOperationToFail(
      server,
      'There is no ongoing game with that id',
      { query: getValidStartRankingQuery(game._id) },
    )
  })
  it('fails if requester is not host', async () => {
    const res = await expectOperationToSucceed(
      server,
      { query: getValidStartGameQuery(mockPlayers[0]) },
      { account: mockPlayers[1].account, req: {}, res: {} },
    )
    await expectOperationToFail(
      server,
      'You must be the game host to do that',
      { query: getValidStartRankingQuery(res.data?.gameStart?.game?._id) },
    )
  })
  it('fails if there is another open ranking', async () => {
    let res = await expectOperationToSucceed(server, { query: getValidStartGameQuery(mockPlayers[0]) })
    const gameId = res.data?.gameStart?.game?._id
    res = await expectOperationToSucceed(server, { query: getValidStartRankingQuery(gameId) })
    await expectOperationToFail(
      server,
      'You cannot run 2 rankings at the same time',
      { query: getValidStartRankingQuery(gameId) },
    )
  })
})
