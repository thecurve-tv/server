import { ObjectTypeComposerFieldConfigMapDefinition } from 'graphql-compose'
import { IRanking } from '../../models/ranking'
import { ResolverContext } from '../resolver-context'
import { guardResolver } from '../guard'
import { RankingTC, GameTC } from '../types'
import { CanEditRankingGuard, CanStartRankingGuard, CanViewRankingGuard, ContainsOnlyVisibleRankingsGuard } from './ranking.guards'
import rankingPutRatingsMutationResolver from './ranking-put-ratings.mutation.resolver'
import rankingStartMutationResolver from './ranking-start.mutation.resolver'

// normalised relations
RankingTC.addRelation('game', {
  resolver: () => GameTC.mongooseResolvers.findById(),
  prepareArgs: {
    _id: ranking => ranking.game,
  },
  projection: { game: 1 },
})

export const rankingQueries: ObjectTypeComposerFieldConfigMapDefinition<IRanking, ResolverContext> = {
  rankingById: guardResolver(RankingTC.mongooseResolvers.findById(), new CanViewRankingGuard()),
  rankingMany: guardResolver(RankingTC.mongooseResolvers.findMany(), new ContainsOnlyVisibleRankingsGuard()),
}

export const rankingMutations: ObjectTypeComposerFieldConfigMapDefinition<IRanking, ResolverContext> = {
  rankingStart: guardResolver(rankingStartMutationResolver, new CanStartRankingGuard()),
  rankingPutRatings: guardResolver(rankingPutRatingsMutationResolver, new CanEditRankingGuard()),
}
