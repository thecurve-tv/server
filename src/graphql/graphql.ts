import { ApolloError, ApolloServer, AuthenticationError, ExpressContext } from 'apollo-server-express'
import { RequestHandler, Response } from 'express'
import Schema from './schema'
import { environment } from '../environment'
import { ensureAuthenticated, getAccessToken } from '../util/security'
import { AuthenticatedRequest, errorResponse, fetchAccount } from '../util/session'
import { Account, IAccount } from '../model/account'
import { ResolverContext } from './resolver-context'

export class GraphErrorResponse extends ApolloError {
  constructor(statusCode: number, description: string, data?: any) {
    super(description, `${statusCode}`, errorResponse(statusCode, description, undefined, data))
  }
}

export function getGraphQLMiddleware() {
  return new ApolloServer({
    schema: Schema,
    playground: !environment.PROD,
    debug: !environment.PROD,
    introspection: true,
    tracing: true,
    context: getGraphQLContext
  })
}

async function getGraphQLContext({ req, res }: ExpressContext): Promise<ResolverContext> {
  const defaultContext = { req: req, res }
  let account: IAccount | null
  try {
    account = await authenticateGraphRequest(req, res)
    const attemptDevAccount = !account && !environment.PROD && environment.DEV_ACCOUNT_ID && !getAccessToken(req)
    if (attemptDevAccount) {
      account = await Account.findById(environment.DEV_ACCOUNT_ID, { _id: 1 })
    }
  } catch (err) {
    if (!environment.PROD) console.error('GraphQL Authentication broke!', err)
    throw new GraphErrorResponse(500, err.message || 'GraphQL Authentication broke!')
  }
  if (!account) throw new AuthenticationError(`You must be logged in to use the GraphQL endpoint`)
  return { ...defaultContext, account }
}

async function authenticateGraphRequest(req: AuthenticatedRequest, res: Response) {
  const authenticationChain = ensureAuthenticated()
  const executeRequestHandler = (handler: RequestHandler) => {
    return new Promise<boolean>((resolve, reject) => {
      handler(req, res, (err?: any) => {
        if (err) return reject(err)
        resolve(false)
      })
      setTimeout(() => {
        if (res.headersSent) resolve(true)
      })
    })
  }
  for (const authenticator of authenticationChain) {
    try {
      let responseSent = await executeRequestHandler(authenticator)
      // the handler preemptively sent a response so we don't know the account associated with the request
      if (responseSent) return null
    } catch (err) {
      return null
    }
  }
  const verifyAccountExists = true
  const fetchAccountHandler = fetchAccount(verifyAccountExists)
  let responseSent = await executeRequestHandler(fetchAccountHandler)
  if (responseSent) return null
  return req.account || null
}
