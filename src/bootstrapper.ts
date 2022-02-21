import { Express } from 'express'
import http from 'http'

export default function bootstrapApp(app: Express, appOnListening: () => Promise<void>, appOnClose: () => Promise<void>): http.Server {
  // Get port from environment and store in Express.
  const port = normalizePort(process.env.PORT || '3000')
  app.set('port', port)

  // Create HTTP server.
  const server = http.createServer(app)

  // Listen on provided port, on all network interfaces.
  server.listen(port)
  server.on('error', onError)
  server.on('listening', onListening)
  server.on('close', onClose)

  // Normalize a port into a number, string, or false.
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

  // Event listener for HTTP server "error" event.
  function onError(error: unknown) {
    if ((error as {syscall?: string}).syscall !== 'listen') {
      throw error
    }

    const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port

    // handle specific listen errors with friendly messages
    switch ((error as {code?: string}).code) {
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

  // Event listener for HTTP server "listening" event.
  function onListening() {
    const addr = server.address()
    const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr?.port
    console.log(`Listening on ${bind}`)
    appOnListening()
      .catch(onError)
  }

  function onClose(error: unknown) {
    if (error) {
      onError(error)
      return
    }
    appOnClose()
      .catch(onError)
  }

  return server
}
