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

    const orchestrator = createOrchestrator(config)
    await orchestrator.collect()
  } finally {
    setRefreshInProgress(false)
  }
}
