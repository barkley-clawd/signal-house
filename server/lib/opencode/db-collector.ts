import Database from 'better-sqlite3'
import os from 'node:os'
import path from 'node:path'

export interface OpencodeDbConfig {
  dbPath?: string
}

export interface DbSessionRow {
  id: string
  slug: string
  agent: string
  model: string | null
  cost: number
  tokensInput: number
  tokensOutput: number
  tokensReasoning: number
  tokensCacheRead: number
  tokensCacheWrite: number
  timeCreated: number
  timeUpdated: number
  projectId: string
  parentId: string | null
}

export interface DailyAggregation {
  day: string
  sessions: number
  startedSessions: number
  completedSessions: number
  erroredSessions: number
  cost: number
  tokensInput: number
  tokensOutput: number
  tokensReasoning: number
  tokensCacheRead: number
  tokensCacheWrite: number
}

export interface ModelBreakdownEntry {
  modelName: string
  sessions: number
  messages: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  cost: number
}

export interface AgentBreakdownEntry {
  agent: string
  sessions: number
}

export interface ParentChildCounts {
  primarySessions: number
  subagentSessions: number
}

type SessionSchemaRow = {
  id: string
  slug: string
  agent: string | null
  model: unknown
  cost: number | null
  tokens_input: number | null
  tokens_output: number | null
  tokens_reasoning: number | null
  tokens_cache_read: number | null
  tokens_cache_write: number | null
  time_created: number | null
  time_updated: number | null
  project_id: string | null
  parent_id: string | null
  status?: string | null
  error?: string | null
  time_completed?: number | null
  completed_at?: number | null
  time_errored?: number | null
  errored_at?: number | null
}

type MessageCountRow = {
  session_id: string
  messages: number
}

type DbSchemaInfo = {
  hasSessionTable: boolean
  hasMessageTable: boolean
}

const schemaInfoCache = new WeakMap<Database.Database, DbSchemaInfo>()

function defaultDbPath(): string {
  return path.join(os.homedir(), '.local/share/opencode/opencode.db')
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeModelName(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null

    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>
      const candidate = parsed.id ?? parsed.modelID ?? parsed.model_id ?? parsed.name
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
    } catch {
      // Plain string model ids are also valid.
    }

    return trimmed
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const candidate = record.id ?? record.modelID ?? record.model_id ?? record.name
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }

  return null
}

function normalizeStatus(row: SessionSchemaRow): string | null {
  const value = row.status
  if (typeof value === 'string' && value.trim()) return value.trim().toLowerCase()
  return null
}

function isErrored(row: SessionSchemaRow): boolean {
  const status = normalizeStatus(row)
  if (status && ['error', 'errored', 'failed', 'failure'].includes(status)) return true
  if (typeof row.error === 'string' && row.error.trim()) return true
  return row.time_errored != null || row.errored_at != null
}

function isCompleted(row: SessionSchemaRow): boolean {
  const status = normalizeStatus(row)
  if (status && ['completed', 'complete', 'done', 'finished', 'success', 'idle'].includes(status)) return true
  if (row.time_completed != null || row.completed_at != null) return true
  if (row.time_created != null && row.time_updated != null) return row.time_updated > row.time_created
  return false
}

function compareLabels(a: string, b: string): number {
  const unknownA = a === '(unknown)'
  const unknownB = b === '(unknown)'
  if (unknownA !== unknownB) return unknownA ? 1 : -1
  return a.localeCompare(b)
}

function getSchemaInfo(db: Database.Database): DbSchemaInfo {
  const cached = schemaInfoCache.get(db)
  if (cached) return cached

  const tableRows = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as Array<{ name: string }>
  const tableNames = new Set(tableRows.map(row => row.name))
  const info = {
    hasSessionTable: tableNames.has('session'),
    hasMessageTable: tableNames.has('message'),
  }
  schemaInfoCache.set(db, info)
  return info
}

export function connectOpencodeDb(config: OpencodeDbConfig = {}): Database.Database | null {
  const dbPath = config.dbPath ?? defaultDbPath()

  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true })
    db.pragma('query_only = ON')

    if (!getSchemaInfo(db).hasSessionTable) {
      db.close()
      return null
    }

    return db
  } catch {
    return null
  }
}

function readSessionRows(since: number, until?: number, config?: OpencodeDbConfig): SessionSchemaRow[] {
  const db = connectOpencodeDb(config)
  if (!db) return []

  try {
    const clauses = ['time_created >= ?']
    const params: Array<number> = [since]
    if (until != null) {
      clauses.push('time_created < ?')
      params.push(until)
    }

    const rows = db.prepare(`
      SELECT
        id,
        slug,
        agent,
        model,
        cost,
        tokens_input,
        tokens_output,
        tokens_reasoning,
        tokens_cache_read,
        tokens_cache_write,
        time_created,
        time_updated,
        project_id,
        parent_id,
        status,
        error,
        time_completed,
        completed_at,
        time_errored,
        errored_at
      FROM session
      WHERE ${clauses.join(' AND ')}
      ORDER BY time_created DESC, id DESC
    `).all(...params) as SessionSchemaRow[]

    return rows
  } catch {
    return []
  } finally {
    db.close()
  }
}

