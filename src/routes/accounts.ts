import { NextFunction, Response, Router } from 'express'
import { body } from 'express-validator'

import { Account, IAccount } from '../model/account'
import { ensureAuthenticated, enableCors } from '../util/security'
import { errorResponse, AuthenticatedRequest, fetchAccount } from '../util/session'
import { environment } from '../environment'
import { IDraftDocument } from '../model/_defaults'

export const router = Router()

router.get('', ensureAuthenticated(), fetchAccount(), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.account) return errorResponse(404, 'Failed to get an account with that access token', res)
  res.send(req.account)
})

router.post(
  '',
  enableCors(<string>environment.AUTH0_DOMAIN),
  body('auth0Id').isString().isLength({ min: 1 }),
  body('email').isEmail(),
  (req, res, next) => {
    Account.findOne({ email: req.body.email })
      .then(existingAccount => {
        if (existingAccount) return res.sendStatus(200)
        const accountDoc: IDraftDocument<IAccount> = {
          auth0Id: req.body.auth0Id,
          email: req.body.email
        }
        Account.create([accountDoc], { validateBeforeSave: true })
          .then(docs => res.status(201).send(docs[0]))
          .catch(next)
      })
      .catch(next)
  })
