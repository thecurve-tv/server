import { ObjectId } from 'bson'
import { SchemaComposer, schemaComposer as _schemaComposer } from 'graphql-compose'
import { ChatPlayer, IChatPlayer } from '../../models/chatPlayer'
import { IPlayer, Player } from '../../models/player'
import { ResolverContext } from '../resolver-context'
import { PlayerTC } from '../types'

const schemaComposer: SchemaComposer<ResolverContext> = _schemaComposer

export interface ChatPlayersRelationResolverArgs {
  chatId: ObjectId
}
export default schemaComposer.createResolver<unknown, ChatPlayersRelationResolverArgs>({
  name: 'ChatPlayersRelationResolver',
  type: [ PlayerTC.getType() ],
  args: {
    chatId: 'MongoID!',
  },
  resolve: async ({ args }) => {
    const chatPlayers: (IChatPlayer & { player: IPlayer })[] = await ChatPlayer.aggregate([
      { $match: { chat: args.chatId } },
      {
        $lookup: {
          from: Player.collection.name,
          localField: 'player',
          foreignField: '_id',
          as: 'player',
        },
      },
      { $unwind: '$player' }, // one player
    ])
    return chatPlayers.map(cp => <IPlayer>cp.player)
  },
})
