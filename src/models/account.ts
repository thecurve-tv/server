import { Schema, model } from 'mongoose'
import { defaultOptions, defaultProperties, emailRegex, IDefaultProperties } from './_defaults'

const accountSchema = new Schema(
  {
    auth0Id: {
      type: String,
      required: true,
      index: true,
      unique: true,
      minLength: 1,
    },
    email: {
      type: String,
      required: true,
      index: true,
      unique: true,
      match: emailRegex,
    },
    // Remember to update Guards that redact fields when you add fields here
    ...defaultProperties,
  },
  defaultOptions,
)

export interface IAccount extends IDefaultProperties {
  auth0Id: string
  email: string
}

export const Account = model<IAccount>('Account', accountSchema)
