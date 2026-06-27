import { connectOpencodeDb, querySessionsByDay, queryModelBreakdown } from './db-collector'

export interface TokenUsageCollectorResult {
  periodStart: string
  periodEnd: string
  source: string
  toolName: string
  totalSessions: number
  totalMessages: number
  totalTokens: number
  totalCost: number | null
  modelUsage: Array<{
    modelName: string
    messages: number
    inputTokens: number | null
    outputTokens: number | null
    cacheReadTokens: number | null
    cacheWriteTokens: number | null
    cost: number | null
  }>
  rawJson: string | null
  collectedAt: string
  errors: string[]
}

function parseNumber(value: string | undefined): number | null { if (!value) return null; const normalized = value.replace(/[$,]/g,'').trim(); const m = normalized.match(/^(-?\d+(?:\.\d+)?)([KMB])$/i); if (m) { const base = Number(m[1]); if (!Number.isFinite(base)) return null; const s = m[2]!.toUpperCase(); return base * (s==='K'?1_000:s==='M'?1_000_000:1_000_000_000)} const p=Number(normalized); return Number.isFinite(p)?p:null }
function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
function extractOverviewValue(lines: string[], label: string): number | null { const pattern = new RegExp(`│\\s*${escapeRegExp(label)}\\s+([^│]+?)\\s*│`, 'i'); for (const line of lines) { const match = line.match(pattern); if (!match) continue; const valueMatch = match[1]?.match(/-?\$?[\d,]+(?:\.\d+)?(?:[KMB])?/i); return parseNumber(valueMatch?.[0]); } return null }
function isLikelyModelName(name: string): boolean { return /^(?:[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*)$/i.test(name) }

export function parseTokenUsage(stdout: string) {
  const lines = stdout.split('\n')
  const totalSessions = extractOverviewValue(lines, 'Sessions') ?? 0
  const totalMessages = extractOverviewValue(lines, 'Messages') ?? 0
  const inputTokens = extractOverviewValue(lines, 'Input') ?? extractOverviewValue(lines, 'Input Tokens') ?? 0
  const outputTokens = extractOverviewValue(lines, 'Output') ?? extractOverviewValue(lines, 'Output Tokens') ?? 0
  const totalCost = extractOverviewValue(lines, 'Total Cost')
  const modelUsage: TokenUsageCollectorResult['modelUsage'] = []
  for (let i=0;i<lines.length;i+=1) {
    const row = lines[i]!
    const modelMatch = row.match(/│\s+(.+?)\s+│\s*$/)
    if (!modelMatch) continue
    const modelName = modelMatch[1]!.trim()
    if (!isLikelyModelName(modelName)) continue
    const block = lines.slice(i+1, i+7).join('\n')
    const messagesMatch = block.match(/Messages\s+([\d,]+)/)
    if (!messagesMatch) continue
    modelUsage.push({
      modelName,
      messages: parseInt(messagesMatch[1]!.replace(/,/g,''),10),
      inputTokens: parseNumber((block.match(/Input Tokens\s+([^\n│]+)/)?.[1] ?? block.match(/Input\s+([^\n│]+)/)?.[1])?.trim()),
      outputTokens: parseNumber((block.match(/Output Tokens\s+([^\n│]+)/)?.[1] ?? block.match(/Output\s+([^\n│]+)/)?.[1])?.trim()),
      cacheReadTokens: parseNumber((block.match(/Cache Read\s+([^\n│]+)/)?.[1])?.trim()),
      cacheWriteTokens: parseNumber((block.match(/Cache Write\s+([^\n│]+)/)?.[1])?.trim()),
      cost: parseNumber((block.match(/Cost\s+([^\n│]+)/)?.[1])?.trim()),
    })
  }
  return { totalSessions, totalMessages, totalTokens: inputTokens + outputTokens, totalCost, modelUsage, rawJson: stdout }
}

export function collectTokenUsageSnapshot(): TokenUsageCollectorResult {
  const collectedAt = new Date().toISOString()
  const periodEnd = collectedAt
  const periodStart = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString()
  const errors: string[] = []

  const db = connectOpencodeDb()
  if (!db) {
    errors.push('OpenCode DB not found: unable to connect to opencode.db')
    return { periodStart, periodEnd, source: 'opencodedb', toolName: 'opencode', totalSessions: 0, totalMessages: 0, totalTokens: 0, totalCost: null, modelUsage: [], rawJson: null, collectedAt, errors }
  }
  db.close()

  const since = Date.now() - 28 * 24 * 60 * 60 * 1000

  const dailyAggs = querySessionsByDay(28)
  const totalSessions = dailyAggs.reduce((sum, d) => sum + d.sessions, 0)
  const totalTokens = dailyAggs.reduce((sum, d) => sum + d.tokensInput + d.tokensOutput, 0)
  const totalCost = dailyAggs.reduce((sum, d) => sum + d.cost, 0)

  const models = queryModelBreakdown(since)
  const modelUsage = models.map(m => ({
    modelName: m.modelName,
    messages: m.messages,
    inputTokens: m.inputTokens,
    outputTokens: m.outputTokens,
    cacheReadTokens: m.cacheReadTokens,
    cacheWriteTokens: m.cacheWriteTokens,
    cost: m.cost,
  }))

  return {
    periodStart,
    periodEnd,
    source: 'opencodedb',
    toolName: 'opencode',
    totalSessions,
    totalMessages: totalSessions, // approximation per spec
    totalTokens,
    totalCost,
    modelUsage,
    rawJson: null,
    collectedAt,
    errors: [],
  }
}
