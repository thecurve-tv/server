import dotenv from 'dotenv'
import { exit } from 'process'
import { run } from './run-script'

async function main() {
  dotenv.config({ path: '.env.test' })
  require('../src/index') // start server
  const testRes = await run('jest')
  exit(testRes.returnCode)
}

main()
