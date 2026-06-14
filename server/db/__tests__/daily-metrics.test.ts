import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { initDb, upsertDailyMetrics, getDailyMetricsRange, getLatestDailyDay, close } from '../client'
import type { DailyMetricsInsert } from '../../../types/daily-metrics'

let tmpDir: string

function makeRow(day: string, overrides: Partial<DailyMetricsInsert> = {}): DailyMetricsInsert {
  return {
    day,
    capturedAt: day + 'T12:00:00Z',
    source: 'test',
    reflectsCompleteData: true,
    issuesOpened: 0,
    issuesClosed: 0,
    prsCreated: 0,
    prsMerged: 0,
    totalCommits: 0,
    avgCycleTimeDays: null,
    medianCycleTimeDays: null,
    p95CycleTimeDays: null,
    cycleTimeSampleSize: 0,
    ciTotalRuns: 0,
    ciPassCount: 0,
    ciFailCount: 0,
    ciPassRate: null,
    ciAvgDurationMs: null,
    totalSessions: 0,
    sessionErrorCount: 0,
    staleIssues: 0,
    stalePrs: 0,
    warnings: [],
    ...overrides,
  }
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'daily-metrics-test-'))
  process.env['DB_DIR'] = tmpDir
})

afterEach(() => {
  close()
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('daily_metrics table', () => {
  it('inserts a daily metrics row and retrieves it', async () => {
    await initDb()
    const row = makeRow('2026-06-01', {
      issuesOpened: 5,
      issuesClosed: 3,
      prsCreated: 2,
      prsMerged: 1,
      totalCommits: 20,
    })
    upsertDailyMetrics(row)

    const results = getDailyMetricsRange('2026-06-01', '2026-06-01')
    expect(results).toHaveLength(1)
    expect(results[0]!.day).toBe('2026-06-01')
    expect(results[0]!.issuesOpened).toBe(5)
    expect(results[0]!.issuesClosed).toBe(3)
    expect(results[0]!.prsCreated).toBe(2)
    expect(results[0]!.prsMerged).toBe(1)
    expect(results[0]!.totalCommits).toBe(20)
    expect(results[0]!.source).toBe('test')
    expect(results[0]!.reflectsCompleteData).toBe(true)
  })

  it('overwrites an existing day on second insert (same-day overwrite)', async () => {
    await initDb()
    const row1 = makeRow('2026-06-01', { issuesOpened: 5, totalCommits: 20 })
    upsertDailyMetrics(row1)

    const row2 = makeRow('2026-06-01', { issuesOpened: 8, totalCommits: 25 })
    upsertDailyMetrics(row2)

    const results = getDailyMetricsRange('2026-06-01', '2026-06-01')
    expect(results).toHaveLength(1)
    expect(results[0]!.issuesOpened).toBe(8)
    expect(results[0]!.totalCommits).toBe(25)
  })

  it('preserves different days separately', async () => {
    await initDb()
    upsertDailyMetrics(makeRow('2026-06-01', { issuesOpened: 3 }))
    upsertDailyMetrics(makeRow('2026-06-02', { issuesOpened: 7 }))
    upsertDailyMetrics(makeRow('2026-06-03', { issuesOpened: 1 }))

    const results = getDailyMetricsRange('2026-06-01', '2026-06-03')
    expect(results).toHaveLength(3)
    expect(results.find((r) => r.day === '2026-06-02')!.issuesOpened).toBe(7)
  })

  it('queries a date range returning only days that have data (missing days by omission)', async () => {
    await initDb()
    upsertDailyMetrics(makeRow('2026-06-01'))
    upsertDailyMetrics(makeRow('2026-06-03'))
    upsertDailyMetrics(makeRow('2026-06-05'))

    const results = getDailyMetricsRange('2026-06-01', '2026-06-05')
    expect(results).toHaveLength(3)
    const days = results.map((r) => r.day).sort()
    expect(days).toEqual(['2026-06-01', '2026-06-03', '2026-06-05'])
  })

  it('returns empty array when no days in range', async () => {
    await initDb()
    upsertDailyMetrics(makeRow('2026-06-01'))

    const results = getDailyMetricsRange('2026-06-10', '2026-06-20')
    expect(results).toHaveLength(0)
  })

  it('returns results in descending order', async () => {
    await initDb()
    upsertDailyMetrics(makeRow('2026-06-01'))
    upsertDailyMetrics(makeRow('2026-06-02'))
    upsertDailyMetrics(makeRow('2026-06-03'))

    const results = getDailyMetricsRange('2026-06-01', '2026-06-03')
    expect(results.map((r) => r.day)).toEqual(['2026-06-03', '2026-06-02', '2026-06-01'])
  })

  it('getLatestDailyDay returns the latest day', async () => {
    await initDb()
    expect(getLatestDailyDay()).toBeNull()

    upsertDailyMetrics(makeRow('2026-06-01'))
    expect(getLatestDailyDay()).toBe('2026-06-01')

    upsertDailyMetrics(makeRow('2026-06-05'))
    expect(getLatestDailyDay()).toBe('2026-06-05')
  })

  it('stores and retrieves nullable numeric fields correctly', async () => {
    await initDb()
    upsertDailyMetrics(makeRow('2026-06-01', {
      avgCycleTimeDays: 3.5,
      medianCycleTimeDays: 2.1,
      p95CycleTimeDays: 8.9,
      cycleTimeSampleSize: 10,
      ciPassRate: 0.85,
      ciAvgDurationMs: 1200,
    }))

    const results = getDailyMetricsRange('2026-06-01', '2026-06-01')
    expect(results[0]!.avgCycleTimeDays).toBe(3.5)
    expect(results[0]!.medianCycleTimeDays).toBe(2.1)
    expect(results[0]!.p95CycleTimeDays).toBe(8.9)
    expect(results[0]!.cycleTimeSampleSize).toBe(10)
    expect(results[0]!.ciPassRate).toBe(0.85)
    expect(results[0]!.ciAvgDurationMs).toBe(1200)
  })

  it('stores and retrieves warnings array', async () => {
    await initDb()
    upsertDailyMetrics(makeRow('2026-06-01', {
      warnings: ['Partial data: GitHub rate limit exceeded', 'Session collector failed'],
    }))

    const results = getDailyMetricsRange('2026-06-01', '2026-06-01')
    expect(results[0]!.warnings).toEqual([
      'Partial data: GitHub rate limit exceeded',
      'Session collector failed',
    ])
  })

  it('boots cleanly on existing database (schema migration)', async () => {
    await initDb()
    upsertDailyMetrics(makeRow('2026-06-01'))
    close()

    const db2 = await initDb()
    expect(db2).toBeTruthy()
    const results = getDailyMetricsRange('2026-06-01', '2026-06-01')
    expect(results).toHaveLength(1)
    expect(results[0]!.day).toBe('2026-06-01')
  })
})
