import mongoose from 'mongoose'
import { ObjectId } from 'bson'

const playerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  bio: {
    type: ObjectId,
    required: true
  }
});

export const Player = mongoose.model('Player', playerSchema);
