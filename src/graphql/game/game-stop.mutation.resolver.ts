import { ObjectId } from 'bson'
import { ResolverResolveParams, SchemaComposer, schemaComposer as _schemaComposer } from 'graphql-compose'
import { Game, IGame } from '../../models/game'
import { ResolverContext } from '../resolver-context'
import { GameTC, GraphErrorResponse } from '../types'

const schemaComposer: SchemaComposer<ResolverContext> = _schemaComposer

export interface GameStopMutationResolverArgs {
  _id: ObjectId
}
export default schemaComposer.createResolver<unknown, GameStopMutationResolverArgs>({
  name: 'GameStopMutationResolver',
  type: GameTC,
  args: {
    _id: 'MongoID!',
  },
  resolve: resolveGameStopMutation,
})

async function resolveGameStopMutation({ args }: ResolverResolveParams<unknown, ResolverContext, GameStopMutationResolverArgs>): Promise<IGame> {
  const now = Date.now()
  let game = await Game.findById(args._id)
  if (!game) throw new GraphErrorResponse(400, 'There is no game with that id')
  const gameAlreadyEnded = game.endTime <= now && game.pausedTime == null
  if (!gameAlreadyEnded) {
    game = await Game.findOneAndUpdate({ _id: args._id }, { endTime: now, $unset: { pausedTime: '' } }, { new: true })
    if (!game) throw new GraphErrorResponse(500, 'Failed to stop and/or get the game doc after stopping it')
  }
  return game
}
