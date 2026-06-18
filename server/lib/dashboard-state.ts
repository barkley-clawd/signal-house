import type { DailyMetricsRow } from '../../types/daily-metrics'
import type {
  DashboardWindow,
  DashboardWindowCoverage,
  DashboardWindowDay,
  DashboardWindowCycleTimeSummary,
  DashboardWindowCISummary,
  DashboardPanelStatus,
  DashboardWindowSessionUsageSummary,
  DashboardWindowSessionSummary,
  DashboardWindowStaleWorkSummary,
  DashboardWindowThroughputSummary,
} from '../../types/snapshot'
import type { SessionUsageAggregate } from '../../types/aggregates'
import { getEnv } from './env'
import { getDashboardWindowDays } from './runtime-config'

function toUtcDay(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function parseUtcDay(day: string): Date {
  return new Date(`${day}T00:00:00Z`)
}

function addUtcDays(day: string, offset: number): string {
  const date = parseUtcDay(day)
  date.setUTCDate(date.getUTCDate() + offset)
  return toUtcDay(date)
}

function buildUtcDays(endDay: string, windowDays = getDashboardWindowDays()): string[] {
  const start = parseUtcDay(addUtcDays(endDay, -(windowDays - 1)))
  const days: string[] = []
  const current = new Date(start)

  while (current <= parseUtcDay(endDay)) {
    days.push(toUtcDay(current))
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return days
}

function sumBy<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((sum, row) => sum + pick(row), 0)
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values))
}

function hasGithubConfig(): boolean {
  return Boolean(
    getEnv(process.env, 'SECRET_HOUSE_GITHUB_TOKEN', 'GITHUB_TOKEN')
    && getEnv(process.env, 'SECRET_HOUSE_GITHUB_OWNER', 'GITHUB_OWNER')
    && getEnv(process.env, 'SECRET_HOUSE_GITHUB_REPO', 'GITHUB_REPO'),
  )
}

function hasLocalGitConfig(): boolean {
  const repos = getEnv(process.env, 'SECRET_HOUSE_GIT_REPOS', 'GIT_REPOS')
  if (repos && repos.split(',').map(part => part.trim()).filter(Boolean).length > 0) return true
  const roots = getEnv(process.env, 'SECRET_HOUSE_PROJECT_ROOTS', 'GIT_REPO_ROOTS')
  return Boolean(roots && roots.split(',').map(r => r.trim()).filter(Boolean).length > 0)
}

function hasSessionConfig(): boolean {
  return Boolean(
    getEnv(process.env, 'SECRET_HOUSE_SESSIONS_PERIOD_DAYS', 'SESSIONS_PERIOD_DAYS')
    || getEnv(process.env, 'SECRET_HOUSE_OPENCODE_BIN', 'OPENCODE_BIN')
    || getEnv(process.env, 'SECRET_HOUSE_OPENCODE_COMMAND', 'OPENCODE_COMMAND'),
  )
}

function hasWarning(rows: DailyMetricsRow[], patterns: RegExp[]): boolean {
  return rows.some(row => row.warnings.some(warning => patterns.some(pattern => pattern.test(warning))))
}

function lastRowWithCycleTime(rows: DailyMetricsRow[]): DailyMetricsRow | null {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i]
    if (!row) continue
    if (row.avgCycleTimeDays != null || row.medianCycleTimeDays != null || row.p95CycleTimeDays != null || row.cycleTimeSampleSize > 0) {
      return row
    }
  }

  return null
}

function latestRow(rows: DailyMetricsRow[]): DailyMetricsRow | null {
  return rows[rows.length - 1] ?? null
}

