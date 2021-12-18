import dotenv from 'dotenv'
dotenv.config({ path: '.env.test' })

export const environment = {
  // Test details
  AUTH0_USER: {
    id: <string>process.env.AUTH0_USER_ID,
    email: <string>process.env.AUTH0_USER_EMAIL,
    password: <string>process.env.AUTH0_USER_PASSWORD
  },
  TEST_SERVER_DOMAIN: `http://localhost:${process.env.PORT}`
}
