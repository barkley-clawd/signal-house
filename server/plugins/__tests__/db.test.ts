import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'

const mocks = {
  mockInitDb: jest.fn(),
  mockClose: jest.fn(),
  mockRunRetention: jest.fn().mockReturnValue({ snapshotsDeleted: 0, aggregatesDeleted: 0, dailyMetricsDeleted: 0, sessionsDeleted: 0, workflowRunsDeleted: 0 }),
}

jest.mock('../../db/client', () => ({
  initDb: mocks.mockInitDb,
  close: mocks.mockClose,
  runRetention: mocks.mockRunRetention,
}))

import { startDb, stopDb } from '../db'

describe('db plugin', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('initializes the database at startup and closes it on shutdown', async () => {
    mocks.mockInitDb.mockResolvedValue(undefined)

    await startDb()

    expect(mocks.mockInitDb).toHaveBeenCalledTimes(1)
    expect(mocks.mockRunRetention).toHaveBeenCalledTimes(1)

    stopDb()
    expect(mocks.mockClose).toHaveBeenCalledTimes(1)
  })
})
