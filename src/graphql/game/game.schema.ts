import { composeMongoose } from 'graphql-compose-mongoose'
import { ObjectTypeComposerFieldConfigMapDefinition, schemaComposer } from 'graphql-compose'
import { Game, IGame } from '../../model/game'
import { AccountTC } from '../account/account.schema'
import { ResolverContext } from '../graphql'
import { GameStartMutationResolver } from './game.resolver'
import { ChatTC } from '../chat/chat.schema'
import { PlayerTC } from '../player/player.schema'

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

export const gameQueries: ObjectTypeComposerFieldConfigMapDefinition<IGame, ResolverContext> = {
  gameMany: GameTC.mongooseResolvers.findMany()
}

export const gameMutations: ObjectTypeComposerFieldConfigMapDefinition<IGame, ResolverContext> = {
  gameStart: {
    type: schemaComposer.createObjectTC({
      name: 'GameStartMutationResolverResult',
      fields: {
        game: GameTC.getType(),
        hostPlayer: PlayerTC.getType(),
        chat: ChatTC.getType()
      },
    }),
    args: { hostPlayerName: 'String!', duration: 'Float!' },
    resolve: GameStartMutationResolver
  }
}
