import { defineNitroPlugin } from 'nitropack/runtime'
import { initDb } from '../db/client'
import { getPollerConfig, startMetricsPoller, type PollerRuntime } from '../lib/poller'

export default defineNitroPlugin(async (nitroApp) => {
  await initDb()

  const config = getPollerConfig()
  if (!config.enabled) {
    console.info('[poller] disabled')
    return
  }

  const runtime: PollerRuntime | null = startMetricsPoller(config)
  console.info('[poller] started')

  nitroApp.hooks.hook('close', () => {
    runtime?.stop()
    console.info('[poller] stopped')
  })
})
