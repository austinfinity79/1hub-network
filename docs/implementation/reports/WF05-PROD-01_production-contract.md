# WF05-PROD-01_production-contract

**WF05 production contract — FROZEN 2026-10-02 (WF05-PROD-01), on the PO's closed decisions ([DEC-W5P](../../decisions/DECISION_LOG.md#dec-w5p)).** Branch `feat/wf05-prod-hardening` (base: WF04 candidate `f40f70c`). Contract only: no runtime, migration or route change. Parts: [domain and lifecycle](WF05-PROD-01_domain-lifecycle.md) · [RBAC, API, frontend](WF05-PROD-01_rbac-api-frontend.md) · [DB contract](WF05-PROD-01_db-contract.md) · [implementation handoff](WF05-PROD-01_implementation-handoff.md). Inputs: [PROD-00 audit](WF05-PROD-00_gap-audit.md), [pre-freeze decisions](WF05-PROD-01_prefreeze-decisions.md).

## Scope: WF05 = L5 + S01 + S02
| Surface | Route | Actions in scope |
|---|---|---|
| entry | ME7 sidebar "Hồ sơ đăng ký" (DEC-AIG-D3); MemberShell footer entry (DEC-WF05-G2) | open S01 |
| S01 ventures + applications | `/demo/projects` | list own ventures (owner or ACTIVE member), own applications in every programme state, PUBLISHED programmes with a form and per-venture eligibility; open S02; start / continue / view an application |
| S02 venture | `/demo/projects/{ventureId}` | read-only venture overview and ACTIVE team; programme rows with eligibility and application status; links to WF02 edit (`/projects/{id}/edit`) and team (`/projects/{id}/team`); start / continue / view an application |
| L5 start | `/programmes/{programmeId}/apply` | 0 eligible venture → SUB0 quick create (canonical `POST /ventures`); 1 → the form; n → CHOOSE |
| L5 form | `/projects/{ventureId}/applications/{programmeId}?buoc=1–4` (SUB1) | first save creates the DRAFT; save answers |
| L5 review | `…/review` (SUB2) | see `missing`; submit |
| L5 submitted | `…/submitted` (SUB3) | read the snapshot |
| legacy paths | `/demo/projects/{id}/applications/{programmeId}[/review]` | 307 to the member routes (kept) |
WF05 adds no table and no copy: S01 / S02 / L5 are a presentation layer over WF02 ventures and WF04 programmes and forms; venture create / edit / publish and team management stay WF02 screens and APIs.

## Out of P0
Operator / organiser read, review or judging of applications and statuses beyond SUBMITTED (HD-A13, Data SOT review states); withdraw, discard, reopen, resubmission or amendment; deadlines from `starts_at` / `ends_at` (DEC-L5-D6); INDIVIDUAL applicant, Solution, separate Team / Startup entities; uploads, application code, e-mail (DEC-L5-D1); team members reading applications; public programme pages (DEC-W4P-D10); public startup profile L44 / L45 and detailed team management (DEC-2809-D5 Future); venture archive action (DEC-WF02-S05-G3); operator-authored questions (WF04 Q3(b) NOT_REQUIRED_FOR_P0); renaming `/demo` routes.

## Demo artifact disposition
| Artifact | Disposition |
|---|---|
| "Dữ liệu demo · Internal Alpha" notice on S01 / S02 | REMOVE (`DemoPage notice: false`, as WF04) |
| "Đặt lại demo" button, its confirmation and message | REMOVE |
| demo-only copy ("trong bản demo", "(demo)" wording in WF05 copy) | REMOVE (state the real behaviour instead) |
| actor-key / legacy session-store plumbing (`actorKey`, `demo-store`) | REMOVE |
| MemberShell footer group "Demo · Internal Alpha" and entry suffix "· Demo" | REMOVE the labels (entry reads "Dự án & Startup"; the link stays) — they call real data demo; protected WF02 screens repaint → targeted WF02 pixel regression |
| internal `/demo/projects*` routes and `/api/v1/demo/projects*` | KEEP (no route migration in WF05) |
| WF04 OpsShell "DEMO · INTERNAL ALPHA" entry | not WF05 scope (WF04, unchanged) |

