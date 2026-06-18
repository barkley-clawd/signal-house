import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  mockInitDb: vi.fn(),
  mockClose: vi.fn(),
}))

vi.mock('../../db/client', () => ({
  initDb: mocks.mockInitDb,
  close: mocks.mockClose,
}))

const mockHooks: { name: string; fn: (...args: unknown[]) => unknown }[] = []

vi.mock('nitropack/runtime', () => ({
  defineNitroPlugin: (def: (nitroApp: unknown) => unknown) => def,
}))

import dbPlugin from '../db'

function makeNitroApp() {
  return {
    hooks: {
      hook: (name: string, fn: (...args: unknown[]) => unknown) => {
        mockHooks.push({ name, fn })
        return () => {}
      },
    },
  }
}

describe('db plugin', () => {
  beforeEach(() => {
    mockHooks.length = 0
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes the database at startup and closes it on shutdown', async () => {
    mocks.mockInitDb.mockResolvedValue(undefined)

    await (dbPlugin as (app: unknown) => Promise<void>)(makeNitroApp())

    expect(mocks.mockInitDb).toHaveBeenCalledTimes(1)

    const closeHook = mockHooks.find(h => h.name === 'close')
    expect(closeHook).toBeDefined()

    closeHook?.fn()
    expect(mocks.mockClose).toHaveBeenCalledTimes(1)
  })
})
