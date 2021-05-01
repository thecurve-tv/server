import { Request, Response, NextFunction, RequestHandler } from 'express'
import { check, ValidationChain, validationResult } from 'express-validator'
import { DocumentQuery, Document } from 'mongoose'
import { objectIdRegex } from '../model/_defaults'

/**
 * Set of validators for MongoDB-related queries.
 * Checks `req.(body|query|params).project` &
 * Checks `req.(body|query|params).options` for:
 * - populate
 * - sort
 * - limit
 * - skip
 */
const commonValidators = [
  check('accountId').isString().matches(objectIdRegex),
  check('project.*').optional().isIn([-1, 1]),
  check('options.populate').optional().isArray(),
  check('options.sort.*').optional().isInt({ min: -1, max: 1 }),
  check('options.sort.*').optional().not().equals('0'),
  check('options.limit').optional().isInt({ min: 0 }),
  check('options.skip').optional().isInt({ min: 0 })
]

/**
 * Validate the request using requirements set in an upstream request-handler
 */
export function ensureValidated(...validators: ValidationChain[]): RequestHandler[] {
  const validator = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
    next()
  }
  return [...commonValidators, ...validators, validator]
}

/**
 * Attaches populate() & sort() options if requested
 */
export function attachCommonOptions(options: any, query: DocumentQuery<Document[], Document, {}>) {
  if (options === undefined) return query
  if (options.populate) {
    for (const populateArg of options.populate) {
      query = query.populate(populateArg)
    }
  }
  if (options.sort) {
    query = query.sort(options.sort)
  }
  if (options.skip) {
    query = query.skip(options.skip)
  }
  return query
}

/**
 * Escapes a given string for use in a regex expression
 */
export function escapeRegex(s: string) {
  return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")
}
