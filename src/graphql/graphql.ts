import { ApolloServer, AuthenticationError } from 'apollo-server-express'

import Schema from './schema'
import { environment } from '../environment'
import { ensureAuthenticated } from '../util/security'
import { AuthenticatedRequest, errorResponse, fetchAccount } from '../util/session'

export function getGraphQLMiddleware() {
  return new ApolloServer({
    schema: Schema,
    playground: !environment.prod,
    introspection: true,
    tracing: true,
    context: ({ req: _req, res }) => {
      const req: AuthenticatedRequest = _req
      const authenticationChain = ensureAuthenticated()
      let authIndex = 0
      let fetAccountHandler: ReturnType<typeof fetchAccount> | null = null
      function next(err?: any) {
        if (err) {
          return onError(err)
        }
        if (authIndex < authenticationChain.length) { // not done authenticating
          return authenticationChain[authIndex++](req, res, next)
        } else { // done authenticating
          return onAuthenticated()
        }
      }
      function onError(err: any) {
        const message = err.message || 'GraphQL Authentication broke!'
        return errorResponse(500, message)
      }
      function onAuthenticated() {
        if (fetAccountHandler !== null) return { account: req.account } // account has been fetched
        const verifyAccountExists = true
        fetAccountHandler = fetchAccount(verifyAccountExists)
        fetAccountHandler(req, res, next)
      }
      const skipAuthentication = !environment.prod
      if (skipAuthentication) {
        return { account: undefined }
      }
      const result = next()
      if (!result || !('account' in result)) {
        throw new AuthenticationError(`You must be logged in to use the GraphQL endpoint`)
      }
      return result
    }
  })
}
