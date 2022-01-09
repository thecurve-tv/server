import { ExpressContext } from 'apollo-server-express'
import { Request } from 'express'
import { Guard, GuardInput, GuardOutput } from './guard'
import { GraphErrorResponse } from './types'

export const GLOBAL_WINDOW_CONSTRAINS = {
  every: 5 * 60 * 1000,
  quota: 300, // 1 req per sec
}
const globalWindows: Record<Request['ip'], {
  startTime: number,
  endTime: number,
  remainingQuota: number,
}> = {}

export class GlobalRateLimitGuard extends Guard<ExpressContext> {
  constructor() {
    super('ingress')
  }
  async check({ context }: GuardInput<ExpressContext, unknown, unknown>): Promise<void | GuardOutput<unknown, unknown>> {
    const now = Date.now()
    const ip = context?.req?.ip
    if (!ip) {
      throw new GraphErrorResponse(
        400,
        'Rate limiting is enforced on this server. Please expose your ip address on your request',
      )
    }
    const window = globalWindows[ip]
    if (window) {
      const expired = window.endTime <= now
      if (expired) {
        delete globalWindows[ip]
      } else {
        const allowed = window.remainingQuota > 0
        if (!allowed) throw new GraphErrorResponse(429, "Slow down, you're sending too many requests.")
        window.remainingQuota--
        return
      }
    }
    // window doesn't exist OR window is expired
    globalWindows[ip] = {
      startTime: now,
      endTime: now + GLOBAL_WINDOW_CONSTRAINS.every,
      remainingQuota: GLOBAL_WINDOW_CONSTRAINS.quota - 1,
    }
  }
}

export async function checkGlobalRateLimit(context: ExpressContext): Promise<void> {
  await new GlobalRateLimitGuard().check({ context, args: {} })
}
