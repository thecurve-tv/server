import { schemaComposer } from 'graphql-compose'
import { accountQueries } from './account/account.schema'
import { chatPlayerQueries } from './chat/chat-player.schema'
import { chatMutations, chatQueries } from './chat/chat.schema'
import { gameMutations, gameQueries } from './game/game.schema'
import { photoQueries } from './photo/photo.schema'
import { playerMutations, playerQueries } from './player/player.schema'

// TODO verify account id on all requests
// TODO protect this resolver, users can only fetch their own account
// TODO: Handle transactions & errors in mutation sequences

schemaComposer.Query.addFields({
  ...accountQueries,
  ...chatPlayerQueries,
  ...chatQueries,
  ...gameQueries,
  ...playerQueries,
  ...photoQueries
})

schemaComposer.Mutation.addFields({
  ...chatMutations,
  ...gameMutations,
  ...playerMutations
})

const Schema = schemaComposer.buildSchema()
export default Schema
