import cors from 'cors'
import { Request, RequestHandler } from 'express'
import jwksRsa, { CertSigningKey, JwksClient, RsaSigningKey } from 'jwks-rsa'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { AuthenticationClient } from 'auth0'
import { AuthenticatedRequest } from './session'
import { environment } from '../environment'

export interface JwtRequestUser {
  iss?: string
  sub?: string
  aud?: string | string[]
  iat?: number
  exp?: number
  azp?: string
  scope?: string | string[]
}

export class ExpressSecurity {
  private _jwksClient?: JwksClient
  private _auth0?: AuthenticationClient

  /**
   * Dynamically provide a signing key based on the kid in the header and the signing keys provided by the JWKS endpoint.
   **/
  private get jwksClient() {
    return this._jwksClient || (this._jwksClient = jwksRsa({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      jwksUri: `${environment.AUTH0_DOMAIN}/.well-known/jwks.json`,
    }))
  }

  /**
   * Authorization middleware. When used, the Access Token must exist and be verified against the Auth0 JSON Web Key Set
   */
  private get checkJwt(): RequestHandler {
    return (req: AuthenticatedRequest, _res, next) => {
      const accessToken = this.getAccessToken(req)
      if (!accessToken) {
        return next(new Error('Failed to get access token from request'))
      }
      this.verifyJwt(accessToken)
        .then(payload => {
          req.user = payload
          next()
        })
        .catch(next)
    }
  }

  get auth0() {
    return this._auth0 || (this._auth0 = new AuthenticationClient({
      domain: <string>environment.AUTH0_API_DOMAIN,
      clientId: <string>environment.AUTH0_CLIENT_ID,
    }))
  }

  /**
   * Assert that the JWToken `token` is valid & correct. Optionally check that the token was issued with required scopes.
   * @returns the token payload
   */
  verifyJwt(token: string, requiredScopes?: string[]): Promise<JwtPayload | undefined> {
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        (header, callback) => {
          this.jwksClient.getSigningKey(header.kid, (err, key) => {
            if (err) return callback(err)
            const signingKey = (<CertSigningKey>key).publicKey || (<RsaSigningKey>key).rsaPublicKey
            callback(null, signingKey)
          })
        },
        {
          // Validate the audience and the issuer.
          audience: environment.AUTH0_API_AUDIENCE,
          issuer: [ `${environment.AUTH0_DOMAIN}/` ],
          algorithms: [ 'RS256' ],
        },
        async (err, payload) => {
          if (err) return reject(err)
          if (requiredScopes) await this.verifyJwtScopes(requiredScopes, payload?.scope)
          resolve(payload)
        },
      )
    })
  }

  /**
   * Assert that the required scopes are present in the payload scope.
   */
  private async verifyJwtScopes(requiredScopes: string[], payloadScope: JwtRequestUser['scope']): Promise<void> {
    const providedScopes = new Set<string>()
    if (payloadScope) {
      const isArrayOfScopes = Array.isArray(payloadScope)
      if (isArrayOfScopes) {
        for (const scope in <string[]>payloadScope) providedScopes.add(scope)
      } else {
        const scopes = (<string>payloadScope)
          .split(' ')
          .map(s => s.trim())
          .filter(s => s.length != 0)
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

  getAccessToken(req: Request) {
    return this.getAccessTokenFromGenericObject(req.headers)
  }

  getAccessTokenFromGenericObject(obj: { authorization?: string }) {
    const authHeader = obj.authorization // = 'Authorization abcdef123456'
    return authHeader && authHeader.split(' ')[1]
  }

  /**
   * Function to get Authorization middleware. When used, `req.user.scope` must exist & must contain the requiredScopes
   */
  private checkJwtScopes(requiredScopes: string[]): RequestHandler {
    return (req: AuthenticatedRequest, _res, next) => {
      this.verifyJwtScopes(requiredScopes, req.user?.scope)
        .then(() => next())
        .catch(next)
    }
  }

  ensureAuthenticated(...scopes: string[]) {
    const handlers: RequestHandler[] = [ this.checkJwt ]
    if (scopes.length != 0) handlers.push(this.checkJwtScopes(scopes))
    return handlers
  }

  enableCors(...allowedOrigins: string[]) {
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
      },
    })
  }
}

export const security = new ExpressSecurity()
