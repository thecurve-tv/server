export type MongoID = string

export interface FindByIdArgs {
  _id: MongoID
}

export interface FindManyArgs {
  filter?: unknown
  limit?: number
  skip?: number
  sort?: string | string[] | Record<string, unknown>
}

export interface UpdateByIdArgs {
  _id: MongoID
  record: unknown
}
