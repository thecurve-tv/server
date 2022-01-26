import axios from 'axios'
import crypto from 'crypto'
import { environment } from '../environment'

export type B2RestrictedCapability =
  'listAllBucketNames' | 'listBuckets' | 'readBuckets'
  | 'readBucketRetentions' | 'writeBucketRetentions'
  | 'readBucketEncryption' | 'writeBucketEncryption'
  | 'listFiles' | 'readFiles' | 'shareFiles' | 'writeFiles' | 'deleteFiles'
  | 'readFileLegalHolds' | 'writeFileLegalHolds'
  | 'readFileRetentions' | 'writeFileRetentions'
  | 'bypassGovernance'
export type B2BasicCapability =
  'listKeys' | 'writeKeys' | 'deleteKeys'
  | 'listBuckets' | 'writeBuckets' | 'deleteBuckets'
  | 'listFiles' | 'readFiles' | 'shareFiles' | 'writeFiles' | 'deleteFiles'
export type B2Capability = B2BasicCapability | B2RestrictedCapability

export interface AuthorizeAccountResponse {
  accountId: string
  authorizationToken: string
  allowed: {
    capabilities: B2BasicCapability[]
    bucketId?: string | null
    bucketName?: string | null
    namePrefix?: string | null
  }
  apiUrl: string
  downloadUrl: string
  recommendedPartSize: number
  absoluteMinimumPartSize: number
}
export interface CreateKeyRequest {
  capabilities: B2Capability[]
  keyName: string,
  expirationDate?: Date,
  bucketId?: string
  namePrefix?: string
}
export interface CreateKeyResponse {
  keyName: string
  applicationKeyId: string
  applicationKey: string
  capabilities: B2Capability[]
  accountId: string
  /** mills since epoch */
  expirationTimestamp?: number | null
  bucketId?: string | null
  namePrefix?: string | null
  options?: unknown
}
export interface GetUploadUrlRequest {
  bucketId: string
}
export interface GetUploadUrlResponse {
  bucketId: string
  uploadUrl: string
  authorizationToken: string
}
export interface UploadFileRequest {
  uploadAuthorization: GetUploadUrlResponse
  fileName: string
  mimeType: string
  fileContent: Buffer
  dateModified?: Date
  expiresHeader?: Date
  maxBytesSize?: number
}
export interface UploadFileResponse {
  accountId: string
  action: 'start' | 'upload' | 'hide' | 'folder'
  bucketId: string
  contentLength: number
  contentSha1: string
  contentMd5?: string | null
  contentType: string
  fileId: string
  fileInfo: Record<string, unknown>
  fileName: string
  serverSizeEncryption?: string | null
  uploadTimestamp: number
}
export interface DeleteFileVersionConfig {
  fileId: string
  fileName: string
}
export interface DownloadFileByIdConfig {
  fileId: string
}

export class BackblazeError extends Error {
  status?: number
  code?: string
  description?: string
  data?: unknown
}

export class Backblaze {
  private readonly B2_API_ROUTE = '/b2api/v2'
  private readonly B2_API_URL = `https://api.backblazeb2.com${this.B2_API_ROUTE}`
  private readonly ERR_UNAUTHORIZED = 'This Backblaze instance is unauthorized. Call authorize() first'
  private authResponse?: AuthorizeAccountResponse

  get defaultBucketId(): string | undefined {
    return this.authResponse?.allowed.bucketId || undefined
  }

  async authorize(force = false): Promise<AuthorizeAccountResponse> {
    if (this.authResponse && !force) return this.authResponse
    const { data } = await axios({
      method: 'POST',
      url: `${this.B2_API_URL}/b2_authorize_account`,
      headers: {
        Authorization: `Basic ${Buffer.from(environment.B2_APPLICATION_KEY as string).toString('base64')}`,
      },
      data: {},
    })
    return this.authResponse = {
      ...data,
      apiUrl: `${data.apiUrl}${this.B2_API_ROUTE}`,
      downloadUrl: `${data.downloadUrl}${this.B2_API_ROUTE}`,
    }
  }

