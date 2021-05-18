import cors from 'cors'
import { Request, RequestHandler } from 'express'
import jwt from 'express-jwt'
import jwtAuthz from 'express-jwt-authz'
import jwksRsa from 'jwks-rsa'
import { AuthenticationClient } from 'auth0'
import { environment } from '../environment'

export interface JwtRequestUser {
  iss?: string,
  sub?: string,
  aud?: string[],
  iat?: number,
  exp?: number,
  azp?: string,
  scope?: string
}

export const auth0 = new AuthenticationClient({
  domain: <string>environment.AUTH0_API_DOMAIN,
  clientId: <string>environment.AUTH0_CLIENT_ID
})

// Authorization middleware. When used, the Access Token must exist and be verified against the Auth0 JSON Web Key Set
const checkJwt = jwt({
  // Dynamically provide a signing key
  // based on the kid in the header and
  // the signing keys provided by the JWKS endpoint.
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `${environment.AUTH0_DOMAIN}/.well-known/jwks.json`
  }),

  // Validate the audience and the issuer.
  audience: environment.AUTH0_API_AUDIENCE,
  issuer: [`${environment.AUTH0_DOMAIN}/`],
  algorithms: ['RS256']
});

export function getAccessToken(req: Request) {
  const authHeader = req.headers['authorization']
  return authHeader && authHeader.split(' ')[1]
}

export function ensureAuthenticated(...scopes: string[]) {
  const handlers: RequestHandler[] = [checkJwt]
  if (scopes) handlers.push(jwtAuthz(scopes))
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
