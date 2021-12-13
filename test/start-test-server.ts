import dotenv from 'dotenv'
import { exit } from 'process'
import { run } from './run-script'

async function main() {
  let envVariant = process.argv[2] || 'dev'
  dotenv.config({ path: `.env.${envVariant}` })
  const res = await run('cd src && ts-node --transpile-only .')
  exit(res.returnCode)
}

main()
