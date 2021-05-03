import mongoose from 'mongoose'
import { defaultOptions, defaultProperties } from './_defaults';

const roomSchema = new mongoose.Schema({
  player: {
    type: 'ObjectId',
    required: true,
    index: true,
    ref: 'Player'
  },
  ...defaultProperties
}, defaultOptions);

export const Room = mongoose.model('Room', roomSchema);
