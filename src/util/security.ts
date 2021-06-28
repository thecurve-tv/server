import cors from 'cors'
import { Request, RequestHandler } from 'express'
import jwksRsa, { CertSigningKey, RsaSigningKey } from 'jwks-rsa'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { AuthenticationClient } from 'auth0'
import { environment } from '../environment'
import { AuthenticatedRequest } from './session'

export interface JwtRequestUser {
  iss?: string
  sub?: string
  aud?: string | string[]
  iat?: number
  exp?: number
  azp?: string
  scope?: string | string[]
}

/**
 * Dynamically provide a signing key based on the kid in the header and the signing keys provided by the JWKS endpoint.
 **/
const jwksClient = jwksRsa({
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
  jwksUri: `${environment.AUTH0_DOMAIN}/.well-known/jwks.json`
})

export const auth0 = new AuthenticationClient({
  domain: <string>environment.AUTH0_API_DOMAIN,
  clientId: <string>environment.AUTH0_CLIENT_ID
})

/**
 * Assert that the JWToken `token` is valid & correct. Optionally check that the token was issued with required scopes.
 * @returns the token payload
 */
export function verifyJwt(token: string, requiredScopes?: string[]): Promise<JwtPayload | undefined> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      (header, callback) => {
        jwksClient.getSigningKey(header.kid, (err, key) => {
          if (err) return callback(err)
          const signingKey = (<CertSigningKey>key).publicKey || (<RsaSigningKey>key).rsaPublicKey
          callback(null, signingKey)
        })
      },
      {
        // Validate the audience and the issuer.
        audience: environment.AUTH0_API_AUDIENCE,
        issuer: [`${environment.AUTH0_DOMAIN}/`],
        algorithms: ['RS256']
      },
      async (err, payload) => {
        if (err) return reject(err)
        if (requiredScopes) await verifyJwtScopes(requiredScopes, payload?.scope)
        resolve(payload)
      }
    )
  })
}

/**
 * Assert that the required scopes are present in the payload scope.
 */
async function verifyJwtScopes(requiredScopes: string[], payloadScope: JwtRequestUser['scope']): Promise<void> {
  const providedScopes = new Set<string>()
  if (payloadScope) {
    const isArrayOfScopes = Array.isArray(payloadScope)
    if (isArrayOfScopes) {
      for (const scope in <string[]>payloadScope) providedScopes.add(scope)
    } else {
      const scopes = (<string>payloadScope).split(' ').map(s => s.trim()).filter(s => s.length != 0)
      for (const scope in scopes) providedScopes.add(scope)
    }
  }
  const missingScopes: string[] = []
  for (const requiredScope of new Set(requiredScopes)) {
    if (providedScopes.has(requiredScope)) continue
    missingScopes.push(requiredScope)
  }
  if (missingScopes.length == 0) return
  const missingScopesStr = missingScopes.map(s => `'${s}'`).join(', ')
  throw new Error(`The following required auth scopes were not provided: ${missingScopesStr}`)
}

export function getAccessToken(req: Request) {
  return getAccessTokenFromGenericObject(req.headers)
}

export function getAccessTokenFromGenericObject(obj: { authorization?: string }) {
  const authHeader = obj.authorization // = 'Authorization abcdef123456'
  return authHeader && authHeader.split(' ')[1]
}

/**
 * Authorization middleware. When used, the Access Token must exist and be verified against the Auth0 JSON Web Key Set
 */
const checkJwt: RequestHandler = (req: AuthenticatedRequest, _res, next) => {
  const accessToken = getAccessToken(req)
  if (!accessToken) {
    return next(new Error('Failed to get access token from request'))
  }
  verifyJwt(accessToken)
    .then(payload => {
      req.user = payload
      next()
    })
    .catch(next)
}

/**
 * Function to get Authorization middleware. When used, `req.user.scope` must exist & must contain the requiredScopes
 */
function checkJwtScopes(requiredScopes: string[]): RequestHandler {
  return (req: AuthenticatedRequest, _res, next) => {
    verifyJwtScopes(requiredScopes, req.user?.scope)
      .then(() => next())
      .catch(next)
  }
}

export function ensureAuthenticated(...scopes: string[]) {
  const handlers: RequestHandler[] = [checkJwt]
  if (scopes.length != 0) handlers.push(checkJwtScopes(scopes))
  return handlers
}

export function enableCors(...allowedOrigins: string[]) {
  const allowAnonymous = !environment.PROD
  if (!environment.PROD) {
    const localhost = `http://localhost:${environment.PORT}`
    const client = <string>environment.CLIENT_DOMAIN
    if (!allowedOrigins.includes(localhost)) allowedOrigins.push(localhost)
    if (!allowedOrigins.includes(client)) allowedOrigins.push(client)
  }
  return cors({
    origin: (origin, callback) => {
      if (allowAnonymous && origin === undefined) return callback(null, true)
      if (allowedOrigins.find(allowed => allowed === origin)) callback(null, true)
      else callback(new Error('Not allowed by CORS'))
    }
  })
}
