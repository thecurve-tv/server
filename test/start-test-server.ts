import dotenv from 'dotenv'
import { exit } from 'process'
import { run } from './run-script'

async function main() {
  const envVariant = process.argv[2]
  dotenv.config({ path: `.env.${envVariant}` })
  const res = await run('set DEBUG=comp-4004-a3:* && cd src && ts-node --transpile-only .')
  exit(res.returnCode)
}

main()
