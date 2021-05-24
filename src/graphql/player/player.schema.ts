import { ObjectTypeComposerFieldConfigMapDefinition } from 'graphql-compose'
import { IPlayer } from '../../model/player'
import { ResolverContext } from '../graphql'
import { guardResolver } from '../guard'
import { AccountTC, GameTC, PhotoTC, PlayerTC } from '../types'
import CanEditPlayerGuard from './can-edit-player.guard'
import { PlayerChatsRelationResolver } from './player.resolver'

// normalised relations
PlayerTC.addRelation('account', {
  resolver: () => AccountTC.mongooseResolvers.findById(),
  prepareArgs: {
    _id: player => player.account
  },
  projection: { account: 1 }
})
PlayerTC.addRelation('game', {
  resolver: () => GameTC.mongooseResolvers.findById(),
  prepareArgs: {
    _id: player => player.game
  },
  projection: { game: 1 }
})
PlayerTC.addRelation('photo', {
  resolver: () => PhotoTC.mongooseResolvers.findById(),
  prepareArgs: {
    _id: player => player.photo
  },
  projection: { photo: 1 }
})
// non-normalised relations
PlayerTC.addRelation('chats', {
  resolver: PlayerChatsRelationResolver,
  prepareArgs: {
    playerId: player => player._id
  },
  projection: { _id: 1 }
})

export const playerQueries: ObjectTypeComposerFieldConfigMapDefinition<IPlayer, ResolverContext> = {
}

export const playerMutations: ObjectTypeComposerFieldConfigMapDefinition<IPlayer, ResolverContext> = {
  playerUpdateById: guardResolver(PlayerTC.mongooseResolvers.updateById(), new CanEditPlayerGuard())
}
