# Signal House — architecture

Operator manual lives in [`docs/operations.md`](operations.md).
Visual rules live in [`docs/design-system.md`](design-system.md).
This file is for the audience that wants to *extend* signal-house:
add a collector, understand the data flow, or reason about the
privacy posture.

Two things to keep in mind throughout:

1. **It's a single Node process.** Next.js serves the UI, the API
   routes run inside it, the poller runs inside it, the SQLite
   database is the same one the API reads from. There's no
   separate daemon, no message bus, no second service.
2. **The UI never talks to GitHub, git, or any upstream source
   directly.** It's a local dashboard. All upstream access goes
   through server-side collectors.

---

## 1. Data flow

```
                                  ┌──────────────────┐
   Upstream                        │                  │
   ─────────                       │   Collectors     │
   GitHub API  ──────────────────► │   (server/lib/   │
   local git   ──────────────────► │    <source>/)    │
   Hermes DB   ──────────────────► │                  │
   OpenCode DB ──────────────────► │                  │
                                  └────────┬─────────┘
                                           │
                                           ▼
                                  ┌──────────────────┐
                                  │  Orchestrator    │
                                  │  (server/lib/    │
                                  │   orchestrator/) │
                                  └────────┬─────────┘
                                           │
                                           ▼
                                  ┌──────────────────┐
                                  │   SQLite         │
                                  │   (server/db/)   │
                                  └────────┬─────────┘
                                           │
                                           ▼
                                  ┌──────────────────┐
                                  │  API routes      │
                                  │  (frontend/src/  │
                                  │   app/api/)      │
                                  └────────┬─────────┘
                                           │
                                           ▼
                                  ┌──────────────────┐
                                  │   UI             │
                                  │  (Next.js page)  │
                                  └──────────────────┘
```

Four hops. Let's walk them.

### 1.1 Collectors (`server/lib/<source>/`)

Each upstream source is a folder under `server/lib/`:

| Folder | Source | What it collects |
|---|---|---|
| `github/` | GitHub REST API | Issues, PRs, workflow runs, repository metadata |
| `git/` | Local git CLI + remotes | Repo discovery, recent commits, authors |
| `hermes/` | Hermes's `state.db` | Agent session metrics, token usage |
| `upstream/` | upstream's database | Operator session metrics |
| `sessions/` | Local session files | Generic session metadata |

Each folder has the same shape:

```
server/lib/<source>/
  collector.ts        # the main entry point: async collect() => result
  types.ts            # the input/output types for this collector
  __tests__/          # tests, colocated
  (sometimes)
  aggregates.ts       # if the source has derived metrics
  db-collector.ts     # if reading from SQLite instead of HTTP/gRPC
```

The collector's `collect()` returns a structured result: the data
it gathered, the errors it hit, and a duration. It doesn't talk to
the database — that's the orchestrator's job.

### 1.2 Orchestrator (`server/lib/orchestrator/`)

The orchestrator is the only fan-out point. It runs every enabled
collector (in parallel, capped at `SECRET_HOUSE_COLLECT_CONCURRENCY`),
collects the results, **filters out private items by default** (see §3),
derives aggregates, and writes one atomic snapshot to the database.

The snapshot includes everything the UI might want to render:
issues, PRs, workflow runs, repo identities, sessions, errors, and
pre-derived aggregates (throughput, cycle time, CI health, stale
work, session usage, **and the privacy map**).

Two outcomes matter:

- **Successful refresh.** New snapshot written, `latest_state`
  table updated, poller continues.
- **Failed refresh.** Error logged to journal, `latest_state` is
  not updated, poller continues. The dashboard shows the *last
  good* snapshot with a "last failure at HH:MM" indicator.

Refreshes are **idempotent and overlapping-refresh-safe**. Two
simultaneous refreshes would corrupt state — the lock is enforced
by a single in-process guard plus a DB advisory (`refresh_in_progress`).
You cannot start a manual refresh while an automatic one is
in flight.

### 1.3 Database (`server/db/`)

SQLite, single file at `~/.local/share/signal-house/runtime/.data/metrics.db`.
Thirteen tables in the current schema, organised into three
groups:

| Group | Tables | Purpose |
|---|---|---|
| Snapshot lifecycle | `snapshots`, `latest_state` | "When was the last refresh? Is anything in flight? Did it succeed?" |
| Per-source data | `source_issues`, `source_pull_requests`, `source_workflow_runs`, `source_sessions`, `source_repositories`, `source_local_git` | Raw data from each collector, keyed by `repo_key` and `last_snapshot_id` |
| Aggregates | `aggregates` | Derived metrics persisted as JSON blobs (`throughput`, `cycleTime`, `ci`, `staleWork`, `sessionUsage`, `repositoryPrivacy`, ...) |

The `aggregates` table holds the derived metrics — including the
privacy map — but also some that need their own table for query
performance: `daily_metrics`, `daily_token_usage`.

Most queries join `source_*` tables on `(repo_key, last_snapshot_id)`
to get the latest data per repo. The exact schema is in
`server/db/schema.ts`. Migration history (the `_vN` blocks) is
historical, applied automatically at startup.

### 1.4 API + UI

Two API routes carry the load:

| Endpoint | What it returns |
|---|---|
| `GET /api/state` | The full normalised state — window, summary, usage, attention, status, diagnostics |
| `POST /api/refresh` | Triggers a manual refresh |

