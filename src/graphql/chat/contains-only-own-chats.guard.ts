import { Chat, IChat } from '@thecurve-tv/mongo-models/src/chat'
import { ChatPlayer } from '@thecurve-tv/mongo-models/src/chatPlayer'
import { Player } from '@thecurve-tv/mongo-models/src/player'
import { ResolverContext } from "../resolver-context"
import { Guard, GuardInput, GuardOutput } from '../guard'
import { FindManyArgs } from '../mongoose-resolvers'
import { ObjectId } from 'bson'
import { Game } from '@thecurve-tv/mongo-models/src/game'

export default class ContainsOnlyOwnChatsGuard extends Guard<ResolverContext, FindManyArgs, any> {
  constructor() {
    super('egress')
  }
  async check(
    { context, data }: GuardInput<ResolverContext, FindManyArgs, any>
  ): Promise<void | GuardOutput<FindManyArgs, any>> {
    const chats: IChat[] = data
    if (!chats || chats.length == 0) return
    const uniqueChatIdStrs = new Set(chats.map(chat => chat._id.toHexString()))
    const chatIds = [...uniqueChatIdStrs].map(_id => new ObjectId(_id))
    const requesterAccountId = context.account._id
    const idsOfChatsWhoseGameIsHostedByRequester = await getIdsOfChatsWhoseGameIsHostedByAccount(chatIds, requesterAccountId)
    const idsOfChatsWhoseGameIsNotHostedByRequester = chatIds.filter(_id => !idsOfChatsWhoseGameIsHostedByRequester.has(_id.toHexString()))
    const idsOfChatsRequesterIsIn = await getIdsOfChatsAccountIsIn(idsOfChatsWhoseGameIsNotHostedByRequester, requesterAccountId)
    return {
      data: chats.filter(chat => {
        const chatIdStr = chat._id.toHexString()
        return idsOfChatsWhoseGameIsHostedByRequester.has(chatIdStr) || idsOfChatsRequesterIsIn.has(chatIdStr)
      })
    }
  }
}

async function getIdsOfChatsWhoseGameIsHostedByAccount(chatIdsToSearchThrough: IChat['_id'][], requesterAccountId: ObjectId): Promise<Set<string>> {
  const aggregationResult: { _id: IChat['_id'] }[] = await Chat.aggregate([
    { $match: { _id: { $in: chatIdsToSearchThrough } } },
    {
      $lookup: {
        from: Game.collection.name,
        localField: 'game',
        foreignField: '_id',
        as: 'game'
      }
    },
    { $unwind: '$game' }, // one game
    { $match: { 'game.hostAccount': requesterAccountId } },
    { $project: { _id: 1 } }
  ])
  return new Set<string>(aggregationResult.map(doc => doc._id.toHexString()))
}

async function getIdsOfChatsAccountIsIn(chatIdsToSearchThrough: IChat['_id'][], requesterAccountId: ObjectId): Promise<Set<string>> {
  const aggregationResult: { chat: IChat['_id'] }[] = await ChatPlayer.aggregate([
    { $match: { chat: { $in: chatIdsToSearchThrough } } },
    {
      $lookup: {
        from: Player.collection.name,
        localField: 'player',
        foreignField: '_id',
        as: 'player'
      }
    },
    { $unwind: '$player' }, // one player
    { $match: { 'player.account': requesterAccountId } },
    { $project: { chat: 1 } }
  ])
  return new Set<string>(aggregationResult.map(doc => doc.chat.toHexString()))
}
