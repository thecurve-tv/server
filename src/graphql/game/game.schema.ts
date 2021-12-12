import { ObjectTypeComposerFieldConfigMapDefinition } from 'graphql-compose'
import { IGame } from '@thecurve-tv/mongo-models/game'
import { ResolverContext } from '../resolver-context'
import { AccountTC, ChatTC, GameTC, PlayerTC } from '../types'
import { guardResolver } from '../guard'
import gameStartMutationResolver from './game-start.mutation.resolver'
import gameStopMutationResolver from './game-stop.mutation.resolver'
import gameJoinMutationResolver from './game-join.mutation.resolver'
import gameGetInviteQueryResolver from './game-get-invite.query.resolver'
import IsOwnGameGuard from './is-own-game.guard'
import IsGameHostGuard from './is-game-host.guard'
import CanEditGameGuard from './can-edit-game.guard'
import ContainsOnlyOwnChatsGuard from '../chat/contains-only-own-chats.guard'

// normalised relations
GameTC.addRelation('hostAccount', {
  resolver: () => AccountTC.mongooseResolvers.findById(),
  prepareArgs: {
    _id: game => game.hostAccount,
  },
  projection: { hostAccount: 1 },
})
GameTC.addRelation('mainChat', {
  resolver: () => ChatTC.mongooseResolvers.findById(),
  prepareArgs: {
    _id: game => game.mainChat,
  },
  projection: { mainChat: 1 },
})
// non-normalised relations
GameTC.addRelation('chats', {
  resolver: () => guardResolver(ChatTC.mongooseResolvers.findMany(), new ContainsOnlyOwnChatsGuard()),
  prepareArgs: {
    filter: game => ({ game: game._id }),
  },
  projection: { _id: 1 },
})
GameTC.addRelation('players', {
  resolver: () => PlayerTC.mongooseResolvers.findMany(),
  prepareArgs: {
    filter: game => ({ game: game._id }),
  },
  projection: { _id: 1 },
})

export const gameQueries: ObjectTypeComposerFieldConfigMapDefinition<IGame, ResolverContext> = {
  gameById: guardResolver(GameTC.mongooseResolvers.findById(), new IsOwnGameGuard()),
  gameGetInvite: gameGetInviteQueryResolver,
}

export const gameMutations: ObjectTypeComposerFieldConfigMapDefinition<IGame, ResolverContext> = {
  gameStart: gameStartMutationResolver,
  gameStop: guardResolver(gameStopMutationResolver, new IsGameHostGuard()),
  gameJoin: gameJoinMutationResolver,
  gameUpdateById: guardResolver(GameTC.mongooseResolvers.updateById(), new CanEditGameGuard()),
}
