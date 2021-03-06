/* eslint-disable @typescript-eslint/no-explicit-any */
import { ObjectId } from 'bson'
import { Game, IGame } from '../../models/game'
import { Player } from '../../models/player'
import { IRanking, Ranking } from '../../models/ranking'
import { getActiveGame } from '../game/game-join.mutation.resolver'
import { Guard, GuardInput, GuardOutput } from '../guard'
import { FindByIdArgs, FindManyArgs } from '../mongoose-resolvers'
import { ResolverContext } from '../resolver-context'
import { GraphErrorResponse } from '../types'
import { RankingPutRatingsMutationResolverArgs } from './ranking-put-ratings.mutation.resolver'

export class CanStartRankingGuard extends Guard<ResolverContext, any, IRanking> {
  constructor() {
    super('ingress')
  }
  async check(
    { context, args: _args }: GuardInput<ResolverContext, any, IRanking>,
  ): Promise<void | GuardOutput<any, IRanking>> {
    const args = _args as {game: ObjectId}
    const now = Date.now()
    const game = await getActiveGame(args.game, now, true, { hostAccount: 1 })
    if (!context.account._id.equals(game.hostAccount as ObjectId)) {
      throw new GraphErrorResponse(403, 'You must be the game host to do that')
    }
    const openRanking = await Ranking.findOne({
      game: game._id,
      completedTime: { $exists: false },
    }, { _id: 1 })
    if (openRanking) {
      throw new GraphErrorResponse(403, 'You cannot run 2 rankings at the same time')
    }
  }
}

export class CanViewRankingGuard extends Guard<ResolverContext, FindByIdArgs, IRanking> {
  constructor() {
    super('egress')
  }
  async check(
    { context, data }: GuardInput<ResolverContext, FindByIdArgs, IRanking>,
  ): Promise<void | GuardOutput<FindByIdArgs, IRanking>> {
    if (!data) return
    const ranking = await Ranking.findById(data._id, { game: 1 })
      .populate('game', { hostAccount: 1 })
    if (!ranking?.game) {
      throw new GraphErrorResponse(500, 'Failed to check CanViewRankingGuard: game is null')
    }
    if (!context.account._id.equals((ranking.game as IGame).hostAccount as ObjectId)) {
      return { data: false }
    }
  }
}

export class CanEditRankingGuard extends Guard<ResolverContext, RankingPutRatingsMutationResolverArgs, IRanking> {
  constructor() {
    super('ingress')
  }
  async check(
    { context, args }: GuardInput<ResolverContext, RankingPutRatingsMutationResolverArgs, IRanking>,
  ): Promise<void | GuardOutput<RankingPutRatingsMutationResolverArgs, IRanking>> {
    const now = Date.now()
    const ranking = await Ranking.findById(args._id, { game: 1, completedTime: 1 })
    if (!ranking) {
      return
    }
    if (ranking.completedTime != null && ranking.completedTime <= now) {
      throw new GraphErrorResponse(403, 'You cannot submit ratings after the ranking has closed')
    }
    const player = await Player.findOne({ game: ranking.game, account: context.account._id }, { game: 1 })
      .populate('game', { endTime: 1, pausedTime: 1 })
    if (!player) {
      throw new GraphErrorResponse(403, 'You must be a player in the game to add ratings')
    }
    const game = <IGame>player.game
    if (game.pausedTime) {
      throw new GraphErrorResponse(403, 'You cannot submit ratings while the game is paused')
    }
    if (game.endTime <= now) {
      throw new GraphErrorResponse(403, 'You cannot submit ratings after the game has ended')
    }
  }
}

export class ContainsOnlyVisibleRankingsGuard extends Guard<ResolverContext, FindManyArgs, any> {
  constructor() {
    super('egress')
  }
  async check(
    { context, data }: GuardInput<ResolverContext, FindManyArgs, any>,
  ): Promise<void | GuardOutput<FindManyArgs, any>> {
    const rankings = data as IRanking[]
    if (!rankings || rankings.length == 0) return
    const aggregationResult: IRanking[] = await Ranking.aggregate([
      { $match: { _id: { $in: rankings.map(r => r._id) } } },
      {
        $lookup: {
          from: Game.collection.name,
          localField: 'game',
          foreignField: '_id',
          as: 'game',
        },
      },
      {
        $match: {
          $or: [
            { 'game.hostAccount': context.account._id }, // if host then you can see all rankings
            { completedTime: { $exists: true } }, // else can only see closed rankings
          ],
        },
      },
    ])
    const mutatedData: IRanking[] = []
    for (const ranking of rankings) {
      const rankingIsCompletelyVisible = aggregationResult.some(r => r._id.equals(ranking._id))
      if (!rankingIsCompletelyVisible) {
        // partially-visible = can only see own ratings
        // (Query: rankingsMany) can show rankings from various games, so cannot do a bulk search for the player associated with the requester
        let gameId
        if (ranking.game) {
          gameId = (ranking.game as ObjectId).toHexString()
        } else {
          const fatRanking = await Ranking.findById(ranking._id, { game: 1 })
          if (fatRanking) gameId = (fatRanking.game as ObjectId).toHexString()
        }
        const player = await Player.findOne({ game: gameId, account: context.account._id }, { _id: 1 })
        if (!player?._id) {
          // skip this ranking because we cannot identify whose ratings are whose
          // NOTE: this will happen if a Query neither populates the Ranking.game field nor the Ranking._id field
          continue
        }
        const playerId = player._id.toHexString()
        const mutatedRatings: IRanking['ratings'] = new Map()
        const ownRatings = ranking.ratings.get(playerId)
        if (ownRatings) mutatedRatings.set(playerId, ownRatings)
        ranking.ratings = mutatedRatings
      }
      mutatedData.push(ranking)
    }
    return { data: mutatedData }
  }
}
