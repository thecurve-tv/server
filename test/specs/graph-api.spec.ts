import { Request, Response } from 'express'
import { getGraphQLContext } from '../../src/graphql/graphql'
import { GLOBAL_WINDOW_CONSTRAINS } from '../../src/graphql/rate-limits'
import { mockPlayers } from '../data'

/* ==================== */

/* ==================== */

describe('rate limiting', () => {
  const originalConstrains = Object.freeze({ ...GLOBAL_WINDOW_CONSTRAINS })
  afterEach(() => {
    for (const _key in originalConstrains) {
      const key = _key as keyof typeof GLOBAL_WINDOW_CONSTRAINS
      GLOBAL_WINDOW_CONSTRAINS[key] = originalConstrains[key]
    }
  })

  it('enforces global rate limit', async () => {
    GLOBAL_WINDOW_CONSTRAINS['every'] = 60 * 1000
    GLOBAL_WINDOW_CONSTRAINS['quota'] = 1
    const testContext = {
      account: mockPlayers[0].account,
      req: ({} as Request),
      res: ({} as Response),
    }
    await getGraphQLContext(testContext) // in usual operation, getGraphQLContext is called before all resolvers
    expect(getGraphQLContext(testContext)).rejects.toThrow("Slow down, you're sending too many requests.")
  })
})