function readMessageCounts(since: number, until?: number, config?: OpencodeDbConfig): Map<string, number> {
  const db = connectOpencodeDb(config)
  if (!db) return new Map()

  try {
    const schema = getSchemaInfo(db)
    if (!schema.hasMessageTable) return new Map()

    const clauses = ['m.time_created >= ?']
    const params: Array<number> = [since]
    if (until != null) {
      clauses.push('m.time_created < ?')
      params.push(until)
    }

    const rows = db.prepare(`
      SELECT m.session_id AS session_id, COUNT(*) AS messages
      FROM message AS m
      WHERE ${clauses.join(' AND ')}
      GROUP BY m.session_id
    `).all(...params) as MessageCountRow[]

    return new Map(rows.map(row => [row.session_id, row.messages]))
  } catch {
    return new Map()
  } finally {
    db.close()
  }
}

export function querySessions(since: number, until?: number, config?: OpencodeDbConfig): DbSessionRow[] {
  const rows = readSessionRows(since, until, config)
  return rows.map((row): DbSessionRow => ({
    id: row.id,
    slug: row.slug,
    agent: row.agent ?? '',
    model: normalizeModelName(row.model),
    cost: toNumber(row.cost),
    tokensInput: toNumber(row.tokens_input),
    tokensOutput: toNumber(row.tokens_output),
    tokensReasoning: toNumber(row.tokens_reasoning),
    tokensCacheRead: toNumber(row.tokens_cache_read),
    tokensCacheWrite: toNumber(row.tokens_cache_write),
    timeCreated: toNumber(row.time_created),
    timeUpdated: toNumber(row.time_updated),
    projectId: row.project_id ?? '',
    parentId: row.parent_id ?? null,
  }))
}

export function querySessionsByDay(days: number, config?: OpencodeDbConfig): DailyAggregation[] {
  const until = Date.now()
  const since = until - Math.max(0, days) * 24 * 60 * 60 * 1000
  const rows = readSessionRows(since, until, config)

  const grouped = new Map<string, DailyAggregation>()
  for (const row of rows) {
    const timeCreated = toNumber(row.time_created)
    const day = new Date(timeCreated).toISOString().slice(0, 10)
    const current = grouped.get(day) ?? {
      day,
      sessions: 0,
      startedSessions: 0,
      completedSessions: 0,
      erroredSessions: 0,
      cost: 0,
      tokensInput: 0,
      tokensOutput: 0,
      tokensReasoning: 0,
      tokensCacheRead: 0,
      tokensCacheWrite: 0,
    }

    current.sessions += 1
    current.startedSessions += 1
    if (isCompleted(row)) current.completedSessions += 1
    if (isErrored(row)) current.erroredSessions += 1
    current.cost += toNumber(row.cost)
    current.tokensInput += toNumber(row.tokens_input)
    current.tokensOutput += toNumber(row.tokens_output)
    current.tokensReasoning += toNumber(row.tokens_reasoning)
    current.tokensCacheRead += toNumber(row.tokens_cache_read)
    current.tokensCacheWrite += toNumber(row.tokens_cache_write)

    grouped.set(day, current)
  }

  return [...grouped.values()].sort((a, b) => b.day.localeCompare(a.day))
}

export function queryModelBreakdown(since: number, until?: number, config?: OpencodeDbConfig): ModelBreakdownEntry[] {
  const rows = readSessionRows(since, until, config)
  const messageCounts = readMessageCounts(since, until, config)
  const grouped = new Map<string, ModelBreakdownEntry>()

  for (const row of rows) {
    const modelName = normalizeModelName(row.model) ?? '(unknown)'
    const current = grouped.get(modelName) ?? {
      modelName,
      sessions: 0,
      messages: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      cost: 0,
    }

    current.sessions += 1
    current.messages += messageCounts.get(row.id) ?? 0
    current.inputTokens += toNumber(row.tokens_input)
    current.outputTokens += toNumber(row.tokens_output)
    current.cacheReadTokens += toNumber(row.tokens_cache_read)
    current.cacheWriteTokens += toNumber(row.tokens_cache_write)
    current.cost += toNumber(row.cost)

    grouped.set(modelName, current)
  }

  return [...grouped.values()].sort((a, b) => b.sessions - a.sessions || compareLabels(a.modelName, b.modelName))
}

export function queryAgentBreakdown(since: number, until?: number, config?: OpencodeDbConfig): AgentBreakdownEntry[] {
  const rows = readSessionRows(since, until, config)
  const grouped = new Map<string, AgentBreakdownEntry>()

  for (const row of rows) {
    const agent = row.agent?.trim() || '(unknown)'
    const current = grouped.get(agent) ?? { agent, sessions: 0 }
    current.sessions += 1
    grouped.set(agent, current)
  }

  return [...grouped.values()].sort((a, b) => b.sessions - a.sessions || compareLabels(a.agent, b.agent))
}

export function queryParentChildCounts(since: number, until?: number, config?: OpencodeDbConfig): ParentChildCounts {
  const rows = readSessionRows(since, until, config)
  return rows.reduce<ParentChildCounts>((acc, row) => {
    if (row.parent_id == null) acc.primarySessions += 1
    else acc.subagentSessions += 1
    return acc
  }, { primarySessions: 0, subagentSessions: 0 })
}
