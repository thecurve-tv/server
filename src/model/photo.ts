import { Schema, model } from 'mongoose'
import { defaultOptions, defaultProperties } from './_defaults';

const photoSchema = new Schema({
  player: {
    type: 'ObjectId',
    required: true,
    index: true,
    ref: 'Player'
  },
  uri: {
    type: String,
    required: true
  },
  alt: {
    type: String,
    required: true
  },
  ...defaultProperties
}, defaultOptions);

export const Photo = model('Photo', photoSchema);
