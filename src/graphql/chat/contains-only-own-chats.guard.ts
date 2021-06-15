import { IChat } from '../../model/chat'
import { ChatPlayer } from '../../model/chatPlayer'
import { Player } from '../../model/player'
import { ResolverContext } from '../graphql'
import { Guard, GuardInput, GuardOutput } from '../guard'
import { FindManyArgs } from '../mongoose-resolvers'

export default class ContainsOnlyOwnChatsGuard extends Guard<ResolverContext, FindManyArgs, any> {
  constructor() {
    super('egress')
  }
  async check(
    { context, data }: GuardInput<ResolverContext, FindManyArgs, any>
  ): Promise<void | GuardOutput<FindManyArgs, any>> {
    const chats: IChat[] = data
    if (!chats || chats.length == 0) return
    const aggregationResult: { chat: IChat['_id'] }[] = await ChatPlayer.aggregate([
      { $match: { chat: { $in: chats.map(chat => chat._id) } } },
      {
        $lookup: {
          from: Player.collection.name,
          localField: 'player',
          foreignField: '_id',
          as: 'player'
        }
      },
      { $unwind: '$player' }, // one player
      { $match: { 'player.account': context.account._id } },
      { $project: { chat: 1 } }
    ])
    const accessibleChatIds = new Set<string>(aggregationResult.map(doc => doc.chat.toHexString()))
    return {
      data: chats.filter(chat => accessibleChatIds.has(chat._id.toHexString()))
    }
  }
}
