import { Schema, model, ObjectId } from 'mongoose'
import { defaultOptions, defaultProperties, IDefaultProperties } from './_defaults'

const rankingSchema = new Schema({
  game: {
    type: 'ObjectId',
    required: true,
    index: true,
    ref: 'Game'
  },
  ...defaultProperties
}, defaultOptions)

export interface IRanking extends IDefaultProperties {
  game: ObjectId
}

export const Ranking = model<IRanking>('Ranking', rankingSchema)
