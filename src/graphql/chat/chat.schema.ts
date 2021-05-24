import { ObjectTypeComposerFieldConfigMapDefinition } from 'graphql-compose'
import { IChat } from '../../model/chat'
import { ResolverContext } from '../graphql'
import { ChatTC, GameTC } from '../types'
import chatPlayersRelationResolver from './chat-players.relation.resolver'

// normalised relations
ChatTC.addRelation('game', {
  resolver: () => GameTC.mongooseResolvers.findById(),
  prepareArgs: {
    _id: chat => chat.game
  },
  projection: { game: 1 }
})
// non-normalised relations
ChatTC.addRelation('players', {
  resolver: chatPlayersRelationResolver,
  prepareArgs: {
    chatId: chat => chat._id
  },
  projection: { _id: 1 }
})

export const chatQueries: ObjectTypeComposerFieldConfigMapDefinition<IChat, ResolverContext> = {
}
