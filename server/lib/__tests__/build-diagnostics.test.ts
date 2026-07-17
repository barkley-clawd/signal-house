import { describe, expect, it } from '@jest/globals'
import { buildDiagnostics } from '../build-diagnostics'
import {
  makeLocalRepo,
  makeRepository,
  makeSnapshot,
} from './fixtures'
import type { RefreshRunState } from '../../../types/snapshot'

function makeState(overrides: Partial<RefreshRunState> = {}): RefreshRunState {
  return {
    status: 'idle',
    lastRunStartedAt: null,
    lastRunFinishedAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    nextRunAt: null,
    lastError: null,
    durationMs: null,
    sourceHealth: {},
    runHistory: [],
    ...overrides,
  }
}

describe('buildDiagnostics — private repo filtering', () => {
  it('shows all repos (public + private) when showPrivateRepoItems is true', () => {
    const state = makeState()
    const snapshot = makeSnapshot({
      localGit: [
        makeLocalRepo({ repoKey: 'local:/alpha', repoName: 'alpha', githubOwner: 'acme', githubRepo: 'alpha' }),
        makeLocalRepo({ repoKey: 'local:/beta', repoName: 'beta', githubOwner: 'acme', githubRepo: 'beta' }),
        makeLocalRepo({ repoKey: 'local:/gamma', repoName: 'gamma', githubOwner: 'acme', githubRepo: 'gamma' }),
      ],
      repositories: [
        makeRepository({ repoKey: 'github:acme/alpha', githubOwner: 'acme', githubRepo: 'alpha' }),
        makeRepository({ repoKey: 'github:acme/beta', githubOwner: 'acme', githubRepo: 'beta' }),
        makeRepository({ repoKey: 'github:acme/gamma', githubOwner: 'acme', githubRepo: 'gamma' }),
      ],
    })
    snapshot.aggregates!.repositoryPrivacy = {
      privacyMap: { 'github:acme/alpha': false, 'github:acme/beta': true, 'github:acme/gamma': false },
    }

    const result = buildDiagnostics(state, snapshot, true)

    expect(result.discoveredRepos).toHaveLength(3)
    expect(result.discoveredRepos.map(r => r.name)).toEqual(['alpha', 'beta', 'gamma'])
  })

  it('filters out private repos when showPrivateRepoItems is false (2 public + 1 private → 2)', () => {
    const state = makeState()
    const snapshot = makeSnapshot({
      localGit: [
        makeLocalRepo({ repoKey: 'local:/alpha', repoName: 'alpha', githubOwner: 'acme', githubRepo: 'alpha' }),
        makeLocalRepo({ repoKey: 'local:/beta', repoName: 'beta', githubOwner: 'acme', githubRepo: 'beta' }),
        makeLocalRepo({ repoKey: 'local:/gamma', repoName: 'gamma', githubOwner: 'acme', githubRepo: 'gamma' }),
      ],
      repositories: [
        makeRepository({ repoKey: 'github:acme/alpha', githubOwner: 'acme', githubRepo: 'alpha' }),
        makeRepository({ repoKey: 'github:acme/beta', githubOwner: 'acme', githubRepo: 'beta' }),
        makeRepository({ repoKey: 'github:acme/gamma', githubOwner: 'acme', githubRepo: 'gamma' }),
      ],
    })
    snapshot.aggregates!.repositoryPrivacy = {
      privacyMap: { 'github:acme/alpha': false, 'github:acme/beta': true, 'github:acme/gamma': false },
    }

    const result = buildDiagnostics(state, snapshot, false)

    expect(result.discoveredRepos).toHaveLength(2)
    expect(result.discoveredRepos.map(r => r.name).sort()).toEqual(['alpha', 'gamma'])
    expect(result.discoveredRepos.every(r => r.isPrivate !== true)).toBe(true)
  })

  it('defaults isPrivate to true when localGit repo has no match in snapshot.repositories (fail-closed)', () => {
    const state = makeState()
    const snapshot = makeSnapshot({
      localGit: [
        makeLocalRepo({ repoKey: 'local:/orphan', repoName: 'orphan', githubOwner: null, githubRepo: null }),
      ],
      repositories: [
        makeRepository({ repoKey: 'github:acme/other', githubOwner: 'acme', githubRepo: 'other' }),
      ],
    })
    snapshot.aggregates!.repositoryPrivacy = {
      privacyMap: { 'github:acme/other': true },
    }

    const result = buildDiagnostics(state, snapshot, false)

    expect(result.discoveredRepos).toHaveLength(0)
  })

  it('returns isPrivate:false for a GitHub-discovered repo with explicit public privacyMap entry', () => {
    const state = makeState()
    const snapshot = makeSnapshot({
      localGit: [
        makeLocalRepo({ repoKey: 'local:/public', repoName: 'public', githubOwner: 'acme', githubRepo: 'public' }),
      ],
      repositories: [
        makeRepository({ repoKey: 'github:acme/public', githubOwner: 'acme', githubRepo: 'public' }),
      ],
    })
    snapshot.aggregates!.repositoryPrivacy = {
      privacyMap: { 'github:acme/public': false },
    }

    // When showPrivateRepoItems is false, public repos should still appear
    const result = buildDiagnostics(state, snapshot, false)

    expect(result.discoveredRepos).toHaveLength(1)
    expect(result.discoveredRepos[0].name).toBe('public')
    expect(result.discoveredRepos[0].isPrivate).toBe(false)
  })

  it('returns isPrivate:true for a GitHub-discovered repo with explicit private privacyMap entry', () => {
    const state = makeState()
    const snapshot = makeSnapshot({
      localGit: [
        makeLocalRepo({ repoKey: 'local:/secret', repoName: 'secret', githubOwner: 'acme', githubRepo: 'secret' }),
      ],
      repositories: [
        makeRepository({ repoKey: 'github:acme/secret', githubOwner: 'acme', githubRepo: 'secret' }),
      ],
    })
    snapshot.aggregates!.repositoryPrivacy = {
      privacyMap: { 'github:acme/secret': true },
    }

    const result = buildDiagnostics(state, snapshot, false)

    expect(result.discoveredRepos).toHaveLength(0)
  })

  it('treats repo missing from privacyMap as private (fail-closed)', () => {
    const state = makeState()
    const snapshot = makeSnapshot({
      localGit: [
        makeLocalRepo({ repoKey: 'local:/missing', repoName: 'missing', githubOwner: 'acme', githubRepo: 'missing' }),
      ],
      repositories: [
        makeRepository({ repoKey: 'github:acme/other', githubOwner: 'acme', githubRepo: 'other' }),
      ],
    })
    snapshot.aggregates!.repositoryPrivacy = {
      privacyMap: { 'github:acme/other': false },
    }

    const result = buildDiagnostics(state, snapshot, false)

    expect(result.discoveredRepos).toHaveLength(0)
  })

  it('shows all repos when showPrivateRepoItems is true, regardless of privacy', () => {
    const state = makeState()
    const snapshot = makeSnapshot({
      localGit: [
        makeLocalRepo({ repoKey: 'local:/public', repoName: 'public', githubOwner: 'acme', githubRepo: 'public' }),
        makeLocalRepo({ repoKey: 'local:/secret', repoName: 'secret', githubOwner: 'acme', githubRepo: 'secret' }),
        makeLocalRepo({ repoKey: 'local:/orphan', repoName: 'orphan', githubOwner: null, githubRepo: null }),
      ],
      repositories: [
        makeRepository({ repoKey: 'github:acme/public', githubOwner: 'acme', githubRepo: 'public' }),
        makeRepository({ repoKey: 'github:acme/secret', githubOwner: 'acme', githubRepo: 'secret' }),
      ],
    })
    snapshot.aggregates!.repositoryPrivacy = {
      privacyMap: { 'github:acme/public': false, 'github:acme/secret': true },
    }

    const result = buildDiagnostics(state, snapshot, true)

    expect(result.discoveredRepos).toHaveLength(3)
    expect(result.discoveredRepos.map(r => r.name).sort()).toEqual(['orphan', 'public', 'secret'])
  })

  it('returns an empty discoveredRepos array when localGit is empty, regardless of flag', () => {
    const state = makeState()
    const snapshot = makeSnapshot({
      localGit: [],
      repositories: [
        makeRepository({ repoKey: 'github:acme/secret', githubOwner: 'acme', githubRepo: 'secret' }),
      ],
    })
    snapshot.aggregates!.repositoryPrivacy = {
      privacyMap: { 'github:acme/secret': true },
    }

    const hiddenResult = buildDiagnostics(state, snapshot, false)
    const shownResult = buildDiagnostics(state, snapshot, true)

    expect(hiddenResult.discoveredRepos).toEqual([])
    expect(shownResult.discoveredRepos).toEqual([])
  })
})