## Programme `d4…0001` (PO decision, exact)
**KEEP the canonical record + CLOSE / HIDE it from normal production user surfaces.** Never delete it; production runtime never depends on it and never uses it as bootstrap data; member listings, search and discovery never present it as an active programme; tests reference it only through explicit deterministic setup (the local / CI seed). Mechanism: the canonical WF04 lifecycle — PUBLISHED → CLOSED by a `programme:manage` actor through `POST /api/v1/programmes/{id}/close` once migration 015 is live in production; CLOSED programmes leave member discovery (only PUBLISHED with a form is offered), take no new application, and owners keep read access to their own history ([D3 matrix](WF05-PROD-01_domain-lifecycle.md#programme-state-matrix)). No hide flag or schema change is required. Execution is a promotion-runbook step (Claude B, after WF04 promotion), recorded in the [handoff](WF05-PROD-01_implementation-handoff.md#promotion-runbook-items).

## SOT precedence (historical SOT left as written)
| | C1 — WF05 "demo" wording | C2 — Team / Startup vs Venture |
|---|---|---|
| source A | CLAUDE.md §2; Master Spec "WF05 … Demo" | Data SOT §A–§C, §12 (Team, Startup, memberships; `PrimaryApplicant ∈ {Individual, Team, Startup}`) |
| source B | DEC-2809-D6, DEC-L5 (deployed RC `ff052d7`); the WF05-PROD contracts (explicit promotion) | Master Spec :101 / :151 / :175, CLAUDE.md §3, WF02 FINAL, DEC-2809-D5, DEC-WF05-G4, T00-D1 |
| winner | B: CLAUDE.md §2 itself allows promotion "when explicitly promoted"; the PO promoted L5 + S01 + S02 | B: CLAUDE.md (1) and Master Spec (2) outrank the Data SOT (4), which lists Team / Startup as foundation entities "activated by a later workflow" |
| interpretation | WF05 L5 + S01 + S02 are production scope | Team ≡ PROJECT venture + its members; Startup ≡ STARTUP venture; primary applicant = the venture |
| document follow-up | owner updates CLAUDE.md §2 wording (pending since conflict-audit C-05) | owner annotates the Data SOT; no rewrite of its history |

## Completeness
| Contract area | Frozen? | Evidence | Remaining gap |
|---|---|---|---|
| scope | yes | above; DEC-AIG-D3 | — |
| canonical model, owner / team, applicant mapping, programme linkage | yes | domain and lifecycle | — |
| application lifecycle, submitted immutability, visibility | yes | domain and lifecycle | implementation: G11, G16, G25 |
| RBAC, API, idempotency, audit | yes | RBAC, API, frontend | implementation: G06, G07, G09, G10, G12, G13, G15 |
| DB | yes | DB contract | migration 016 (PROD-02) |
| frontend, demo artifact policy | yes | above; RBAC, API, frontend | implementation PROD-04 |
| `d4…0001` handling | yes | above | promotion runbook step |
| cross-WF consistency | yes | domain and lifecycle | form lock at create (G10) |
| testing boundary | yes | handoff | fixtures (G19), tests (G34) |

**TRUE_PO_DECISIONS_REMAINING = 0.**

## Related
- [WF05-PROD-01_domain-lifecycle.md](WF05-PROD-01_domain-lifecycle.md) · [WF05-PROD-01_rbac-api-frontend.md](WF05-PROD-01_rbac-api-frontend.md) · [WF05-PROD-01_db-contract.md](WF05-PROD-01_db-contract.md) · [WF05-PROD-01_implementation-handoff.md](WF05-PROD-01_implementation-handoff.md) · [WF04_PRODUCTION_CONTRACT.md](WF04_PRODUCTION_CONTRACT.md)
