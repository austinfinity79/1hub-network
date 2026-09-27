# WF05 Pre-Implementation Audit

**Update 2026-09-27: G1–G5 FROZEN** as [DEC-WF05-G1..G5](../decisions/DECISION_LOG.md#dec-wf05-g1) (OPEN-WF05 closed, history kept). **WF05-T00 Demo Foundation DONE** ([DEC-WF05-T00-D1..D3](../decisions/DECISION_LOG.md#dec-wf05-t00-d1), [report](reports/WF05-T00_demo-foundation.md)). Human decisions remaining: 0. The findings below are the original audit, kept as history.

**Verdict: HUMAN DECISION REQUIRED (5 — [OPEN-WF05-G1..G5](../decisions/DECISION_LOG.md#open-wf05-g1)).** Audit only: no runtime code, migration, seed or design change. HEAD `f395d2b`, 2026-09-27. WF05 Founder / Project / Startup journey = **DEMO** for INTERNAL ALPHA (CLAUDE.md §2; Master Spec §4, M5). WF01–WF04 stay PROTECTED.

**Sources** (precedence order): CLAUDE.md §2–§3; Master Spec v1.3 §1, §3 (WF02 "reuses it in WF05"), §4 WF05, §5 rule 6, M5; WF02 workflow (WF05 consumes the venture); Data SOT v1.1 §1, §2B–C, §3, §6, §8, §12–§15; Data Freeze v1.1; architecture 01 §7, 02 (Venture / Engagement), 03 §4, 04 A2 / "Demo later" / D4, 05 §5.3 + §15, 06; capability matrix §E; migrations 001–009; `seed_p0_deterministic.sql`; DEC-WF02-H6/H7, DEC-WF02-S05-G1..G5, DEC-WF02-S06-G1..G9, DEC-WF04-H1..H5 / T00-D3, DEC-P0-SHELL-D2/D3/D6; `design-reference/final` manifest, Pixel SOT §9; `1hub_architecture_v1.3.1.zip` (byte-identical mirror of the repo sources).

## Findings that shape the plan
| # | Finding | Evidence | Consequence |
|---|---|---|---|
| F1 | No WF05 workflow contract, screen map, manifest entry, bitmap or external reference. The Master Spec says only "uses the same Project/Startup entity maintained in WF02" | `docs/workflows/` = WF01–WF03; manifest = 24 WF01–WF03 screens; MS §4, M5 | Design source → G1; scope limited to what SOT / architecture already freeze |
| F2 | One canonical venture: `projects` (`type PROJECT \| STARTUP`, `owner_profile_id`, DRAFT / ACTIVE / ARCHIVED, REGION + DOMAIN), team = `project_members` (PENDING_CONFIRMATION / ACTIVE / LEFT / REMOVED / REJECTED) | 001:244-255; 007; 008; DEC-WF02-S05-G4/G5, S06-G1 | REUSE; no second project, team or member model |
| F3 | The SOT models Team, Startup and Solution (+ memberships, contributor / startup relationships) as separate WF05 entities; P0 has only `projects` | SOT §2B, §3; 04 C (names reserved) | TEAM applicant mapping → G4; Solution FUTURE (no fields, no table) |
| F4 | Application = one primary applicant (Individual / Team / Startup) + programme + status + programme-specific answers; profile reused, never copied. Lifecycle DRAFT → SUBMITTED → UNDER_REVIEW → NEEDS_UPDATE → RESUBMITTED → UNDER_REVIEW → CLOSED. No table; submission / review are out of the P0 API | SOT §12, §6, §15.8; API §15 | DEMO only → G5 |
| F5 | Participation, Outcome, Achievement, ActivityRecord: definitions only, no lifecycle, no table | SOT §2B, §13 | FUTURE |
| F6 | Demo shape is fixed: `/demo/projects`, `/demo/projects/:id`, `GET /api/v1/demo/projects/*`; fixtures in future production DTO shapes; demo isolated from production write paths | 04 A2, "Demo later", D4; 01 §7 | Routes resolved by precedence |
| F7 | WF02 provides `POST/GET/PATCH /ventures`, team read / invite / role / remove / accept / decline, pages `/projects/new`, `/projects/:id/edit` (read-only view for members), `/projects/:id/team`. `GET /me/ventures` is in the contract but not built; `/me/network` roles list owned and ACTIVE-member ventures | `src/app/api/v1/ventures/**`; `src/lib/venture/{venture,team}.ts`; `src/lib/network/network.ts:72-77`; API §5.3 | REUSE; the WF05 read model composes these services, no production API added |
| F8 | Venture read is relation-only: `venture:read` = owner + ACTIVE members; `venture:manage` / `team_manage` = owner; no visibility column; everyone else 404 | Matrix §E; `venture.ts:121-137`; DEC-WF02-H7 | No organizer, admin or public read of a venture in WF05 |
| F9 | No venture transition in P0 (create DRAFT; DRAFT / ACTIVE editable; ARCHIVED read-only, 409); `submit-for-review` conditional and not configured | DEC-WF02-S05-G3; API §5.3 | WF05 adds no venture transition |
| F10 | WF04 programmes are code fixtures (P1 PUBLISHED: applicant types TEAM + STARTUP, 2 questions; C1 DRAFT) readable by ops actors only; ops drafts live in each ops browser session | `src/lib/programme-demo/{fixtures,guard,read-model}.ts`; DEC-WF04-H2, T00-D3 | Founders see no programme today → G3 |
| F11 | "Founder" is a relationship, not an entity or role code; the owner row reads "Chủ sở hữu"; `role_label` is display text only | SOT §1.2; DEC-WF02-S06-G4/G5; Matrix §E | Founder = the venture owner (copy only) |
| F12 | Seed: one venture (`50000000-…-0001` "Demo Startup", STARTUP, ACTIVE, owner member@) and one PENDING invitation (leader@); no PROJECT venture, no ACTIVE member | `seed_p0_deterministic.sql:229-250` | UAT creates its ventures through WF02; no seed change proposed |
| F13 | Approved bitmaps draw WF05 intent only as content already classed FUTURE: PRO1 fundraising / data room / "Gửi HUB duyệt", PRO3 permission tiers and "nộp giải pháp", ME6 activity, ORG1 problem-owner KPIs | Pixel SOT §9; DEC-WF02-S05-G1; S06 resolved list; DEC-WF03-G1 | Not reintroduced |

## Canonical entities
| Entity | SOT | Schema | WF05 alpha |
|---|---|---|---|
| IndividualProfile | §1.1 | `individual_profiles` | EXISTS — REUSE (actor from the session only) |
| Project / Startup (API "Venture") | MS §5.6; API §5.3 | `projects` | EXISTS — REUSE read-only; edits only through WF02 |
| Team membership | §6 | `project_members` | EXISTS — REUSE read-only (owner derived + ACTIVE members) |
| Team / Startup (SOT entities) | §2B | `projects.type` | NOT REQUIRED as tables; mapping → G4 |
| Solution (+ relationships) | §2B, §3 | none | FUTURE / OMITTED |
| Organization | — | `organizations` | NOT REQUIRED (no venture ↔ organization relation) |
| Programme | Freeze D1 | WF04 code fixtures | REUSE read-only, PUBLISHED only → G3 |
| Application | §12 | none | DEMO (browser session) → G5 |
| Participation / Outcome / Achievement | §2B, §13 | none | FUTURE |
| Vocabulary REGION / DOMAIN | Freeze | `vocabulary_items` | REUSE (labels in the WF02 DTO) |
| RoleAssignment | 03 §4 | `role_assignments` | NOT USED; STARTUP_MEMBER, JUDGE, MENTOR, ADVISOR, INVESTMENT_FUND_REPRESENTATIVE stay "activated later" |

## WF02 reuse
| Capability | Existing | Class |
|---|---|---|
| Create / edit venture, type immutability, taxonomy | `/projects/new`, `/projects/:id/edit`, `/ventures` | REUSE AS-IS (WF05 links to it) |
| Venture detail (read) | `GET /ventures/{id}` service | REUSE + DEMO READ MODEL |
| My ventures | `/me/network` roles (no `GET /me/ventures`) | REUSE + DEMO READ MODEL |
| Owner, team, role labels, invitations | `owner_profile_id`; team API; `/projects/:id/team` | REUSE AS-IS (WF05 shows a read summary) |
| Visibility, lifecycle, archived | relation-only read; no transition; ARCHIVED read-only | REUSE AS-IS |
| LEFT, ownership transfer, permission tiers, venture audit, public page, review | none | FUTURE |

## Conflicts
| # | Item | Sources | Resolution |
|---|---|---|---|
| C1 | Separate Team / Startup / Solution vs one `projects` table | SOT §2B vs MS §3, API §5.3, 001 | Settled for WF02 by precedence; TEAM → G4; Solution FUTURE |
| C2 | Demo isolation vs "reuse canonical Project/Startup data" | 01 §7 vs MS §4, M5 | Precedence (MS): read canonical rows, write none — reading is not a production write path |
| C3 | Design copy "nộp giải pháp" (submit a solution) vs SOT Application; Solution has no fields | WF01-S08, WF02-S01/S04/S06 bitmaps; SOT §12 | Application wording; copy for PO review |
| C4 | "Creator becomes a team membership" vs owner-only field | API §5.3; DEC-WF02-S05-G5 | Settled by S05-G5 |
| C5 | Stale gap register (P12 still open) and 02 omitting Venture from WF02 | GAPS; 02 §WF map | P3 doc drift, recorded only |

## Resolved by precedence (not asked)
Routes `/demo/projects*` and `GET /api/v1/demo/projects/*` (04) · canonical venture read-only, no fixture ventures, no programme copy (MS §4, M5; SOT §12, §15.8) · no table, migration or production application API (API §15; 01 §7) · Solution / Participation / Outcome FUTURE · Founder = owner relation (SOT §1.2) · relation-only venture read, no admin read (Matrix §E, D3) · no venture transition (S05-G3) · WF01–WF04 not reopened.

## Related
- [WF05_SCREEN_IMPLEMENTATION_PLAN.md](WF05_SCREEN_IMPLEMENTATION_PLAN.md) — screens, routes, API, DB, tasks
- [WF05_HAPPY_PATH_PLAN.md](WF05_HAPPY_PATH_PLAN.md) — journeys, negative matrix, invariants
- [DECISION_LOG.md](../decisions/DECISION_LOG.md#open-wf05-g1) — OPEN-WF05 G1–G5
- [WF04_PRE_IMPLEMENTATION_AUDIT.md](WF04_PRE_IMPLEMENTATION_AUDIT.md) — precedent
