import { ObjectId } from 'bson'
import { Router } from 'express'
import { startSession } from 'mongoose'
import { apolloServer } from '../graphql/graphql'
import { Chat } from '../models/chat'
import { ChatPlayer } from '../models/chatPlayer'
import { Game } from '../models/game'
import { IPhoto, Photo } from '../models/photo'
import { Player } from '../models/player'
import { Ranking } from '../models/ranking'
import { Room } from '../models/room'
import { getBackblazeInstance, BackblazeError } from '../util/backblaze'
import { AuthenticatedRequest, fetchAccount } from '../util/session'

const router = Router()
export default router

async function deletePhotosFromB2(photos: IPhoto[]) {
  const b2 = await getBackblazeInstance()
  await b2.authorize()
  await Promise.all(
    photos.map(photo => {
      return b2.deleteFileVersion({
        fileId: photo.metadata.fileId as string,
        fileName: photo.metadata.fileName as string,
      }).catch(_err => {
        const err = _err as BackblazeError
        if (err.response?.data?.code !== 'file_not_present') {
          throw err.response
        }
      })
    }),
  )
}
export async function clearGames(accountId: string) {
  const gameIds = (await Game.find(
    { hostAccount: accountId },
    { _id: 1 },
  )).map(g => g._id)
  const playerIds = (await Player.find(
    { game: { $in: gameIds } },
    { _id: 1 },
  )).map(p => p._id)
  const chatIds = (await Chat.find(
    { game: { $in: gameIds } },
    { _id: 1 },
  )).map(c => c._id)
  const photos = await Photo.find(
    { player: { $in: playerIds } },
    { metadata: 1 },
  )
  const session = await startSession()
  await session.withTransaction(async () => {
    await Promise.all([
      Ranking.deleteMany({ game: { $in: gameIds } }, { session }),
      Room.deleteMany({ player: { $in: playerIds } }, { session }),
      deletePhotosFromB2(photos),
      Photo.deleteMany(
        { _id: { $in: photos.map(p => p._id) } },
        { session },
      ),
      ChatPlayer.deleteMany({
        $or: [
          { chat: { $in: chatIds } },
          { player: { $in: playerIds } },
        ],
      }, { session }),
      Chat.deleteMany({ _id: { $in: chatIds } }, { session }),
      Player.deleteMany({ _id: { $in: playerIds } }, { session }),
      Game.deleteMany({ _id: { $in: gameIds } }, { session }),
    ])
  })
}
router.post('/clearGames', fetchAccount(), (req: AuthenticatedRequest, res, next) => {
  const accountId = req.account?._id
  if (!accountId) return res.status(400).send('invalid account')
  Promise.all(req.body.accountIds.map(clearGames))
    .then(() => res.sendStatus(200))
    .catch(next)
})

router.post('/execGraphql', (req, res, next) => {
  const account = req.body.account
  if (account?._id) account._id = new ObjectId(account._id)
  apolloServer.executeOperation(
    req.body.request,
    { account, req, res },
  )
    .then(gRes => res.send(gRes))
    .catch(next)
})
