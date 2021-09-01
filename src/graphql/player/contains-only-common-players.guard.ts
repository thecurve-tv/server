import { ObjectId } from 'bson'
import { IPlayer, Player } from '@thecurve-tv/mongo-models/src/player'
import { ResolverContext } from '../resolver-context'
import { Guard, GuardInput, GuardOutput } from '../guard'
import { FindManyArgs } from '../mongoose-resolvers'

export default class ContainsOnlyCommonPlayersGuard extends Guard<ResolverContext, FindManyArgs, any> {
  constructor() {
    super('egress')
  }
  async check({ context, data }: GuardInput<ResolverContext, FindManyArgs, any>): Promise<void | GuardOutput<FindManyArgs, any>> {
    const players: IPlayer[] = data
    // the game field might not have been requested, so fetch it
    const playersGameIdsDoc = await Player.find({ _id: { $in: players.map(p => p._id) } }, { game: 1 })
    const playerIdToGameIdMap = new Map(
      playersGameIdsDoc.map(player => {
        return [player._id.toHexString(), (<ObjectId>player.game).toHexString()]
      })
    )
    // get ids of all the games requester has played in
    const myGameIdsDoc = await Player.find({ account: context.account._id }, { game: 1 })
    const myGameIds = new Set(myGameIdsDoc.map(player => (<ObjectId>player.game).toHexString()))
    return {
      data: players.filter(player => {
        const playerIsOwnedByRequester = player.account && (<ObjectId>player.account).toHexString() == context.account._id.toHexString()
        if (playerIsOwnedByRequester) return true
        const playerGameId = playerIdToGameIdMap.get(player._id.toHexString())
        // if the _id field wasn't requested we won't know the game id, so assert that it is there to pass
        return playerGameId && myGameIds.has(playerGameId)
      }),
    }
  }
}
