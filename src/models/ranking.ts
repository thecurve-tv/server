import { ObjectId } from 'bson'
import { Schema, model } from 'mongoose'
import { IGame } from './game'
import { defaultOptions, defaultProperties, IDefaultProperties } from './_defaults'

const rankingSchema = new Schema(
  {
    game: {
      type: 'ObjectId',
      required: true,
      index: true,
      ref: 'Game',
    },
    ratings: {
      type: Map, // key=id of player doing the ranking
      of: {
        type: Map, // key=id of player being ranked
        of: Number,
      },
    },
    completedTime: {
      type: Number,
      required: false,
      min: 0,
    },
    ...defaultProperties,
  },
  defaultOptions,
)

export interface IRanking extends IDefaultProperties {
  game: ObjectId | IGame
  /**
   * Map of Maps of positions
   * (top level key=id of player doing the ranking)
   * (bottom level key=id of player being ranked)
   * (bottom level value=position of player in ranker's list [1st-->last])
   * */
  ratings: Map<string, Map<string, number>>
  completedTime?: number
}

export const Ranking = model<IRanking>('Ranking', rankingSchema)
