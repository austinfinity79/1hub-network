# WF05-PROD-00_gap-audit

**WF05-PROD-00 — WF05 production gap audit (audit only).** 2026-10-02, on the WF04 candidate `f40f70c`. No runtime code, migration, API or design changed. WF05 = the founder Project / Startup journey: `/demo/projects` (S01 list, S02 venture) and the L5 Programme Application flow (`/programmes/{id}/apply` → SUB0 / CHOOSE / SUB1–SUB3). Classified gaps: [gap matrix](WF05-PROD-00_gap-matrix.md); runtime, persistence, lifecycle and identity: [runtime matrices](WF05-PROD-00_runtime-matrices.md); API, DB, security, tests, visual: [API / DB / security](WF05-PROD-00_api-db-security.md).

## Verdict
WF05 already runs on the canonical model with real persistence: the L5 Application went server-side (DEC-2809-D6, DEC-L5-D1…D6) and is live in production since RC `ff052d7` (migration 013, DEP-1). What remains is **hardening, not rebuilding**: 0 P0 blockers, 14 P1, 13 P2, 2 SOT conflicts, 3 PO decisions, 4 not required for P0. No duplicate Project / Startup / Venture / Application model exists or is needed.

## Preflight
| Check | Result |
|---|---|
| repository, worktree | `/Users/thanosvn/workspace/hubnetwork`, Claude A main worktree |
| branch, HEAD | `feat/wf04-prod-hardening`, `f40f70c55080a154a721cd5878453837b3460a9b` (WF04 candidate), tree clean except `AGENTS.md` |
| other lanes | `fix/member-shell-mobile` (`a957876`, on `78f21f2`) and Claude B `docs/ai-ingestion-contract` (`fb2130f`, on `cdcf17e`): neither is in HEAD |
| origin/main, production | `78f21f2` / `78f21f2`; local `main` sits at `b4463e2` (PROD-01 commit), not pushed |
| migrations, schema | 001–015 present; local DB at 015; production at 014 (`78f21f2` code) |

**Git plan (applied, local only):** WF05 work goes on a new branch `feat/wf05-prod-hardening` cut from `f40f70c`, because WF05 hardening builds on the WF04 programme schema (015) and API; `feat/wf04-prod-hardening` stays exactly at the candidate. This audit's docs are the first commit there. Nothing reset, rebased, merged or pushed.

## SOT reviewed
CLAUDE.md §1–§8; Master Spec v1.3 §3–5, §9; Data SOT v1.1 §1–4, §6, §12, §14–15; Data Decisions Freeze; WF02 FINAL; DECISION_LOG (DEC-WF02-S05, OPEN-WF05 / DEC-WF05-G1…G5, DEC-WF05-T00, DEC-L2, DEC-L2R, DEC-2809, DEC-2909, DEC-L5, DEC-PDF, DEC-AIG, DEC-W4P); `task-24/l5-startup-contract.md` + inventory; `scope-refreeze/application-persistence.md`, `human-decisions.md`, `task-sequence.md`, `conflict-audit.md`; WF05 completion audit, UAT matrix, TASK-24.4 closure, INTERNAL-ALPHA RC deploy; API contract §2, §5.3–5.4, §15, §21, §22; capability matrix; migrations 007, 008, 011, 012, 013, 015; deterministic seed.

## Canonical model
| Concept | Canonical entity / table | Current WF05 usage | Gap |
|---|---|---|---|
| User / Profile | `user_accounts` 1:1 `individual_profiles` | session → owner checks (`application.ts`) | — |
| Venture / Project / Startup | `projects` (`project_type` PROJECT / STARTUP; DRAFT / ACTIVE / ARCHIVED; visibility) + `project_domains` | S01 / S02 read model, `ventureOf`, `getApplyOptions`; SUB0 creates through `POST /ventures` | Data SOT still lists Team / Startup entities (G02) |
| Team / member | owner = `projects.owner_profile_id`; `project_members` (state, EDIT / VIEW) | `getTeam`, `teamOf` | — |
| Programme | `programmes` (`programme_status`, 015) | `loadForm` reads PUBLISHED only | — |
| ProgrammeApplicationForm | `programme_application_forms` | `loadForm`, `listOpenForms` | form read without lock (G10) |
| ProgrammeApplication | `applications` (`venture_id` FK, answers, snapshot, one-active-pair index, no-update-after-submit trigger) | `lib/application` | DELETE of SUBMITTED not blocked (G16) |

