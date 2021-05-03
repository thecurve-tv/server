import { composeMongoose } from 'graphql-compose-mongoose'
import { ObjectTypeComposerFieldConfigMapDefinition } from 'graphql-compose'
import { Player, IPlayer } from '../../model/player';
import { ResolverContext } from '../graphql';

export const PlayerTC = composeMongoose(Player)

export const playerQueries: ObjectTypeComposerFieldConfigMapDefinition<IPlayer, ResolverContext> = {
  playerById: PlayerTC.mongooseResolvers.findById()
};
