import { NextFunction, Response, Router } from 'express'
import { body } from 'express-validator'

import { environment, security } from '../environment'
import { IDraftDocument } from '../models/_defaults'
import { Account, IAccount } from '../models/account'
import { errorResponse, AuthenticatedRequest, fetchAccount } from '../util/session'

export const router = Router()

router.get('', security.ensureAuthenticated(), fetchAccount(), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.account) return errorResponse(404, 'Failed to get an account with that access token', res)
  res.send(req.account)
})

router.post(
  '',
  security.enableCors(<string>environment.AUTH0_DOMAIN),
  body('auth0Id').isString().isLength({ min: 1 }),
  body('email').isEmail(),
  (req, res, next) => {
    Account.findOne({ email: req.body.email })
      .then(existingAccount => {
        if (existingAccount) return res.sendStatus(200)
        const accountDoc: IDraftDocument<IAccount> = {
          auth0Id: req.body.auth0Id,
          email: req.body.email,
        }
        Account.create([accountDoc], { validateBeforeSave: true })
          .then(docs => res.status(201).send(docs[0]))
          .catch(next)
      })
      .catch(next)
  }
)
