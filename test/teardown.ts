import { Server } from 'http'
import mongoose from 'mongoose'
import { onClose } from '../src/app'
import { awaitState, disconnectMongoDB } from '../src/mongodb'

export async function ensureMongoDBDisconnected() {
  if (mongoose.connection.readyState == 1) {
    await disconnectMongoDB()
  }
  await awaitState(0) // 0 is mongoose state 'disconnected'
}

export function shutdownExpressServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close(err => {
      if (err) return reject(err)
      onClose()
        .then(() => awaitState(0))
        .then(resolve)
        .catch(reject)
    })
  })
}
