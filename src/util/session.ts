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
export function fetchAccount(verifyExists = false, projection: Record<string, number> = { _log: 0 }): RequestHandler {
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

export async function fetchAccountUsingJwtPayload(payload: JwtRequestUser, projection: Record<string, number> = { _log: 0 }): Promise<IAccount | null> {
  return await Account.findOne({ auth0Id: payload?.sub }, projection)
}

export type ErrorResponse = {
  status: number
  message: string
  data?: unknown
}
/**
 * Returns a unified error reponse structure for http(s) requests
 */
export function errorResponse(statusCode: number, description: string, res: undefined, data?: unknown): ErrorResponse
export function errorResponse(statusCode: number, description: string, res: Response, data?: unknown): never
export function errorResponse(statusCode: number, description: string, res?: Response, data?: unknown): ErrorResponse | never {
  const json = {
    status: statusCode,
    message: description,
    data: data,
  }
  if (statusCode >= 500 && !res) {
    console.error(json.data)
  }
  if (environment.PROD) {
    json.data = undefined
  }
  if (!res) return json
  res.status(statusCode).send(json)
  return (<unknown>undefined) as never
}

/**
 * Returns a unified error object structure for internal handlers
 */
export function errorInternal(description: string, res?: Response, data?: unknown) {
  const json = {
    message: description,
    data: data,
    code: 500,
  }
  if (res) res.status(500).send(json)
  return json
}