function buildSessionUsageSummary(
  rows: DailyMetricsRow[],
  aggregate: SessionUsageAggregate | null,
): DashboardWindowSessionUsageSummary {
  const configuredSessions = hasSessionConfig()
  const periodStart = aggregate?.periodStart ?? rows[0]?.day ?? ''
  const periodEnd = aggregate?.periodEnd ?? rows.at(-1)?.day ?? ''

  if (!configuredSessions) {
    return {
      periodStart,
      periodEnd,
      totalSessions: aggregate?.totalSessions ?? 0,
      startedSessions: aggregate?.startedSessions ?? null,
      completedSessions: aggregate?.completedSessions ?? null,
      erroredSessions: aggregate?.erroredSessions ?? null,
      stuckSessions: aggregate?.stuckSessions ?? null,
      lastActivityAt: aggregate?.lastActivityAt ?? null,
      messages: aggregate?.messages ?? null,
      activeDays: aggregate?.activeDays ?? null,
      totalCost: aggregate?.totalCost ?? null,
      averageCostPerDay: aggregate?.averageCostPerDay ?? null,
      averageTokensPerSession: aggregate?.averageTokensPerSession ?? null,
      medianTokensPerSession: aggregate?.medianTokensPerSession ?? null,
      inputTokens: aggregate?.inputTokens ?? null,
      outputTokens: aggregate?.outputTokens ?? null,
      cacheReadTokens: aggregate?.cacheReadTokens ?? null,
      cacheWriteTokens: aggregate?.cacheWriteTokens ?? null,
      uniqueTools: aggregate?.uniqueTools ?? [],
      toolUsage: aggregate?.toolUsage ?? [],
      topActions: aggregate?.topActions ?? [],
      errorCount: aggregate?.errorCount ?? 0,
      status: 'unconfigured',
      message: 'Session metrics unavailable - configure OPENCODE_BIN or ensure opencode stats works',
    }
  }

  const sessionTotal = aggregate?.totalSessions ?? sumBy(rows, row => row.totalSessions)
  const sessionErrorCount = aggregate?.errorCount ?? sumBy(rows, row => row.sessionErrorCount)
  const hasSourceError = hasWarning(rows, [/opencode stats CLI unavailable/i, /session collector/i])
  const sessionFieldsPresent = aggregate != null

  let status: DashboardPanelStatus = 'available'
  let message: string | null = null

  if (hasSourceError && !sessionFieldsPresent) {
    status = 'unavailable'
    message = 'Session metrics unavailable - opencode stats could not be collected'
  } else if (!sessionFieldsPresent) {
    status = 'empty'
    message = 'No session activity'
  }

  return {
    periodStart,
    periodEnd,
    totalSessions: sessionTotal,
    startedSessions: aggregate?.startedSessions ?? null,
    completedSessions: aggregate?.completedSessions ?? null,
    erroredSessions: aggregate?.erroredSessions ?? null,
    stuckSessions: aggregate?.stuckSessions ?? null,
    lastActivityAt: aggregate?.lastActivityAt ?? null,
    messages: aggregate?.messages ?? null,
    activeDays: aggregate?.activeDays ?? null,
    totalCost: aggregate?.totalCost ?? null,
    averageCostPerDay: aggregate?.averageCostPerDay ?? null,
    averageTokensPerSession: aggregate?.averageTokensPerSession ?? null,
    medianTokensPerSession: aggregate?.medianTokensPerSession ?? null,
    inputTokens: aggregate?.inputTokens ?? null,
    outputTokens: aggregate?.outputTokens ?? null,
    cacheReadTokens: aggregate?.cacheReadTokens ?? null,
    cacheWriteTokens: aggregate?.cacheWriteTokens ?? null,
    uniqueTools: aggregate?.uniqueTools ?? [],
    toolUsage: aggregate?.toolUsage ?? [],
    topActions: aggregate?.topActions ?? [],
    errorCount: sessionErrorCount,
    status,
    message,
  }
}

function buildThroughputSummary(rows: DailyMetricsRow[]): DashboardWindowThroughputSummary {
  const configuredGithub = hasGithubConfig()
  const configuredLocalGit = hasLocalGitConfig()
  const partial = hasWarning(rows, [/GitHub/i, /local git/i])
  const totalDataPoints = sumBy(rows, row => row.issuesOpened + row.issuesClosed + row.prsCreated + row.prsMerged + row.totalCommits)

  let status: DashboardPanelStatus = 'available'
  let message: string | null = null

  if (!configuredGithub && !configuredLocalGit) {
    status = 'unconfigured'
    message = 'Throughput unavailable - configure GitHub and local git sources'
  } else if (partial) {
    status = totalDataPoints > 0 ? 'partial' : 'unavailable'
    message = totalDataPoints > 0
      ? 'Partial data - one or more throughput sources failed during the last refresh'
      : 'Throughput unavailable - one or more sources failed during the last refresh'
  } else if (rows.length === 0) {
    status = 'empty'
    message = 'No throughput data in this window'
  }

  return {
    issuesOpened: sumBy(rows, row => row.issuesOpened),
    issuesClosed: sumBy(rows, row => row.issuesClosed),
    prsCreated: sumBy(rows, row => row.prsCreated),
    prsMerged: sumBy(rows, row => row.prsMerged),
    totalCommits: sumBy(rows, row => row.totalCommits),
    status,
    message,
  }
}

