export interface DailyMetricsRow {
  day: string
  capturedAt: string
  source: string
  version: number
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
  createdAt: string
}

export interface DailyMetricsInsert {
  day: string
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
}
