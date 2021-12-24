import { Request, Response, NextFunction, RequestHandler } from 'express'
import { ValidationChain, validationResult } from 'express-validator'

/**
 * Validate the request using requirements set in an upstream request-handler
 */
export function ensureValidated(...validators: ValidationChain[]): RequestHandler[] {
  const validator = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
    next()
  }
  return [ ...validators, validator ]
}

/**
 * Escapes a given string for use in a regex expression
 */
export function escapeRegex(s: string) {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}
