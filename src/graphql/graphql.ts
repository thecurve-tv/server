import { ApolloServer, AuthenticationError, ExpressContext } from 'apollo-server-express'
import { RequestHandler, Response } from 'express'
import { environment } from '../environment'
import { Account, IAccount } from '../models/account'
import { IDraftDocument } from '../models/_defaults'
import { security } from '../util/security'
import { AuthenticatedRequest, fetchAccount, fetchAccountUsingJwtPayload } from '../util/session'
import { checkGlobalRateLimit } from './rate-limits'
import { ResolverContext } from './resolver-context'
import Schema from './schema'
import { GraphErrorResponse } from './types'

export const apolloServer = new ApolloServer({
  schema: Schema,
  playground: !environment.PROD,
  debug: !environment.PROD,
  introspection: true,
  tracing: true,
  context: getGraphQLContext,
})

export async function getGraphQLContext(expressContext: ExpressContext & { account?: IDraftDocument<IAccount> }): Promise<ResolverContext> {
  let account: IDraftDocument<IAccount> | null = expressContext.account || null
  if (environment.PROD || account == null) {
    try {
      account = await getAccountFromExpressContext(expressContext)
    } catch (err: unknown) {
      // Only execution errors are caught here. Authentication errors simply result in `account === null`
      if (!environment.PROD) console.error('GraphQL Authentication broke!', err)
      throw new GraphErrorResponse(500, (err as Error).message || 'GraphQL Authentication broke!')
    }
    if (!account) throw new AuthenticationError('You must be logged in to use the GraphQL endpoint')
  }
  const resolverContext: ResolverContext = { ...expressContext, account: (account as IAccount) }
  await checkGlobalRateLimit(resolverContext)
  return resolverContext
}

async function getAccountFromExpressContext({ connection, req, res }: ExpressContext): Promise<IAccount | null> {
  let accessToken: string | undefined
  let account: IAccount | null
  if (connection) {
    // Operation is a Subscription
    accessToken = security.getAccessTokenFromGenericObject(connection.context)
    account = await authenticateSubscription(accessToken)
  } else {
    // Operation is a Query/Mutation
    accessToken = security.getAccessToken(req)
    account = await authenticateGraphRequest(req, res)
  }
  const attemptDevAccount = !account && !environment.PROD && environment.DEV_ACCOUNT_ID && !accessToken
  if (attemptDevAccount) {
    account = await Account.findById(environment.DEV_ACCOUNT_ID, { _id: 1 })
  }
  return account
}

async function authenticateGraphRequest(req: AuthenticatedRequest, res: Response): Promise<IAccount | null> {
  const authenticationChain = security.ensureAuthenticated()
  const executeRequestHandler = (handler: RequestHandler) => {
    return new Promise<boolean>((resolve, reject) => {
      handler(req, res, (err?: unknown) => {
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
      const responseSent = await executeRequestHandler(authenticator)
      // the handler preemptively sent a response so we don't know the account associated with the request
      if (responseSent) return null
    } catch (err) {
      return null
    }
  }
  const verifyAccountExists = true
  const fetchAccountHandler = fetchAccount(verifyAccountExists)
  const responseSent = await executeRequestHandler(fetchAccountHandler)
  if (responseSent) return null
  return req.account || null
}

async function authenticateSubscription(accessToken: string | undefined): Promise<IAccount | null> {
  if (!accessToken) return null
  try {
    const payload = await security.verifyJwt(accessToken)
    if (!payload) return null
    const account = await fetchAccountUsingJwtPayload(payload)
    return account
  } catch (err) {
    return null
  }
}
