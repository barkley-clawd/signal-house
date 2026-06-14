import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApiClient } from '../client'

function mockFetch(status: number, body: unknown, headers: Record<string, string> = {}): void {
  const bodyStr = JSON.stringify(body)
  const resHeaders = new Headers({ 'content-type': 'application/json', ...headers })
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(bodyStr, { status, headers: resHeaders }))
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('createApiClient', () => {
  it('maps issues from GitHub API response', async () => {
    mockFetch(200, [
      {
        number: 42,
        title: 'Fix the thing',
        state: 'open',
        created_at: '2025-01-05T00:00:00Z',
        updated_at: '2025-01-06T00:00:00Z',
        closed_at: null,
        html_url: 'https://github.com/test/repo/issues/42',
        labels: [{ name: 'bug' }],
        assignee: { login: 'alice' },
        milestone: { title: 'v1.0' },
      },
      {
        number: 43,
        title: 'PR not issue',
        state: 'open',
        created_at: '2025-01-05T00:00:00Z',
        updated_at: '2025-01-06T00:00:00Z',
        closed_at: null,
        html_url: 'https://github.com/test/repo/pull/43',
        labels: [],
        assignee: null,
        milestone: null,
        pull_request: {},
      },
    ])

    const client = createApiClient({ token: 'tok', baseUrl: 'https://api.github.com/repos/test/repo' })
    const issues = await client.fetchIssues()

    expect(issues).toHaveLength(1)
    expect(issues[0]!.id).toBe('42')
    expect(issues[0]!.state).toBe('open')
    expect(issues[0]!.labels).toEqual(['bug'])
    expect(issues[0]!.assignee).toBe('alice')
    expect(issues[0]!.milestone).toBe('v1.0')
    expect(issues[0]!.repo).toBe('test/repo')
  })

  it('maps pull requests from GitHub API response', async () => {
    mockFetch(200, [
      {
        number: 7,
        title: 'Add feature',
        state: 'closed',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-10T00:00:00Z',
        merged_at: '2025-01-10T00:00:00Z',
        closed_at: '2025-01-10T00:00:00Z',
        html_url: 'https://github.com/test/repo/pull/7',
        user: { login: 'bob' },
        labels: [{ name: 'enhancement' }],
        additions: 100,
        deletions: 50,
        changed_files: 5,
        head: { ref: 'feature', sha: 'abc123' },
        merged: true,
      },
    ])

    const client = createApiClient({ token: 'tok', baseUrl: 'https://api.github.com/repos/test/repo' })
    const prs = await client.fetchPullRequests()

    expect(prs).toHaveLength(1)
    expect(prs[0]!.state).toBe('merged')
    expect(prs[0]!.author).toBe('bob')
    expect(prs[0]!.additions).toBe(100)
    expect(prs[0]!.deletions).toBe(50)
    expect(prs[0]!.changedFiles).toBe(5)
    expect(prs[0]!.repo).toBe('test/repo')
  })

  it('handles API errors gracefully', async () => {
    mockFetch(500, { message: 'Internal Server Error' })
    const client = createApiClient({ token: 'tok', baseUrl: 'https://api.github.com/repos/test/repo' })
    await expect(client.fetchIssues()).rejects.toThrow('GitHub API 500')
  })

  it('paginates with Link header', async () => {
    const page1 = Array.from({ length: 2 }, (_, i) => ({
      number: i + 1,
      title: `Issue ${i + 1}`,
      state: 'open' as const,
      created_at: '2025-01-05T00:00:00Z',
      updated_at: '2025-01-06T00:00:00Z',
      closed_at: null,
      html_url: '',
      labels: [],
      assignee: null,
      milestone: null,
    }))
    const page2 = [
      {
        number: 3,
        title: 'Issue 3',
        state: 'open' as const,
        created_at: '2025-01-05T00:00:00Z',
        updated_at: '2025-01-06T00:00:00Z',
        closed_at: null,
        html_url: '',
        labels: [],
        assignee: null,
        milestone: null,
      },
    ]

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify(page1), {
          status: 200,
          headers: new Headers({
            'content-type': 'application/json',
            link: '<https://api.github.com/repos/test/repo/issues?page=2>; rel="next"',
          }),
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(page2), {
          status: 200,
          headers: new Headers({
            'content-type': 'application/json',
            link: '',
          }),
        }),
      )

    const client = createApiClient({ token: 'tok', baseUrl: 'https://api.github.com/repos/test/repo' })
    const issues = await client.fetchIssues()
    expect(issues).toHaveLength(3)
  })
})
