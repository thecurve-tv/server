import mongoose from 'mongoose'
import { awaitState, disconnectMongoDB } from '../src/mongodb'

export async function ensureMongoDBDisconnected() {
  if (mongoose.connection.readyState == 1) {
    await disconnectMongoDB()
  }
  await awaitState(0) // 0 is mongoose state 'disconnected'
}
