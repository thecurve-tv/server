import cookieParser from 'cookie-parser'
import express from 'express'
import { graphqlUploadExpress } from 'graphql-upload'
import mongoose from 'mongoose'
import logger from 'morgan'
import path from 'path'
import { environment } from './environment'
import { apolloServer } from './graphql/graphql'
import { useGlobalRateLimit } from './graphql/rate-limits'
import { connectMongoDB, disconnectMongoDB } from './mongodb'
import playersRouter from './routes/players'
import testRouter from './routes/_test'
import { security } from './util/security'
import { errorResponse } from './util/session'

export const app = express()

app.use(logger(environment.PROD ? 'tiny' : 'dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())

app.use(express.static(path.join(__dirname, 'public')))
app.use(security.enableCors())

app.use(graphqlUploadExpress())
apolloServer.applyMiddleware({
  app,
  path: '/graphql',
  cors: true,
  onHealthCheck: () =>
    new Promise<boolean>((resolve, reject) => {
      if (mongoose.connection.readyState === 1) resolve(true)
      else reject()
    }),
})

app.use(useGlobalRateLimit())
app.use('/players', playersRouter)
if (!environment.PROD) {
  app.use('/_test', testRouter)
}

app.use('*', (_req, res) => {
  res.sendStatus(404)
})
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err, (<Error>err).stack)
  errorResponse(500, 'Something broke!', res, err)
})

export async function onListening(): Promise<void> {
  await connectMongoDB()
}

export async function onClose(): Promise<void> {
  await disconnectMongoDB()
}
