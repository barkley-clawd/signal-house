import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { collectTokenUsageSnapshot } from '../collector'

const execFileSync = jest.fn()

jest.mock('node:child_process', () => ({
  execFileSync: (...args: unknown[]) => execFileSync(...args),
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('collectTokenUsageSnapshot', () => {
  it('returns a refresh-scoped fallback when the binary is missing', () => {
    execFileSync.mockImplementation(() => { throw Object.assign(new Error('spawnSync ENOENT'), { code: 'ENOENT' }) })
    const result = collectTokenUsageSnapshot()
    expect(result.source).toBe('opencode')
    expect(result.toolName).toBe('opencode')
    expect(result.periodStart).toBeTruthy()
    expect(result.periodEnd).toBeTruthy()
  })

  it('parses opencode stats output into token usage rows', () => {
    execFileSync.mockReturnValueOnce('')  // --version check succeeds
    execFileSync.mockReturnValueOnce([
      '│ Sessions    4 │',
      '│ Messages    16 │',
      '│ Input       1.2K │',
      '│ Output      800 │',
      '│ Total Cost  $1.25 │',
      '│ opencode-go/minimax-m3 │',
      'Messages 3',
      'Input Tokens 100',
      'Output Tokens 200',
      'Cache Read 50',
      'Cache Write 25',
      'Cost $0.42',
    ].join('\n'))

    const result = collectTokenUsageSnapshot()

    expect(result.totalSessions).toBe(4)
    expect(result.totalMessages).toBe(16)
    expect(result.totalTokens).toBe(2000)
    expect(result.totalCost).toBe(1.25)
    expect(result.modelUsage).toEqual([
      {
        modelName: 'opencode-go/minimax-m3',
        messages: 3,
        inputTokens: 100,
        outputTokens: 200,
        cacheReadTokens: 50,
        cacheWriteTokens: 25,
        cost: 0.42,
      },
    ])
  })
})
