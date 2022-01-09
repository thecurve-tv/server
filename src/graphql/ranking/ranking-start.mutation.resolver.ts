import { ObjectId } from 'bson'
import { ResolverResolveParams, SchemaComposer, schemaComposer as _schemaComposer } from 'graphql-compose'
import { IRanking, Ranking } from '../../models/ranking'
import { IDraftDocument } from '../../models/_defaults'
import { getActiveGame } from '../game/game-join.mutation.resolver'
import { ResolverContext } from '../resolver-context'
import { RankingTC } from '../types'

const schemaComposer: SchemaComposer<ResolverContext> = _schemaComposer

export interface RankingStartMutationResolverArgs {
  game: ObjectId
}
export default schemaComposer.createResolver<unknown, RankingStartMutationResolverArgs>({
  name: 'RankingStartMutationResolver',
  type: RankingTC,
  args: {
    game: 'MongoID!',
  },
  resolve: resolveRankingStartMutation,
})

async function resolveRankingStartMutation(
  { args }: ResolverResolveParams<unknown, ResolverContext, RankingStartMutationResolverArgs>,
): Promise<IRanking> {
  const now = Date.now()
  const game = await getActiveGame(args.game, now, true, { _id: 1 })
  const rankingDoc: IDraftDocument<IRanking> = {
    game: game._id,
    ratings: new Map(),
  }
  const [ ranking ] = await Ranking.create([ rankingDoc ])
  return ranking
}
