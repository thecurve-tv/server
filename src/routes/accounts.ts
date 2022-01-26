import { Response, Router } from 'express'
import { body } from 'express-validator'
import { environment } from '../environment'
import { IDraftDocument } from '../models/_defaults'
import { Account, IAccount } from '../models/account'
import { security } from '../util/security'
import { errorResponse, AuthenticatedRequest, fetchAccount } from '../util/session'

const router = Router()
export default router

router.get('', security.ensureAuthenticated(), fetchAccount(), (req: AuthenticatedRequest, res: Response) => {
  if (!req.account) return errorResponse(404, 'Failed to get an account with that access token', res)
  res.send(req.account)
})

router.post(
  '',
  security.enableCors(<string>environment.AUTH0_DOMAIN),
  body('auth0Id').isString().isLength({ min: 1 }),
  body('email').isEmail(),
  (req, res, next) => {
    const f = async () => {
      const existingAccount = await Account.findOne({ email: req.body.email })
      if (existingAccount) return res.sendStatus(200)
      const accountDoc: IDraftDocument<IAccount> = {
        auth0Id: req.body.auth0Id,
        email: req.body.email,
      }
      const docs = await Account.create([ accountDoc ], { validateBeforeSave: true })
      res.status(201).send(docs[0])
    }
    f().catch(next)
  },
)
