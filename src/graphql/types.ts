import { composeMongoose } from 'graphql-compose-mongoose'
import { Account } from '../models/account'
import { Chat } from '../models/chat'
import { ChatPlayer } from '../models/chatPlayer'
import { Game } from '../models/game'
import { Photo } from '../models/photo'
import { Player } from '../models/player'

export const AccountTC = composeMongoose(Account)
export const ChatTC = composeMongoose(Chat)
export const ChatPlayerTC = composeMongoose(ChatPlayer)
export const GameTC = composeMongoose(Game)
export const PhotoTC = composeMongoose(Photo)
export const PlayerTC = composeMongoose(Player)
