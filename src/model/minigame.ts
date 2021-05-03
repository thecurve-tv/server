import mongoose from 'mongoose'
import { defaultOptions, defaultProperties } from './_defaults';

const minigameSchema = new mongoose.Schema({
  ...defaultProperties
}, defaultOptions);

export const Minigame = mongoose.model('Minigame', minigameSchema);
