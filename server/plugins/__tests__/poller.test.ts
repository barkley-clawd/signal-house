import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'

const mocks = {
  mockInitDb: jest.fn(),
  mockStartMetricsPoller: jest.fn(),
  mockGetPollerConfig: jest.fn(),
}

jest.mock('../../db/client', () => ({
  initDb: mocks.mockInitDb,
}))

jest.mock('../../lib/poller', () => ({
  getPollerConfig: mocks.mockGetPollerConfig,
  startMetricsPoller: mocks.mockStartMetricsPoller,
}))

import { startAppPoller, stopAppPoller } from '../poller'

describe('poller plugin', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('does not start the poller when disabled', async () => {
    mocks.mockInitDb.mockResolvedValue(undefined)
    mocks.mockGetPollerConfig.mockReturnValue({
      enabled: false,
      intervalMs: 300000,
      runOnStartup: true,
      startupDelayMs: 0,
    })

    const runtime = await startAppPoller()

    expect(mocks.mockInitDb).toHaveBeenCalledTimes(1)
    expect(mocks.mockStartMetricsPoller).not.toHaveBeenCalled()
    expect(runtime).toBeNull()
  })

  it('starts the poller at process startup and stops it on shutdown', async () => {
    const runtime = { stop: jest.fn() }
    mocks.mockInitDb.mockResolvedValue(undefined)
    mocks.mockGetPollerConfig.mockReturnValue({
      enabled: true,
      intervalMs: 300000,
      runOnStartup: true,
      startupDelayMs: 0,
    })
    mocks.mockStartMetricsPoller.mockReturnValue(runtime)

    const startedRuntime = await startAppPoller()

    expect(mocks.mockInitDb).toHaveBeenCalledTimes(1)
    expect(mocks.mockStartMetricsPoller).toHaveBeenCalledWith({
      enabled: true,
      intervalMs: 300000,
      runOnStartup: true,
      startupDelayMs: 0,
    })
    expect(startedRuntime).toBe(runtime)

    stopAppPoller(startedRuntime)
    expect(runtime.stop).toHaveBeenCalledTimes(1)
  })

  it('does not throw on shutdown when no runtime exists', () => {
    expect(() => stopAppPoller(null)).not.toThrow()
  })
})
