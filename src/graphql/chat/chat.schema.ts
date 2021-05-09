import { ObjectTypeComposerFieldConfigMapDefinition } from 'graphql-compose'
import { IChat } from '../../model/chat'
import { ResolverContext } from '../graphql'
import { IChatPlayer } from '../../model/chatPlayer'
import { ChatTC, GameTC, ChatPlayerTC, PlayerTC } from '../types'


ChatTC.addRelation(
  'game',
  {
    resolver: () => GameTC.mongooseResolvers.findById(),
    prepareArgs: {
      _id: chat => chat.game,
    },
    projection: { game: 1 }
  }
)

ChatPlayerTC.addRelation(
  'chat',
  {
    resolver: () => ChatTC.mongooseResolvers.findById(),
    prepareArgs: {
      _id: chatPlayer => chatPlayer.chat,
    },
    projection: { chat: 1 }
  }
)
ChatPlayerTC.addRelation(
  'player',
  {
    resolver: () => PlayerTC.mongooseResolvers.findById(),
    prepareArgs: {
      _id: ChatPlayer => ChatPlayer.player,
    },
    projection: { player: 1 }
  }
)

export const chatQueries: ObjectTypeComposerFieldConfigMapDefinition<IChat, ResolverContext> = {
  chatById: ChatTC.mongooseResolvers.findById(),
  chatMany: ChatTC.mongooseResolvers.findMany()
}

export const chatPlayerQueries: ObjectTypeComposerFieldConfigMapDefinition<IChatPlayer, ResolverContext> = {
  chatPlayerById: ChatPlayerTC.mongooseResolvers.findById(),
  chatPlayerMany: ChatPlayerTC.mongooseResolvers.findMany()
}
