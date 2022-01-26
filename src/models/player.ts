import { ObjectId } from 'bson'
import { Schema, model } from 'mongoose'
import { IAccount } from './account'
import { IGame } from './game'
import { IPhoto } from './photo'
import { defaultOptions, defaultProperties, IDefaultProperties } from './_defaults'

const playerSchema = new Schema(
  {
    game: {
      type: 'ObjectId',
      required: true,
      index: true,
      ref: 'Game',
    },
    name: {
      type: String,
      required: true,
      minLength: 1,
      maxLength: 20,
      trim: true,
    },
    age: {
      type: Number,
      default: 18,
      min: 13,
    },
    job: {
      type: String,
      default: '',
      maxLength: 20,
      trim: true,
    },
    bio: {
      type: String,
      default: '',
      maxLength: 1000,
      trim: true,
    },
    account: {
      type: 'ObjectId',
      ref: 'Account',
      required: true,
      index: true,
    },
    ...defaultProperties,
  },
  defaultOptions,
)

export interface IPlayer extends IDefaultProperties {
  game: ObjectId | IGame
  name: string
  age: number
  job: string
  bio: string
  photo?: ObjectId | IPhoto
  account: ObjectId | IAccount
}

export const Player = model<IPlayer>('Player', playerSchema)
