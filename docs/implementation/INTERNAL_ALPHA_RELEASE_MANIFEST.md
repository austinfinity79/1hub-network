# Internal Alpha Release Manifest

**Status: INTERNAL ALPHA — DEPLOYED GREEN** on https://1hubnetwork.io.vn since 2026-09-30 01:58 UTC ([deploy report](reports/INTERNAL-ALPHA-RC_deploy.md)); RC frozen by TASK 24 FINAL ([freeze report](reports/TASK-24-FINAL_release-freeze.md)). Functional QA: PASS. Pixel QA: PASS on the individual flow closures (24.1–24.5). Automated UAT: PASS; domain smoke 35 / 35. Human / team UAT: **PENDING**. [DEP-1](#dep-1): **CLOSED** (PO option A).

Deploy EXACTLY the release SHA with the deploy tooling SHA below; never a branch name or HEAD at deploy time (CLAUDE.md §14). The previous RC (`9c61458`, 28/09) and its hotfixes up to `c02cdd9` are superseded.

## Release
| Field | Value |
|---|---|
| **Release SHA** (app, `main`) | **`ff052d70fe418cb092bd5e33fcc03ee712c76d14`** — TASK 24.1–24.5 on top of `c02cdd9`; product code identical to `db25d95` (`ff052d7` adds the RC responsive smoke only) |
| GitHub | `main` and `deploy/vps-foundation` pushed 2026-09-30; tag **`internal-alpha-2026-09-30`** → `ff052d70fe418cb092bd5e33fcc03ee712c76d14` ([release sync](reports/INTERNAL-ALPHA-RC_release-sync.md)) |
| **Deploy tooling SHA** (`deploy/vps-foundation`) | **`4519a84f045b663fc82c688516bc5e1483f22fc3`** (on `origin`) |
| **Rollback SHA** | **`c02cdd9ba4ab6b84bf87a569c02c608cc62804a0`** — live on https://1hubnetwork.io.vn (server `state/current` and `app/.env`, read 2026-09-30); its image is kept, so `rollback.sh` needs no rebuild. Schema-safe: 013 only adds tables that `c02cdd9` never reads |
| Runtime | Node 22, pnpm via corepack, PostgreSQL 17 (`postgres:17.6-alpine`), the Next patch in `patches/` |
| Migrations | `001`→`013`, 13 files, sha256 ledger. Production holds `001`→`012`; the deploy applies **`013_p0_applications.sql`** only (additive: two enums, `programme_application_forms`, `applications`) |
| Seed | never on a production deploy. Production was seeded once; it holds the fixture organisations and a DRAFT "Demo Challenge", **not** the PUBLISHED programme `d4000000-…01` nor any application form |
| Scope | Homepage, About, Library (L2), L1, L2, L3 (chapter / CLB), WF04 operator demo (L4, no FUTURE frame), L5 Startup Journey (server applications), L6: no screen (DEC-L6-D1) |

## <a id="dep-1"></a>DEP-1 — production programme data (CLOSED 2026-09-30, option A)
| Item | Detail |
|---|---|
| Finding | From this release, the L5 journey and the WF05 list / detail "Chương trình đang mở" read `programme_application_forms`. The live `c02cdd9` shows the WF04 fixture programme from code. After the deploy, without data, production shows **no open programme** and no "Đăng ký" |
| Option A (recommended) | After the migrate, apply once the seed's L5 block alone: programme `d4000000-…01` "Chương trình ươm tạo (demo)" under the existing `chapter-01`, and its form (two questions, TEAM + STARTUP). Idempotent (`ON CONFLICT`); touches `programmes` and `programme_application_forms` only (verified on a copy of the `c02cdd9` schema) |
| Option B | Deploy without data: L5 stays dark in production until a programme is configured |
| Not allowed | running the full seed on production (dev personas) |
| Result | applied after 013: programme `d4000000-…01` PUBLISHED under `chapter-01` + its form; re-applied identical; no other row changed ([deploy report](reports/INTERNAL-ALPHA-RC_deploy.md)) |

## Commands (from the deploy worktree at `4519a84`)
| Step | Command |
|---|---|
| Backup (before) | `/opt/1hub-network/app/bin/backup.sh`; copy `/opt/1hub-network/shared/media` separately |
| Deploy | `deploy/bin/deploy.sh ff052d70fe418cb092bd5e33fcc03ee712c76d14` |
| Migrate | by `release.sh`: expect `001`→`012` skip, `013` applied. Never `reset` |
| DEP-1 | only as decided by the PO |
| Health / smoke | `deploy/bin/smoke.sh`, then the checks below over HTTPS |
| Rollback | `rollback.sh` → `c02cdd9` |

## Environment
| Variable | Required | Value / rule |
|---|---|---|
| `DATABASE_URL` | yes (secret, server only) | PostgreSQL connection string |
| `NODE_ENV` | yes | `production` |
| `MEDIA_STORAGE_DIR` | yes | a mounted volume |
| `ENABLE_DEV_ROUTES` | **must be unset** | `=1` opens `/dev/login` |
| `LEGAL_CONTENT_DIR` | yes | `content/legal` ([DEC-LEGAL](../decisions/DECISION_LOG.md#dec-legal)) |

## Health / smoke after deploy
| Check | Expect |
|---|---|
| `GET /`, `/about`, `/library`, `/auth` | 200 |
| `GET /api/v1/session` | 200 `{"authenticated":false}` |
| `GET /dev/login`, `/dev/typography` | 404 |
| `GET /me`, `/programmes/d4000000-…01/apply` as guest | 307 → `/auth` |
| `GET /api/v1/me/applications` as guest | 401 |
| `/demo/projects` signed in | the open programme listed (DEP-1 A) or the empty state (DEP-1 B) |

## Evidence (TASK 24 FINAL, local production build of the RC)
| Gate | Result |
|---|---|
| format, lint, typecheck, production build | PASS |
| Unit · impacted DB / API | 252 / 252 · 214 / 214 |
| Combined release smoke (UAT L1 / L2 + 10 specs) | 19 / 19 · 92 / 92 |
| Migrations: fresh · upgrade from `c02cdd9` + live-like rows | 13 applied, rerun 13 skip · 013 only, 0 existing table changed, ledger identical |
| Runtime | #418 0 · 5xx 0 · broken assets 0 · console 0 |

## Known gaps (non-blocking, documented)
Invite-by-link; Google OAuth configuration; AI provider; L3 FUTURE (L21, L22, L24, L25, L27); L4 FUTURE (L28–L36) and real operator-side Challenge administration; L6 matching / ranking / recommendation and L46–L54; public startup page (PUBLIC grants no read); 500 view (IA-P3-05, HD-A9); email provider (operator-issued links); auth rate limiting, CSRF beyond SameSite, monitoring (post-Alpha); accepted P3 items of the [audit](INTERNAL_ALPHA_COMPLETION_AUDIT.md).

## Related
- [reports/TASK-24-FINAL_release-freeze.md](reports/TASK-24-FINAL_release-freeze.md) — this freeze
- [reports/INTERNAL-ALPHA_release-freeze.md](reports/INTERNAL-ALPHA_release-freeze.md) — the 28/09 freeze (superseded)
- [P0_STATUS.md](P0_STATUS.md) — status
