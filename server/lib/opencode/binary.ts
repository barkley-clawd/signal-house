import { execFileSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'

export function isCommandNotFound(err: unknown): boolean {
  if (err instanceof Error) {
    const e = err as NodeJS.ErrnoException
    if (e.code === 'ENOENT' || e.code === 'EACCES') return true
    const msg = e.message
    if (msg.includes('ENOENT') || msg.includes('EACCES') || msg.includes('not found') || msg.includes('127')) return true
  }
  return false
}

export function findOpencodeBinary(overrides?: { opencodeBin?: string; opencodeCommand?: string }): string | null {
  const candidates: Array<string | undefined> = [
    overrides?.opencodeBin,
    process.env.OPENCODE_BIN,
    'opencode',
    path.join(os.homedir(), '.opencode/bin/opencode'),
    '/home/openclaw/.opencode/bin/opencode',
    overrides?.opencodeCommand,
    process.env.OPENCODE_COMMAND,
  ]

  for (const cmd of candidates) {
    if (!cmd) continue
    try {
      execFileSync(cmd, ['--version'], { timeout: 5000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] })
      return cmd
    } catch {
      // try next candidate
    }
  }

  return null
}
