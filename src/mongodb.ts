import mongoose from 'mongoose'
import { environment } from './environment'

const waitingPromises: [number, Function][] = []

/**
 * Wait for synchronization with the main thread
 * @param state the connection state you're waiting for
 */
export async function awaitState(state: number): Promise<void> {
  return new Promise(resolve => {
    if (mongoose.connection.readyState == state) return resolve()
    waitingPromises.push([state, resolve])
  })
}

/**
 * Synchronize main thread with any waiting threads
 */
async function notifyWaiters() {
  const state = mongoose.connection.readyState
  for (let i = 0; i < waitingPromises.length; ++i) {
    const desiredState = waitingPromises[i][0]
    if (desiredState != state) continue
    const resolve = waitingPromises[i][1]
    await resolve()
    waitingPromises.splice(i, 1)
    --i
  }
}

export async function connectMongoDB(uri?: string): Promise<void> {
  const state = mongoose.connection.readyState
  if (state != 0) {
    const stateStr =
      state == 1
        ? 'connected' :
        state == 2
          ? 'connecting' : 'disconnecting'
    throw new Error(`Cannot connect when MongoDB is not disconnected. Current state is ${state} (${stateStr})`)
  }
  mongoose.set('runValidators', true)
  try {
    if (uri == null) uri = <string>environment.MONGODB_CONNECT_URI
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    console.log('Connected to MongoDB')
  } catch (err) {
    console.error('Failed to connect to MongoDB')
    throw err
  }
  await notifyWaiters()
}

export async function disconnectMongoDB(): Promise<void> {
  const state = mongoose.connection.readyState
  if (state != 1) {
    const stateStr =
      state == 0
        ? 'disconnected' :
        state == 2
          ? 'connecting' : 'disconnecting'
    throw new Error(`Cannot disconnect when MongoDB is not connected. Current state is ${state} (${stateStr})`)
  }
  await mongoose.disconnect()
  console.log('Disconnected from MongoDB')
  await notifyWaiters()
}
