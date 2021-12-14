import { ObjectId } from 'bson'
import { Schema, model } from 'mongoose'
import { defaultOptions, defaultProperties, IDefaultProperties } from './_defaults'

const minigameSchema = new Schema(
  {
    game: {
      type: 'ObjectId',
      required: true,
      index: true,
      ref: 'Game',
    },
    ...defaultProperties,
  },
  defaultOptions
)

export interface IMinigame extends IDefaultProperties {
  game: ObjectId
}

export const Minigame = model<IMinigame>('Minigame', minigameSchema)
