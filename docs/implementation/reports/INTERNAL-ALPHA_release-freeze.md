# Claude Task Report

## Task
INTERNAL ALPHA — FINAL RELEASE RECHECK + FREEZE EXACT SHA. Process: PROCESS-P0-ACCELERATED-SAFE-V2. Start HEAD `1eeda38` (`main`). HEAD chain since the last full recheck: `9c61458` (IA-P2-03 CSS + test) → `1eeda38` (docs). Deploy branch `deploy/vps-foundation` started at `2bdce0f`.

## Verdict
**GREEN — Internal Alpha RELEASE CANDIDATE.** Frozen:
- **Release SHA `9c614585ca61fe2e4c957f28d7cc5c78fafe7bc0`** (app, `main`: all product and build code incl. IA-P2-02 and IA-P2-03; later `main` commits are docs only);
- **deploy tooling `68488cfe9732b46aad297e24ab6f2811ce6d9caf`** (`deploy/vps-foundation`: the Dockerfile copies `patches/` before the install);
- **rollback `0a2df094b941f6d0f0fc87cdb7767b2e92272198`**.

Manifest **READY**. Nothing deployed or pushed; Task 20 not started.

## Gates
| # | Gate | Result | Evidence |
|---|---|---|---|
| 1 | HEAD / tree | PASS | IA-P2-02 (`194b4b3`: patch + workspace + lockfile) and IA-P2-03 (`9c61458`: 4 CSS files + REL-RESP test) present; `9c61458..1eeda38` is docs only; tree clean except the untracked `AGENTS.md` |
| 2 | Patch reproducibility | PASS | `git archive 9c61458` → clean tree → `pnpm install --frozen-lockfile` exit 0. Installed `next@15.5.26_patch_hash=989560c2…` (= lockfile hash); the patch reverse-applies; 1 patched line in each react-dom client build. The production chunks `4b76ab8d-….js` and `framework-….js` contain the rewind. No manual `node_modules` edit |
| 3 | Deploy build context | PASS (fixed) | `deploy.sh` builds `docker build -f deploy/Dockerfile <git archive of the SHA>`. `68488cf` adds `COPY patches ./patches` between the manifests and `pnpm install --frozen-lockfile`. Real local docker builds of `git archive 9c61458`: the old Dockerfile (`2bdce0f`) exits 254 with `ENOENT … /app/patches/next@15.5.26.patch`; the new one installs (3m 8s) and builds. The image resolves the patched `next`. `rollback.sh` reuses kept images, so it needs no rebuild |
| 4 | Release image smoke | PASS | That image on a fresh DB: migrate 9 applied / rerun 9 skipped, seed ok. `/api/v1/auth/providers` 200, `/api/v1/session` 200 `{"authenticated":false}`, `/` 200, `/auth` 200, `REGION` 200 × 3; `/dev/typography` and `POST /dev/login` 404; guest `/me` 307 → `/auth`. The served chunk is patched; container log clean |
| 5 | Hydration | PASS | Split harness on the candidate build: 0 / 150; on the release image: 0 / 90. 0 console, page or recoverable errors. Landing / auth 10 / 10, WF05-S04 "never a submit" 10 / 10. Full suite 0 #418 |
| 6 | Responsive | PASS | Pointer / touch probe of 28 routes and states: 0 unreachable, covered or clipped at 1440 / 1024 / 768 / 390; 9 local scroll containers in use below 1440. Page-level sideways scroll only where IA-P3-08 lists it. REL-RESP pointer test: 60 rows, 0 problems |
| 7 | Regression | PASS | Clean-tree full suite on a fresh DB: **665 = 641 passed, 24 skipped, 0 failed** (P0-LANDING 8, P0-SHELL 47, WF01 152, WF02 94, WF03 66, WF04 115, WF05 66, shared 110, Internal Alpha 7). Visual 110 (86 passed, 24 opt-in skipped). The only skips are the `PIXEL_QA_SCREENS` opt-in; no security test skipped. Unit 237 / 237; DB / API 349 / 349 |
| 8 | Build gates | PASS | format, lint (0 warnings), typecheck, build (0 warnings) in the clean tree |
| 9 | Fresh DB | PASS | PostgreSQL 17.6: 001→009 in order, rerun 9 skipped, ledger 9; seed × 2 identical (31 tables); same seeded counts as before. Schema vs dev: only the `public` schema owner / comment / grant lines differ. No migration since `0a2df09` (`db/`, `scripts/` unchanged) |
| 10 | Security / privacy | PASS | IA-P2-03 and the deploy fix change no auth, RBAC, API or DB write path. REL-SEC 270 cells, REL-DATA and REL-NAV (108 visits, 0 findings) pass; P0-SHELL matrix 497 rows = 461 × 200 + 36 inert, 0 dead. Table diff over the suite: `programmes`, `events`, `role_assignments` and `project_domains` unchanged. Console audit of every page: 0 JS or page errors; the "Failed to load resource" lines are the negative tests' intended 4xx and 30 × 500 stubs. Server log clean; no token, cookie, secret or PII in logs, HTML, API or storage |
| 11 | Defects | PASS | P0 0 · P1 0 · P2 0. P3: IA-P3-01..08, IA-L1, WF04-P3-01..06, WF05-P3-01..05. Watch: IA-OBS-01, not seen in 5 later DB runs |
| 12 | External | PASS for the review domain | `1hubnetwork.io.vn` resolves; Let's Encrypt `*.1hubnetwork.io.vn` valid to 2026-12-24; `GET /api/v1/auth/providers` over HTTPS 200 (read-only check). Other items classified in the manifest; none blocks the review deploy |

Environment note: during the docker build the 2 GiB colima VM OOM-killed the local PostgreSQL once. It recovered from its WAL, the dev DB was checked intact, and every DB-dependent step was re-run afterwards.

## Files changed
- Deploy branch: `deploy/Dockerfile` (`68488cf`)
- Docs (`main`): this report, `INTERNAL_ALPHA_RELEASE_MANIFEST.md` (READY), `INTERNAL_ALPHA_COMPLETION_AUDIT.md`, `INTERNAL_ALPHA_UAT_MATRIX.md`, `P0_STATUS.md`, `CLAUDE_LATEST_REPORT.md`
- No product code, test or migration change

## Git
- `main`: start `1eeda38`; release SHA `9c61458`; report: the docs commit containing this file
- `deploy/vps-foundation`: `2bdce0f` → `68488cf` (local branch, not on `origin`)
- Push NOT RUN (LOCAL REVIEW MODE)

## Related
- [INTERNAL_ALPHA_RELEASE_MANIFEST.md](../INTERNAL_ALPHA_RELEASE_MANIFEST.md) — manifest (READY)
- [INTERNAL-ALPHA_final-recheck.md](INTERNAL-ALPHA_final-recheck.md), [IA-P2-03_basic-responsive-safety.md](IA-P2-03_basic-responsive-safety.md), [IA-P2-02_hydration-418.md](IA-P2-02_hydration-418.md) — history