function buildCycleTimeSummary(rows: DailyMetricsRow[]): DashboardWindowCycleTimeSummary {
  const latest = lastRowWithCycleTime(rows)
  const configuredGithub = hasGithubConfig()
  const hasSourceError = hasWarning(rows, [/GitHub/i])
  let status: DashboardPanelStatus = 'available'
  let message: string | null = null

  if (!configuredGithub) {
    status = 'unconfigured'
    message = 'Cycle time unavailable - configure GitHub access'
  } else if (hasSourceError && latest == null) {
    status = 'unavailable'
    message = 'Cycle time unavailable - GitHub collector failed during the last refresh'
  } else if (latest == null) {
    status = 'empty'
    message = 'No cycle time data in this window'
  }

  return {
    averageDays: latest?.avgCycleTimeDays ?? null,
    medianDays: latest?.medianCycleTimeDays ?? null,
    p95Days: latest?.p95CycleTimeDays ?? null,
    sampleSize: latest?.cycleTimeSampleSize ?? 0,
    sourceDay: latest?.day ?? null,
    status,
    message,
  }
}

function buildCiSummary(rows: DailyMetricsRow[]): DashboardWindowCISummary {
  const ciRows = rows.filter(row => row.ciTotalRuns > 0 || row.ciPassCount > 0 || row.ciFailCount > 0)
  const configuredGithub = hasGithubConfig()
  const hasSourceError = hasWarning(rows, [/workflow runs? could not be collected/i, /GitHub collector/i, /CI data unavailable/i])
  const hasMissingDailyCiData = hasWarning(rows, [/CI trend unavailable/i])
  const totalRuns = sumBy(ciRows, row => row.ciTotalRuns)
  const passCount = sumBy(ciRows, row => row.ciPassCount)
  const failCount = sumBy(ciRows, row => row.ciFailCount)
  const weightedDuration = ciRows.reduce((sum, row) => {
    if (row.ciAvgDurationMs == null || row.ciTotalRuns <= 0) return sum
    return sum + (row.ciAvgDurationMs * row.ciTotalRuns)
  }, 0)
  const durationWeight = ciRows.reduce((sum, row) => {
    if (row.ciAvgDurationMs == null || row.ciTotalRuns <= 0) return sum
    return sum + row.ciTotalRuns
  }, 0)

  let status: DashboardPanelStatus = 'available'
  let message: string | null = null

  if (!configuredGithub) {
    status = 'unconfigured'
    message = 'CI health unavailable - configure GitHub access'
  } else if (hasSourceError && totalRuns === 0) {
    status = 'unavailable'
    message = 'CI data unavailable - GitHub workflow runs could not be collected'
  } else if (hasMissingDailyCiData && totalRuns === 0) {
    status = 'empty'
    message = 'No per-day CI data in this window'
  } else if (totalRuns === 0) {
    status = 'empty'
    message = 'No per-day CI data in this window'
  }

  return {
    totalRuns,
    passCount,
    failCount,
    passRate: totalRuns > 0 ? passCount / totalRuns : null,
    averageDurationMs: durationWeight > 0 ? weightedDuration / durationWeight : null,
    sourceDays: ciRows.length,
    status,
    message,
  }
}

function buildStaleWorkSummary(rows: DailyMetricsRow[]): DashboardWindowStaleWorkSummary {
  const latest = latestRow(rows)
  const configuredGithub = hasGithubConfig()
  const hasSourceError = hasWarning(rows, [/GitHub/i])
  const hasStaleWork = (latest?.staleIssues ?? 0) > 0 || (latest?.stalePrs ?? 0) > 0
  let status: DashboardPanelStatus = 'available'
  let message: string | null = null

  if (!configuredGithub) {
    status = 'unconfigured'
    message = 'Stale work unavailable - configure GitHub access'
  } else if (hasSourceError && !hasStaleWork) {
    status = 'unavailable'
    message = 'Stale work unavailable - GitHub collector failed during the last refresh'
  } else if (!hasStaleWork) {
    message = 'No stale work'
  }

  return {
    staleIssues: latest?.staleIssues ?? 0,
    stalePrs: latest?.stalePrs ?? 0,
    capturedAt: latest?.capturedAt ?? null,
    reflectsCompleteData: latest?.reflectsCompleteData ?? null,
    status,
    message,
  }
}

