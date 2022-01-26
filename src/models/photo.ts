import { ObjectId } from 'bson'
import { Schema, model } from 'mongoose'
import { defaultOptions, defaultProperties, IDefaultProperties } from './_defaults'

const photoSchema = new Schema(
  {
    player: {
      type: 'ObjectId',
      required: true,
      index: true,
      ref: 'Player',
    },
    uri: {
      type: String,
      required: true,
    },
    alt: {
      type: String,
      required: true,
    },
    metadata: {
      type: 'Object',
      default: {},
    },
    ...defaultProperties,
  },
  defaultOptions,
)

export interface IPhoto extends IDefaultProperties {
  player: ObjectId
  uri: string
  alt: string
  metadata: Record<string, unknown>
}

export const Photo = model<IPhoto>('Photo', photoSchema)
