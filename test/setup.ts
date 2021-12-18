import mongoose from 'mongoose'
import { connectMongoDB } from '../src/mongodb'

export async function ensureMongoDBConnected() {
  if (mongoose.connection.readyState != 1) {
    await connectMongoDB()
  }
}
