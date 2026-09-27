# Internal Alpha Completion Audit

**Verdict: NOT GREEN — NOT READY** (2026-09-27, audit base `9e01fc8`; candidate `4847ec3`). Process: PROCESS-P0-ACCELERATED-SAFE-V2. Draft manifest: [INTERNAL_ALPHA_RELEASE_MANIFEST.md](INTERNAL_ALPHA_RELEASE_MANIFEST.md) (no release SHA frozen). UAT: [INTERNAL_ALPHA_UAT_MATRIX.md](INTERNAL_ALPHA_UAT_MATRIX.md). Not deployed.

**Update (IA-P2-02 remediation, 2026-09-27): IA-P2-02 CLOSED** — root cause proven (React 19.3.0 hydration-cursor bug on replay, inside `next@15.5.26`), fixed by a pnpm patch backporting React's upstream fix, verified on a fresh server and a fresh DB ([report](reports/IA-P2-02_hydration-418.md)). Status: **READY FOR COMPLETION AUDIT RECHECK.** The verdict below stays NOT GREEN until the final recheck re-runs the release gates and freezes the release SHA.

Answer to the gate question: **not yet.** The React hydration error #418 (OBS-WF05-01) reproduced once in this audit, on the public landing page, so by the task's closure rule Internal Alpha is not GREEN (**IA-P2-02**, open). Every other gate passed: scope, inventory, navigation, authorization, auth / session, WF01–WF05 journeys, data, migrations, seed, fresh DB, restart, production mode, build. One more P2 was found and fixed (**IA-P2-01**, sign-in request 500 on a malformed `X-Forwarded-For`). Once IA-P2-02 is closed, the deployment conditions below (HTTPS, dev routes off, seeded DB, operator-issued sign-in links) are what remains for internal team testing.

