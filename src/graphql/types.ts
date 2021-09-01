import { composeMongoose } from 'graphql-compose-mongoose'
import { Account } from '@thecurve-tv/mongo-models/src/account'
import { Chat } from '@thecurve-tv/mongo-models/src/chat'
import { ChatPlayer } from '@thecurve-tv/mongo-models/src/chatPlayer'
import { Game } from '@thecurve-tv/mongo-models/src/game'
import { Photo } from '@thecurve-tv/mongo-models/src/photo'
import { Player } from '@thecurve-tv/mongo-models/src/player'

export const AccountTC = composeMongoose(Account)
export const ChatTC = composeMongoose(Chat)
export const ChatPlayerTC = composeMongoose(ChatPlayer)
export const GameTC = composeMongoose(Game)
export const PhotoTC = composeMongoose(Photo)
export const PlayerTC = composeMongoose(Player)
