import { schemaComposer } from 'graphql-compose'
import { accountQueries } from './account.schema'
import { gameMutations, gameQueries } from './game.schema'

// TODO verify account id on all requests
// TODO protect this resolver, users can only fetch their own account
// TODO: Handle transactions & errors in mutation sequences

schemaComposer.Query.addFields({
  ...accountQueries,
  ...gameQueries
})

schemaComposer.Mutation.addFields({
  ...gameMutations
})

const Schema = schemaComposer.buildSchema()
export default Schema
