import { Schema, model, ObjectId } from 'mongoose'
import { IAccount } from './account';
import { defaultOptions, defaultProperties, IDefaultProperties } from './_defaults';

const gameSchema = new Schema({
  hostAccount: {
    type: 'ObjectId',
    ref: 'Account',
    required: true,
    index: true
  },
  startTime: {
    type: Number,
    required: true,
    index: true
  },
  endTime: {
    type: Number,
    required: true,
    index: true
  },
  ...defaultProperties
}, defaultOptions)

export interface IGame extends IDefaultProperties {
  hostAccount: ObjectId | IAccount
  startTime: number,
  endTime: number
}

export const Game = model<IGame>('Game', gameSchema)
