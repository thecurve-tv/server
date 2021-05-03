import dotenv from 'dotenv'
dotenv.config()

export const environment = {
  prod: !!process.env.prod,
  PORT: process.env.PORT,
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
  AUTH0_DOMAIN: process.env.AUTH0_DOMAIN,
  AUTH0_API_AUDIENCE: process.env.AUTH0_API_AUDIENCE,
  AUTH0_API_DOMAIN: process.env.AUTH0_API_DOMAIN,
  CLIENT_DOMAIN: process.env.CLIENT_DOMAIN,
  DEV_ACCOUNT_ID: process.env.DEV_ACCOUNT_ID,
  MONGODB_CONNECT_URI: process.env.MONGODB_CONNECT_URI
}
