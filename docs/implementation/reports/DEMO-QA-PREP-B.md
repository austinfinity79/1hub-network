# DEMO-QA-PREP-B

Parallel QA / demo prep for the 07/10 demo (Claude B, support only). Branch `qa/demo-support-0710`, worktree `../1hub-network-qa-b`, base `4c9e7b7` (DEMO-HOME-ABOUT-01). No runtime source, migration, seed or config changed; Claude A's `feat/sprint1-completion` worktree not entered. Not pushed, merged or deployed.

## Deliverables
| File | Content |
|---|---|
| [DEMO_VERTICAL_FLOW_QA](../../demo-0710/qa/DEMO_VERTICAL_FLOW_QA.md) | 11-step journey plan, BASE vs AWAITING, run commands, SYNC notes |
| [DEMO_ROUTE_CTA_MATRIX](../../demo-0710/qa/DEMO_ROUTE_CTA_MATRIX.md) | demo-critical actions on 5 surfaces, classified |
| [DEMO_RESPONSIVE_MATRIX](../../demo-0710/qa/DEMO_RESPONSIVE_MATRIX.md) | 1440 / 768 / 390 × 5 surfaces × 12 checks |
| [DEMO_SMOKE_CHECKLIST](../../demo-0710/qa/DEMO_SMOKE_CHECKLIST.md) | exact DEMO-QA-01 sequence |
| [DEMO_DEPLOY_ROLLBACK_CHECKLIST](../../demo-0710/qa/DEMO_DEPLOY_ROLLBACK_CHECKLIST.md) | gates, backup, deploy, rollback (checklist only) |
| `tests/visual/specs/demo-qa-vertical-flow.spec.ts` | 20 tests: 8 BASE, 12 AWAITING (`fixme` until `DEMO_QA_SYNC=1`) |
| `scripts/qa/demo-0710-smoke.mjs` | read-only HTTP smoke for any base URL (`--sync` adds DIR2 / founder routes) |

## Evidence (isolated DB `hubnetwork_demo_qa_b`, port 3997, `nice`)
| Check | Result |
|---|---|
| prettier · eslint (new files) · typecheck | PASS |
| `playwright --list` | 20 tests |
| spec on BASE build | 8 PASS · 12 SKIP (fixme, AWAITING) · 0 FAIL · 10.6 s |
| spec with `DEMO_QA_SYNC=1` on BASE (step 3–5) | FAIL as intended ("Sản phẩm" is still a label): the awaited steps cannot pass vacuously |
| smoke base mode | 3 / 3 (`/`, `/about`, `/auth` 200, clean HTML) |
| smoke `--sync` on BASE | 3 expected failures (`/products`, `/products/tracely`, `/talents/…b1` → 404 until A lands) |
| smoke failure paths | no argument → exit 2; unreachable host → exit 1 with JSON |

## Issues for Claude A (not patched)
| ISSUE_ID | SEVERITY | AFFECTED_ROUTE | EXPECTED | OBSERVED / EXPECTED_RISK | EVIDENCE | RECOMMENDED_A_FIX |
|---|---|---|---|---|---|---|
| QA-B-01 | MEDIUM | data step `node scripts/db.mjs demo` | DEMO_DATA_CONTRACT: the step "refuses `hubnetwork_p0` and any database it cannot name" | `demo` is MUTATING only: it refuses a missing `DATABASE_URL`, but the shared-DB refusal applies to DESTRUCTIVE commands, so `DATABASE_URL=…/hubnetwork_p0 node scripts/db.mjs demo` would write demo rows to the shared DB; nothing refuses a production DB | `scripts/db-target.mjs` `COMMAND_CLASS.demo = 'MUTATING'`, refusal block `commandClass === 'DESTRUCTIVE'` | refuse `demo` on `SHARED_DATABASES` (and on the production DB name) in `db-target.mjs`, with a db-safety test; or correct the contract text |
| QA-B-02 | HIGH (deploy gate, PO) | demo target | demo rows never on a production DB (DATA_CONTRACT, OUT_OF_SCOPE) | the journey needs the 3 startups / 6 profiles on whatever server shows the demo; target environment not decided | [deploy checklist](../../demo-0710/qa/DEMO_DEPLOY_ROLLBACK_CHECKLIST.md) Gate 0 | PO decides target and whether `demo` may run there before any deploy; not a code fix |
| QA-B-03 | LOW (risk) | `/products/tracely` → `/talents/[profileId]` | DEMO-D2 route uses the profile id; BASE test forbids `de710000-` in Homepage HTML | founder links will put a demo profile UUID in the startup page HTML / URL; DEC-W6P-D03 says "No id is shown" for Library founders | SCREEN_ROUTE_MAP DEMO-D2; `demo-home-about-01` "no id leaks" | confirm the id in the founder URL is accepted for the demo (allow-list only), and keep listing pages id-free (the spec checks `/products`) |

## Awaiting Claude A (assertions written from SOT, verify at SYNC)
Steps 3–9 of the journey, the 404 / allow-list checks, and containment of `/products`, `/products/tracely`, `/talents/…b1` at 3 widths. Observed in A's unaccepted `7dd5230` (git objects only): `/products`, interim `/products/[slug]`, header / search scope to `/products`. The AWAITING tests use roles, routes and SOT copy; if A's markup names differ (h1 text, "Xem hồ sơ" link name), adjust the selector at SYNC, never the expected behaviour.

## Related
- [DEMO_SOT_v1](../../demo-0710/DEMO_SOT_v1.md) · [DEMO-HOME-ABOUT-01](DEMO-HOME-ABOUT-01.md)
