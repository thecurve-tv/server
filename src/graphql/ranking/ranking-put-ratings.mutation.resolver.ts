import { ObjectId } from 'bson'
import { ResolverResolveParams, SchemaComposer, schemaComposer as _schemaComposer } from 'graphql-compose'
import { Player } from '../../models/player'
import { Ranking } from '../../models/ranking'
import { ResolverContext } from '../resolver-context'
import { GraphErrorResponse } from '../types'

const schemaComposer: SchemaComposer<ResolverContext> = _schemaComposer

export interface RankingPutRatingsMutationResolverArgs {
  _id: ObjectId
  ratings: {
    player: string
    position: number
  }[]
}
export default schemaComposer.createResolver<unknown, RankingPutRatingsMutationResolverArgs>({
  name: 'RankingPutRatingsMutationResolver',
  type: 'Boolean',
  args: {
    _id: 'MongoID!',
    ratings: schemaComposer.createObjectTC({
      name: 'RankingRating',
      fields: {
        player: 'String!',
        position: 'Int!',
      },
    }).getITC().NonNull.List.NonNull,
  },
  resolve: resolveRankingPutRatingsMutation,
})

async function resolveRankingPutRatingsMutation(
  { args, context }: ResolverResolveParams<unknown, ResolverContext, RankingPutRatingsMutationResolverArgs>,
): Promise<boolean> {
  const now = Date.now()
  const ranking = await Ranking.findById(args._id)
  if (!ranking) {
    throw new GraphErrorResponse(404, 'There is not ranking with that id')
  }
  const numOtherPlayers = await validateRatings(ranking.game as ObjectId, args.ratings)
  const playerDoingRating = await Player.findOne(
    { game: ranking.game, account: context.account._id },
    { _id: 1 },
  )
  if (!playerDoingRating) {
    throw new GraphErrorResponse(500, "Couldn't find playerDoingRating")
  }
  const ratings = new Map<string, number>(
    args.ratings.map(rating => {
      return [ rating.player, rating.position ]
    }),
  )
  ranking.ratings.set(playerDoingRating._id.toHexString(), ratings)
  if (ranking.ratings.size == numOtherPlayers + 1) {
    ranking.completedTime = now
  }
  await ranking.save()
  return true
}

async function validateRatings(gameId: ObjectId, ratings: RankingPutRatingsMutationResolverArgs['ratings']) {
  const players = await Player.find({ game: gameId }, { _id: 1 })
  const numOtherPlayers = players.length - 2 // minus host, minus self
  if (ratings.length != numOtherPlayers) {
    throw new GraphErrorResponse(400, 'You must rate all other players')
  }
  const providedIdsMatch = ratings.every(rating => players.some(p => p._id.equals(rating.player)))
  if (!providedIdsMatch) {
    throw new GraphErrorResponse(400, 'Each rating must refer to a player in this game')
  }
  const positions = ratings.map(r => r.position)
  if (Math.min(...positions) != 1) {
    throw new GraphErrorResponse(400, 'Positions must start at 1')
  }
  positions.sort().reduce((prev, cur) => {
    if (cur != prev + 1) {
      throw new GraphErrorResponse(400, 'Positions must be consecutive')
    }
    return cur
  }, 0)
  return numOtherPlayers
}
