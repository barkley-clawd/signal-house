const ACRONYMS = new Set([
  'GPT', 'GLM', 'API', 'SDK', 'LLM', 'AI',
])

const VERSION_PATTERN = /^[Vv]([1-9]\d*)$/

// Known brand names with internal capitalization that cannot be derived
// from the lowercase slug alone.
const BRAND_NAMES = new Map<string, string>([
  ['deepseek', 'DeepSeek'],
  ['minimax', 'MiniMax'],
  ['opencode', 'OpenCode'],
])

function isAcronym(word: string): boolean {
  return ACRONYMS.has(word.toUpperCase())
}

function isVersionLabel(word: string): boolean {
  // M1-M3, R1, V1-V5, V10, etc.
  return /^(?:[Mm][1-3]|R1)$/.test(word) || VERSION_PATTERN.test(word)
}

function isNumeric(word: string): boolean {
  return /^\d/.test(word)
}

function titleCaseWord(word: string): string {
  // Preserve pure acronyms (GPT, GLM, etc.)
  if (isAcronym(word)) return word.toUpperCase()
  // Preserve version labels (V4, M3, R1)
  if (isVersionLabel(word)) return word.toUpperCase()
  // Preserve numeric-leading segments (5.2, k2.7 — but title-case the non-numeric part)
  if (isNumeric(word)) return word
  // Check for known brand names
  if (BRAND_NAMES.has(word)) return BRAND_NAMES.get(word)!
  // Normal title case
  if (word.length === 0) return word
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

export function normalizeModelName(value: unknown): { slug: string; provider: string | null } {
  if (value == null) return { slug: '(unknown)', provider: null }

  let raw: string | null = null

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return { slug: '(unknown)', provider: null }

    // Try JSON parse first — same as db-collectors' existing logic
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>
        const extracted =
          (typeof parsed.id === 'string' && parsed.id.trim()) ||
          (typeof parsed.modelID === 'string' && parsed.modelID.trim()) ||
          (typeof parsed.model_id === 'string' && parsed.model_id.trim()) ||
          (typeof parsed.name === 'string' && parsed.name.trim()) ||
          (typeof parsed.providerID === 'string' && parsed.providerID.trim()) ||
          null
        if (extracted) {
          raw = extracted.trim()
        } else {
          raw = trimmed
        }
      } catch {
        raw = trimmed
      }
    } else {
      raw = trimmed
    }
  } else if (typeof value === 'object' && value !== null) {
    // Resolve JSON-object extraction (same field preference as db-collectors)
    const record = value as Record<string, unknown>
    const extracted =
      (typeof record.id === 'string' && record.id.trim()) ||
      (typeof record.modelID === 'string' && record.modelID.trim()) ||
      (typeof record.model_id === 'string' && record.model_id.trim()) ||
      (typeof record.name === 'string' && record.name.trim()) ||
      (typeof record.providerID === 'string' && record.providerID.trim()) ||
      null
    if (extracted) {
      raw = extracted.trim()
    } else {
      return { slug: '(unknown)', provider: null }
    }
  } else {
    return { slug: '(unknown)', provider: null }
  }

  if (!raw) return { slug: '(unknown)', provider: null }

  // Extract provider from first `/` segment
  let provider: string | null = null
  const slashIndex = raw.indexOf('/')
  if (slashIndex !== -1) {
    provider = raw.slice(0, slashIndex).trim() || null
    // Keep the full string for slugification (slash becomes hyphen)
  }

  // Slugify: lowercase, replace non-alphanumeric (except dot) with hyphen, collapse, strip
  let slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-') // non-alphanumeric/dot → hyphen
    .replace(/-+/g, '-')           // collapse consecutive hyphens
    .replace(/^-+|-+$/g, '')       // strip leading/trailing hyphens

  if (!slug) return { slug: '(unknown)', provider: null }

  return { slug, provider }
}

export function slugToDisplayName(slug: string, provider?: string | null): string {
  let displaySlug = slug

  // Strip provider prefix if it matches
  if (provider && displaySlug.startsWith(`${provider}-`)) {
    displaySlug = displaySlug.slice(provider.length + 1)
  }

  // Split on hyphen and format each word
  const parts = displaySlug.split('-')
  const formatted = parts.map(part => {
    // Handle dot-notation versions (e.g., k2.7 → K2.7, 5.2 → 5.2)
    if (part.includes('.')) {
      return part
        .split('.')
        .map(segment => titleCaseWord(segment))
        .join('.')
    }
    return titleCaseWord(part)
  })

  return formatted.join(' ')
}