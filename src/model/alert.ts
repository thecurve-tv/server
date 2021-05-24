import { ObjectId } from 'bson'
import { Schema, model } from 'mongoose'
import { defaultOptions, defaultProperties, IDefaultProperties } from './_defaults'

const alertSchema = new Schema(
  {
    game: {
      type: 'ObjectId',
      required: true,
      index: true,
      ref: 'Game'
    },
    ...defaultProperties
  },
  defaultOptions
)

export interface IAlert extends IDefaultProperties {
  game: ObjectId
}

export const Alert = model<IAlert>('Alert', alertSchema)
