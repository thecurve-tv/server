import { ObjectTypeComposerFieldConfigMapDefinition } from 'graphql-compose'
import { IChat } from '@thecurve-tv/mongo-models/chat'
import { ResolverContext } from '../resolver-context'
import { guardResolver } from '../guard'
import { ChatTC, GameTC } from '../types'
import chatCreateMutationResolver from './chat-create.mutation.resolver'
import chatPlayersRelationResolver from './chat-players.relation.resolver'
import ContainsOnlyOwnChatsGuard from './contains-only-own-chats.guard'
import chatMessagesSubscriptionResolver from './chat-messages.subscription.resolver'
import chatSendMessageMutationResolver from './chat-send-message.mutation.resolver'

// normalised relations
ChatTC.addRelation('game', {
  resolver: () => GameTC.mongooseResolvers.findById(),
  prepareArgs: {
    _id: chat => chat.game,
  },
  projection: { game: 1 },
})
// non-normalised relations
ChatTC.addRelation('players', {
  resolver: chatPlayersRelationResolver,
  prepareArgs: {
    chatId: chat => chat._id,
  },
  projection: { _id: 1 },
})

export const chatQueries: ObjectTypeComposerFieldConfigMapDefinition<IChat, ResolverContext> = {
  chatMany: guardResolver(ChatTC.mongooseResolvers.findMany(), new ContainsOnlyOwnChatsGuard()),
}

export const chatMutations: ObjectTypeComposerFieldConfigMapDefinition<IChat, ResolverContext> = {
  chatCreate: chatCreateMutationResolver,
  chatSendMessage: chatSendMessageMutationResolver,
}

export const chatSubscriptions: ObjectTypeComposerFieldConfigMapDefinition<IChat, ResolverContext> = {
  chatMessages: chatMessagesSubscriptionResolver,
}
