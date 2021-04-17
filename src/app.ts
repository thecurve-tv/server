import express from 'express'
import path from 'path'
import cookieParser from 'cookie-parser'
import logger from 'morgan'
import mongoose from 'mongoose'
import dotenv from 'dotenv'

import { router as accountRouter } from './routes/account'
import { router as bioRouter } from './routes/bio'
import { router as chatRouter } from './routes/chat'
import { router as roomRouter } from './routes/room'

dotenv.config()
export const app = express()

app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())

// mongoose.connect(<string>process.env.MONGODB_CONNECT_URI, { useNewUrlParser: true, useUnifiedTopology: true })

app.use(express.static(path.join(__dirname, 'public')))

app.use('/account', accountRouter)
app.use('/bio', bioRouter)
app.use('/chat', chatRouter)
app.use('/room', roomRouter)

app.use('*', (req, res) => {
  res.sendStatus(404)
})
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack)
  res.status(500).send("Something broke!")
})
