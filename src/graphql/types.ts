import { composeMongoose } from 'graphql-compose-mongoose'
import { Account } from '../model/account'
import { Chat } from '../model/chat'
import { ChatPlayer } from '../model/chatPlayer'
import { Game } from '../model/game'
import { Photo } from '../model/photo'
import { Player } from '../model/player'

export const AccountTC = composeMongoose(Account)
export const ChatTC = composeMongoose(Chat)
export const ChatPlayerTC = composeMongoose(ChatPlayer)
export const GameTC = composeMongoose(Game)
export const PhotoTC = composeMongoose(Photo)
export const PlayerTC = composeMongoose(Player)
