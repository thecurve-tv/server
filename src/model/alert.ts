import mongoose from 'mongoose'
import { defaultOptions, defaultProperties } from './_defaults';

const alertSchema = new mongoose.Schema({
  ...defaultProperties
}, defaultOptions);

export const Alert = mongoose.model('Alert', alertSchema);
