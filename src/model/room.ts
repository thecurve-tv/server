import mongoose from 'mongoose'

const roomSchema = new mongoose.Schema({
  player: {
    type: 'ObjectId',
    required: true,
    index: true,
    ref: 'Player'
  }
});

export const Room = mongoose.model('Room', roomSchema);
