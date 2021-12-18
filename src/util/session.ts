import { Request, RequestHandler, Response } from 'express'
import { environment } from '../environment'
import { Account, IAccount } from '../models/account'
import { JwtRequestUser } from './security'

export interface AuthenticatedRequest extends Request {
  account?: IAccount
  user?: JwtRequestUser
}

/**
 * Must be used after authenticating a request
 */
export function fetchAccount(verifyExists = false, projection: any = { _log: 0 }): RequestHandler {
  return (req: AuthenticatedRequest, res, next) => {
    const onFail = () => errorResponse(404, 'Failed to get an account with that access token', res)
    let accountQuery
    if (environment.PROD) {
      if (!req.user) return onFail()
      accountQuery = fetchAccountUsingJwtPayload(req.user, projection)
    } else {
      accountQuery = Account.findById(environment.DEV_ACCOUNT_ID, projection)
    }
    accountQuery
      .then(account => {
        if (verifyExists && !account) return onFail()
        req.account = account || undefined
        next()
      })
      .catch(next)
  }
}

export async function fetchAccountUsingJwtPayload(payload: JwtRequestUser, projection: any = { _log: 0 }): Promise<IAccount | null> {
  return await Account.findOne({ auth0Id: payload?.sub }, projection)
}

/**
 * Returns a unified error reponse structure for http(s) requests
 */
export function errorResponse(statusCode: number, description: string, res?: Response, data?: any) {
  const json = {
    status: statusCode,
    message: description,
    data: data,
  }
  if (typeof data == 'boolean') data = null
  if (res) res.status(statusCode).send(json)
  return json
}

/**
 * Returns a unified error object structure for internal handlers
 */
export function errorInternal(description: string, res?: Response, data?: any) {
  const json = {
    message: description,
    data: data,
    code: 500,
  }
  if (res) res.status(500).send(json)
  return json
}
