import { ObjectTypeComposerFieldConfigMapDefinition } from 'graphql-compose'
import { IPlayer } from '@thecurve-tv/mongo-models/player'
import IsOwnAccountGuard from '../account/is-own-account.guard'
import { ResolverContext } from '../resolver-context'
import { guardResolver } from '../guard'
import { AccountTC, GameTC, PhotoTC, PlayerTC } from '../types'
import CanEditPlayerGuard from './can-edit-player.guard'
import ContainsOnlyCommonPlayersGuard from './contains-only-common-players.guard'
import { PlayerChatsRelationResolver } from './player.resolver'

// normalised relations
PlayerTC.addRelation('account', {
  // can only view _ids of the related account if this player is not yours
  resolver: () => guardResolver(AccountTC.mongooseResolvers.findById(), new IsOwnAccountGuard(true)),
  prepareArgs: {
    _id: player => player.account,
  },
  projection: { account: 1 },
})
PlayerTC.addRelation('game', {
  resolver: () => GameTC.mongooseResolvers.findById(),
  prepareArgs: {
    _id: player => player.game,
  },
  projection: { game: 1 },
})
PlayerTC.addRelation('photo', {
  resolver: () => PhotoTC.mongooseResolvers.findById(),
  prepareArgs: {
    _id: player => player.photo,
  },
  projection: { photo: 1 },
})
// non-normalised relations
PlayerTC.addRelation('chats', {
  resolver: PlayerChatsRelationResolver,
  prepareArgs: {
    playerId: player => player._id,
  },
  projection: { _id: 1 },
})

export const playerQueries: ObjectTypeComposerFieldConfigMapDefinition<IPlayer, ResolverContext> = {
  playerMany: guardResolver(PlayerTC.mongooseResolvers.findMany(), new ContainsOnlyCommonPlayersGuard()),
}

export const playerMutations: ObjectTypeComposerFieldConfigMapDefinition<IPlayer, ResolverContext> = {
  playerUpdateById: guardResolver(PlayerTC.mongooseResolvers.updateById(), new CanEditPlayerGuard()),
}
