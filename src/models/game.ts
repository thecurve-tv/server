import { ObjectId } from 'bson'
import { Schema, model } from 'mongoose'
import { IAccount } from './account'
import { IChat } from './chat'
import { defaultOptions, defaultProperties, IDefaultProperties } from './_defaults'

const gameSchema = new Schema(
  {
    hostAccount: {
      type: 'ObjectId',
      ref: 'Account',
      required: true,
      index: true,
    },
    maxPlayerCount: {
      type: Number,
      required: true,
      min: 4,
      max: 12,
    },
    startTime: {
      type: Number,
      required: true,
      index: true,
      min: 0,
    },
    endTime: {
      type: Number,
      required: true,
      index: true,
      min: 0,
    },
    pausedTime: {
      type: Number,
      index: true,
      min: 0,
    },
    mainChat: {
      type: 'ObjectId',
      ref: 'Chat',
      required: true,
      index: true,
    },
    ...defaultProperties,
  },
  defaultOptions,
)

export interface IGame extends IDefaultProperties {
  hostAccount: ObjectId | IAccount
  maxPlayerCount: number
  startTime: number
  endTime: number
  pausedTime?: number
  mainChat: ObjectId | IChat
}

export const Game = model<IGame>('Game', gameSchema)
