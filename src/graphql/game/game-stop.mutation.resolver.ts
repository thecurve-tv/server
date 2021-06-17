import { ObjectId } from 'bson'
import { SchemaComposer, schemaComposer as _schemaComposer } from 'graphql-compose'
import { Game } from '../../model/game'
import { GraphErrorResponse } from '../graphql'
import { ResolverContext } from "../resolver-context"
import { GameTC } from '../types'

const schemaComposer: SchemaComposer<ResolverContext> = _schemaComposer

export interface GameStopMutationResolverArgs {
  _id: ObjectId
}
export default schemaComposer.createResolver<any, GameStopMutationResolverArgs>({
  name: 'GameStopMutationResolver',
  type: GameTC,
  args: {
    _id: 'MongoID!'
  },
  resolve: async ({ args }) => {
    const now = Date.now()
    const activeGame = await Game.findById(args._id)
    if (!activeGame) throw new GraphErrorResponse(400, 'There is no game with that id')
    const gameAlreadyEnded = activeGame.endTime <= now && activeGame.pausedTime == null
    if (!gameAlreadyEnded) {
      await Game.updateOne({ _id: args._id }, { endTime: now, $unset: { pausedTime: '' } })
    }
    return activeGame
  }
})
