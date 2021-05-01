import { Request, RequestHandler, Response } from 'express'
import { ClientSession, ObjectId, QueryOptions, startSession } from 'mongoose'
import { IAccount, Account } from '../model/account'
import { auth0, getAccessToken } from './security'

export interface AuthenticatedRequest extends Request {
  account?: IAccount
}

export interface SearchArgs {
  addCondition: (key: string, value: any) => void
  getConditions: () => { [key: string]: any }
  q: (path: string) => ReturnType<typeof q>
  project: { [include: string]: 1 } | { [exclude: string]: 0 }
  options: QueryOptions
}

export function fetchAccount(verifyExists = false, projection: any = { _log: -1 }) {
  const handler: RequestHandler = async (req: AuthenticatedRequest, res, next) => {
    const accessToken = getAccessToken(req)
    if (!accessToken) {
      console.error(new Error('Failed to get user from Auth0. The request had no access token'))
      return errorInternal('Failed to authenticate request', res)
    }
    auth0.users?.getInfo(accessToken)
      .then(user => {
        if (!user) return errorResponse(403, "Provided access token doesn't represent an existing user", res)
        Account.findOne({ email: user.email }, projection)
          .then(account => {
            if (verifyExists && !account) return errorResponse(404, 'Failed to get an account with that access token', res)
            req.account = account || undefined
            next()
          })
          .catch(next)
      })
      .catch(next)
  }
  return handler
}

/**
 * Returns a unified error reponse structure for http(s) requests
 */
export function errorResponse(statusCode: number, description: string, res?: Response, data?: any) {
  const json = {
    status: statusCode,
    message: description,
    data: data
  };
  if (typeof data == "boolean") data = null;
  if (res) res.status(statusCode).send(json);
  return json;
}

/**
 * Returns a unified error object structure for internal handlers
 */
export function errorInternal(description: string, res?: Response, data?: any) {
  const json = {
    message: description,
    data: data,
    code: 500
  };
  if (res) res.status(500).send(json);
  return json;
}

export function beginMongooseSession(): Promise<ClientSession> {
  return new Promise((resolve, reject) => {
    startSession()
      .then(session => {
        session.startTransaction();
        resolve(session);
      })
      .catch(reject);
  });
}

export function initArgs(type: 'search', obj: any, accountId: ObjectId | string): SearchArgs
export function initArgs(type: string, obj: any, accountId: ObjectId | string): unknown {
  const project: | undefined = obj.project
  const query: { [key: string]: any } = { '_log.accountId': accountId } // protect all queries
  return {
    addCondition: (key: string, value: any) => {
      query[key] = value
    },
    getConditions: () => query,
    q: (path: string) => q(query, path),
    project
  }
}

function q<T>(obj: any, path: string): T | undefined {
  path += 'q.' // all query args start with q.
  let match = obj;
  for (const segment of path.split('.')) {
    if (!(segment in match)) return undefined
    match = match[segment]
  }
  return match
}
