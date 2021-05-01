import { Schema, model, ObjectId } from 'mongoose'
import { defaultProperties, IDefaultProperties } from './_defaults';

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
})

export interface IGame extends IDefaultProperties {
  hostAccount: ObjectId
}

export const Game = model<IGame>('Game', gameSchema)
