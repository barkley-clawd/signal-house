# ADR-0001: Explicit-null tri-state privacy contract

- **Status**: Accepted
- **Date**: 2026-07-17
- **Number**: 0001

## Context

The `SECRET_HOUSE_SHOW_PRIVATE_REPO_ITEMS` flag was non-functional for private
repos discovered via local git. Their issues and PRs surfaced in the Attention
Queue, and the Discovered / Historical Repositories cards listed them with
`isPrivate=false`.

Three independent defects combined into a single class of bug:

1. **Type contract forced a boolean.** `RepositoryIdentity.isPrivate` was
   `boolean` (no `null`). When the GitHub API had no data for a local-git-only
   repo, the unknown privacy status was silently encoded as `false` (public).
2. **Orchestrator defaulted to public.** The privacyMap builder in the
   orchestrator read `repo.isPrivate ?? false`, meaning "unknown" became
   "public" — the wrong default for a privacy-sensitive feature.
3. **Missing map entries leaked.** The API route and diagnostics computed
   `publicRepoKeys` from `privacyMap` entries. If a repo key was missing from
   the map entirely, it was treated as public — the map was not authoritative.

## Decision

Adopt a fail-closed tri-state contract: `boolean | null` throughout the
pipeline, with `null` resolved to `true` (private, i.e. fail-closed) before
persistence.

### The four-part fix (commit `0cf46da`)

1. **Types**: `RepositoryIdentity.isPrivate` → `boolean | null`,
   `RepositoryMetric.isPrivate` → `boolean | null`,
   `RepositoryPrivacyAggregate.privacyMap` → `Record<string, boolean>`
   (nulls resolved before storage).

2. **Orchestrator**:
   - `toRepositoryMetric()` (`server/lib/orchestrator/index.ts:99–110`)
     returns `isPrivate: null` for local-git-only repos (was `false`).
   - `mergeIdentity()` (`:60–64`) uses `??` with a comment forbidding `||`,
     preserving `null` across merges.
   - PrivacyMap builder (`:366–369`) resolves `null → true` (fail-closed):
     `repo.isPrivate ?? true`.

3. **API + diagnostics**: `publicRepoKeys` computed from
   `privacyMap[repoKey] === false`; missing entries treated as private.
   See `frontend/src/app/api/state/route.ts:105–114` and
   `server/lib/build-diagnostics.ts:15–20`.

4. **Validation**: `validatePrivacyMap()` (`orchestrator/index.ts:427–439`)
   asserts every issue/PR/workflow run/repo has a privacyMap entry. On
   mismatch it warns, sets `partialData=true`, and surfaces the count
   (not the names) in diagnostics.

### Rejected alternative

Defaulting `null` to `false` (public) was the original bug. A "fail-open"
approach would let private repo data leak into the UI until the collector
provides the correct value. Fail-closed (`null → true`) ensures privacy
by default — data only appears in the Attention Queue when privacy is
definitively known to be `false`.

## Consequences

- **Positive**: Privacy is fail-closed by default. Unknown repos are treated
  as private until proven public. No data leaks through the Attention Queue
  for repos with unknown privacy status.
- **Positive**: Clear type-level contract. `boolean | null` makes the tri-state
  explicit — readers of the type know "we may not know this yet."
- **Positive**: `validatePrivacyMap()` catches regressions at runtime. Any new
  code path that adds repo keys without updating the privacy map triggers a
  `partialData` warning.
- **Negative**: Slightly more complex type signatures. Every consumer of
  `isPrivate` must handle three states: `true` (private), `false` (public),
  `null` (unknown).
- **Negative**: The privacy map's stored type is `Record<string, boolean>`
  (nulls resolved), which differs from the pipeline types. The resolution
  boundary is in the orchestrator — easy to miss when adding a new path
  through the pipeline.

## References

- Commit: [`0cf46da`](https://github.com/barkley-assistant/signal-house/commit/0cf46da)
- PR: [#342](https://github.com/barkley-assistant/signal-house/pull/342)
- `types/metrics.ts:59,68` — `RepositoryIdentity.isPrivate` and
  `RepositoryMetric.isPrivate`
- `server/lib/orchestrator/index.ts:60–64` — `mergeIdentity()` with `??` invariant
- `server/lib/orchestrator/index.ts:99–110` — `toRepositoryMetric()` returns `null`
- `server/lib/orchestrator/index.ts:366–369` — privacyMap builder (`null → true`)
- `server/lib/orchestrator/index.ts:427–439` — `validatePrivacyMap()`