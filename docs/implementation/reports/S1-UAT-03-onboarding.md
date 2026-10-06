# S1-UAT-03 onboarding

Sprint 1 onboarding corrections: US-01.07 location (FB-06, FB-07), FB-09 / FB-10 recheck, US-01.10 role minimum, US-01.11 HUB position declarations (FB-11, FB-12, FB-13), US-01.12 review. Decisions [DEC-S1O](../../decisions/DECISION_LOG.md#dec-s1o); contract [05 amendment A17](../../architecture/05_API_CONTRACT_P0_v1.0.md). Tests and git: [S1-UAT-03-evidence](S1-UAT-03-evidence.md).

## Preflight
| Check | Result |
|---|---|
| Lane | `feat/sprint1-completion`, worktree `../1hub-network-sprint1-completion`, base `392d99e` (single-lane head), clean |
| Environment | new `.env.local` (gitignored; DB `hubnetwork_s1uat03`, fresh `INVITE_LINK_SECRET`); DB created, guarded `reset` 001 → 020 + seed |
| Shared DB | `hubnetwork_p0` ledger 017 before and after |
| Migration | none needed: declarations fit `onboarding_hub_claims` (jsonb); typed places reuse UNNORMALIZED vocabulary items (019) |

## Impact map
| Layer | Change |
|---|---|
| UI | stage 1 location (country "Khác", Việt Nam list + "Khác", typed place); stage 3 position rows; stage 4 ordered list; /me dialog and profile editor follow the location rule; stage 2 "Quay lại" saves; "Sửa" returns to stage 4 |
| API | PATCH `/me/profile` `country` / `locality`; PUT `/me/onboarding/roles` structured rows; stage `ROLE` gate (A17) |
| Domain | `lib/profile/location.ts`, `lib/onboarding/hub-position.ts` (pure, shared by form and server); `roles.ts`, `profile.ts`, `state.ts`; `resolveTags` options |
| DB / seed | no migration; `db/seed/catalog_sprint1.sql` (generated from Appendix E) + `db.mjs catalog`; `seed` applies it |
| Tests | new: 16 DB, 10 unit, S1-UAT-03 browser spec; stale tests updated (see evidence) |
| Ops (data effect) | `/ops/network` rows grow with long real names (min-height, name column bounded by the table's visible width): the catalogue exposed a fixed row height |

## Requirement status
| Requirement | Before | After |
|---|---|---|
| FB-06 / FB-07 / US-01.07 location | MISSING (1 country, 3 provinces, no free text) | done |
| FB-09 free-text tags · FB-10 no Skills | ALREADY_CORRECT (S1-UAT-05) | rechecked, unchanged |
| US-01.09 "Quay lại" keeps stage 2 | MISSING | done |
| US-01.10 at least one role | MISSING (none required) | done |
| FB-11 catalogue 1 / 13 / 55 | MISSING (Chapter 01/02, Club 01 placeholders) | done (seed / catalog step) |
| FB-12 positions · FB-13 term | MISSING (free text) | done |
| US-01.11 1–10 rows, overlap, order, "Chờ xác minh" | PARTIALLY_CORRECT (5 rows, one per unit) | done |
| US-01.11 requests per position, routing, withdrawal | — | DEPENDENCY_ON_S1_UAT_03B |
| US-01.12 review order, "Sửa" → back | PARTIALLY_CORRECT | done; 12-item completion unchanged (S1-UAT-05) |

## Deviations (PO review)
| Item | Disposition |
|---|---|
| ACC-08 declaration row | the UAT's fields replace the board's 3-field row; pixel compares the panel head and foot only (INTENTIONAL-BUSINESS) |
| Catalogue delivery | a seed / `db.mjs catalog` data step, not a migration; live placeholder units (Chapter 01/02) are not touched and not offered |
| Completion filing | still one membership request per unit with the printed position (03B replaces it with one verification request per position) |
| `/ops/network` CSS | outside onboarding, needed because real names wrap; no layout change for one-line rows |

## Related
- [S1-UAT-03-evidence](S1-UAT-03-evidence.md)
- [DECISION_LOG DEC-S1O](../../decisions/DECISION_LOG.md#dec-s1o)
- [S1-UAT-05-profile](S1-UAT-05-profile.md)
- [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
