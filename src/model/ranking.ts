import mongoose from 'mongoose'
import { defaultOptions, defaultProperties } from './_defaults';

const rankingSchema = new mongoose.Schema({
  ...defaultProperties
}, defaultOptions);

export const Ranking = mongoose.model('Ranking', rankingSchema);
