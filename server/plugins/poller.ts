import { initDb } from '../db/client'
import { getPollerConfig, startMetricsPoller, type PollerRuntime } from '../lib/poller'

export async function startAppPoller(): Promise<PollerRuntime | null> {
  await initDb()

  const config = getPollerConfig()
  if (!config.enabled) {
    console.info('[poller] disabled')
    return null
  }

  const runtime = startMetricsPoller(config)
  console.info('[poller] started')
  return runtime
}

export function stopAppPoller(runtime: PollerRuntime | null | undefined): void {
  runtime?.stop()
  console.info('[poller] stopped')
}
