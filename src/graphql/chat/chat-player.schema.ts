import { ObjectTypeComposerFieldConfigMapDefinition } from 'graphql-compose'
import { ResolverContext } from '../resolver-context'
import { IChatPlayer } from '@thecurve-tv/mongo-models/chatPlayer'
import { ChatTC, ChatPlayerTC, PlayerTC } from '../types'

// normalised relations
ChatPlayerTC.addRelation('chat', {
  resolver: () => ChatTC.mongooseResolvers.findById(),
  prepareArgs: {
    _id: chatPlayer => chatPlayer.chat,
  },
  projection: { chat: 1 },
})
ChatPlayerTC.addRelation('player', {
  resolver: () => PlayerTC.mongooseResolvers.findById(),
  prepareArgs: {
    _id: ChatPlayer => ChatPlayer.player,
  },
  projection: { player: 1 },
})

export const chatPlayerQueries: ObjectTypeComposerFieldConfigMapDefinition<IChatPlayer, ResolverContext> = {}
