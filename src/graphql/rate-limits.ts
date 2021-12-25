import { Request } from 'express'
import { Guard, GuardInput, GuardOutput } from './guard'
import { ResolverContext } from './resolver-context'
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

export class GlobalRateLimitGuard extends Guard<ResolverContext> {
  constructor() {
    super('ingress')
  }
  async check({ context }: GuardInput<ResolverContext, unknown, unknown>): Promise<void | GuardOutput<unknown, unknown>> {
    const now = Date.now()
    const ip = context.req.ip
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

export async function checkGlobalRateLimit(context: ResolverContext): Promise<void> {
  await new GlobalRateLimitGuard().check({ context, args: {} })
}
