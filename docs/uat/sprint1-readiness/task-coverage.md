# Task coverage

How the Sprint 1 tasks cover the 160 AC ([traceability.csv](traceability.csv), column IMPLEMENTATION_TASK), after the decision reconciliation of 06/10. An AC is counted under every task its row names, so the column totals exceed 160.

## AC per task

| Task | State (06/10) | READY | IMPL | BUSINESS | LEGAL | PO content | ENV | OOS | AC |
|---|---|---|---|---|---|---|---|---|---|
| EXISTING-WF01 (pre-Sprint 1 main) | deployed earlier | 17 | 2 | 0 | 0 | 0 | 0 | 0 | 19 |
| EXISTING-WF02 (pre-Sprint 1 main) | deployed earlier | 19 | 6 | 0 | 0 | 0 | 0 | 0 | 25 |
| S1-UAT-01 Auth | done local, review pending | 14 | 1 | 0 | 0 | 0 | 3 | 0 | 18 |
| S1-UAT-02 Feedback | done local, review pending | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 4 |
| S1-UAT-03 Onboarding correction | done on the lane (`a613d80`), review pending | 16 | 0 | 0 | 0 | 0 | 0 | 0 | 16 |
| S1-UAT-03B RoleVerificationRequest | not started | 3† | 7 | 0 | 0 | 0 | 0 | 0 | 10 |
| S1-UAT-04 AI Profile Helper | not started | 0 | 2 | 0 | 9 | 0 | 0 | 0 | 11 |
| S1-UAT-05 Profile consistency | done local, review pending | 10 | 2* | 0 | 0 | 0 | 1 | 0 | 13 |
| S1-UAT-06 Project/Startup + AI | not started | 0 | 15 | 0 | 2 | 2 | 0 | 0 | 19 |
| S1-UAT-07 Invite flow | integrated in candidate (FIX-01, FIX-02 incl.) | 18 | 3 | 0 | 0 | 0 | 0 | 0 | 21 |
| S1-UAT-08 / 08A PO batch | 08A done local; FB-03/19/20 open | — | — | — | — | — | — | — | 0 (PO direct) |
| S1-UAT-09 P1/P2 polish | done local, review pending | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| UNASSIGNED | no owner | 0 | 25 | 0 | 0 | 0 | 0 | 0 | 25 |
| none (superseded by DEC-ADM-PD3) | — | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |

\* US-02.02-AC03/05 (Chính/Phụ, years): unassigned gaps in an S1-UAT-05 story, outside its delivered scope.

† US-01.11-AC05/06/08 are READY from S1-UAT-03 (review order, terms and overlap, no admin access); S1-UAT-03B must keep them when one request per position ships. S1-UAT-03 also took three unassigned AC: US-01.09-AC08, US-01.10-AC02, US-01.12-AC03.

S1-UAT-07 AC (18 READY in the candidate; US-02.14-AC04 READY since S1-UAT-07-FIX-02; still pending: US-X.02-AC01…03 for their S1-UAT-06 / 03B cases): US-02.08-AC04, US-02.09-AC02/03/06, US-02.11-AC01…04, US-02.12-AC01…04, US-02.13-AC02, US-02.14-AC01…04, US-02.17-AC01, US-X.02-AC01…03.

## Cross-cutting dependencies

| Dependency | State | AC affected | What closes it |
|---|---|---|---|
| Live Google OAuth | ENV_BLOCKED: no client credentials on a UAT server; logic proven with a stub only | US-01.03-AC02, US-01.05-AC02/03 (+ AC01 photo import, DEC-S1A-D12); U9 | OAuth client with redirect `<APP_PUBLIC_BASE_URL>/auth/callback` on the UAT server |
| LEGAL-AI-01 | open: AI contract "implementation blocked until LEGAL-AI-01 is resolved" | 11 LEGAL + US-01.08-AC08/09 | legal decision + provider choice, then S1-UAT-04 / 06; ingestion upload limit above 3 MB |
| Location rule | **implemented**: S1-UAT-03 (DEC-S1O-D2), consistent with DEC-ADM-PD4 + UAT Appendix E | US-01.07-AC01…06 (READY) | catalogue data step on the UAT environment (G10) |
| RoleVerification routing | **resolved**: DEC-ADM-PD1 (PO 04/10) | US-01.11-AC07, AC09 (and keep AC05, 06, 08), US-01.13-AC01, US-02.08-AC02; U8 | S1-UAT-03B + roster import + a handler per receiving unit used in UAT |
| HUB units | **catalogue delivered** (S1-UAT-03): HUB Network Tổng · 13 Chapters · 55 CLBs in `db/seed/catalog_sprint1.sql`; fixture / live "Chapter 01 / 02" are not offered | US-01.11-AC01/02 (READY), U8 | `node scripts/db.mjs catalog` on the UAT environment (G10); member roster import stays separate |
| FB-19 and PO material | FB-19 waits for PO notes / images; FB-03, FB-20 not built; FB-02/04 await PO acceptance; 48-field list and tab fields missing | 2 PO_CONTENT AC; FB items outside the 160 | PO documents, then S1-UAT-08 / 06 |
| S1-UAT-07 integration | done in `int/sprint1-candidate-01` (S1-CANDIDATE-INT-01, FIX-02 `d497da2`), regression GREEN | 18 AC now READY | none for S1-UAT-07 itself |

## Related

- [overview](overview.md)
- [readiness-gaps](readiness-gaps.md)
- [business-decisions](business-decisions.md)
