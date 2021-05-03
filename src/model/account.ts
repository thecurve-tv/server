import { Schema, model } from 'mongoose'
import { defaultOptions, defaultProperties, emailRegex, IDefaultProperties } from './_defaults'

const accountSchema = new Schema({
  email: {
    type: String,
    unique: true,
    match: emailRegex
  },
  ...defaultProperties
}, defaultOptions)

export interface IAccount extends IDefaultProperties {
  email: string
}

export const Account = model<IAccount>('Account', accountSchema)
