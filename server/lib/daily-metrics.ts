import type { MetricSnapshot } from '../../types/snapshot'
import type { DailyMetricsInsert } from '../../types/daily-metrics'
import type { CycleTimeAggregate, CIAggregate } from '../../types/aggregates'

function toDayKey(isoString: string): string {
  return isoString.slice(0, 10)
}

function extractDaysFromRange(startIso: string, endIso: string): string[] {
  const days: string[] = []
  const start = new Date(startIso.slice(0, 10) + 'T00:00:00Z')
  const end = new Date(endIso.slice(0, 10) + 'T00:00:00Z')
  const current = new Date(start)
  while (current <= end) {
    days.push(current.toISOString().slice(0, 10))
    current.setUTCDate(current.getUTCDate() + 1)
  }
  return days
}

function countByDay<T>(
  items: T[],
  getTimestamp: (item: T) => string | null,
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const item of items) {
    const ts = getTimestamp(item)
    if (!ts) continue
    const day = toDayKey(ts)
    counts.set(day, (counts.get(day) || 0) + 1)
  }
  return counts
}

type DailyMetricBuckets = {
  issuesOpenedByDay: Map<string, number>
  issuesClosedByDay: Map<string, number>
  prsCreatedByDay: Map<string, number>
  prsMergedByDay: Map<string, number>
  ciCompletedByDay: Map<string, number>
  ciPassByDay: Map<string, number>
  ciFailByDay: Map<string, number>
  sessionsByDay: Map<string, number>
  sessionErrorsByDay: Map<string, number>
  commitsByDay: Map<string, number>
}

function buildBuckets(snapshot: MetricSnapshot): DailyMetricBuckets {
  const issuesOpenedByDay = countByDay(snapshot.issues, issue => issue.createdAt)
  const issuesClosedByDay = countByDay(snapshot.issues, issue => issue.closedAt)
  const prsCreatedByDay = countByDay(snapshot.pullRequests, pr => pr.createdAt)
  const prsMergedByDay = countByDay(snapshot.pullRequests, pr => pr.mergedAt)
  const ciCompletedByDay = countByDay(snapshot.workflowRuns, run => run.completedAt)
  const ciPassByDay = countByDay(
    snapshot.workflowRuns.filter(run => run.conclusion === 'success'),
    run => run.completedAt,
  )
  const ciFailByDay = countByDay(
    snapshot.workflowRuns.filter(run => run.conclusion === 'failure' || run.conclusion === 'timed_out' || run.conclusion === 'startup_failure'),
    run => run.completedAt,
  )
  const sessionsByDay = countByDay(snapshot.sessions, session => session.timestamp)
  const sessionErrorsByDay = countByDay(
    snapshot.sessions.filter(session => !session.success),
    session => session.timestamp,
  )
  const commitsByDay = new Map<string, number>()
  for (const repo of snapshot.localGit) {
    if (!repo.commitsByDay) continue
    for (const [day, count] of Object.entries(repo.commitsByDay)) {
      commitsByDay.set(day, (commitsByDay.get(day) || 0) + count)
    }
  }

  return {
    issuesOpenedByDay,
    issuesClosedByDay,
    prsCreatedByDay,
    prsMergedByDay,
    ciCompletedByDay,
    ciPassByDay,
    ciFailByDay,
    sessionsByDay,
    sessionErrorsByDay,
    commitsByDay,
  }
}

function pushRow(
  rows: DailyMetricsInsert[],
  params: {
    day: string
    repoKey: string
    capturedAt: string
    source: string
    reflectsCompleteData: boolean
    issuesOpened: number
    issuesClosed: number
    prsCreated: number
    prsMerged: number
    totalCommits: number
    avgCycleTimeDays: number | null
    medianCycleTimeDays: number | null
    p95CycleTimeDays: number | null
    cycleTimeSampleSize: number
    ciTotalRuns: number
    ciPassCount: number
    ciFailCount: number
    ciPassRate: number | null
    ciAvgDurationMs: number | null
    totalSessions: number
    sessionErrorCount: number
    staleIssues: number
    stalePrs: number
    warnings: string[]
  },
): void {
  rows.push(params)
}

