import { close, initDb, runRetention } from '../db/client'

export async function startDb(): Promise<void> {
  await initDb()
  console.info('[db] initialized')

  try {
    const result = runRetention()
    console.info('[db] retention cleanup complete:', JSON.stringify(result))
  } catch (error) {
    console.error('[db] retention cleanup failed:', error)
  }
}

export function stopDb(): void {
  close()
  console.info('[db] closed')
}
