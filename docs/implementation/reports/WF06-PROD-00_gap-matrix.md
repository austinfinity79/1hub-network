# WF06-PROD-00_gap-matrix

**WF06-PROD-00 — gap matrix, API / frontend gaps, readiness and the PROD-01 → 06 plan.** Main report: [WF06-PROD-00_runtime-gap-audit.md](WF06-PROD-00_runtime-gap-audit.md).

## Gap matrix
| Capability | Gap | Class | Severity |
|---|---|---|---|
| Org public page | no db-test for `lib/public/organization.ts`; children list unbounded | TEST, API | P1_HARDENING / P2_QUALITY |
| Library (as approved) | founder names of non-accounts shown to guests; whole dataset serialised to the client; problem dataset flagged "cần HUB duyệt"; facets on raw strings, not vocabulary ids | SOT, BUSINESS_RULE, DATA, API | PO_DECISION_REQUIRED (PO-D) |
| Library resilience | external feed: 5 s timeout, 10 min cache, 24 h stale fallback, 2 MB cap (exists) | — | none |
| Home search | client-only redirect to `/library?q=` | — | none |
| Member directory | no surface, API, design frame; privacy copy promises it | SOT, API, FRONTEND, PIXEL, TEST | PO_DECISION_REQUIRED (PO-A) |
| Public venture discovery | PUBLIC grants no read; no API / frame | SOT, API, FRONTEND, PIXEL, TEST | PO_DECISION_REQUIRED (PO-B) |
| Programme / challenge discovery | no public list (DEC-W4P-D10); open list unbounded, ignores org status | SOT, API | PO_DECISION_REQUIRED (PO-C); S4 P2_QUALITY |
| Organization directory, public profile, L6 | no SOT / design approval | SOT | FUTURE |
| Matching / ranking / recommendation | no rule | BUSINESS_RULE | FUTURE (out of P0) |
| Follow / connect / save | no approved write | BUSINESS_RULE | FUTURE / NO_EVIDENCE |
| SOT wording | Data SOT §8 PUBLIC profile defaults vs D2 never PUBLIC (the decision governs P0); DEC-WF06 "no coming soon" vs later DEC-P3UX-D2/D3 "Sắp có" (later governs); stale self-review guide | SOT | P2_QUALITY (doc) |
No P0_RUNTIME_BLOCKER exists for the current layer.

## API gaps
| Kind | Items |
|---|---|
| reusable | `GET /organizations/by-slug/{slug}`, `GET /vocabularies/{type}` (cursor, ≤ 200), `projectDiscovery`, venture / programme status predicates |
| missing (only if promoted) | PO-A `GET /api/v1/network/members?domain=&region=&q=&cursor=` (members only, NETWORK_ONLY projection); PO-B `GET /api/v1/ventures/public?type=&domain=&region=&stage=&cursor=` + detail by slug; PO-C read-only programme list / detail (PUBLISHED, owner org PUBLISHED); `GET /profiles/{id}` stays FUTURE (DEC-WF02-H3) |
| over-broad / unbounded | org-page children, requestable organizations, `listOpenForms` (N+1), ops members paged in memory, Library dataset to the client |
| visibility | none leaking today; new endpoints must apply visibility in SQL, never post-filter |
| pagination / ranking | §2.4 cursor envelope for every new list; deterministic sort only |
Expected PROD-03 scope: harden the existing endpoints (bounds, org status on the open list, tests) + only the endpoints the PO promotes.

## Frontend gaps
| Surface | Route | Real API | Loading / empty / error | Filter / pagination | Responsive baseline |
|---|---|---|---|---|---|
| Org page | yes | yes | 404 uniform | — | L19 |
| Library | yes | external / static | stale fallback, empty states | client facets, "Xem thêm" (9) | L15 / L15b / L15c |
| Member / venture / programme directory | no | no | — | — | no frame (needs design if promoted) |

## Readiness diagnostic (current state; diagnostic only)
| Category | % | Evidence |
|---|---:|---|
| Scope clarity | 25 | WF06 FUTURE by decision; PO-A–D open |
| Canonical data | 75 | all entities, visibility and vocabularies exist; Problem entity absent |
| Read models | 60 | query-time projections suffice; profile projection exists |
| API | 25 | org page only; directory APIs absent |
| Visibility / RBAC | 65 | PROFILE_DISCOVERY, status predicates, org projection server-side |
| Matching / ranking | n/a | deferred by decision; not needed for P0 |
| Frontend | 35 | Library + org page; directories absent |
| Tests | 45 | Library, org page, L6 guard specs; no org db-test |
| Pixel / responsive | 40 | L15 / L19 baselines; new surfaces unframed |
| Overall | 40 | ~75 for "harden the existing layer only" |

## PROD-01 → 06 validation
| Phase | Actual scope | Dependencies | Likely files | Risks | PO |
|---|---|---|---|---|---|
| 01 Freeze contract + data / ranking boundaries | record PO-A–D; freeze surfaces, visibility, sort, no matching | PO answers | DECISION_LOG, WF06 contract, API amendment | scope creep from L6 frames | PO-A–D |
| 02 Data / read-model foundation | no new table; optional indexes; deterministic WF06 test fixture | 01 | `db/migrations/017_*` only if an index is frozen; `lib/*/testing.ts` | duplicating stores | — |
| 03 API / visibility hardening | bounds, org status on the open list, org db-test; promoted list / detail endpoints | 01, 02 | `lib/public/organization.ts`, `lib/application/application.ts` (list only), new `lib/discovery/*` | visibility drift, enumeration | — |
| 04 Frontend integration | promoted surfaces on real APIs; Library per PO-D; privacy copy aligned | 03, design frames | `components/library/*`, new pages | no approved frame → design work | design approval |
| 05 Functional / security QA | visibility, IDOR, enumeration, pagination, leakage | 04 | specs | — | — |
| 06 Pixel / responsive + closure | baselines for promoted surfaces | 05 | specs, reports | SHELL-MOBILE-01 separate | — |
Boundaries: Admin Portal (management UI, content admin, approval queues, back office) starts after WF06-PROD-06; Sprint1 UAT (auth replacement, feedback modal, AI profile helper, AI venture import, RoleVerificationRequest fixes, About / Home / Library feedback) stays a separate lane.

## Related
- [WF06-PROD-00_runtime-gap-audit.md](WF06-PROD-00_runtime-gap-audit.md) · [WF06-PROD-00_scope-matrix.md](WF06-PROD-00_scope-matrix.md) · [WF06-PROD-00_data-visibility.md](WF06-PROD-00_data-visibility.md)
