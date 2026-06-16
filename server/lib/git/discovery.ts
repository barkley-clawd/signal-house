import { readdirSync, statSync, existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { RepoDiscoveryConfig } from './types'

const DEFAULT_EXCLUDES = ['node_modules', '.git']
const DEFAULT_MAX_DEPTH = 3

function matchesGlob(name: string, patterns: string[]): boolean {
  if (patterns.length === 0) return true
  return patterns.some(pattern => {
    if (pattern === '*' || pattern === '*/*') return true
    const regexStr = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
    return new RegExp(`^${regexStr}$`).test(name)
  })
}

function walk(
  rootPath: string,
  currentPath: string,
  depth: number,
  globs: string[],
  maxDepth: number,
  excludes: string[],
  found: string[],
): void {
  if (maxDepth >= 0 && depth > maxDepth) return

  let entries: string[]
  try {
    entries = readdirSync(currentPath)
  } catch {
    return
  }

  for (const entry of entries) {
    const fullPath = join(currentPath, entry)

    let isDir = false
    try {
      isDir = statSync(fullPath).isDirectory()
    } catch {
      continue
    }
    if (!isDir) continue

    if (excludes.includes(entry)) continue

    if (existsSync(join(fullPath, '.git'))) {
      if (matchesGlob(entry, globs)) {
        found.push(fullPath)
      }
      continue
    }

    walk(rootPath, fullPath, depth + 1, globs, maxDepth, excludes, found)
  }
}

export function discoverGitRepos(config: RepoDiscoveryConfig): string[] {
  const roots = config.roots ?? []
  if (roots.length === 0) return []

  const globs = config.globs ?? []
  const maxDepth = config.maxDepth ?? DEFAULT_MAX_DEPTH
  const excludes = [...DEFAULT_EXCLUDES, ...(config.excludes ?? [])]

  const found: string[] = []

  for (const root of roots) {
    const resolvedRoot = resolve(root)
    if (!existsSync(resolvedRoot)) {
      console.warn(`[signal-house] Repo discovery root does not exist: ${resolvedRoot}`)
      continue
    }
    walk(resolvedRoot, resolvedRoot, 0, globs, maxDepth, excludes, found)
  }

  return [...new Set(found)]
}
