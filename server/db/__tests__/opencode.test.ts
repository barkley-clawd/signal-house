import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

jest.mock('../../lib/opencode/collector', () => ({
  collectTokenUsageSnapshot: jest.fn().mockReturnValue({
    periodStart: '2026-05-22T12:00:00.000Z',
    periodEnd: '2026-06-19T12:00:00.000Z',
    source: 'opencodedb',
    toolName: 'opencode',
    totalSessions: 3,
    totalMessages: 9,
    totalTokens: 1234,
    totalCost: 4.56,
    modelUsage: [{
      modelName: 'opencode-go/deepseek-v4-flash',
      messages: 9,
      inputTokens: 1000,
      outputTokens: 234,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      cost: 4.56,
    }],
    rawJson: '{"ok":true}',
    collectedAt: '2026-06-19T12:00:00.000Z',
    errors: [],
  }),
}))

import { collectTokenUsageSnapshot } from '../../lib/opencode/collector'

beforeEach(() => {
  jest.clearAllMocks()
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('token usage collector', () => {
  it('returns a refresh-scoped snapshot with model usage', () => {
    const result = collectTokenUsageSnapshot()
    expect(result.periodStart).toBe('2026-05-22T12:00:00.000Z')
    expect(result.periodEnd).toBe('2026-06-19T12:00:00.000Z')
    expect(result.toolName).toBe('opencode')
    expect(result.modelUsage).toHaveLength(1)
    expect(result.modelUsage[0]!.modelName).toContain('deepseek-v4-flash')
  })
})
