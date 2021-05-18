import express from 'express'
import path from 'path'
import cookieParser from 'cookie-parser'
import logger from 'morgan'
import mongoose from 'mongoose'

import { environment } from './environment'
import { router as accountRouter } from './routes/accounts'
import { router as gameRouter } from './routes/games'
import { router as chatRouter } from './routes/chats'
import { router as roomRouter } from './routes/rooms'
import { enableCors } from './util/security'
import { getGraphQLMiddleware } from './graphql/graphql'

export const app = express()

app.use(logger(environment.PROD ? 'tiny' : 'dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())

app.use(express.static(path.join(__dirname, 'public')))
app.use(enableCors())

const graphQLServer = getGraphQLMiddleware()
graphQLServer.applyMiddleware({
  app,
  path: '/graphql',
  cors: true,
  onHealthCheck: () =>
    new Promise<boolean>((resolve, reject) => {
      if (mongoose.connection.readyState === 1) resolve(true)
      else reject()
    })
})

app.use('/accounts', accountRouter)
app.use('/games', gameRouter)
app.use('/chats', chatRouter)
app.use('/rooms', roomRouter)

app.use('*', (req, res) => {
  res.sendStatus(404)
})
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack)
  res.status(500).send("Something broke!")
})

mongoose.set('runValidators', true)
mongoose.connect(<string>environment.MONGODB_CONNECT_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Failed to connect to MongoDB', err))