function buildSessionSummary(sessionUsage: DashboardWindowSessionUsageSummary | null): DashboardWindowSessionSummary {
  let status: DashboardPanelStatus = 'available'
  let message: string | null = null

  if (!sessionUsage) {
    status = 'unavailable'
    message = 'Session metrics unavailable'
  } else {
    status = sessionUsage.status
    message = sessionUsage.message
  }

  return {
    totalSessions: sessionUsage?.totalSessions ?? 0,
    sessionErrorCount: sessionUsage?.errorCount ?? 0,
    startedSessions: sessionUsage?.startedSessions ?? null,
    completedSessions: sessionUsage?.completedSessions ?? null,
    erroredSessions: sessionUsage?.erroredSessions ?? null,
    stuckSessions: sessionUsage?.stuckSessions ?? null,
    lastActivityAt: sessionUsage?.lastActivityAt ?? null,
    status,
    message,
  }
}

function buildCoverage(rows: DailyMetricsRow[], missingDays: string[], warnings: string[]): DashboardWindowCoverage {
  const daysWithData = rows.length
  const hasSourceWarnings = warnings.length > 0

  return {
    totalDays: getDashboardWindowDays(),
    daysWithData,
    missingDays: missingDays.length,
    hasGaps: missingDays.length > 0,
    hasSourceWarnings,
    isComplete: missingDays.length === 0 && !hasSourceWarnings,
  }
}

export function buildDashboardWindow(
  rows: DailyMetricsRow[],
  now = new Date(),
  isStale = false,
  sessionUsageAggregate: SessionUsageAggregate | null = null,
): DashboardWindow {
  const endDay = toUtcDay(now)
  const days = buildUtcDays(endDay, getDashboardWindowDays())
  const rowsByDay = new Map(rows.map(row => [row.day, row]))
  const windowRows = days.map((day): DashboardWindowDay => {
    const metrics = rowsByDay.get(day) ?? null
    return {
      day,
      isGap: metrics == null,
      metrics,
    }
  })
  const presentRows = windowRows
    .map(point => point.metrics)
    .filter((row): row is DailyMetricsRow => row != null)
    .sort((a, b) => a.day.localeCompare(b.day))

  const rowWarnings = unique(presentRows.flatMap(row => row.warnings))
  const missingDays = windowRows.filter(point => point.isGap).map(point => point.day)
  const warnings = unique([
    ...rowWarnings,
    ...(missingDays.length > 0 ? [`Missing ${missingDays.length} of ${getDashboardWindowDays()} days in the rolling window`] : []),
  ])

  const throughput = buildThroughputSummary(presentRows)
  const cycleTime = buildCycleTimeSummary(presentRows)
  const ci = buildCiSummary(presentRows)
  const staleWork = buildStaleWorkSummary(presentRows)
  const sessionUsage = buildSessionUsageSummary(presentRows, sessionUsageAggregate)
  const sessionSummary = buildSessionSummary(sessionUsage)

  if (isStale) {
    for (const panel of [throughput, cycleTime, ci, staleWork, sessionSummary]) {
      if (panel.status === 'available') {
        panel.status = 'stale'
        panel.message = panel.message ?? 'Cached data may be stale'
      }
    }
    if (sessionUsage && sessionUsage.status === 'available') {
      sessionUsage.status = 'stale'
      sessionUsage.message = sessionUsage.message ?? 'Cached data may be stale'
    }
  }

  return {
    startDay: days[0] ?? endDay,
    endDay,
    days: windowRows,
    missingDays,
    latestDay: latestRow(presentRows),
    sessionUsage,
    cards: {
      throughput,
      cycleTime,
      ci,
      staleWork,
      sessionUsage: sessionSummary,
    },
    coverage: buildCoverage(presentRows, missingDays, rowWarnings),
    warnings,
  }
}
