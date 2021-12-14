import express from 'express'
import path from 'path'
import cookieParser from 'cookie-parser'
import logger from 'morgan'
import mongoose from 'mongoose'

import { environment, security } from './environment'
import { router as accountRouter } from './routes/accounts'
import { getGraphQLMiddleware } from './graphql/graphql'
import { connectMongoDB } from './mongodb'

export const app = express()

app.use(logger(environment.PROD ? 'tiny' : 'dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())

app.use(express.static(path.join(__dirname, 'public')))
app.use(security.enableCors())

export const apolloServer = getGraphQLMiddleware()
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

app.use('/accounts', accountRouter)

app.use('*', (_req, res) => {
  res.sendStatus(404)
})
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack)
  res.status(500).send('Something broke!')
})

export async function onListening(): Promise<void> {
  connectMongoDB()
}
