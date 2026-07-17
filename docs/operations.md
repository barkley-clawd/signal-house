# Signal House — operator manual

This is the file you open when signal-house is broken, when you're
configuring it, or when you're trying to remember how a piece of it
works. Architecture deep-dive lives in [`docs/architecture.md`](architecture.md).
Visual rules live in [`docs/design-system.md`](design-system.md).

If you only remember three things:

1. **The env file lives at `~/.config/signal-house/.env`.** That's
   where every runtime setting comes from.
2. **The daemon runs as a user service under systemd**, not as a
   system service. `systemctl --user ...`, no sudo needed.
3. **The build script at `~/bin/build-signal-house` is the upgrade
   path.** It clones, installs, builds, restarts. One command does
   all four.

---

## 1. Setup

### 1.1 Prerequisites

The runtime checkout is built and run by [`mise`](https://mise.jdx.dev/).
You need mise, git, and a Unix-y shell. No other host dependencies —
Node comes via mise, modules install via `npm ci`.

### 1.2 Install on a fresh box

1. **Get the source** (or a release tarball, when public packages exist):

   ```bash
   git clone https://github.com/barkley-assistant/signal-house.git
   ```

   For the deployed runtime, the convention here is to keep a
   separate checkout at `~/.local/share/signal-house/runtime/`. The
   build script manages this — see §4.

2. **Set up the config directory:**

   ```bash
   mkdir -p ~/.config/signal-house
   cp signal-house/.env.example ~/.config/signal-house/.env
   # Edit ~/.config/signal-house/.env. At minimum, set
   # SECRET_HOUSE_GITHUB_TOKEN. See §2 for the full list.
   chmod 600 ~/.config/signal-house/.env   # token in plaintext; don't leak
   ```

3. **Install the systemd unit:**

   ```bash
   cp signal-house/packaging/systemd/signal-house.service \
      ~/.config/systemd/user/
   systemctl --user daemon-reload
   systemctl --user enable --now signal-house
   ```

   That last command is two operations combined: register the unit
   with the user-systemd manager so it starts on every login, and
   start it right now.

4. **Verify:**

   ```bash
   systemctl --user status signal-house
   curl http://localhost:8999/api/state | head -c 200
   ```

   You should see `active (running)` and a JSON object starting with
   `"window"`. If you see `connection refused`, the daemon isn't
   up yet — give it ~3s and retry; if still refused, jump to §5.

### 1.3 Access protection (optional)

For a single-operator local dashboard, HTTP basic auth is overkill.
If you do want it (e.g. the dashboard is reachable on a LAN), set:

```bash
SECRET_HOUSE_ACCESS_USERNAME=<your-name>
SECRET_HOUSE_ACCESS_PASSWORD=<a-long-random-string>
```

in `~/.config/signal-house/.env`. Leave `SECRET_HOUSE_ACCESS_PASSWORD`
empty to disable. Auth is enforced globally — there's no per-endpoint
toggle.

---

## 2. Configuration

All runtime config comes from environment variables. In the daemon,
those come from `~/.config/signal-house/.env` (read by the systemd
unit's `EnvironmentFile=`).

### 2.1 The full list

| Env var | Default | What it does |
|---|---|---|
| `SECRET_HOUSE_GITHUB_TOKEN` | (none) | Personal access token for the GitHub API. Empty = no GitHub data. **Required for the dashboard to show anything.** |
| `SECRET_HOUSE_GITHUB_OWNER` | (none) | Owner scope for the GitHub collector. Typically your handle. |
| `SECRET_HOUSE_GITHUB_REPO` | (none) | Default repo. Often unused if you're monitoring many repos. |
| `SECRET_HOUSE_GIT_REPOS` | (none) | Comma-separated explicit paths to git repos. Empty = use discovery. |
| `SECRET_HOUSE_PROJECT_ROOTS` | (none) | Comma-separated directories to scan for repos. Empty = no discovery. |
| `SECRET_HOUSE_GIT_REPO_GLOBS` | `*` | Glob filter applied during discovery. |
| `SECRET_HOUSE_GIT_DISCOVERY_MAX_DEPTH` | `3` | How deep to walk from `SECRET_HOUSE_PROJECT_ROOTS`. |
| `SECRET_HOUSE_GIT_EXCLUDE` | `node_modules,dist,.next,.nuxt,.output` | Comma-separated directory names to skip. |
| `SECRET_HOUSE_POLLER_ENABLED` | `false` | Run the background refresh loop. Set to `true` for continuous updates. |
| `SECRET_HOUSE_POLL_INTERVAL_SECONDS` | `300` | Refresh interval when the poller is enabled. |
| `SECRET_HOUSE_POLL_STARTUP_DELAY_SECONDS` | `5` | Delay before the poller's first refresh. |
| `SECRET_HOUSE_RUN_ON_STARTUP` | `true` | Run one refresh when the daemon starts. Set to `false` to require manual trigger. |
| `SECRET_HOUSE_SESSIONS_PERIOD_DAYS` | `30` | Lookback window for agent session metrics. |
| `SECRET_HOUSE_HERMES_DB_PATH` | `~/.hermes/state.db` | Path to Hermes's `state.db` for token usage collection. |
| `SECRET_HOUSE_COLLECT_CONCURRENCY` | `3` | Parallelism for GitHub collectors during a refresh. |
| `SECRET_HOUSE_COLLECT_LOOKBACK_DAYS` | `28` | How far back to fetch issues/PRs. |
| `SECRET_HOUSE_STALE_THRESHOLD_DAYS` | `14` | What's "stale" in the attention queue. |
| `SECRET_HOUSE_STALE_THRESHOLD_MINUTES` | `15` | What's "stale" for the dashboard data freshness indicator. |
| `SECRET_HOUSE_RETENTION_SNAPSHOTS_DAYS` | `30` | How long to keep dashboard snapshots. |
| `SECRET_HOUSE_RETENTION_DAILY_METRICS_DAYS` | `90` | Same for daily metrics rollups. |
| `SECRET_HOUSE_RETENTION_SESSIONS_DAYS` | `90` | Same for session data. |
| `SECRET_HOUSE_RETENTION_WORKFLOW_RUNS_DAYS` | `90` | Same for workflow runs. |
| `SECRET_HOUSE_SHOW_PRIVATE_REPO_ITEMS` | `false` | Show private-repo issues/PRs in the attention queue. **Default is fail-closed — leave it `false` unless you have a reason.** See "Privacy posture" below. |
| `SECRET_HOUSE_ACCESS_USERNAME` | `signal-house` | HTTP basic auth username. Leave blank to disable. |
| `SECRET_HOUSE_ACCESS_PASSWORD` | (empty) | HTTP basic auth password. Empty = no auth. |
| `DB_DIR` | `.data` (cwd) | Where the SQLite database lives. The unit sets this to `/home/agent/.local/share/signal-house/runtime/.data`. |

### 2.2 The ones you'll actually touch

For 95% of operator work, you only ever edit these:

- **`SECRET_HOUSE_GITHUB_TOKEN`** — when the GitHub collector starts
  hitting 401/403, or when you rotate tokens.
- **`SECRET_HOUSE_POLLER_ENABLED`** — flip to `true` once you've
  confirmed a manual refresh works end-to-end.
- **`SECRET_HOUSE_SHOW_PRIVATE_REPO_ITEMS`** — flip to `true`
  *only* if you understand the privacy implications (see below).
- **`SECRET_HOUSE_POLL_INTERVAL_SECONDS`** — lower if you want more
  frequent updates; raise if you're rate-limited.

Everything else has a sensible default. Leave them alone.

### 2.3 Privacy posture

**Default is fail-closed.** Unknown privacy status → treated as
private. `SECRET_HOUSE_SHOW_PRIVATE_REPO_ITEMS=false` is the safe
default and you should keep it that way unless you have an
explicit reason.

Setting it to `true` will surface:
- Issue and PR titles from private repos that the GitHub token can see
- Repository names in the Discovered Repositories card

It will *not* leak the GitHub token, the env file, or any
credentials — that's a different layer. But it will leak
*identifiable information* about your private repos. This is the
exact trade-off the operator is opting into.

The privacy contract (explicit-null tri-state, fail-closed default)
is enforced by the code; see [`docs/architecture.md`](architecture.md#privacy-posture)
for the design.

---

## 3. Day-to-day

### 3.1 Trigger a refresh

The daemon refreshes automatically when the poller is enabled
(default: off). To trigger one manually:

```bash
curl -X POST http://localhost:8999/api/refresh
```

If you'd rather trigger from the dashboard, there's a button in the
top bar. Same code path underneath.

### 3.2 Check daemon status

```bash
systemctl --user status signal-house
```

The `Active:` line tells you everything. `active (running)` = good.
`inactive (dead)` after a restart = something crashed; check the
log (next item).

### 3.3 Read the log

```bash
journalctl --user -u signal-house -n 100 --no-pager   # last 100 lines
journalctl --user -u signal-house -f                   # follow live
```

Poller refresh status appears as `[poller] refresh completed
successfully` or `[poller] refresh completed with errors: ...`.
The latter is not a panic — partial-data refreshes are normal
when one collector fails (e.g. transient GitHub API error).

### 3.4 Restart

```bash
systemctl --user restart signal-house
```

Brief downtime (~5s). The poller will resume on the
`POLL_STARTUP_DELAY_SECONDS` timer.

### 3.5 Stop / start

```bash
systemctl --user stop signal-house    # stop, won't auto-start
systemctl --user start signal-house   # manual start (poller resumes if enabled)
```

### 3.6 Look at the database

```bash
sqlite3 ~/.local/share/signal-house/runtime/.data/metrics.db ".tables"
```

Useful queries:

```sql
-- latest snapshot
SELECT id, captured_at FROM snapshots ORDER BY captured_at DESC LIMIT 1;

-- last 10 privacy decisions in the privacy map
SELECT data FROM aggregates
WHERE type = 'repositoryPrivacy'
ORDER BY id DESC LIMIT 1;

-- source repos currently marked present
SELECT repo_key, github_owner, github_repo FROM source_repositories
WHERE last_snapshot_id = (SELECT id FROM snapshots ORDER BY captured_at DESC LIMIT 1)
  AND present = 1;
```

---

## 4. Upgrade

The build script handles the full upgrade cycle. It's at
`~/bin/build-signal-house` on this box; it's not in the repo
(intentionally — public package publishing is a future pass).

```bash
~/bin/build-signal-house
```

This single command:

1. `git pull`s the runtime checkout to `origin/main`
2. `npm ci` at the root and in `frontend/`
3. `npm run build` for the frontend
4. Kills any stale process holding port 8999
5. `systemctl --user daemon-reload`
6. `systemctl --user restart signal-house.service`

Override-able env vars: `SOURCE_REMOTE` (alternative repo),
`DEPLOY_ROOT` (alternative runtime checkout), `FRONTEND_DIR`,
`MISE_BIN`, `SYSTEMD_UNIT`. None of these need overriding for
a normal upgrade.

After running, verify:

```bash
curl http://localhost:8999/api/state | head -c 200
```

If the response is empty or 502, check the log (§3.3). Most
upgrade failures are transient — re-run the script.

---

## 5. Troubleshooting

This section is intentionally short. When you hit a *new* failure
mode, write it down here so the next person doesn't have to
re-derive the fix.

### 5.1 Dashboard shows "stale" but data is fresh

The freshness indicator (`SECRET_HOUSE_STALE_THRESHOLD_MINUTES`,
default 15 min) is based on the snapshot's `capturedAt` timestamp.
If the poller hasn't run in 15 min *and* the daemon hasn't been
restarted, you'll see "stale."

- **Poller is enabled but not running:** check the log (§3.3). Look
  for `[poller]` lines. If absent, the poller daemon failed. Restart
  it.
- **Poller is disabled:** the dashboard only refreshes on startup
  and on manual trigger. Enable it: `SECRET_HOUSE_POLLER_ENABLED=true`
  in the env file, then restart.

### 5.2 "connection refused" on port 8999

The daemon isn't up. Three checks:

1. `systemctl --user status signal-house` — is it active?
2. `journalctl --user -u signal-house --no-pager -n 30` — what does
   the log say at the most recent startup?
3. `ss -tlnp 'sport = :8999'` — is anything listening?

If the daemon is "active" but nothing is on 8999, the daemon is
crashing during `ExecStart=`. The most common cause is a missing or
invalid `EnvironmentFile=`. Check `~/.config/signal-house/.env` is
present and readable, and that the unit's `EnvironmentFile=` line
points at it.

### 5.3 GitHub collector hits 401

Token is invalid or expired. Two paths:

- **Personal token expires:** rotate it in GitHub, update
  `SECRET_HOUSE_GITHUB_TOKEN` in the env file, restart.
- **Token scope is too narrow:** the dashboard needs `repo` scope
  to read private repos and `public_repo` for public-only access.

After the fix, the next manual refresh (§3.1) should succeed.

### 5.4 Build script fails with "port 8999 is busy"

The script tries to kill the process holding port 8999 before
restarting (see `kill_port_8999()` in the script). If something
*else* is on 8999 — a leftover dev server, a different app — the
kill fails.

Find the culprit:

```bash
ss -tlnp 'sport = :8999'
```

Kill it manually, then re-run the build script.

### 5.5 Private items leaking into the attention queue

If you've set `SECRET_HOUSE_SHOW_PRIVATE_REPO_ITEMS=true` and a
private repo's data is appearing, this is the expected behaviour
per the contract — *you opted in*. If you didn't intend to opt in:

1. Set `SECRET_HOUSE_SHOW_PRIVATE_REPO_ITEMS=false` in the env file.
2. Restart: `systemctl --user restart signal-house`.

If you have it set to `false` and you still see private-repo data,
that's a bug. File an issue at
[barkley-assistant/signal-house/issues](https://github.com/barkley-assistant/signal-house/issues)
with the symptoms. The tri-state privacy contract (§2.3) should
prevent this; if it doesn't, the contract has a hole.

### 5.6 Database grows unbounded

The retention settings (§2.1) cap how long historical data is kept.
If the database is huge, either:

- The retention never ran (e.g. the daemon is crashing before the
  retention plugin executes). Check the log on startup.
- A new collector is producing data the retention doesn't know
  about. Check the `aggregates` table for unfamiliar `type` values.

Quick check:

```bash
ls -la ~/.local/share/signal-house/runtime/.data/
sqlite3 ~/.local/share/signal-house/runtime/.data/metrics.db \
  "SELECT name, SUM(pgsize) FROM dbstat GROUP BY name ORDER BY 2 DESC LIMIT 10;"
```

Shows table sizes. The top three will typically be `aggregates`,
`snapshots`, and one of the `source_*` tables.

---

## 6. Layout reference

Single-page reference so you don't have to grep:

```
~/.config/signal-house/
  └── .env                                   # all runtime config

~/.local/share/signal-house/runtime/         # the deployed build
  ├── frontend/                              # built Next.js app
  └── .data/metrics.db                       # SQLite

~/.config/systemd/user/
  ├── signal-house.service                   # the unit
  └── default.target.wants/signal-house.service → ../signal-house.service

~/bin/build-signal-house                     # upgrade + restart script

http://localhost:8999/                       # the dashboard
http://localhost:8999/api/state              # JSON state (for debugging)
```
