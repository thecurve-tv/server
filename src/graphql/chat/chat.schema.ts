import { composeMongoose } from 'graphql-compose-mongoose'
import { ObjectTypeComposerFieldConfigMapDefinition } from 'graphql-compose'
import { Chat, IChat } from '../../model/chat';
import { ResolverContext } from '../graphql';

export const ChatTC = composeMongoose(Chat)

export const chatQueries: ObjectTypeComposerFieldConfigMapDefinition<IChat, ResolverContext> = {
  chatById: ChatTC.mongooseResolvers.findById()
};
