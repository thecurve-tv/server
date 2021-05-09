import { Document, SchemaOptions } from "mongoose"

export const defaultProperties = {
  '_log.createdDate': {
    type: Number,
    min: 0
  },
  '_log.updatedDate': {
    type: Number,
    min: 0
  }
}

export const defaultOptions: SchemaOptions = {
  validateBeforeSave: true,
  timestamps: {
    createdAt: '_log.createdDate',
    updatedAt: '_log.updatedDate',
    currentTime: () => Date.now() // use milliseconds since epoch
  }
}

export interface IDefaultProperties extends Document {
  _log?: {
    createdDate?: number
    updatedDate?: number
  }
}

export type IDraftDocument<T> = Omit<T, keyof Document> & { _id?: Document['_id'] }

export const emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
export const objectIdRegex = /^[a-fA-F0-9]{24}$/
