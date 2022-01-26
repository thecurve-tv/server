import { ObjectId } from 'bson'
import { ResolverResolveParams, SchemaComposer, schemaComposer as _schemaComposer } from 'graphql-compose'
import { FileUpload } from 'graphql-upload'
import { IGame } from '../../models/game'
import { IPhoto, Photo } from '../../models/photo'
import { IPlayer, Player } from '../../models/player'
import { IDraftDocument } from '../../models/_defaults'
import { Backblaze, BackblazeError, getBackblazeInstance, UploadFileResponse } from '../../util/backblaze'
import { ResolverContext } from '../resolver-context'
import { GraphErrorResponse, PhotoTC } from '../types'

const schemaComposer: SchemaComposer<ResolverContext> = _schemaComposer

export interface PlayerUploadPhotoMutationResolverArgs {
  _id: ObjectId
  file: Promise<FileUpload>
}
export default schemaComposer.createResolver<unknown, PlayerUploadPhotoMutationResolverArgs>({
  name: 'PlayerUploadPhotoMutationResolver',
  type: PhotoTC,
  args: {
    _id: 'MongoID!',
    file: 'Upload!',
  },
  resolve: resolvePlayerUploadPhotoMutation,
})

async function resolvePlayerUploadPhotoMutation(
  { args }: ResolverResolveParams<unknown, ResolverContext, PlayerUploadPhotoMutationResolverArgs>,
): Promise<IPhoto> {
  const { createReadStream, mimetype: mimeType } = await (args.file as Promise<FileUpload>)
  const player = await validatePlayerUploadPhotoMutation(args._id)

  // Invoking the `createReadStream` will return a Readable Stream.
  // See https://nodejs.org/api/stream.html#stream_readable_streams
  const stream = createReadStream()
  return cleanupFileAfterExecution(stream, async () => {
    const fileContent = await readFileUpload(stream)

    const b2 = await getBackblazeInstance()
    const upload = await uploadFileToB2(player, b2, mimeType, fileContent)

    const photoDoc: IDraftDocument<IPhoto> = {
      player: player._id,
      alt: `Photo of ${player.name}`,
      uri: `players/${player._id.toHexString()}/photo`,
      metadata: {
        contentLength: upload.contentLength,
        contentSha1: upload.contentSha1,
        contentMd5: upload.contentMd5,
        contentType: upload.contentType,
        fileId: upload.fileId,
        fileInfo: upload.fileInfo,
        fileName: upload.fileName,
        uploadTimestamp: upload.uploadTimestamp,
      },
    }
    try {
      const [ photo ] = await Photo.create([ photoDoc ])
      return photo
    } catch (err) {
      const errs = [ err ]
      try {
        await b2.deleteFileVersion({
          fileId: upload.fileId,
          fileName: upload.fileName,
        })
      } catch (err2) {
        errs.push(err2)
      }
      throw new GraphErrorResponse(
        (err as {status?: number})?.status || 500, 'Failed to upload file metadata', errs,
      )
    }
  })
}

async function validatePlayerUploadPhotoMutation(playerId: ObjectId): Promise<IPlayer> {
  const player = await Player.findById(playerId, { name: 1, game: 1 })
    .populate('game', { endTime: 1 })
  if (!player) {
    throw new GraphErrorResponse(400, 'You are not a member of this game')
  }
  const photo = await Photo.findOne({ player: playerId })
  if (photo) {
    throw new GraphErrorResponse(403, 'Changing your photo is currently disallowed')
  }
  return player
}

async function cleanupFileAfterExecution<R>(stream: ReturnType<FileUpload['createReadStream']>, func: () => Promise<R>): Promise<R> {
  const r: R[] = []
  let error: unknown
  try {
    r.push(await func())
  } catch (err) {
    error = err
  }
  stream.destroy()
  if (error) throw error
  return r[0]
}

function readFileUpload(stream: ReturnType<FileUpload['createReadStream']>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const data: Buffer[] = []
    stream.on('data', chunk => {
      data.push(chunk as Buffer)
    })
    stream.on('error', err => reject(err))
    stream.on('close', () => resolve(Buffer.concat(data)))
  })
}

async function uploadFileToB2(player: IPlayer, b2: Backblaze, mimeType: string, fileContent: Buffer): Promise<UploadFileResponse> {
  const b2Auth = await b2.authorize()
  let upload: UploadFileResponse | undefined
  let tries = 0
  while (tries < 5) {
    tries++
    const uploadAuthorization = await b2.getUploadUrl({ bucketId: b2Auth.allowed.bucketId as string })
    try {
      upload = await b2.uploadFile({
        uploadAuthorization,
        fileName: `player-${player._id.toHexString()}_photo`,
        mimeType,
        expiresHeader: new Date((player.game as IGame).endTime),
        fileContent,
        maxBytesSize: 10 * 1024 * 1024,
      })
    } catch (_err) {
      const err = _err as BackblazeError
      const reachedErrorLimit = tries == 5
      if (reachedErrorLimit) {
        console.log(_err) // print error in case the b2 api fails to discriminate it
      }
      if (reachedErrorLimit || !b2.shouldRetryUpload(err)) {
        throw new GraphErrorResponse(
          err.status || (err.data as {status?: number})?.status || 500,
          'Failed to upload file',
          err,
        )
      }
    }
  }
  if (!upload) {
    throw new GraphErrorResponse(500, 'Failed to upload file')
  }
  return upload
}
