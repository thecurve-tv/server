import { makeExecutableSchema } from 'apollo-server-express'
import { GraphQLScalarType } from 'graphql'
import { SchemaComposer, schemaComposer as _schemaComposer } from 'graphql-compose'
import { GraphQLUpload } from 'graphql-upload'
import { accountQueries } from './account/account.schema'
import { chatPlayerQueries } from './chat/chat-player.schema'
import { chatMutations, chatQueries, chatSubscriptions } from './chat/chat.schema'
import { gameMutations, gameQueries } from './game/game.schema'
import { photoQueries } from './photo/photo.schema'
import { playerMutations, playerQueries } from './player/player.schema'
import { rankingMutations, rankingQueries } from './ranking/ranking.schema'
import { ResolverContext } from './resolver-context'

const schemaComposer: SchemaComposer<ResolverContext> = _schemaComposer

schemaComposer.Query.addFields({
  ...accountQueries,
  ...chatPlayerQueries,
  ...chatQueries,
  ...gameQueries,
  ...playerQueries,
  ...photoQueries,
  ...rankingQueries,
})

schemaComposer.Mutation.addFields({
  ...chatMutations,
  ...gameMutations,
  ...playerMutations,
  ...rankingMutations,
})

schemaComposer.Subscription.addFields({
  ...chatSubscriptions,
})

const fileUploadSchema = makeExecutableSchema({
  typeDefs: 'scalar Upload',
  resolvers: {
    Upload: (<unknown>GraphQLUpload) as GraphQLScalarType,
  },
})

const Schema = schemaComposer.merge(fileUploadSchema).buildSchema()
export default Schema
