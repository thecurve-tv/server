export type MongoID = string

export interface FindByIdArgs {
  _id: any
}

export interface FindManyArgs {
  filter?: any
  limit?: number
  skip?: number
  sort?: string | string[] | Record<string, any>
}

export interface UpdateByIdArgs {
  _id: any
  record: any
}