## Gates
| # | Area | Result | Evidence |
|---|---|---|---|
| 1 | Source / scope | PASS | CLAUDE.md, Master Spec, SOT, design SOT, screen contracts, DECISION_LOG (no OPEN item), WF01–WF05 audits, P0 reports, DEC-WF06: 0 release-blocking conflict; no executable screen outside scope, none missing; WF06 runtime absent; no duplicate model (WF05 reads the WF02 venture; applications only in the browser session) |
| 2 | Screen inventory | PASS | 44 page routes: **39 executable** (P0-LANDING 1, WF01 8 + legal page, WF02 8, WF03 8, WF04 9, WF05 4), 1 approved placeholder (`/ops/org/:id/programmes`, DEC-WF03-G12, never linked), 4 dev-only (404 unless `ENABLE_DEV_ROUTES=1`); 51 route files / 58 API handlers; loading / empty / error / not-found states per screen in the UAT matrix sources |
| 3 | Navigation | PASS | REL-NAV 108 visits, 35 route patterns, 102 link targets, 0 findings; P0-SHELL matrix 536 rows, 0 dead; direct URL, refresh, back, logout, revoked session covered |
| 4 | Authorization | PASS | REL-SEC 9 identities (10 roles) × 30 endpoints = 270 cells, spoofed = plain; guest → `/auth` / 401; admin and leader get no personal-resource shortcut; membership, leadership, the "Founder" label and pending states grant nothing beyond their contract |
| 5 | Auth / session | PASS | Magic link sign-in, one-time use, invalid / expired, callback `Referrer-Policy: no-referrer`, no token in HTML / API / logs, sessions list / revoke one / current / all, logout, revoked cookie replay 401; cookie `1hub_session` HttpOnly, SameSite=Lax, Secure under `next start` |
| 6–10 | WF01 – WF05 | PASS | Each workflow's closure spec + screen specs in the full suite (counts below) |
| — | Hydration #418 | **FAIL → CLOSED** | 1 occurrence (fresh-DB full run, `p0-shell-navigation` landing test) — IA-P2-02 below, closed by the remediation task; recheck pending |
| 11 | Landing | PASS | `p0-landing` 1–10; guest / member CTAs; footer legal links resolve with legal content (see Dependencies); "Tương lai" surfaces are copy only, no link |
| 12 | Shell / global UX | PASS | `p0-shell-navigation`; terminology consistent (Dự án / Startup, Chương trình / Challenge, Chapter / CLB, Sự kiện); P3 copy notes below |
| 13 | Responsive | PASS (certified scope) | REL-RESP 27 checks: all clean at 1440; landing, auth, WF05 clean at 768 / 390. Member, ops and onboarding shells are desktop-first (P0-SHELL audit; CLAUDE.md §5 1440 target): overflow at 768 (WF02 profile 609 px, venture 156) and 390 (onboarding 139, member home 205, WF02 profile 987, venture 534, WF03 dashboard 158) — IA-L1 |
| 14 | Visual | PASS | Pixel QA and primitive specs in the full suite: Structural 0, Major 0, Component 0; Be Vietnam Pro default; no APEC blue; `design-reference/final` untouched |
| 15 | Copy | PASS | Crawl: 0 placeholder, 0 technical term; P3 copy items below |
| 16 | Data invariants | PASS | REL-DATA; full-run table deltas come only from WF01–WF03 production workflows under test; `programmes`, `events`, `role_assignments` untouched by WF04 / WF05 demo activity |
| 17 | Migrations | PASS | 001→009 apply in order on a clean DB, rerun skips 9 / 9, sha256 ledger consistent, no undocumented migration, no WF05 / WF06 table; schema dump dev = fresh (only pg_dump restrict tokens and an empty schema comment differ) |
| 18 | Seed | PASS | Fresh DB: seed twice → 31 tables identical; personas, Chapter 01 / 02, Club 01, HUB, vocabulary, legal rows, Demo Startup present |
| 19 | Fresh DB | PASS except #418 (IA-P2-02 since closed) | Full suite on the fresh DB (after the IA-P2-01 fix): 664 tests — 639 passed, 24 skipped (opt-in), **1 failed = IA-P2-02**; 22 tables written by WF01–WF03 test setups through their own workflows; `programmes`, `events`, `role_assignments`, `project_domains` untouched; server log 0 lines |
| 20 | Restart | PASS | Member (WF01 / WF02 / WF05) and leader (WF03 / WF04) sessions kept across an app + PostgreSQL restart: 21 routes / APIs 200; the WF05 SUBMITTED application and the WF04 published demo state byte-identical in the browser session; 31 tables identical; both resets clear with 0 writes; guest → `/auth`; 0 console errors; log clean |
| 21 | Logs / privacy | PASS except #418 (IA-P2-02 since closed) | Every server log of this audit: 0 email / token / cookie / session / error lines; storage holds no PII or secret; API responses carry no token, hash or other actors' ids; console: the one #418 above, otherwise 0 |
| 22 | Negative / security | PASS | See UAT matrix; no required security case skipped (the 24 skips are the `PIXEL_QA_SCREENS` opt-in pixel runs) |
| 23 | Regression | PASS except #418 (IA-P2-02 since closed) | Dev DB after the fix: 664 tests — **640 passed, 24 skipped, 0 failed, 0 #418**; dev DB before the fix: 658 — 634 / 24 / 0; fresh DB after the fix: 639 / 24 / 1 (IA-P2-02). Per workflow (664): P0-LANDING 8, P0-SHELL + shell routes 47, WF01 152, WF02 94, WF03 66, WF04 115, WF05 66, shared (auth, API contract, idempotency, pixel harness, primitives, typography, console health, M0 root) 110, Internal Alpha 6. Unit 237, DB 349 |
| 24 | Build / static | PASS | `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (237), `pnpm test:db` (349), `pnpm build` (clean `.next`, 0 warnings) |
| 25 | Production mode | PASS | `next start` without `ENABLE_DEV_ROUTES`: `/dev/*` 404, `POST /dev/login` 404, guest `/me` → `/auth`, demo API 401, `/api/v1/session` 200 |

## Defect fixed
**IA-P2-01** — `POST /api/v1/auth/magic-link` answered 500 `UNCONTRACTED_INTERNAL` when the first `X-Forwarded-For` token was not a plain IP (`unknown`, `ip:port`, an IPv6 zone id): the value went into the `inet` column `request_ip`. The contract allows 202 / 429 only, and the WF01-S01 sign-in form uses this endpoint. Fix (`src/app/api/v1/auth/magic-link/route.ts`): keep a plain IPv4 / IPv6 literal, otherwise store null. Proof: REL-AUTH forwarded-address test (6 header shapes → 202; only valid IPs stored); WF01-S01, API contract, idempotency, auth-session specs and the full suite re-run.

## Closure defect IA-P2-02 (closed)
**IA-P2-02 — React hydration error #418 (intermittent; was OBS-WF05-01).** Production build, `next start`. As found by this audit:

| Occurrence | Context |
|---|---|
| 1 (WF05-S04 closure, run 1, dev DB) | `wf05-s04` authorization test: the ACTIVE member's first S04 review load right after an onboarding redirect (~70 ms into hydration) |
| 2 (this audit, fresh-DB full run, test ~72 / 664) | `p0-shell-navigation` "landing and auth entry …": the second `/` load at 768 px, right after `/auth` (~20 ms after the page chunks loaded) |

Facts: the landing page has **no app client component** (only Next `Link` / router); the failing `/` response was identical in size and headers (`no-store`) to the clean loads; the test touched no DOM before the error. In both events the page being left had an RSC request for `/` in flight during the navigation (a `Link` prefetch) — correlated, not sufficient: 750 targeted rapid `/` ↔ `/auth` loads (7 such windows) gave 0 errors. Not reproduced in isolation: WF05 gate 25 + 25 (under load), 40 repeats of the landing test, WF05 full suites. Seen only inside full-suite runs (2 of the last 6). Root cause not identified; the production error text is minified. Impact: React discards the server HTML and renders on the client (recoverable), no data or security effect — but the gate requires 0 hydration errors.

**Resolution (remediation task, [report](reports/IA-P2-02_hydration-418.md)).** Server markup, DOM at DOMContentLoaded and the first client commit are identical; the fault is in React 19.3.0 as bundled by `next@15.5.26`. When hydration reaches the page root `<div>` (under `InnerLayoutRouter`) while a child RSC chunk is still streaming, React suspends and replays that host fiber without rewinding its hydration cursor, and the replay fails to claim its own node (#418 'HTML'). Reproduced on demand by pausing the landing HTML stream after the page-root chunk: 42 / 150 unpatched. Fix: `patches/next@15.5.26.patch` (pnpm `patchedDependencies`) backports the upstream React lines (fixed in React canary `19.3.0-canary-d083ec1d-20260922`, Next 16.3.6); no app code changed. After the fix: 0 / 150, affected tests 50 / 50 each, fresh DB 0 / 90 and 25 / 25 each, full regression on a fresh DB 640 passed / 24 skipped / 0 failed, 0 #418. A root-layout `<Suspense>` was rejected because it changed HTTP status contracts (307 / 404 → 200).

## Defects and limitations (P3 / documented)
| ID | Item | Class |
|---|---|---|
| IA-P3-01 | Auth brand panel (approved WF01-S01 bitmap) states challenge figures and capabilities that are not live ("12 bài toán đang mở…", "Không đăng nhập vẫn đọc được toàn bộ đề bài…"); flagged "confirm before go-live" in the WF01-S01 report | P3 copy — **PO decision** (baseline-bound) |
| IA-P3-02 | Onboarding / profile copy refers to "Thư viện" and challenge owners (approved bitmaps); header "Challenge" inert as "giai đoạn sau" | P3 copy (PO) |
| IA-P3-03 | Seed data marks itself in English ("Fixture chapter …", "FIXTURE" legal text) on public org, ops profile and WF05 pages | P3 tester note |
| IA-P3-04 | `/ops/org/:id/programmes` placeholder reachable by direct URL (English "Route reserved…", no data; DEC-WF03-G12) | P3 |
| IA-P3-05 | No `error.tsx`: a server error shows Next's default English page; the 404 page has no link home | P3 |
| IA-P3-06 | Stale comments / docs (P0_STATUS older "Next" lines, DECISION_LOG SEC-OBS-01 "OPEN" line, P0-SHELL audit header, `programme-demo/fixtures.ts` seed reference, `profile/projection.ts`) | P3 doc |
| IA-L1 | App shells (member, ops, onboarding) desktop-first; test at ≥ 1024 px | Documented limitation |
| — | Carried: WF04-P3-01..06, WF05-P3-01..05 | P3 |

## Deployment dependencies
| Item | Internal Alpha | Go-live |
|---|---|---|
| HTTPS in front (Secure cookie) | Required (release condition) | Required |
| `ENABLE_DEV_ROUTES` unset | Required (release condition) | Required |
| Seeded DB (`db.mjs seed`) | Required (fixtures, vocabulary, legal rows, personas) | Real roster / taxonomy instead |
| No email provider | TEAM-UAT limitation: operator-issued one-time links, `@example.test` only | EXTERNAL DEPENDENCY / blocker |
| Legal text (`PRODUCTION_LEGAL_CONTENT_REQUIRED`) | TEAM-UAT limitation: legal links 404 unless `LEGAL_CONTENT_DIR` is set | EXTERNAL DEPENDENCY / blocker |
| Auth rate limiting; CSRF beyond SameSite; session TTL decision; server error logging (500s return `X-Request-ID` only) | TEAM-UAT limitation | Go-live blockers (M0 §16) |
| `X-Forwarded-For` first hop is client-controllable (`request_ip` audit value) | None | Hardening |
| Security headers (CSP, HSTS, X-Frame-Options) not set by the app; CDN overrides `Referrer-Policy` and injects scripts (deploy docs) | TEAM-UAT: rely on proxy / CDN | EXTERNAL / hardening |
| Avatar files outside `pg_dump` backups; `MEDIA_STORAGE_DIR` must be a volume | TEAM-UAT note | Backup plan |
| `patches/` must be in the image before `pnpm install --frozen-lockfile` (IA-P2-02 patch); `deploy/Dockerfile` copies only the manifests today | Required (deploy task) | Until the Next upgrade drops the patch |
| Deploy-branch docs stale (not seeded / nobody can sign in / WF01 open / `/` → `/auth`; PO checklist lacks landing, shell, WF04, WF05) | Update in the deploy task | — |

## Related
- [INTERNAL_ALPHA_RELEASE_MANIFEST.md](INTERNAL_ALPHA_RELEASE_MANIFEST.md) — release manifest
- [INTERNAL_ALPHA_UAT_MATRIX.md](INTERNAL_ALPHA_UAT_MATRIX.md) — UAT matrix
- [reports/WF05_COMPLETION_AUDIT.md](reports/WF05_COMPLETION_AUDIT.md), [reports/WF04_COMPLETION_AUDIT.md](reports/WF04_COMPLETION_AUDIT.md) — workflow audits
- [P0_STATUS.md](P0_STATUS.md) — status
