import { ApolloError } from 'apollo-server-express'
import { composeMongoose } from 'graphql-compose-mongoose'
import { Account } from '../models/account'
import { Chat } from '../models/chat'
import { ChatPlayer } from '../models/chatPlayer'
import { Game } from '../models/game'
import { Photo } from '../models/photo'
import { Player } from '../models/player'
import { Ranking } from '../models/ranking'
import { errorResponse } from '../util/session'

export const AccountTC = composeMongoose(Account)
export const ChatTC = composeMongoose(Chat)
export const ChatPlayerTC = composeMongoose(ChatPlayer)
export const GameTC = composeMongoose(Game)
export const PhotoTC = composeMongoose(Photo)
export const PlayerTC = composeMongoose(Player)
export const RankingTC = composeMongoose(Ranking)

export class GraphErrorResponse extends ApolloError {
  constructor(statusCode: number, description: string, data?: unknown) {
    super(description, `${statusCode}`, errorResponse(statusCode, description, undefined, data))
  }
}
