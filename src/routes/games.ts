import { NextFunction, Response, Router } from 'express'

import { Game } from '../model/game'
import { ensureAuthenticated } from '../util/security'
import { AuthenticatedRequest, errorResponse, fetchAccount } from '../util/session'

export const router = Router()

router.post('start', ensureAuthenticated(), fetchAccount(), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  res.sendStatus(501)
})

router.get('', ensureAuthenticated(), fetchAccount(), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.account) return errorResponse(40, 'Failed to get an account with that access token', res)
  Game.find({hostAccount: req.account?._id})
})
