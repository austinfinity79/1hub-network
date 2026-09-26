# Claude Task Report

## 1. Task
- Task ID / name: WF02-S05 — Project / Startup (resolve OPEN-WF02-S05 G1–G5 and implement)
- Status: **DONE — LOCAL REVIEW**
- Mode: LOCAL REVIEW. S06 and WF05 UI were not implemented. Nothing was pushed.

## 2. Decision freeze
| ID | Decision |
|---|---|
| DEC-WF02-S05-G1 | P0 form addendum with five fields (type, name, summary, domains, region) and "Lưu". A–J navigator, completion %, image upload, public preview and review button are not rendered |
| DEC-WF02-S05-G2 | Any member with onboarding DONE may create; the owner is the session profile |
| DEC-WF02-S05-G3 | Created as DRAFT. DRAFT and ACTIVE are editable; ARCHIVED is read-only. There is no P0 transition endpoint |
| DEC-WF02-S05-G4 | `type` is fixed at creation; PATCH `type` → 422 `immutable` |
| DEC-WF02-S05-G5 | No owner `project_members` row is created; ownership comes from `owner_profile_id` alone |
| DEC-WF02-S05-D1..D3 | API shape, slug and bounds (technical); frozen error codes reused; UI plus the EditorHeader extraction |

OPEN-WF02-S05 → CLOSED. The matrix (§E) adds `venture:read` (owner or ACTIVE member), `venture:manage` and `venture:team_manage` (owner only). These are relation capabilities, not session capabilities.

## 3. Migration 007 (`007_p0_venture_taxonomy.sql`, additive)
- `projects.region_id uuid NULL → vocabulary_items`
- `project_domains(project_id, vocabulary_item_id)`: primary key on both, cascade on project delete, index on the item
- Fresh DB 001→007: PASS. Rerun: skipped. Upgrade from 006: PASS. Seed: PASS. Migrations 001–006 are untouched.

## 4. Behaviour
| Area | Result |
|---|---|
| Create `POST /api/v1/ventures` | Returns 201 with status DRAFT and the owner taken from the session. Onboarding not DONE → 403 SCOPE_FORBIDDEN. Owner, status or system fields in the body → 422 |
| Read `GET /ventures/{id}` | Owner or ACTIVE member only. Anyone else gets the same 404 (no existence leak). The DTO omits slug, metadata and profile ids |
| Update `PATCH /ventures/{id}` | Owner only; a member gets 403 SCOPE_FORBIDDEN. ARCHIVED → 409 PROFILE_DEACTIVATED. Name, summary, region and domains are written in one transaction |
| Taxonomy | Only ACTIVE REGION/DOMAIN items can be newly selected; an inactive item → VOCABULARY_ITEM_INACTIVE. Archived items already linked are kept. Domains are deduplicated, max 10 |
| Side effects | Profile completion is unchanged. No `project_members` row. No audit event (no audit code is frozen for this) |
| UI | Pages `/projects/new` and `/projects/:id/edit`. Members and ARCHIVED ventures see read-only mode. The shared `EditorHeader` is now used by both S02 and S05 |

## 5. Tests / build
| Gate | Result |
|---|---|
| Format / lint / typecheck / build | PASS |
| Unit | 157 passed |
| DB (incl. 10 venture tests, schema ledger with 007) | 258 passed |
| Playwright full suite | 352 passed, 24 skipped, 0 failed |
| WF01 pixel | 8/8 PASS |
| WF02-S02 pixel after the EditorHeader refactor | Drift 0 (header, fields, note) |
| Restart proof (app + PostgreSQL) | Venture DTO and page identical; no email or token in logs; fixture removed afterwards |

## 6. Visual QA (1440×900 DPR1)
- Header segment: drift 0 outside text.
- Full page (DEC-WF02-H12, short reference): 0 unexpected differences below the reference. The form area is a documented INTENTIONAL-P0-SCOPE / CONTRACT difference (G1 addendum).
- Baseline `shell-member-placeholder.png` was regenerated because the placeholder route moved to `/projects/sample-project/team` now that `/edit` is implemented. `design-reference/final` is untouched.

## 7. Deviations / blockers
- Copy the approved bitmap does not show (hints, read-only notices, "Chưa lưu") awaits PO copy review (D3).
- console-health: a signed-in user on `/projects/[id]/edit` for an unknown id expects 404, which is the correct scoped behaviour.
- Blocking gaps: none.

## 8. Git
- Branch: `main`; start HEAD `54c38d9` (checked again before the commit)
- Implementation commit: `08e66ad`
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `d54cc8d`
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Related
- [WF02_S05_PREFLIGHT_AUDIT.md](WF02_S05_PREFLIGHT_AUDIT.md) — preflight
- [WF02_SCREEN_IMPLEMENTATION_PLAN.md](WF02_SCREEN_IMPLEMENTATION_PLAN.md) — plan
- [P0_STATUS.md](P0_STATUS.md) — status
