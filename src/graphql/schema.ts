import { SchemaComposer, schemaComposer as _schemaComposer } from 'graphql-compose'
import { accountQueries } from './account/account.schema'
import { chatPlayerQueries } from './chat/chat-player.schema'
import { chatMutations, chatQueries } from './chat/chat.schema'
import { gameMutations, gameQueries } from './game/game.schema'
import { ResolverContext } from "./resolver-context"
import { photoQueries } from './photo/photo.schema'
import { playerMutations, playerQueries } from './player/player.schema'

const schemaComposer: SchemaComposer<ResolverContext> = _schemaComposer

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