35 public tables, 0 views; no `team*`, `startup*`, `venture*`, `founder*` table and no second application table. Parallel structures are code-level only (legacy actor key, applicant type defined three times, two "my ventures" queries over the same tables).

## Production readiness (diagnostic only; tracker is owned by ChatGPT / PO)
| Category | Readiness | Evidence |
|---|---:|---|
| Canonical data model | 90% | one copy of each entity; Data SOT not amended (G02) |
| Persistence | 85% | all business state in DB; idempotency copy of answers (G15); ≤ 20 s typing window (G26) |
| API | 75% | owner rules, idempotent create / submit; 500 on malformed venture id (G06), envelope (G07), invite key (G08), PATCH checks (G09) |
| RBAC / security | 80% | owner-only proven e2e incl. spoofing; privacy copy (G15), unlogged 500s (G12), pool (G13) |
| Lifecycle | 80% | DRAFT → SUBMITTED final, snapshot, trigger; closed-programme draft (G11), DELETE (G16) |
| Frontend real API | 70% | no fixture, no browser persistence; demo frame (G21, G22), session expiry (G23), navigation (G24) |
| Cross-WF integrity | 85% | same `projects.id` WF02 → WF05, same programme / form ids; form race (G10) |
| Test coverage | 60% | L5 + WF05 UAT + DB tests; no WF05 API / security spec, gaps in G34 |
| Pixel / responsive | 60% | L5 frames approved and responsive; S01 / S02 have no approved reference (G35) |
| **Overall** | **≈ 75%** | |

## Proposed PROD-01 → PROD-07
See [gap matrix § plan](WF05-PROD-00_gap-matrix.md#proposed-prod-01--prod-07). The planned sequence stands; PROD-01 must also carry the WF02-protected authorisation (G06, G08 live in WF02 code).

## PO decisions
| # | Smallest question | Gap |
|---|---|---|
| PO-1 | Promote WF05 to production as (a) the L5 application flow only (already live) or (b) L5 + the S01 / S02 project screens? | G01 |
| PO-2 | On S01 / S02: remove the "Dữ liệu demo" notice and "Đặt lại demo" (as WF04 did), rename the "· Demo" entry, and keep `/demo/projects` routes (as WF04 Q6) or move them? | G22 |
| PO-3 | After a programme closes, should the owner still see their submitted application in S01 / S02 (today it disappears from every list)? | G25 |
| PO-4 | Confirm that one Venture (PROJECT / STARTUP) replaces the Data SOT Team / Startup / `primary_applicant_id` model and authorise amending Data SOT §2 / §12. | G02 |
| PO-5 | Programme `d4…0001` "(demo)" in production: keep, rename or retire (WF04 Q8, shared)? | G32 |

Not escalated (decided or technical): audience of PUBLISHED programmes (DEC-W4P-D10), owner-only reads (HD-A13), no withdraw in P0, no deadlines (DEC-L5-D6), every fix in P1 / P2.

## Related
- [WF05-PROD-00_gap-matrix.md](WF05-PROD-00_gap-matrix.md) · [WF05-PROD-00_runtime-matrices.md](WF05-PROD-00_runtime-matrices.md) · [WF05-PROD-00_api-db-security.md](WF05-PROD-00_api-db-security.md) · [WF04-PROD-07_production-readiness.md](WF04-PROD-07_production-readiness.md)
