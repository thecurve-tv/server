import { ApolloError, ApolloServer, AuthenticationError, ExpressContext } from 'apollo-server-express'

import Schema from './schema'
import { environment } from '../environment'
import { ensureAuthenticated } from '../util/security'
import { AuthenticatedRequest, errorResponse, fetchAccount } from '../util/session'
import { Account, IAccount } from '../model/account'

export interface ResolverContext extends ExpressContext {
  account?: IAccount
}

export class GraphErrorResponse extends ApolloError {
  constructor(statusCode: number, description: string, data?: any) {
    super(description, `${statusCode}`, errorResponse(statusCode, description, undefined, data))
  }
}

export function getGraphQLMiddleware() {
  return new ApolloServer({
    schema: Schema,
    playground: !environment.prod,
    debug: !environment.prod,
    introspection: true,
    tracing: true,
    context: getGraphQLContext
  })
}

async function getGraphQLContext({ req: _req, res }: ExpressContext): Promise<ResolverContext> {
  const defaultContext = { req: _req, res }
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
  let result: ReturnType<typeof next>
  if (skipAuthentication) {
    // attach the dev account to the request context if one is provided
    if (!environment.DEV_ACCOUNT_ID) return defaultContext
    try {
      const account = await Account.findById(environment.DEV_ACCOUNT_ID, { _id: 1 })
      if (!account) return defaultContext // failed to attach account to request context
      req.account = account
      result = { account: req.account }
    } catch (err) {
      result = next(err)
    }
  } else {
    result = next() // run the next (in this case: first) auth check in the chain
  }
  if (!result || !('account' in result)) {
    throw new AuthenticationError(`You must be logged in to use the GraphQL endpoint`)
  }
  return { ...defaultContext, ...result }
}
