import { ObjectTypeComposerFieldConfigMapDefinition } from 'graphql-compose'
import { IPhoto } from '../../models/photo'
import { ResolverContext } from '../resolver-context'
import { PhotoTC, PlayerTC } from '../types'

// normalised relations
PhotoTC.addRelation('player', {
  resolver: () => PlayerTC.mongooseResolvers.findById(),
  prepareArgs: {
    _id: (photo: IPhoto) => photo.player,
  },
  projection: { player: 1 },
})

export const photoQueries: ObjectTypeComposerFieldConfigMapDefinition<IPhoto, ResolverContext> = {}