  async createKey(config: CreateKeyRequest): Promise<CreateKeyResponse> {
    if (!this.authResponse) {
      throw new Error(this.ERR_UNAUTHORIZED)
    }
    if (config.keyName.length > 100) {
      throw new Error(`keyName is too long, max 100 chars, got "${config.keyName}"`)
    }
    if (!/^[\w-]+$/.test(config.keyName)) {
      throw new Error(`keyNme is invalid. Must use only letters/numbers/"-", got "${config.keyName}"`)
    }
    let validDurationInSeconds: number | undefined
    if (config.expirationDate) {
      validDurationInSeconds = (config.expirationDate.getTime() - Date.now()) / 1000
      if (validDurationInSeconds > 1000 * 24 * 60 * 60) {
        throw new Error(
          `expirationDate cannot be greater than 1000 days in the future, got ${config.expirationDate} (${validDurationInSeconds} seconds from now)`,
        )
      }
    }
    if (!!config.bucketId !== !!config.namePrefix) {
      throw new Error('bucketId & namePrefix are both required if either is set')
    }
    const { data } = await axios({
      method: 'POST',
      url: `${this.authResponse.apiUrl}/b2_create_key`,
      headers: { Authorization: this.authResponse.authorizationToken },
      data: {
        accountId: this.authResponse.accountId,
        capabilities: config.capabilities,
        keyName: config.keyName,
        validDurationInSeconds: validDurationInSeconds,
        bucketId: config.bucketId,
        namePrefix: config.namePrefix,
      },
    })
    return data
  }

  async getUploadUrl(config: GetUploadUrlRequest): Promise<GetUploadUrlResponse> {
    if (!this.authResponse) {
      throw new Error(this.ERR_UNAUTHORIZED)
    }
    const { data } = await axios({
      method: 'POST',
      url: `${this.authResponse.apiUrl}/b2_get_upload_url`,
      headers: { Authorization: this.authResponse.authorizationToken },
      data: { bucketId: config.bucketId },
    })
    return data
  }

  async uploadFile(config: UploadFileRequest): Promise<UploadFileResponse> {
    if (!this.authResponse) {
      throw new Error(this.ERR_UNAUTHORIZED)
    }
    const fileSize = config.fileContent.byteLength
    if (config.maxBytesSize !== undefined && fileSize > config.maxBytesSize) {
      throw new Error(`Provided file content exceeds max byte length. ${fileSize} > ${config.maxBytesSize}`)
    }
    const headers: Record<string, string> = {
      'Authorization': config.uploadAuthorization.authorizationToken,
      'X-Bz-File-Name': encodeURIComponent(config.fileName),
      'Content-Type': config.mimeType,
      'Content-Length': `${fileSize}`,
      'X-Bz-Content-Sha1': crypto.createHash('sha1').update(config.fileContent).digest('hex'),
      'X-Bz-Server-Side-Encryption': 'AES256',
    }
    if (config.dateModified !== undefined) {
      headers['X-Bz-Info-src_last_modified_millis'] = `${config.dateModified.getTime()}`
    }
    // TODO set expires header
    const { data } = await axios({
      method: 'POST',
      url: config.uploadAuthorization.uploadUrl,
      headers,
      data: config.fileContent,
    })
    return data
  }

  shouldRetryUpload(uploadFileError: BackblazeError): boolean {
    return (
      (uploadFileError?.status === 401 && uploadFileError?.code === 'expired_auth_token') ||
      uploadFileError?.status === 408 ||
      (!!uploadFileError?.status && uploadFileError.status >= 500 && uploadFileError.status < 600)
    )
  }

  async deleteFileVersion(config: DeleteFileVersionConfig): Promise<void> {
    if (!this.authResponse) {
      throw new Error(this.ERR_UNAUTHORIZED)
    }
    await axios({
      method: 'POST',
      url: `${this.authResponse.apiUrl}/b2_delete_file_version`,
      headers: { Authorization: this.authResponse.authorizationToken },
      data: {
        fileId: config.fileId,
        fileName: config.fileName,
      },
    })
  }

  async downloadFileById(config: DownloadFileByIdConfig): Promise<Buffer> {
    if (!this.authResponse) {
      throw new Error(this.ERR_UNAUTHORIZED)
    }
    const { data, headers } = await axios({
      method: 'POST',
      url: `${this.authResponse.downloadUrl}/b2_download_file_by_id`,
      headers: {
        Authorization: this.authResponse.authorizationToken,
        serverSideEncryption: 'AES256',
      },
      data: { fileId: config.fileId },
      responseType: 'arraybuffer',
    })
    const expectedSha1 = headers['x-bz-content-sha1']
    const sha1 = crypto.createHash('sha1').update(data).digest('hex')
    if (sha1 !== expectedSha1) {
      throw new BackblazeError(`Download was corrupted. Expected sha1: ${expectedSha1}, got ${sha1}`)
    }
    return data
  }
}

let backblaze: Backblaze
export async function getBackblazeInstance(): Promise<Backblaze> {
  if (!backblaze) {
    backblaze = new Backblaze()
    await backblaze.authorize()
  }
  return backblaze
}
