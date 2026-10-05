# Alpha Backlog

Known, non-blocking limits of the Internal Alpha release that carries L1, L2, the PO decision freeze ([DEC-PDF](../../decisions/DECISION_LOG.md#dec-pdf)), the Thảo business UAT and the Library layout hotfix. None of them fails a current critical journey; each needs its own task. Nothing here was implemented for the release.

## Business UAT (Thảo, 10 use cases)
Suite `tests/uat/l1-l2/` (`pnpm exec playwright test --config=tests/uat/uat.config.ts`): PASS 10, FAIL 0, DEFERRED 1 (invitation by link). Each gap below is recorded on its test as PRODUCT GAP or DEFERRED.

## Backlog
| # | Item | Source | Current behaviour |
|---|---|---|---|
| 1 | Invitation by link | UC07, DEC-PDF-D2 | **DONE in S1-UAT-07 (DEC-S1I).** Was DEFERRED: the PRJ2 row is drawn inert ("Tính năng giai đoạn sau"); e-mail invitation works |
| 2 | Google OAuth | D-G1 | no client configured; the control says Google sign-in is not enabled |
| 3 | AI provider | D-A1 | AI blocks drawn inert; manual entry complete; nothing written by AI |
| 4 | Return to the original CTA after sign-in / onboarding | UC02, DEC-2809-D1 | the link always returns to the resolver; programme / event CTAs are inert |
| 5 | Project → Startup conversion | UC05 | the type is fixed at creation (DEC-WF02-S05-G4) |
| 6 | Ownership transfer and venture deletion | UC10 | not built (DEC-WF02-H8); nobody can transfer or delete a venture |
| 7 | Invitation expiry; early refusal of a current member's address | UC07, UC08 | **DONE in S1-UAT-07 (DEC-S1I-D5): 7-day expiry, `already_member`.** Was: no expiry; a duplicate invitation is created and e-mailed, its acceptance is refused (409) |
| 8 | Activity history; linking an experience to an organization on HUB | UC04, D-P1 | records show on the profile; no history; the organization is free text |
| 9 | Directory / Mạng lưới backed by internal PUBLIC profiles and ventures | UC09 | server visibility works; `/library` reads its demo fixture and `startup.json`, not internal records; no public venture page |
| 10 | Startup / Nhà sáng lập card redesign of the 29/09 frames | Library | done in TASK 24.1 with the fields the sources hold (DEC-L15-D11…D13); needs, openness, city, verification, badges and expertise wait for a source |
| — | Startup website and pitch deck fields | UC06 | the venture record holds neither |

## Related
- [po-decision-freeze.md](po-decision-freeze.md) · [open-decisions.md](open-decisions.md) · [l2-closure.md](l2-closure.md) · [overview.md](overview.md)
