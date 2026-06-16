export interface GithubRemoteParseResult {
  originRemoteUrl: string
  githubOwner: string
  githubRepo: string
}

function stripGitSuffix(repo: string): string {
  return repo.endsWith('.git') ? repo.slice(0, -4) : repo
}

function parseGithubPath(pathname: string): { owner: string; repo: string } | null {
  const normalized = pathname.replace(/^\/+/, '')
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length !== 2) return null
  const [owner, repo] = parts
  if (!owner || !repo) return null
  return { owner, repo: stripGitSuffix(repo) }
}

export function parseGithubOriginRemote(remoteUrl: string): GithubRemoteParseResult | null {
  const trimmed = remoteUrl.trim()
  if (!trimmed) return null

  const sshMatch = trimmed.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i)
  if (sshMatch) {
    return {
      originRemoteUrl: trimmed,
      githubOwner: sshMatch[1]!,
      githubRepo: stripGitSuffix(sshMatch[2]!),
    }
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.hostname.toLowerCase() !== 'github.com') return null
    const path = parseGithubPath(parsed.pathname)
    if (!path) return null
    return {
      originRemoteUrl: trimmed,
      githubOwner: path.owner,
      githubRepo: path.repo,
    }
  } catch {
    return null
  }
}
