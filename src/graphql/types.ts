import { composeMongoose } from 'graphql-compose-mongoose'
import { Account } from '@thecurve-tv/mongo-models/account'
import { Chat } from '@thecurve-tv/mongo-models/chat'
import { ChatPlayer } from '@thecurve-tv/mongo-models/chatPlayer'
import { Game } from '@thecurve-tv/mongo-models/game'
import { Photo } from '@thecurve-tv/mongo-models/photo'
import { Player } from '@thecurve-tv/mongo-models/player'

export const AccountTC = composeMongoose(Account)
export const ChatTC = composeMongoose(Chat)
export const ChatPlayerTC = composeMongoose(ChatPlayer)
export const GameTC = composeMongoose(Game)
export const PhotoTC = composeMongoose(Photo)
export const PlayerTC = composeMongoose(Player)
