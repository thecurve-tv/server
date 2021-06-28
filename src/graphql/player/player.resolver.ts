import { ObjectId } from 'bson'
import { SchemaComposer, schemaComposer as _schemaComposer } from 'graphql-compose'
import { Chat, IChat } from '../../model/chat'
import { ChatPlayer, IChatPlayer } from '../../model/chatPlayer'
import { ResolverContext } from "../resolver-context"
import { ChatTC } from '../types'

const schemaComposer: SchemaComposer<ResolverContext> = _schemaComposer

export interface PlayerChatsRelationResolverArgs {
  playerId: ObjectId
}
export const PlayerChatsRelationResolver = schemaComposer.createResolver<any, PlayerChatsRelationResolverArgs>({
  name: 'PlayerChatsRelationResolver',
  type: [ChatTC.getType()],
  args: {
    playerId: 'MongoID!'
  },
  resolve: async ({ args }) => {
    const chatPlayers: (IChatPlayer & { chat: IChat })[] = await ChatPlayer.aggregate([
      { $match: { player: args.playerId } },
      {
        $lookup: {
          from: Chat.collection.name,
          localField: 'chat',
          foreignField: '_id',
          as: 'chat'
        }
      },
      { $unwind: '$chat' }, // one player
    ])
    return chatPlayers.map(cp => <IChat>cp.chat)
  }
})
