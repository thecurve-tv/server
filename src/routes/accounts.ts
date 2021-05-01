import { NextFunction, Response, Router } from 'express'
import { body } from 'express-validator'

import { Account } from '../model/account'
import { ensureAuthenticated, enableCors } from '../util/security'
import { errorResponse, AuthenticatedRequest, fetchAccount } from '../util/session'
import { addDefaults } from '../model/_defaults'
import { environment } from '../environment'

export const router = Router()

router.get('', ensureAuthenticated(), fetchAccount(), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.account) return errorResponse(404, 'Failed to get an account with that access token', res)
  res.send(req.account)
})

router.post('', enableCors(<string>environment.AUTH0_DOMAIN), body('email').isEmail(), (req, res, next) => {
  Account.findOne({ email: req.body.email })
    .then(existingAccount => {
      if (existingAccount) return res.sendStatus(200)
      const accountDoc = addDefaults({ email: req.body.email })
      Account.create([accountDoc], { validateBeforeSave: true })
        .then(() => res.sendStatus(201))
        .catch(next)
    })
    .catch(next)
})
