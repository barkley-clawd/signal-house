import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  mockSetHeader: vi.fn(),
  mockGetQuery: vi.fn(),
  mockInitDb: vi.fn().mockResolvedValue(undefined),
  mockGetLatestState: vi.fn(),
  mockGetDailyMetricsRange: vi.fn(),
  mockGetDailyMetricsRangeForRepo: vi.fn(),
}))

vi.mock('h3', () => ({
  defineEventHandler: (handler: Function) => handler,
  setHeader: mocks.mockSetHeader,
  getQuery: mocks.mockGetQuery,
}))

vi.mock('../../db/client', () => ({
  initDb: mocks.mockInitDb,
  getLatestState: mocks.mockGetLatestState,
  getDailyMetricsRange: mocks.mockGetDailyMetricsRange,
  getDailyMetricsRangeForRepo: mocks.mockGetDailyMetricsRangeForRepo,
}))

import handler from '../state.get'

describe('GET /api/state', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-14T12:00:00Z'))
    vi.clearAllMocks()
    vi.stubEnv('GITHUB_TOKEN', 'ghp_test')
    vi.stubEnv('GITHUB_OWNER', 'barkley-clawd')
    vi.stubEnv('SECRET_HOUSE_GITHUB_REPO', 'signal-house')
    vi.stubEnv('SECRET_HOUSE_GIT_REPOS', '/tmp/repo-a')
    vi.stubEnv('SECRET_HOUSE_SESSIONS_PERIOD_DAYS', '30')
    mocks.mockGetQuery.mockReturnValue({})
    mocks.mockGetLatestState.mockReturnValue({
      snapshot: null,
      lastRefreshAt: null,
      lastSuccessfulRefreshAt: null,
      refreshInProgress: false,
      isStale: true,
      dashboardWindow: null,
      diagnostics: {
        configuredProjectRoots: ['/workspace'],
        discoveredRepos: [],
        skippedPaths: [],
        parsedGitHubRemotes: [],
        collectionTargets: [],
        cacheAgeSeconds: null,
        pollerEnabled: false,
        pollerIntervalSeconds: 300,
        lastSuccessfulRefreshAt: null,
        lastError: null,
        sourceHealth: {},
      },
    })
    mocks.mockGetDailyMetricsRange.mockReturnValue([])
    mocks.mockGetDailyMetricsRangeForRepo.mockReturnValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('sets Cache-Control: no-cache header', async () => {
    const mockEvent = {} as any
    await handler(mockEvent)
    expect(mocks.mockSetHeader).toHaveBeenCalledWith(mockEvent, 'Cache-Control', 'no-cache')
  })

  it('initializes the database', async () => {
    await handler({} as any)
    expect(mocks.mockInitDb).toHaveBeenCalledOnce()
  })

  it('returns the latest state with a normalized 28-day dashboard window', async () => {
    const state = {
      snapshot: {
        id: 'snap-1',
        capturedAt: new Date().toISOString(),
        aggregates: {
          sessionUsage: {
            periodStart: '2026-05-18T00:00:00Z',
            periodEnd: '2026-06-14T12:00:00Z',
            totalSessions: 17,
            startedSessions: 5,
            completedSessions: 4,
            erroredSessions: 1,
            stuckSessions: 1,
            lastActivityAt: '2026-06-14T11:30:00Z',
            messages: 28,
            activeDays: 2,
            totalCost: 12.34,
            averageCostPerDay: 6.17,
            averageTokensPerSession: 100,
            medianTokensPerSession: 80,
            inputTokens: 60,
            outputTokens: 30,
            cacheReadTokens: 5,
            cacheWriteTokens: 10,
            uniqueTools: ['edit', 'search'],
            toolUsage: [
              { toolName: 'edit', count: 1, percentage: 50 },
              { toolName: 'search', count: 1, percentage: 50 },
            ],
            topActions: [
              { action: 'edit', count: 1 },
              { action: 'search', count: 1 },
            ],
            errorCount: 3,
          },
        },
      },
      lastRefreshAt: '2026-06-14T12:00:00.000Z',
      lastSuccessfulRefreshAt: '2026-06-14T12:00:00.000Z',
      refreshInProgress: false,
      isStale: false,
      dashboardWindow: null,
      diagnostics: {
        configuredProjectRoots: ['/workspace'],
        discoveredRepos: [],
        skippedPaths: [],
        parsedGitHubRemotes: [],
        collectionTargets: ['github', 'localGit'],
        cacheAgeSeconds: 0,
        pollerEnabled: true,
        pollerIntervalSeconds: 300,
        lastSuccessfulRefreshAt: '2026-06-14T12:00:00.000Z',
        lastError: null,
        sourceHealth: {},
      },
    }
    const rows = [
      {
        day: '2026-06-14',
        repoKey: 'all',
        capturedAt: '2026-06-14T12:00:00.000Z',
        source: 'orchestrated',
        version: 1,
        reflectsCompleteData: true,
        issuesOpened: 3,
        issuesClosed: 4,
        prsCreated: 5,
        prsMerged: 6,
        totalCommits: 7,
        avgCycleTimeDays: 2.5,
        medianCycleTimeDays: 2,
        p95CycleTimeDays: 4,
        cycleTimeSampleSize: 8,
        ciTotalRuns: 10,
        ciPassCount: 8,
        ciFailCount: 2,
        ciPassRate: 0.8,
        ciAvgDurationMs: 1200,
        totalSessions: 11,
        sessionErrorCount: 1,
        staleIssues: 2,
        stalePrs: 1,
        warnings: [],
        createdAt: '2026-06-14T12:00:00.000Z',
      },
      {
        day: '2026-06-12',
        repoKey: 'all',
        capturedAt: '2026-06-12T12:00:00.000Z',
        source: 'orchestrated',
        version: 1,
        reflectsCompleteData: false,
        issuesOpened: 1,
        issuesClosed: 2,
        prsCreated: 3,
        prsMerged: 4,
        totalCommits: 5,
        avgCycleTimeDays: null,
        medianCycleTimeDays: null,
        p95CycleTimeDays: null,
        cycleTimeSampleSize: 0,
        ciTotalRuns: 0,
        ciPassCount: 0,
        ciFailCount: 0,
        ciPassRate: null,
        ciAvgDurationMs: null,
        totalSessions: 6,
        sessionErrorCount: 2,
        staleIssues: 4,
        stalePrs: 3,
        warnings: ['Partial data: local git unavailable'],
        createdAt: '2026-06-12T12:00:00.000Z',
      },
    ]
    mocks.mockGetLatestState.mockReturnValue(state)
    mocks.mockGetDailyMetricsRange.mockReturnValue(rows)

    const result = await handler({} as any)

    expect(mocks.mockGetDailyMetricsRange).toHaveBeenCalledWith('2026-05-18', '2026-06-14')
    expect(mocks.mockGetLatestState).toHaveBeenCalledOnce()
    expect(result).toMatchObject({
      ...state,
      dashboardWindow: {
        startDay: '2026-05-18',
        endDay: '2026-06-14',
        missingDays: expect.arrayContaining(['2026-06-13']),
        sessionUsage: {
          periodStart: '2026-05-18T00:00:00Z',
          periodEnd: '2026-06-14T12:00:00Z',
          totalSessions: 17,
          startedSessions: 5,
          completedSessions: 4,
          erroredSessions: 1,
          stuckSessions: 1,
          lastActivityAt: '2026-06-14T11:30:00Z',
          messages: 28,
          activeDays: 2,
          totalCost: 12.34,
          averageCostPerDay: 6.17,
          averageTokensPerSession: 100,
          medianTokensPerSession: 80,
          inputTokens: 60,
          outputTokens: 30,
          cacheReadTokens: 5,
          cacheWriteTokens: 10,
          uniqueTools: ['edit', 'search'],
          toolUsage: [
            { toolName: 'edit', count: 1, percentage: 50 },
            { toolName: 'search', count: 1, percentage: 50 },
          ],
          topActions: [
            { action: 'edit', count: 1 },
            { action: 'search', count: 1 },
          ],
          errorCount: 3,
          status: 'available',
          message: null,
        },
        cards: {
          throughput: {
            issuesOpened: 4,
            issuesClosed: 6,
            prsCreated: 8,
            prsMerged: 10,
            totalCommits: 12,
            status: 'partial',
            message: 'Partial data - one or more throughput sources failed during the last refresh',
          },
          cycleTime: {
            averageDays: 2.5,
            medianDays: 2,
            p95Days: 4,
            sampleSize: 8,
            sourceDay: '2026-06-14',
            status: 'available',
            message: null,
          },
          ci: {
            totalRuns: 10,
            passCount: 8,
            failCount: 2,
            passRate: 0.8,
            averageDurationMs: 1200,
            sourceDays: 1,
            status: 'available',
            message: null,
          },
          staleWork: {
            staleIssues: 2,
            stalePrs: 1,
            capturedAt: '2026-06-14T12:00:00.000Z',
            reflectsCompleteData: true,
            status: 'available',
            message: null,
          },
          sessionUsage: {
          totalSessions: 17,
          startedSessions: 5,
          completedSessions: 4,
          erroredSessions: 1,
          stuckSessions: 1,
          lastActivityAt: '2026-06-14T11:30:00Z',
          sessionErrorCount: 3,
          status: 'available',
          message: null,
          },
        },
        coverage: {
          totalDays: 28,
          daysWithData: 2,
          missingDays: 26,
          hasGaps: true,
          hasSourceWarnings: true,
          isComplete: false,
        },
      },
    })

    expect(result.dashboardWindow.latestDay?.day).toBe('2026-06-14')

    expect(result.dashboardWindow.days).toHaveLength(28)
    expect(result.dashboardWindow.days[0]).toMatchObject({ day: '2026-05-18', isGap: true, metrics: null })
    expect(result.dashboardWindow.days.at(-1)).toMatchObject({ day: '2026-06-14', isGap: false })
    expect(result.dashboardWindow.warnings).toEqual(
      expect.arrayContaining([
        'Partial data: local git unavailable',
        'Missing 26 of 28 days in the rolling window',
      ]),
    )
  })

  it('returns repo-filtered daily metrics when repoKey is provided', async () => {
    mocks.mockGetQuery.mockReturnValue({ repoKey: 'github:barkley-clawd/signal-house' })
    mocks.mockGetDailyMetricsRangeForRepo.mockReturnValue([
      {
        day: '2026-06-14',
        repoKey: 'github:barkley-clawd/signal-house',
        capturedAt: '2026-06-14T12:00:00.000Z',
        source: 'orchestrated',
        version: 1,
        reflectsCompleteData: true,
        issuesOpened: 1,
        issuesClosed: 2,
        prsCreated: 3,
        prsMerged: 4,
        totalCommits: 5,
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
        createdAt: '2026-06-14T12:00:00.000Z',
      },
    ])

    const result = await handler({} as any)

    expect(mocks.mockGetDailyMetricsRange).not.toHaveBeenCalled()
    expect(mocks.mockGetDailyMetricsRangeForRepo).toHaveBeenCalledWith(
      '2026-05-18',
      '2026-06-14',
      'github:barkley-clawd/signal-house',
    )
    expect(result.dashboardWindow.days.at(-1)).toMatchObject({
      day: '2026-06-14',
      isGap: false,
      metrics: expect.objectContaining({
        repoKey: 'github:barkley-clawd/signal-house',
      }),
    })
    expect(result.dashboardWindow.coverage.daysWithData).toBe(1)
  })

  it('propagates refreshInProgress from the database', async () => {
    mocks.mockGetLatestState.mockReturnValue({
      snapshot: null,
      lastRefreshAt: null,
      lastSuccessfulRefreshAt: null,
      refreshInProgress: true,
      isStale: true,
      dashboardWindow: null,
    })

    const result = await handler({} as any)
    expect(result.refreshInProgress).toBe(true)
  })
})
