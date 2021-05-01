import { Document } from "mongoose"

export const defaultProperties = {
  _log: {
    type: {
      createdDate: {
        type: Number,
        required: true
      }
    }
  }
}

export interface IDefaultProperties extends Document {
  _log: {
    createdDate: number
  }
}

export function addDefaults(doc: any): IDefaultProperties {
  if ('_log' in doc) throw new Error('Document already has _log')
  doc._log = {
    createdDate: Date.now()
  }
  return doc
}

export const emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
export const objectIdRegex = /^[a-fA-F0-9]{24}$/
