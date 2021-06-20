import { ApolloError, ApolloServer, AuthenticationError, ExpressContext } from 'apollo-server-express'
import { RequestHandler, Response } from 'express'
import Schema from './schema'
import { environment } from '../environment'
import { ensureAuthenticated, getAccessToken, getAccessTokenFromGenericObject, verifyJwt } from '../util/security'
import { AuthenticatedRequest, errorResponse, fetchAccount, fetchAccountUsingJwtPayload } from '../util/session'
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

async function getGraphQLContext(context: ExpressContext): Promise<ResolverContext> {
  const defaultContext: Omit<ResolverContext, 'account'> = { req: context.req, res: context.res }
  let account: IAccount | null
  try {
    account = await getAccountFromExpressContext(context)
  } catch (err) {
    // Only execution errors are caught here. Authentication errors simply result in `account === null`
    if (!environment.PROD) console.error('GraphQL Authentication broke!', err)
    throw new GraphErrorResponse(500, err.message || 'GraphQL Authentication broke!')
  }
  if (!account) throw new AuthenticationError(`You must be logged in to use the GraphQL endpoint`)
  return { ...defaultContext, account }
}

async function getAccountFromExpressContext({ connection, req, res }: ExpressContext): Promise<IAccount | null> {
  let accessToken: string | undefined
  let account: IAccount | null
  if (connection) {
    // Operation is a Subscription
    accessToken = getAccessTokenFromGenericObject(connection.context)
    account = await authenticateSubscription(accessToken)
  } else {
    // Operation is a Query/Mutation
    accessToken = getAccessToken(req)
    account = await authenticateGraphRequest(req, res)
  }
  console.log(req?.body?.operationName, req?.headers, req?.query)
  const attemptDevAccount = !account && !environment.PROD && environment.DEV_ACCOUNT_ID && !accessToken
  if (attemptDevAccount) {
    account = await Account.findById(environment.DEV_ACCOUNT_ID, { _id: 1 })
  }
  return account
}

async function authenticateGraphRequest(req: AuthenticatedRequest, res: Response): Promise<IAccount | null> {
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

async function authenticateSubscription(accessToken: string | undefined): Promise<IAccount | null> {
  if (!accessToken) return null
  try {
    const payload = await verifyJwt(accessToken)
    console.log('done auth chain')
    if (!payload) return null
    const account = await fetchAccountUsingJwtPayload(payload)
    console.log('done fetch account')
    return account
  } catch (err) {
    return null
  }
}
