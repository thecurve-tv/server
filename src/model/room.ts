import { ObjectId } from 'bson';
import mongoose from 'mongoose'

const roomSchema = new mongoose.Schema({
  player: {
    type: ObjectId,
    index: true
  }
});

export const Room = mongoose.model('Room', roomSchema);
