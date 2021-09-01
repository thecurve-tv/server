import { NextFunction, Response, Router } from 'express'

import { Game } from '@thecurve-tv/mongo-models/src/game'
import { AuthenticatedRequest, errorResponse, fetchAccount } from '@thecurve-tv/express-utils/src/session'
import { security } from '../environment'

export const router = Router()

router.post('start', security.ensureAuthenticated(), fetchAccount(), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  res.sendStatus(501)
})

router.get('', security.ensureAuthenticated(), fetchAccount(), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.account) return errorResponse(40, 'Failed to get an account with that access token', res)
  Game.find({ hostAccount: req.account?._id })
})
