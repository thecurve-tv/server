import { ChildProcess, exec } from 'child_process'
import { Writable } from 'stream'

class WritableTextStream extends Writable {
  public text = ''

  constructor() {
    super()
  }

  _write(chunk: Buffer, _encoding: BufferEncoding, done: (error?: Error | null) => void): void {
    const chunkText = chunk.toString()
    this.text += chunkText
    console.log(chunkText)
    done()
  }
}


class RunResult {
  public returnCode = NaN
  public signal: string | null = null
  public completed = false
  _stdout: WritableTextStream = new WritableTextStream()
  _stderr: WritableTextStream = new WritableTextStream()

  stdout() {
    return this._stdout.text.trim()
  }

  stderr() {
    return this._stderr.text.trim()
  }
}

async function awaitProcess(process: ChildProcess): Promise<[code: number | null, signal: string | null]> {
  return new Promise((resolve, reject) => {
    process.once('exit', (code, signal) => resolve([ code, signal ]))
    process.once('error', err => reject(err))
  })
}

export async function run(cmd: string) {
  const result = new RunResult()
  const process = exec(cmd)
  process.stdout?.pipe(result._stdout)
  process.stderr?.pipe(result._stderr)
  const [ returnCode, signal ] = await awaitProcess(process)
  result.returnCode = returnCode == null ? NaN : returnCode // ChildProcess can supply null return codes
  result.signal = signal
  result.completed = true
  return result
}
