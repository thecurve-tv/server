import dotenv from 'dotenv'
import path from 'path'

const envFilePath = path.join(path.dirname(__dirname), '.env.test')
dotenv.config({ path: envFilePath })

export const environment = {
  // Test details
  AUTH0_USER: {
    id: <string>process.env.AUTH0_USER_ID,
    email: <string>process.env.AUTH0_USER_EMAIL,
    password: <string>process.env.AUTH0_USER_PASSWORD,
  },
  TEST_SERVER_DOMAIN: `http://localhost:${process.env.PORT}`,
  // Services
  MONGODB_CONNECT_URI: <string>process.env.MONGODB_CONNECT_URI,
}
