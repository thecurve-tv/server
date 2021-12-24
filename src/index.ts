#!/usr/bin/env node

/*
 * Module dependencies.
 */

import http from 'http'
import { app, onListening as appOnListening } from './app'
import { apolloServer } from './graphql/graphql'

/*
 * Get port from environment and store in Express.
 */

const port = normalizePort(process.env.PORT || '3000')
app.set('port', port)

/*
 * Create HTTP server.
 */

const server = http.createServer(app)
// Accept subscriptions over WebSocket
apolloServer.installSubscriptionHandlers(server)

/*
 * Listen on provided port, on all network interfaces.
 */

server.listen(port)
server.on('error', onError)
server.on('listening', onListening)

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val: unknown) {
  const port = parseInt(val as string, 10)

  if (isNaN(port)) {
    // named pipe
    return val
  }

  if (port >= 0) {
    // port number
    return port
  }

  return false
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error: unknown) {
  if ((error as {syscall: string}).syscall !== 'listen') {
    throw error
  }

  const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port

  // handle specific listen errors with friendly messages
  switch ((error as {code: string}).code) {
  case 'EACCES':
    console.error(bind + ' requires elevated privileges')
    process.exit(1)
    break
  case 'EADDRINUSE':
    console.error(bind + ' is already in use')
    process.exit(1)
    break
  default:
    throw error
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  const addr = server.address()
  const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr?.port
  console.log(`Listening on ${bind}`)
  appOnListening()
    .catch(err => {
      console.error(err)
      process.exit(1)
    })
}
