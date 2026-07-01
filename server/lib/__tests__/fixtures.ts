import type { MetricSnapshot, DashboardWindow, DashboardWindowDay, DashboardWindowThroughputSummary, DashboardWindowCycleTimeSummary, DashboardWindowCISummary, DashboardWindowStaleWorkSummary, DashboardWindowSessionSummary, DashboardWindowSessionUsageSummary, DashboardWindowCoverage, DashboardWindowCards } from '../../../types/snapshot'
import type { DailyMetricsRow } from '../../../types/daily-metrics'
import type {
  SessionUsageAggregate,
} from '../../../types/aggregates'
import type {
  IssueMetric,
  PullRequestMetric,
  WorkflowRunMetric,
  RepositoryIdentity,
  LocalGitRepoMetric,
  SessionMetric,
} from '../../../types/metrics'

export const DEFAULT_CAPTURED_AT = '2026-06-05T12:00:00Z'

export function makeIssue(overrides: Partial<IssueMetric> = {}): IssueMetric {
  return {
    id: '1',
    title: 'Test Issue',
    state: 'open',
    createdAt: '2026-06-01T10:00:00Z',
    updatedAt: '2026-06-01T10:00:00Z',
    closedAt: null,
    repo: 'test/repo',
    repoKey: 'github:test/repo',
    labels: [],
    assignee: null,
    milestone: null,
    url: '',
    ...overrides,
  }
}

export function makePullRequest(overrides: Partial<PullRequestMetric> = {}): PullRequestMetric {
  return {
    id: '1',
    title: 'Test PR',
    state: 'merged',
    createdAt: '2026-06-01T10:00:00Z',
    updatedAt: '2026-06-01T10:00:00Z',
    headSha: 'abc123',
    mergedAt: '2026-06-02T10:00:00Z',
    closedAt: null,
    repo: 'test/repo',
    repoKey: 'github:test/repo',
    author: 'author',
    labels: [],
    additions: null,
    deletions: null,
    changedFiles: null,
    url: '',
    ciStatus: null,
    ...overrides,
  }
}

export function makeWorkflowRun(overrides: Partial<WorkflowRunMetric> = {}): WorkflowRunMetric {
  return {
    id: '1',
    name: 'CI',
    status: 'completed',
    conclusion: 'success',
    createdAt: '2026-06-01T10:00:00Z',
    completedAt: '2026-06-01T11:00:00Z',
    headSha: 'abc123',
    repo: 'test/repo',
    repoKey: 'github:test/repo',
    branch: 'main',
    workflowName: 'CI',
    url: null,
    ...overrides,
  }
}

export function makeSession(overrides: Partial<SessionMetric> = {}): SessionMetric {
  return {
    id: 's1',
    toolName: 'opencode',
    action: 'edit',
    timestamp: '2026-06-01T10:00:00Z',
    durationMs: 100,
    metadata: {},
    success: true,
    ...overrides,
  }
}

export function makeLocalRepo(overrides: Partial<LocalGitRepoMetric> = {}): LocalGitRepoMetric {
  return {
    repoKey: 'local:/repo',
    source: 'local',
    path: '/repo',
    repoName: 'repo',
    remoteUrl: null,
    githubOwner: null,
    githubRepo: null,
    defaultBranch: 'main',
    isGitRepo: true,
    recentCommits: 5,
    commitsByDay: {},
    authors: ['alice@example.com'],
    latestCommitAt: null,
    error: null,
    ...overrides,
  }
}

export function makeRepository(overrides: Partial<RepositoryIdentity> = {}): RepositoryIdentity {
  return {
    repoKey: 'github:owner/repo',
    name: 'repo',
    localPath: null,
    remoteUrl: 'https://github.com/owner/repo',
    githubOwner: 'owner',
    githubRepo: 'repo',
    source: 'github',
    isPrivate: false,
    ...overrides,
  }
}

export function makeSessionUsageAggregate(overrides: Partial<SessionUsageAggregate> = {}): SessionUsageAggregate {
  return {
    periodStart: '2026-05-06T00:00:00Z',
    periodEnd: '2026-06-05T12:00:00Z',
    totalSessions: 10,
    startedSessions: 5,
    completedSessions: 4,
    erroredSessions: 1,
    stuckSessions: 0,
    lastActivityAt: '2026-06-05T11:30:00Z',
    messages: 20,
    activeDays: 2,
    totalCost: 5.0,
    averageCostPerDay: 2.5,
    averageTokensPerSession: 100,
    medianTokensPerSession: 80,
    inputTokens: 60,
    outputTokens: 30,
    cacheReadTokens: 5,
    cacheWriteTokens: 10,
    uniqueTools: ['opencode'],
    toolUsage: [{ toolName: 'opencode', count: 10, percentage: 100 }],
    topActions: [{ action: 'edit', count: 8 }],
    errorCount: 1,
    ...overrides,
  }
}

export function makeSnapshot(overrides: Partial<MetricSnapshot> = {}): MetricSnapshot {
  return {
    id: 'snap-1',
    capturedAt: DEFAULT_CAPTURED_AT,
    issues: [],
    pullRequests: [],
    workflowRuns: [],
    repositories: [],
    sessions: [],
    localGit: [],
    errors: [],
    aggregates: {
      throughput: {
        periodStart: '2026-06-01T00:00:00Z',
        periodEnd: '2026-06-05T12:00:00Z',
        issuesClosed: 0,
        issuesOpened: 0,
        prsMerged: 0,
        prsCreated: 0,
        totalCommits: 0,
      },
      cycleTime: null,
      ci: null,
      staleWork: {
        asOf: DEFAULT_CAPTURED_AT,
        staleIssues: 0,
        stalePRs: 0,
        staleThresholdDays: 14,
        oldestItemDays: null,
      },
      sessionUsage: null,
      computedAt: DEFAULT_CAPTURED_AT,
    },
    metadata: {
      source: 'orchestrated',
      refreshDurationMs: 100,
      partialData: false,
      errors: [],
    },
    ...overrides,
  }
}

export function makeDailyMetricsRow(day: string, overrides: Partial<DailyMetricsRow> = {}): DailyMetricsRow {
  return {
    day,
    repoKey: 'all',
    capturedAt: `${day}T12:00:00.000Z`,
    source: 'orchestrated',
    version: 1,
    reflectsCompleteData: true,
    issuesOpened: 0,
    issuesClosed: 0,
    prsCreated: 0,
    prsMerged: 0,
    totalCommits: 0,
    avgCycleTimeSeconds: null,
    medianCycleTimeSeconds: null,
    p95CycleTimeSeconds: null,
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
    createdAt: `${day}T12:00:00.000Z`,
    ...overrides,
  }
}
