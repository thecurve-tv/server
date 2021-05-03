import { Schema, model, ObjectId } from 'mongoose'
import { defaultOptions, defaultProperties, IDefaultProperties } from './_defaults';

const chatPlayerSchema = new Schema({
  chat: {
    type: 'ObjectId',
    required: true,
    index: true,
    ref: 'Chat'
  },
  player: {
    type: 'ObjectId',
    required: true,
    index: true,
    ref: 'Player'
  },
  ...defaultProperties
}, defaultOptions);

export interface IChatPlayer extends IDefaultProperties {
  chat: ObjectId
  player: ObjectId
}

export const ChatPlayer = model<IChatPlayer>('ChatPlayer', chatPlayerSchema);
