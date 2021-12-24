import { ObjectId } from 'bson'
import { Schema, model } from 'mongoose'
import { IPlayer } from './player'
import { defaultOptions, defaultProperties, IDefaultProperties } from './_defaults'

const roomSchema = new Schema(
  {
    player: {
      type: 'ObjectId',
      required: true,
      index: true,
      ref: 'Player',
    },
    ...defaultProperties,
  },
  defaultOptions,
)

export interface IRoom extends IDefaultProperties {
  player: ObjectId | IPlayer
}

export const Room = model<IRoom>('Room', roomSchema)
