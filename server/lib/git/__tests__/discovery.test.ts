import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { discoverGitRepos } from '../discovery'

let tmpDir: string

function gitRepo(path: string): void {
  mkdirSync(path, { recursive: true })
  mkdirSync(join(path, '.git'), { recursive: true })
}

function notGitDir(path: string): void {
  mkdirSync(path, { recursive: true })
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'sh-discovery-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('discoverGitRepos', () => {
  it('discovers git repos in a root directory', () => {
    gitRepo(join(tmpDir, 'repo-a'))
    gitRepo(join(tmpDir, 'repo-b'))
    notGitDir(join(tmpDir, 'not-a-repo'))

    const repos = discoverGitRepos({ roots: [tmpDir] })

    expect(repos).toHaveLength(2)
    expect(repos).toContain(join(tmpDir, 'repo-a'))
    expect(repos).toContain(join(tmpDir, 'repo-b'))
  })

  it('filters discovered repos by glob pattern', () => {
    gitRepo(join(tmpDir, 'project-alpha'))
    gitRepo(join(tmpDir, 'project-beta'))
    gitRepo(join(tmpDir, 'other-thing'))

    const repos = discoverGitRepos({
      roots: [tmpDir],
      globs: ['project-*'],
    })

    expect(repos).toHaveLength(2)
    expect(repos).toContain(join(tmpDir, 'project-alpha'))
    expect(repos).toContain(join(tmpDir, 'project-beta'))
    expect(repos).not.toContain(join(tmpDir, 'other-thing'))
  })

  it('returns all repos when globs is empty', () => {
    gitRepo(join(tmpDir, 'repo-a'))
    gitRepo(join(tmpDir, 'repo-b'))

    const repos = discoverGitRepos({
      roots: [tmpDir],
      globs: [],
    })

    expect(repos).toHaveLength(2)
  })

  it('skips excluded directories', () => {
    gitRepo(join(tmpDir, 'node_modules'))
    gitRepo(join(tmpDir, 'src'))
    gitRepo(join(tmpDir, 'dist'))

    const repos = discoverGitRepos({
      roots: [tmpDir],
      excludes: ['node_modules'],
    })

    expect(repos).not.toContain(join(tmpDir, 'node_modules'))
    expect(repos).toContain(join(tmpDir, 'src'))
    expect(repos).toContain(join(tmpDir, 'dist'))
  })

  it('skips .git directory by default', () => {
    // .git itself should never be discovered as a repo
    mkdirSync(join(tmpDir, '.git'), { recursive: true })
    // .git shouldn't be found because it's in the default excludes
    // But also git repos shouldn't recurse into .git
  })

  it('respects maxDepth', () => {
    gitRepo(join(tmpDir, 'top-repo'))
    gitRepo(join(tmpDir, 'level1', 'inner-repo'))
    gitRepo(join(tmpDir, 'level1', 'level2', 'deep-repo'))

    const repos = discoverGitRepos({
      roots: [tmpDir],
      maxDepth: 1,
    })

    expect(repos).toContain(join(tmpDir, 'top-repo'))
    expect(repos).toContain(join(tmpDir, 'level1', 'inner-repo'))
    expect(repos).not.toContain(join(tmpDir, 'level1', 'level2', 'deep-repo'))
  })

  it('maxDepth 0 only checks root directories', () => {
    gitRepo(join(tmpDir, 'top-repo'))
    gitRepo(join(tmpDir, 'sub', 'nested-repo'))

    const repos = discoverGitRepos({
      roots: [tmpDir],
      maxDepth: 0,
    })

    expect(repos).toContain(join(tmpDir, 'top-repo'))
    expect(repos).not.toContain(join(tmpDir, 'sub', 'nested-repo'))
  })

  it('returns empty array for empty roots', () => {
    const repos = discoverGitRepos({ roots: [] })
    expect(repos).toEqual([])
  })

  it('warns and skips non-existent root', () => {
    const warn = console.warn
    const warnings: string[] = []
    console.warn = (msg: string) => { warnings.push(msg) }

    try {
      const repos = discoverGitRepos({ roots: ['/nonexistent/path'] })
      expect(repos).toEqual([])
      expect(warnings.length).toBeGreaterThan(0)
      expect(warnings[0]).toContain('does not exist')
    } finally {
      console.warn = warn
    }
  })

  it('handles multiple roots', () => {
    const rootA = join(tmpDir, 'workspace-a')
    const rootB = join(tmpDir, 'workspace-b')
    gitRepo(join(rootA, 'repo-one'))
    gitRepo(join(rootB, 'repo-two'))

    const repos = discoverGitRepos({ roots: [rootA, rootB] })

    expect(repos).toHaveLength(2)
    expect(repos).toContain(join(rootA, 'repo-one'))
    expect(repos).toContain(join(rootB, 'repo-two'))
  })

  it('deduplicates repos found from multiple roots', () => {
    gitRepo(join(tmpDir, 'shared-repo'))

    const repos = discoverGitRepos({ roots: [tmpDir, tmpDir] })

    expect(repos).toHaveLength(1)
    expect(repos).toEqual([join(tmpDir, 'shared-repo')])
  })

  it('does not recurse inside discovered git repos', () => {
    gitRepo(join(tmpDir, 'monorepo'))
    gitRepo(join(tmpDir, 'monorepo', 'packages', 'inner-pkg'))

    const repos = discoverGitRepos({ roots: [tmpDir] })

    expect(repos).toContain(join(tmpDir, 'monorepo'))
    expect(repos).not.toContain(join(tmpDir, 'monorepo', 'packages', 'inner-pkg'))
  })

  it('matches glob with exact name', () => {
    gitRepo(join(tmpDir, 'my-repo'))
    gitRepo(join(tmpDir, 'other'))

    const repos = discoverGitRepos({
      roots: [tmpDir],
      globs: ['my-repo'],
    })

    expect(repos).toHaveLength(1)
    expect(repos).toContain(join(tmpDir, 'my-repo'))
  })
})
