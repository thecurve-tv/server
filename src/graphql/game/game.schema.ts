import { ObjectTypeComposerFieldConfigMapDefinition, schemaComposer } from 'graphql-compose'
import { IGame } from '../../model/game'
import { ResolverContext } from '../graphql'
import { GameJoinMutationResolver, GameStartMutationResolver, GameStopMutationResolver } from './game.resolver'
import { AccountTC, ChatTC, GameTC, PlayerTC } from '../types'

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
GameTC.addRelation(
  'mainChat',
  {
    resolver: () => ChatTC.mongooseResolvers.findById(),
    prepareArgs: {
      _id: game => game.mainChat,
    },
    projection: { mainChat: 1 }
  }
)

export const gameQueries: ObjectTypeComposerFieldConfigMapDefinition<IGame, ResolverContext> = {
  gameById: GameTC.mongooseResolvers.findById(),
  gameMany: GameTC.mongooseResolvers.findMany()
}

export const gameMutations: ObjectTypeComposerFieldConfigMapDefinition<IGame, ResolverContext> = {
  gameUpdateById: GameTC.mongooseResolvers.updateById(),
  gameStart: {
    type: schemaComposer.createObjectTC({
      name: 'GameStartMutationResolverResult',
      fields: {
        game: GameTC.getType(),
        hostPlayer: PlayerTC.getType(),
        chat: ChatTC.getType()
      },
    }),
    args: {
      hostPlayerName: 'String!',
      maxPlayerCount: 'Int!',
      duration: 'Int!'
    },
    resolve: GameStartMutationResolver
  },
  gameStop: {
    type: GameTC,
    args: {
      _id: 'MongoID!'
    },
    resolve: GameStopMutationResolver
  },
  gameJoin: {
    type: GameTC,
    args: {
      gameId: 'MongoID!',
      playerName: 'String!'
    },
    resolve: GameJoinMutationResolver
  }
}
