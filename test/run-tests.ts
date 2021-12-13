import { exec } from 'child_process'
import { exit } from 'process'
import { run } from './run-script'

async function main() {
  const serverProcess = exec('npm run start:test -- test')
  try {
    const testRes = await run('jest')
    exit(testRes.returnCode)
  } catch (err) {
    serverProcess.kill()
    console.error(err)
    exit(1)
  }
}

main()
