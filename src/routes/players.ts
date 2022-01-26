import { ObjectId } from 'bson'
import { Response, Router } from 'express'
import asyncHandler from 'express-async-handler'
import { param } from 'express-validator'
import { IGame } from '../models/game'
import { Photo } from '../models/photo'
import { Player } from '../models/player'
import { objectIdRegex } from '../models/_defaults'
import { getBackblazeInstance } from '../util/backblaze'
import { security } from '../util/security'
import { AuthenticatedRequest, errorResponse, fetchAccount } from '../util/session'

const router = Router()
export default router

router.get(
  '/:playerId/photo',
  param('playerId').matches(objectIdRegex),
  security.ensureAuthenticated(),
  fetchAccount(true, { _id: 1 }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const now = Date.now()
    const player = await Player.findById(new ObjectId(req.params.playerId), { game: 1 })
      .populate('game', { endTime: 1 })
    if (!player) {
      return errorResponse(400, 'There is no player with that id', res)
    }
    const game = player.game as IGame
    const requester = await Player.findOne({ game: game._id, account: req.account?._id }, { _id: 1 })
    if (!requester) {
      return errorResponse(403, 'You must be in the same game as the player to view their photo', res)
    }
    const photo = await Photo.findOne({ player: player._id }, { metadata: 1 })
    if (!photo) {
      return errorResponse(400, 'That player has no photo', res)
    }
    try {
      // 30 days or till game end; in the future, i might want to change the way photos behave
      const cacheMaxAge = Math.ceil(now >= game.endTime ? 30 * 24 * 60 * 60 : (game.endTime - now) / 1000)
      const cacheControl = `private, max-age=${cacheMaxAge}`
      const b2 = await getBackblazeInstance()
      const buffer = await b2.downloadFileById({ fileId: photo.metadata.fileId as string }) // by player.schema, photos are limited to 10 MB
      // res.sendFile('c:/Users/Victor/Pictures/nose aerobics.png')
      res.contentType(photo.metadata.contentType as string)
        .set({
          'Cache-Control': cacheControl,
          'Accept': 'bytes',
        })
        .send(buffer)
    } catch (err) {
      return errorResponse(500, 'Failed to get the players photo', res, err)
    }
  }),
)
