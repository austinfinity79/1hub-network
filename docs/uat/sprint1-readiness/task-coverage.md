# Task coverage

How the Sprint 1 tasks cover the 160 AC ([traceability.csv](traceability.csv), column IMPLEMENTATION_TASK). An AC may need several tasks, so the column totals exceed 160.

## AC per task

| Task | State (06/10) | READY | IMPL | BUSINESS | LEGAL | ENV | AC |
|---|---|---|---|---|---|---|---|
| EXISTING-WF01 (pre-Sprint 1 main) | deployed earlier | 17 | 0 | 3 | 0 | 0 | 20 |
| EXISTING-WF02 (pre-Sprint 1 main) | deployed earlier | 18 | 4 | 19 | 0 | 0 | 41 |
| S1-UAT-01 Auth | done local, review pending | 13 | 1 | 1 | 0 | 3 | 18 |
| S1-UAT-02 Feedback | done local, review pending | 4 | 0 | 0 | 0 | 0 | 4 |
| S1-UAT-03 Onboarding correction | not started | 0 | 13 | 0 | 0 | 0 | 13 |
| S1-UAT-03B RoleVerificationRequest | not started | 0 | 9 | 1 | 0 | 0 | 10 |
| S1-UAT-04 AI Profile Helper | not started | 0 | 2 | 0 | 9 | 0 | 11 |
| S1-UAT-05 Profile consistency | done local, review pending | 10 | 0 | 0 | 0 | 1 | 11 |
| S1-UAT-06 Project/Startup + AI | not started | 0 | 12 | 4 | 2 | 0 | 18 |
| S1-UAT-07 Invite flow | isolated branch, FIX-01 running | 0 | 21 | 0 | 0 | 0 | 21 |
| S1-UAT-08 / 08A PO batch | 08A done local; FB-03/19/20 open | — | — | — | — | — | 0 (PO direct) |
| S1-UAT-09 P1/P2 polish | done local, review pending | 2 | 0 | 0 | 0 | 0 | 2 |
| UNASSIGNED | no owner | 0 | 8 | 0 | 0 | 0 | 8 |

S1-UAT-07 AC (all IMPLEMENTATION_PENDING): US-02.08-AC04, US-02.09-AC02/03/06, US-02.11-AC01…04, US-02.12-AC01…04, US-02.13-AC02, US-02.14-AC01…04, US-02.17-AC01, US-X.02-AC01…03.

## Cross-cutting dependencies

| Dependency | State | AC affected | What closes it |
|---|---|---|---|
| Live Google OAuth | ENV_BLOCKED: no `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` on any UAT server; logic proven with a stub (S1-UAT-01 evidence) | US-01.03-AC02, US-01.05-AC01…03; account U9 | OAuth client with redirect `<APP_PUBLIC_BASE_URL>/auth/callback` configured on the UAT server; Google photo import (DEC-S1A-D12) for US-01.05-AC01 |
| LEGAL-AI-01 | open; AI contract "implementation blocked until LEGAL-AI-01 is resolved" (only a stub provider may run) | 11 LEGAL (US-01.08-AC01…07, US-01.12-AC02, US-01.14-AC03, US-02.10-AC06/07) + US-01.08-AC08/09 | legal decision + provider choice (Q1), then S1-UAT-04 / 06; Nginx upload limit raised from 3 MB for the ingestion route |
| Location rule | policy decided (DEC-ADM-PD4 hybrid); UI/data not built; open detail: "Vị trí" completion item for a typed city abroad (S1-UAT-05 report) | US-01.07-AC01…06; FB-20 Library filter | S1-UAT-03 (11 countries, 34 provinces + Khác, free text ≤ 60) and the completion follow-up |
| RoleVerification routing | rule decided (DEC-ADM-PD1: unit handler, fallback CLB → Chapter → HUB Tổng); admin queue exists; user side absent; onboarding still files memberships | US-01.11-AC05…09, US-01.13-AC01, US-02.08-AC02; account U8 | S1-UAT-03B + roster import (HUB Tổng, 13 Chapter, 55 CLB) + at least one handler per receiving unit used in UAT |
| HUB roster | seed has fixture "Chapter 01 / 02" only | US-01.11-AC01/02, U8 | import from the PO list (Appendix E) via the roster tool; never invented |
| FB-19 and PO material | FB-19 (homepage problem UI) waits for PO notes/images; FB-03 Milestones photo and FB-20 filter not built; FB-02/04 (08A) await PO acceptance | none of the 160 AC (PO direct) | PO acceptance documents, then S1-UAT-08 tasks |
| S1-UAT-07 integration | branch only, FIX-01 running | 21 AC above | FIX-01 PASS → PO accepts → integrated into the frozen candidate → regression |

## Related

- [overview](overview.md)
- [readiness-gaps](readiness-gaps.md)
- [business-decisions](business-decisions.md)
