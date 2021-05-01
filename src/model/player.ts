import { Schema, model, ObjectId } from 'mongoose'
import { defaultProperties, IDefaultProperties } from './_defaults';

const playerSchema = new Schema({
  game: {
    type: 'ObjectId',
    required: true,
    index: true,
    ref: 'Game'
  },
  name: {
    type: String,
    required: true,
    minLength: 1,
    maxLength: 100,
    trim: true
  },
  bio: {
    type: String,
    default: '',
    maxLength: 1000,
    trim: true
  },
  account: {
    type: 'ObjectId',
    sparse: true,
    ref: 'Account'
  },
  ...defaultProperties
});

export interface IPlayer extends IDefaultProperties {
  game: ObjectId
  name: string
  bio: string
  account?: ObjectId
}

export const Player = model<IPlayer>('Player', playerSchema);