export function computeDailyMetrics(snapshot: MetricSnapshot): DailyMetricsInsert[] {
  const capturedAt = snapshot.capturedAt
  const capturedDay = toDayKey(capturedAt)
  const source = snapshot.metadata.source
  const warnings: string[] = snapshot.metadata.errors.length > 0
    ? ['Partial data: ' + snapshot.metadata.errors.join('; ')]
    : []

  const buckets = buildBuckets(snapshot)
  const sessionUsageAggregate = snapshot.aggregates.sessionUsage
  const useAggregateSessionFallback = snapshot.sessions.length === 0 && sessionUsageAggregate != null

  const totalCommits = snapshot.localGit.reduce((sum, r) => sum + r.recentCommits, 0)
  const { issuesOpenedByDay, issuesClosedByDay, prsCreatedByDay, prsMergedByDay, ciCompletedByDay, ciPassByDay, ciFailByDay, sessionsByDay, sessionErrorsByDay, commitsByDay } = buckets

  const allDays = new Set<string>()
  for (const day of issuesOpenedByDay.keys()) allDays.add(day)
  for (const day of issuesClosedByDay.keys()) allDays.add(day)
  for (const day of prsCreatedByDay.keys()) allDays.add(day)
  for (const day of prsMergedByDay.keys()) allDays.add(day)
  for (const day of ciCompletedByDay.keys()) allDays.add(day)
  for (const day of sessionsByDay.keys()) allDays.add(day)
  for (const day of commitsByDay.keys()) allDays.add(day)

  if (snapshot.aggregates) {
    const aggDays = extractDaysFromRange(
      snapshot.aggregates.throughput.periodStart,
      snapshot.aggregates.throughput.periodEnd,
    )
    for (const day of aggDays) allDays.add(day)
  }

  allDays.add(capturedDay)

  const cycleTime = snapshot.aggregates.cycleTime as CycleTimeAggregate | null
  const ci = snapshot.aggregates.ci as CIAggregate | null
  const staleWork = snapshot.aggregates.staleWork
  const hasCiRows = ciCompletedByDay.size > 0

  const inserts: DailyMetricsInsert[] = []

  const sortedDays = Array.from(allDays).sort().reverse()

  for (const day of sortedDays) {
    const ciTotal = ciCompletedByDay.get(day) || 0
    const ciPass = ciPassByDay.get(day) || 0
    const ciFail = ciFailByDay.get(day) || 0

    pushRow(inserts, {
      day,
      repoKey: 'all',
      capturedAt,
      source,
      reflectsCompleteData: warnings.length === 0,
      issuesOpened: issuesOpenedByDay.get(day) || 0,
      issuesClosed: issuesClosedByDay.get(day) || 0,
      prsCreated: prsCreatedByDay.get(day) || 0,
      prsMerged: prsMergedByDay.get(day) || 0,
      totalCommits: commitsByDay.size > 0 ? (commitsByDay.get(day) || 0) : totalCommits,
      avgCycleTimeDays: cycleTime?.averageDays ?? null,
      medianCycleTimeDays: cycleTime?.medianDays ?? null,
      p95CycleTimeDays: cycleTime?.p95Days ?? null,
      cycleTimeSampleSize: cycleTime?.sampleSize ?? 0,
      ciTotalRuns: ciTotal,
      ciPassCount: ciPass,
      ciFailCount: ciFail,
      ciPassRate: ciTotal > 0 ? ciPass / ciTotal : null,
      ciAvgDurationMs: ci?.averageDurationMs ?? null,
      totalSessions: sessionsByDay.get(day) || (useAggregateSessionFallback && day === capturedDay ? sessionUsageAggregate.totalSessions : 0),
      sessionErrorCount: sessionErrorsByDay.get(day) || (useAggregateSessionFallback && day === capturedDay ? sessionUsageAggregate.errorCount : 0),
      staleIssues: staleWork.staleIssues,
      stalePrs: staleWork.stalePRs,
      warnings,
    })
  }

  const repoKeys = new Set<string>()
  for (const issue of snapshot.issues) repoKeys.add(issue.repoKey)
  for (const pr of snapshot.pullRequests) repoKeys.add(pr.repoKey)
  for (const run of snapshot.workflowRuns) repoKeys.add(run.repoKey)
  for (const repo of snapshot.localGit) repoKeys.add(repo.repoKey)

  for (const repoKey of Array.from(repoKeys).sort()) {
    const repoDays = new Set<string>()
    for (const issue of snapshot.issues.filter(item => item.repoKey === repoKey)) {
      repoDays.add(toDayKey(issue.createdAt))
      if (issue.closedAt) repoDays.add(toDayKey(issue.closedAt))
    }
    for (const pr of snapshot.pullRequests.filter(item => item.repoKey === repoKey)) {
      repoDays.add(toDayKey(pr.createdAt))
      if (pr.mergedAt) repoDays.add(toDayKey(pr.mergedAt))
    }
    for (const run of snapshot.workflowRuns.filter(item => item.repoKey === repoKey)) {
      if (run.completedAt) repoDays.add(toDayKey(run.completedAt))
    }
    for (const repo of snapshot.localGit.filter(item => item.repoKey === repoKey)) {
      for (const day of Object.keys(repo.commitsByDay ?? {})) {
        repoDays.add(day)
      }
    }

    for (const day of Array.from(repoDays).sort().reverse()) {
      if (!allDays.has(day)) continue
      pushRow(inserts, {
        day,
        repoKey,
        capturedAt,
        source,
        reflectsCompleteData: warnings.length === 0,
        issuesOpened: snapshot.issues.filter(item => item.repoKey === repoKey && toDayKey(item.createdAt) === day).length,
        issuesClosed: snapshot.issues.filter(item => item.repoKey === repoKey && item.closedAt != null && toDayKey(item.closedAt) === day).length,
        prsCreated: snapshot.pullRequests.filter(item => item.repoKey === repoKey && toDayKey(item.createdAt) === day).length,
        prsMerged: snapshot.pullRequests.filter(item => item.repoKey === repoKey && item.mergedAt != null && toDayKey(item.mergedAt) === day).length,
        totalCommits: snapshot.localGit.filter(item => item.repoKey === repoKey).reduce((sum, repo) => sum + (repo.commitsByDay?.[day] ?? 0), 0),
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
        warnings,
      })
    }
  }

  if (ci && !hasCiRows) {
    const ciWarning = 'CI trend unavailable: no per-day workflow runs were captured in this window'
    const firstRow = inserts[0]
    if (firstRow) {
      inserts[0] = {
        ...firstRow,
        warnings: uniqueWarnings(firstRow.warnings, ciWarning),
      }
    }
  }

  return inserts
}

function uniqueWarnings(existing: string[], warning: string): string[] {
  return existing.includes(warning) ? existing : [...existing, warning]
}
