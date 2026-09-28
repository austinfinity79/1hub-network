# Scope Buckets

One primary bucket per screen (62 screens; the 2 annotations are not implemented). Screens are bucketed individually, not by design group.

> **28/09 refreeze:** for Internal Alpha these buckets are superseded by the classification in [scope-refreeze/](scope-refreeze/overview.md): APPROVED ALPHA 24 screens (H1, AUTH1–4, ACC-10, L06b, L06c, L11, L13a–c, L16, L19, L20, L23, L26, L37–L43), FUTURE 38. L54 leaves Bucket A (System Status is Future); L06b / L06c, L16 and L37–L43 enter Alpha; L27, L28, L47, L52, L53 become Future. The tables below are kept as the Task 21 v2 record.

- **A:** approved existing-behaviour UI revision, safe for Task 22 once the PO freezes this audit. Screens marked *subset* ship only the blocks backed by existing behaviour; the other blocks are omitted.
- **B:** business / API / data delta. Needs PO / BA approval before implementation.
- **C:** future or outside Internal Alpha. Not in Task 22.

## Bucket A — 15
| Screen | Route | Subset omissions |
|---|---|---|
| H1 Homepage | `/` | No-destination CTAs rendered as non-links; placeholder blocks omitted (HD-01) |
| AUTH1, AUTH2, AUTH3, AUTH4 | `/auth`, `/auth/check-email`, `/auth/callback`, `/auth/error` | — (copy per design; the dropped rate-limit and support text is a no-op, [DEC-L1-D6](../decisions/DECISION_LOG.md#dec-l1-d6)) · **22.2 DONE** |
| ACC-10 Hoàn tất | `/onboarding/complete` | The "Theo dõi xác minh chức vụ HUB" card (HD-02); current next actions kept · **22.2 DONE** ([DEC-L1-D7](../decisions/DECISION_LOG.md#dec-l1-d7)) |
| L11 ME0 Cài đặt | `/me/settings` (+ `/me/privacy`) | Change email, Google link, 4-purpose consent, "view as", view statistics, personal log, export, email preferences · **22.3 DONE** ([DEC-L2-D1](../decisions/DECISION_LOG.md#dec-l2-d1)) |
| L13a PRJ1, L13b PRJ2, L13c PRJ3 | `/projects/new` | Stage, deck, AI, Owner / Editor / Viewer, link invitations · **22.3 DONE** ([DEC-L2-D2](../decisions/DECISION_LOG.md#dec-l2-d2)) |
| L19 CHP0 | `/organizations/[slug]` | KPIs and public leadership (HD-08), partner strip, "Bài toán" nav, summit · **22.4 DONE** ([DEC-L3-D1](../decisions/DECISION_LOG.md#dec-l3-d1)) |
| L20 CHP1 | `/ops/org/:id` | Landing views, funnel, local Q&A inbox · **22.4 DONE** ([DEC-L3-D2](../decisions/DECISION_LOG.md#dec-l3-d2)) |
| L23 CHP4 | `/ops/org/:id/events` | Event type, owner, capacity · **22.4 DONE** ([DEC-L3-D3](../decisions/DECISION_LOG.md#dec-l3-d3)) |
| L26 CHP7 | `/ops/org/:id/members` | Email invite, export, transfer / remove-role actions · **22.4 DONE** ([DEC-L3-D4](../decisions/DECISION_LOG.md#dec-l3-d4)) |
| L54 SYS1 | 404 page + 500 view | Maintenance state |

## Bucket B — 26
| Screens | Reason | Decision |
|---|---|---|
| ACC-05, ACC-06, L06b, L06c, ACC-07, ACC-08, ACC-09 | Onboarding restructure, AI, consent removal, free-text skills, HUB position claim | HD-02, HD-03, HD-04, HD-05 |
| FP1-OWN | New owner profile page and data | HD-05 |
| L10 FP1 | Member-to-member profile view | HD-08 |
| L12 FP1-EDIT | Host is FP1-OWN; org auto-link | HD-05 |
| L13 ME7 | Invitation inbox, lifecycle, new route | HD-06 |
| L14 ORGP1 | Org types, shared account, capability flags | HD-08 |
| L16 EV2, L18 EV1, L47 EV1 (partner) | Event discovery read model, canonical route, registration | HD-09 |
| L27 CHP8 | Leadership transfer workflow | HD-10 |
| L28 CH1 | Public challenge page over session demo data | HD-10 |
| L37 SUB0 | Quick team: create, temp or reuse | HD-06 |
| L38, L39, L40, L41, L42, L43 | Application schema, persistence, editability, emails | HD-07 |
| L52 ADM15, L53 ADM17 | Platform admin capabilities | HD-10 |

## Bucket C — 21
| Screens | Reason |
|---|---|
| L15 DIR1, L17 NOTI1 | Library / discovery (WF06) and notifications: no model |
| L21 CHP2, L22 CHP3, L24 CHP5, L25 CHP6 | Summit, registrations, judging, email campaigns (no provider) |
| L29–L34 (P1 tabs), L35 CS1, L36 CS2 | Problem entity, Q&A, updates, submitted teams, summit, registration |
| L44, L45, L48, L49, L50, L51 (SP1) | Public startup profile + new startup data + data room (§C) |
| L46 WS1 | Collaboration workspace = new product scope |

Totals: **A 15 · B 26 · C 21 = 62**. Moving a screen from B or C to A needs a PO / BA decision that updates this table.

## Related
- [05_BUSINESS_API_DATA_CONFLICT_MATRIX.md](05_BUSINESS_API_DATA_CONFLICT_MATRIX.md) · [07_TASK22_IMPLEMENTATION_ORDER.md](07_TASK22_IMPLEMENTATION_ORDER.md)
