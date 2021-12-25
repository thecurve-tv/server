import { ObjectId } from 'bson'
import { Schema, model } from 'mongoose'
import { defaultOptions, defaultProperties, IDefaultProperties } from './_defaults'

const chatSchema = new Schema(
  {
    game: {
      type: 'ObjectId',
      required: true,
      index: true,
      ref: 'Game',
    },
    name: {
      type: 'String',
      minLength: 1,
      maxLength: 50,
      trim: true,
    },
    ...defaultProperties,
  },
  defaultOptions,
)

export interface IChat extends IDefaultProperties {
  game: ObjectId
  name: string
}

export const Chat = model<IChat>('Chat', chatSchema)
