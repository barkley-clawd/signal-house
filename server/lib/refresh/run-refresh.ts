import { initDb, setRefreshInProgress, getRefreshInProgress, setRefreshRunState, setRefreshRunStatus } from '../../db/client'
import { createOrchestrator } from '../orchestrator'
import { getEnv } from '../env'
import type { OrchestratorConfig, OrchestratorResult } from '../orchestrator/types'
import type { SessionCollectorConfig } from '../sessions/types'

export interface RefreshRunResult {
  startedAt: string
  finishedAt: string
  durationMs: number
  success: boolean
  partialData: boolean
  sources: string[]
  errors: string[]
  errorSummary: string | null
  skipped: boolean
  skippedReason: string | null
  orchestratorResult: OrchestratorResult | null
}

export function buildRefreshConfig(env: NodeJS.ProcessEnv = process.env): OrchestratorConfig {
  const config: OrchestratorConfig = {}

  const githubToken = getEnv(env, 'SECRET_HOUSE_GITHUB_TOKEN', 'GITHUB_TOKEN')
  const githubOwner = getEnv(env, 'SECRET_HOUSE_GITHUB_OWNER', 'GITHUB_OWNER')
  const githubRepo = getEnv(env, 'SECRET_HOUSE_GITHUB_REPO', 'GITHUB_REPO')
  if (githubToken && githubOwner && githubRepo) {
    config.github = {
      owner: githubOwner,
      repo: githubRepo,
      token: githubToken,
    }
  }

  const gitRepos = getEnv(env, 'SECRET_HOUSE_GIT_REPOS', 'GIT_REPOS')
  if (gitRepos) {
    const paths = gitRepos.split(',').map(path => path.trim()).filter(Boolean)
    if (paths.length > 0) {
      config.localGit = {
        repos: paths.map(path => ({ path })),
      }
    }
  }

  const sessionsConfig: SessionCollectorConfig = {}
  const sessionsPeriodDays = getEnv(env, 'SECRET_HOUSE_SESSIONS_PERIOD_DAYS', 'SESSIONS_PERIOD_DAYS')
  if (sessionsPeriodDays) {
    const days = Number.parseInt(sessionsPeriodDays, 10)
    if (!Number.isNaN(days) && days > 0) {
      sessionsConfig.periodDays = days
    }
  }
  const opencodeBin = getEnv(env, 'SECRET_HOUSE_OPENCODE_BIN', 'OPENCODE_BIN')
  if (opencodeBin) {
    sessionsConfig.opencodeBin = opencodeBin
  }
  const opencodeCommand = getEnv(env, 'SECRET_HOUSE_OPENCODE_COMMAND', 'OPENCODE_COMMAND')
  if (opencodeCommand) {
    sessionsConfig.opencodeCommand = opencodeCommand
  }
  if (Object.keys(sessionsConfig).length > 0) {
    config.sessions = sessionsConfig
  }

  return config
}

export async function runRefresh(): Promise<RefreshRunResult> {
  const startedAt = new Date().toISOString()
  const startedMs = Date.now()

  await initDb()

  if (getRefreshInProgress()) {
    const result: RefreshRunResult = {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedMs,
      success: false,
      partialData: false,
      sources: [],
      errors: [],
      errorSummary: 'Refresh already in progress',
      skipped: true,
      skippedReason: 'refresh-in-progress',
      orchestratorResult: null,
    }
    setRefreshRunState({
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
      durationMs: result.durationMs,
      success: result.success,
      partialData: result.partialData,
      sources: result.sources,
      errorSummary: result.errorSummary,
      skipped: result.skipped,
      skippedReason: result.skippedReason,
    })
    return result
  }

  setRefreshInProgress(true)
  setRefreshRunStatus('running')

  try {
    const orchestrator = createOrchestrator(buildRefreshConfig())
    const orchestratorResult = await orchestrator.collect()
    const success = orchestratorResult.errors.length === 0

    const result: RefreshRunResult = {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedMs,
      success,
      partialData: orchestratorResult.partialData,
      sources: orchestratorResult.sources,
      errors: orchestratorResult.errors,
      errorSummary: orchestratorResult.errors[0] ?? null,
      skipped: false,
      skippedReason: null,
      orchestratorResult,
    }
    setRefreshRunState({
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
      durationMs: result.durationMs,
      success: result.success,
      partialData: result.partialData,
      sources: result.sources,
      errorSummary: result.errorSummary,
      skipped: result.skipped,
      skippedReason: result.skippedReason,
    })
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const result: RefreshRunResult = {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedMs,
      success: false,
      partialData: false,
      sources: [],
      errors: [message],
      errorSummary: message,
      skipped: false,
      skippedReason: null,
      orchestratorResult: null,
    }
    setRefreshRunState({
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
      durationMs: result.durationMs,
      success: result.success,
      partialData: result.partialData,
      sources: result.sources,
      errorSummary: result.errorSummary,
      skipped: result.skipped,
      skippedReason: result.skippedReason,
    })
    return result
  } finally {
    setRefreshInProgress(false)
  }
}
