import { execFileSync } from 'node:child_process'
import { findOpencodeBinary } from '../opencode/binary'
import { parseTokenUsage } from '../opencode/collector'
import { upsertDailyTokenUsage, getLatestDailyTokenUsage } from '../../db/client'
import type { DailyTokenUsageRow } from '../../../types/daily-token-usage'

export interface DailyTokenUsageCollectorResult {
  success: boolean
  date: string
  row: DailyTokenUsageRow | null
  errors: string[]
}

export async function maybeCollectDailyTokenUsage(): Promise<DailyTokenUsageCollectorResult> {
  const errors: string[] = []

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const date = yesterday.toISOString().slice(0, 10)

  try {
    const existing = getLatestDailyTokenUsage()
    if (existing && existing.date === date) {
      return { success: true, date, row: null, errors: [] }
    }
  } catch (err) {
    errors.push(`DB check failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  return collectAndStoreDailyTokenUsage(date)
}

export async function collectAndStoreDailyTokenUsage(targetDate?: string): Promise<DailyTokenUsageCollectorResult> {
  const errors: string[] = []

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const date = targetDate ?? yesterday.toISOString().slice(0, 10)

  const binary = findOpencodeBinary()
  if (!binary) {
    errors.push('OpenCode binary not found')
    return { success: false, date, row: null, errors }
  }

  try {
    const stdout = execFileSync(binary, ['stats', '--days', '1', '--models'], {
      timeout: 15000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })
    const parsed = parseTokenUsage(stdout)

    const row: DailyTokenUsageRow = {
      date,
      totalSessions: parsed.totalSessions,
      totalMessages: parsed.totalMessages,
      totalTokens: parsed.totalTokens,
      totalCost: parsed.totalCost,
      modelUsage: parsed.modelUsage,
      rawJson: parsed.rawJson,
      createdAt: new Date().toISOString(),
    }

    upsertDailyTokenUsage({
      date,
      totalSessions: row.totalSessions,
      totalMessages: row.totalMessages,
      totalTokens: row.totalTokens,
      totalCost: row.totalCost,
      modelUsage: row.modelUsage,
      rawJson: row.rawJson,
    })

    return { success: true, date, row, errors: [] }
  } catch (err) {
    errors.push(`Daily token usage collection failed: ${err instanceof Error ? err.message : String(err)}`)
    return { success: false, date, row: null, errors }
  }
}
