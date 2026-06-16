import { defineEventHandler, getQuery, setHeader } from 'h3'
import { initDb, getLatestState, getDailyMetricsRange, getDailyMetricsRangeForRepo } from '../db/client'
import { buildDashboardWindow } from '../lib/dashboard-state'

export default defineEventHandler(async (event) => {
  await initDb()
  setHeader(event, 'Cache-Control', 'no-cache')
  const query = getQuery(event)
  const repoKey = typeof query.repoKey === 'string' && query.repoKey.length > 0 ? query.repoKey : null
  const state = getLatestState()
  const sessionUsage = state.snapshot?.aggregates.sessionUsage ?? null
  const today = new Date().toISOString().slice(0, 10)
  const fromDay = new Date(`${today}T00:00:00Z`)
  fromDay.setUTCDate(fromDay.getUTCDate() - 27)
  const dailyMetrics = repoKey
    ? getDailyMetricsRangeForRepo(fromDay.toISOString().slice(0, 10), today, repoKey)
    : getDailyMetricsRange(fromDay.toISOString().slice(0, 10), today)
  const dashboardWindow = buildDashboardWindow(
    dailyMetrics,
    new Date(),
    state.isStale,
    sessionUsage,
  )

  return {
    ...state,
    dashboardWindow,
  }
})
