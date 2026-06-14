import { initDb, setRefreshInProgress, getRefreshInProgress } from '../db/client'
import { createOrchestrator } from '../lib/orchestrator'
import type { OrchestratorConfig } from '../lib/orchestrator/types'

export default defineEventHandler(async (event) => {
  await initDb()

  if (getRefreshInProgress()) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Refresh already in progress',
    })
  }

  setRefreshInProgress(true)

  runRefresh().catch((err) => {
    console.error('Background refresh failed:', err)
    setRefreshInProgress(false)
  })

  return { started: true }
})

async function runRefresh(): Promise<void> {
  try {
    const config: OrchestratorConfig = {}

    if (
      process.env.GITHUB_TOKEN &&
      process.env.GITHUB_OWNER &&
      process.env.GITHUB_REPO
    ) {
      config.github = {
        owner: process.env.GITHUB_OWNER,
        repo: process.env.GITHUB_REPO,
        token: process.env.GITHUB_TOKEN,
      }
    }

    if (process.env.GIT_REPOS) {
      const paths = process.env.GIT_REPOS.split(',').map(p => p.trim()).filter(Boolean)
      if (paths.length > 0) {
        config.localGit = {
          repos: paths.map(p => ({ path: p })),
        }
      }
    }

    const sessionsConfig: import('../lib/sessions/types').SessionCollectorConfig = {}
    if (process.env.SESSIONS_PERIOD_DAYS) {
      const days = parseInt(process.env.SESSIONS_PERIOD_DAYS, 10)
      if (!isNaN(days) && days > 0) {
        sessionsConfig.periodDays = days
      }
    }
    if (process.env.OPENCODE_BIN) {
      sessionsConfig.opencodeBin = process.env.OPENCODE_BIN
    }
    if (process.env.OPENCODE_COMMAND) {
      sessionsConfig.opencodeCommand = process.env.OPENCODE_COMMAND
    }
    if (Object.keys(sessionsConfig).length > 0) {
      config.sessions = sessionsConfig
    }

    const orchestrator = createOrchestrator(config)
    await orchestrator.collect()
  } finally {
    setRefreshInProgress(false)
  }
}
