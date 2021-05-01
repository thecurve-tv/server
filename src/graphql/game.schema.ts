import { composeMongoose } from 'graphql-compose-mongoose'
import { ObjectTypeComposerFieldConfigMapDefinition } from 'graphql-compose'
import { Game } from '../model/game';
import { AccountTC } from './account.schema';

export const GameTC = composeMongoose(Game)
GameTC.addRelation(
  'hostAccount',
  {
    resolver: () => AccountTC.mongooseResolvers.findById(),
    prepareArgs: {
      _id: game => game.hostAccount,
    },
    projection: { hostAccount: 1 }
  }
)

export const gameQueries: ObjectTypeComposerFieldConfigMapDefinition<any, any> = {
  gameById: GameTC.mongooseResolvers.findById(),
  gameByIds: GameTC.mongooseResolvers.findByIds(),
  gameOne: GameTC.mongooseResolvers.findOne(),
  gameMany: GameTC.mongooseResolvers.findMany(),
  gameDataLoader: GameTC.mongooseResolvers.dataLoader(),
  gameDataLoaderMany: GameTC.mongooseResolvers.dataLoaderMany(),
  gameByIdLean: GameTC.mongooseResolvers.findById({ lean: true }),
  gameByIdsLean: GameTC.mongooseResolvers.findByIds({ lean: true }),
  gameOneLean: GameTC.mongooseResolvers.findOne({ lean: true }),
  gameManyLean: GameTC.mongooseResolvers.findMany({ lean: true }),
  gameDataLoaderLean: GameTC.mongooseResolvers.dataLoader({ lean: true }),
  gameDataLoaderManyLean: GameTC.mongooseResolvers.dataLoaderMany({ lean: true }),
  gameCount: GameTC.mongooseResolvers.count(),
  gameConnection: GameTC.mongooseResolvers.connection(),
  gamePagination: GameTC.mongooseResolvers.pagination(),
}

export const gameMutations: ObjectTypeComposerFieldConfigMapDefinition<any, any> = {
  gameCreateOne: GameTC.mongooseResolvers.createOne(),
  gameCreateMany: GameTC.mongooseResolvers.createMany(),
  gameUpdateById: GameTC.mongooseResolvers.updateById(),
  gameUpdateOne: GameTC.mongooseResolvers.updateOne(),
  gameUpdateMany: GameTC.mongooseResolvers.updateMany(),
  gameRemoveById: GameTC.mongooseResolvers.removeById(),
  gameRemoveOne: GameTC.mongooseResolvers.removeOne(),
  gameRemoveMany: GameTC.mongooseResolvers.removeMany(),
}