import { ObjectTypeComposerFieldConfigMapDefinition } from 'graphql-compose'
import { IPhoto } from '../../model/photo'
import { ResolverContext } from "../resolver-context"
import { PhotoTC, PlayerTC } from '../types'

// normalised relations
PhotoTC.addRelation('player', {
  resolver: () => PlayerTC.mongooseResolvers.findById(),
  prepareArgs: {
    _id: player => player.player
  },
  projection: { player: 1 }
})

export const photoQueries: ObjectTypeComposerFieldConfigMapDefinition<IPhoto, ResolverContext> = {
}
