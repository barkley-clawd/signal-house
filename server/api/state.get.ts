import { defineEventHandler, setHeader } from 'h3'
import { initDb, getLatestState, getDailyMetricsRange } from '../db/client'
import { buildDashboardWindow } from '../lib/dashboard-state'

export default defineEventHandler(async (event) => {
  await initDb()
  setHeader(event, 'Cache-Control', 'no-cache')
  const state = getLatestState()
  const sessionUsage = state.snapshot?.aggregates.sessionUsage ?? null
  const today = new Date().toISOString().slice(0, 10)
  const fromDay = new Date(`${today}T00:00:00Z`)
  fromDay.setUTCDate(fromDay.getUTCDate() - 27)
  const dashboardWindow = buildDashboardWindow(
    getDailyMetricsRange(fromDay.toISOString().slice(0, 10), today),
    new Date(),
    state.isStale,
    sessionUsage,
  )

  return {
    ...state,
    dashboardWindow,
  }
})
