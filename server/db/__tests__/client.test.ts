import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { initDb, getLatestState, close } from '../client'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'metrics-test-'))
  process.env['DB_DIR'] = tmpDir
})

afterEach(() => {
  close()
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('initDb on fresh database', () => {
  it('initializes and returns a valid db', async () => {
    const db = await initDb()
    expect(db).toBeTruthy()
    expect(typeof db.run).toBe('function')
  })

  it('getLatestState returns defaults on empty db', async () => {
    await initDb()
    const state = getLatestState()
    expect(state.snapshot).toBeNull()
    expect(state.lastRefreshAt).toBeNull()
    expect(state.lastSuccessfulRefreshAt).toBeNull()
    expect(state.refreshInProgress).toBe(false)
    expect(state.isStale).toBe(true)
  })

  it('getLatestState can be called multiple times', async () => {
    await initDb()
    const state1 = getLatestState()
    const state2 = getLatestState()
    expect(state1).toEqual(state2)
  })
})
