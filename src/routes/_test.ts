import { Router } from 'express'
import { startSession } from 'mongoose'
import { apolloServer } from '../graphql/graphql'
import { Chat } from '../models/chat'
import { ChatPlayer } from '../models/chatPlayer'
import { Game } from '../models/game'
import { Photo } from '../models/photo'
import { Player } from '../models/player'
import { Room } from '../models/room'
import { AuthenticatedRequest, fetchAccount } from '../util/session'

export const router = Router()

export async function clearGames(accountId: string) {
  const gameIds = (await Game.find(
    { hostAccount: accountId },
    { _id: 1 }
  )).map(g => g._id)
  const playerIds = (await Player.find(
    { game: { $in: gameIds } },
    { _id: 1 }
  )).map(p => p._id)
  const chatIds = (await Chat.find(
    { game: { $in: gameIds } },
    { _id: 1 }
  )).map(c => c._id)
  const session = await startSession()
  await session.withTransaction(async () => {
    await Promise.all([
      Room.deleteMany({ player: { $in: playerIds } }, { session }),
      Photo.deleteMany({ player: { $in: playerIds } }, { session }),
      ChatPlayer.deleteMany({
        $or: [
          { chat: { $in: chatIds } },
          { player: { $in: playerIds } }
        ]
      }, { session }),
      Chat.deleteMany({ _id: { $in: chatIds } }, { session }),
      Player.deleteMany({ _id: { $in: playerIds } }, { session }),
      Game.deleteMany({ _id: { $in: gameIds } }, { session })
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
  apolloServer.executeOperation(
    req.body.request,
    { account: req.body.account, req, res }
  )
    .then(gRes => res.send(gRes))
    .catch(next)
})
