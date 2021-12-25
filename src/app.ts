import cookieParser from 'cookie-parser'
import express from 'express'
import mongoose from 'mongoose'
import logger from 'morgan'
import path from 'path'
import { environment } from './environment'
import { apolloServer } from './graphql/graphql'
import { connectMongoDB } from './mongodb'
import { router as testRouter } from './routes/_test'
import { router as accountRouter } from './routes/accounts'
import { security } from './util/security'

export const app = express()

app.use(logger(environment.PROD ? 'tiny' : 'dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())

app.use(express.static(path.join(__dirname, 'public')))
app.use(security.enableCors())

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
if (!environment.PROD) {
  app.use('/_test', testRouter)
}

app.use('*', (_req, res) => {
  res.sendStatus(404)
})
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error((<Error>err).stack)
  res.status(500).send('Something broke!')
})

export async function onListening(): Promise<void> {
  await connectMongoDB()
}
