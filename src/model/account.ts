import { Schema, model } from 'mongoose'
import { defaultProperties, emailRegex, IDefaultProperties } from './_defaults'

const accountSchema = new Schema({
  email: {
    type: String,
    unique: true,
    match: emailRegex
  },
  ...defaultProperties
})

export interface IAccount extends IDefaultProperties {
  email: string
}

export const Account = model<IAccount>('Account', accountSchema)
