import { ObjectTypeComposerFieldConfigMapDefinition } from 'graphql-compose'
import { IPlayer } from '../../model/player'
import { ResolverContext } from '../graphql'
import { AccountTC, GameTC, PhotoTC, PlayerTC } from '../types'

PlayerTC.addRelation(
  'game',
  {
    resolver: () => GameTC.mongooseResolvers.findById(),
    prepareArgs: {
      _id: player => player.game,
    },
    projection: { game: 1 }
  }
)
PlayerTC.addRelation(
  'photo',
  {
    resolver: () => PhotoTC.mongooseResolvers.findById(),
    prepareArgs: {
      _id: player => player.photo,
    },
    projection: { photo: 1 }
  }
)
PlayerTC.addRelation(
  'account',
  {
    resolver: () => AccountTC.mongooseResolvers.findById(),
    prepareArgs: {
      _id: player => player.account,
    },
    projection: { account: 1 }
  }
)

export const playerQueries: ObjectTypeComposerFieldConfigMapDefinition<IPlayer, ResolverContext> = {
  playerById: PlayerTC.mongooseResolvers.findById(),
  playerMany: PlayerTC.mongooseResolvers.findMany()
}