The UI fetches `/api/state` every 30s (when the page is open). No
streaming, no websockets, no GraphQL. The 30s interval is a
trade-off between "feels live" and "doesn't hammer the DB" — see
the comment in `frontend/src/app/page.tsx` if you want to tune it.

---

## 2. The collector model

If you want to add a new data source (say, an npm metrics API),
the contract is:

1. **Create `server/lib/<source>/`** with the shape in §1.1:
   - `collector.ts` exporting `createCollector(config) => { collect(): Promise<CollectorResult> }`
   - `types.ts` with the input/output types
   - `__tests__/collector.test.ts` (red first, per AGENTS.md)

2. **Wire it into the orchestrator:**
   - Add a branch in `server/lib/orchestrator/index.ts`
   - Add a new `SourceTaskResult` field for the new data type
   - Decide whether it joins the existing `source_*` schema or
     needs a new table (probably needs a new table)

3. **Add a new aggregate type** in `types/aggregates.ts` if the
   dashboard surfaces a derived metric. Otherwise skip.

4. **Persist via `upsert*FromSnapshot`** in `server/db/client.ts`.
   Add the function, then call it from `persistSnapshot()`.

5. **Update the UI** in `frontend/src/app/page.tsx` (or extract
   a new component if it's big enough). Follow the design
   system.

6. **Add docs.** Update `docs/operations.md` env var table if
   the collector has new config; update this file if the data
   flow diagram needs updating.

The collector model is *deliberately* simple. There's no plugin
manifest, no dynamic loading, no shared dependency-injection
container. Each collector is just a function that takes a config
and returns a result. If that constraint feels heavy, it is —
and that's the point. Heavy-to-add means easy-to-reason-about
once added.

---

## 3. Privacy posture

This is non-negotiable for new code. If you're adding a feature
that touches the privacy surface, read this section first and
follow the contract.

### 3.1 The contract

Three rules, enforced by the type system:

1. **`isPrivate: boolean` is wrong.** Use `boolean | null`.
   - `true` = known private (GitHub confirmed)
   - `false` = known public (GitHub confirmed)
   - `null` = unknown (collector could not determine)

2. **Missing privacy map entry → treated as private.** A repo
   that has no entry in `aggregates.repositoryPrivacy.privacyMap`
   is assumed private for the purposes of operator-facing surfaces.

3. **The `SECRET_HOUSE_SHOW_PRIVATE_REPO_ITEMS` flag is opt-in,
   not opt-out.** Default is `false`, meaning "hide private data."
   Setting it to `true` is a deliberate operator action.

### 3.2 Where it's enforced

| Layer | What it does | File |
|---|---|---|
| Collectors | Set `isPrivate: null` (or the real value from the API) | `server/lib/github/client.ts`, `server/lib/git/collector.ts` |
| Orchestrator | Builds the privacy map; resolves `null` to `true` (fail-closed) | `server/lib/orchestrator/index.ts` |
| API filter | Builds `privateRepoKeys` set from the map; defaults unknown to private | `frontend/src/app/api/state/route.ts` |
| Diagnostics | Same defensive treatment for `discoveredRepos` and `historicalRepos` | `server/lib/build-diagnostics.ts` |

The case study for this contract is GitHub issue
[#342](https://github.com/barkley-assistant/signal-house/issues/342).
Read it before changing anything in the privacy surface.

### 3.3 What "private" leaks if you opt in

Setting `SECRET_HOUSE_SHOW_PRIVATE_REPO_ITEMS=true` will surface:

- Issue titles, IDs, and URLs from private repos that the GitHub
  token can see
- Repository names in the Discovered Repositories card

It will **not** leak:

- The GitHub token
- The env file contents
- Any credentials

The opt-in is about *identifiable information about your work*,
not about *credentials*. Re-read §2.3 of `operations.md` before
flipping the flag.

---

## 4. Adding a new data source — checklist

Practical version of §2, copy-pastable:

- [ ] `server/lib/<source>/collector.ts` with `createCollector()` and `collect()`
- [ ] `server/lib/<source>/types.ts` with input/output types
- [ ] `server/lib/<source>/__tests__/collector.test.ts` (red first)
- [ ] `server/db/schema.ts` new table OR extension to existing `source_*` table
- [ ] `server/db/client.ts` new `upsert*FromSnapshot` + call from `persistSnapshot()`
- [ ] `server/lib/orchestrator/index.ts` new `SourceTaskResult` branch
- [ ] (if derived metrics needed) `types/aggregates.ts` new aggregate type
- [ ] `frontend/src/app/page.tsx` (or new component) — surface the data
- [ ] `docs/operations.md` — add env vars to the config table
- [ ] `docs/architecture.md` — update §1.1 collector table
- [ ] `.env.example` — add the new env vars

If any of these is missing, the change isn't done.

---

## 5. Things this file deliberately doesn't cover

- **Function-by-function walkthroughs of `server/db/client.ts`
  (1164 lines) or `frontend/src/app/page.tsx` (1117 lines).
  Those are the two biggest files; reading them directly is
  faster than a tour.
- **Decision records.** When `docs/decisions/` lands (per issue
  #344), that's where "why is it built this way" questions live.
  This file is about "how it works today."
- **Past migration history.** The `_vN` tables in `schema.ts`
  are migration artefacts, not coexisting tables. See §1.3.

If you're confused by something this file doesn't explain, that's
a bug in the file. File an issue.
