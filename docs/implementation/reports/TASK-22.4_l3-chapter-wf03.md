# TASK-22.4 L3 Chapter WF03

**TASK 22 — Bucket A, BATCH 22.4 Corrected L3 Chapter / WF03: DONE.**
- **References:** `design-reference/final/revision/L3` (L19, L20, L23, L26); byte-identical copies from `L3.zip` (`180908cd…623c`).
- **Governing decisions:** [DEC-L3-D1…D5](../../decisions/DECISION_LOG.md#dec-l3-d1), under [DEC-HD-12](../../decisions/DECISION_LOG.md#dec-hd-12); Task 21 v2 defaults HD-08, HD-09, HD-10, HD-11. WF03 stays PROTECTED / CLOSED; its decisions (G1–G15, S02-D1, S03-D1, S04-D1, S09-D1) are inputs, not reopened.

## Scope
| Screen | Route | Result |
|---|---|---|
| L19 CHP0 | `/organizations/:slug` | Full-bleed public page over the unchanged projection: three canonical counts, children, upcoming events, join band (D1) |
| L20 CHP1 | `/ops/org/:orgId` | KPI / work-card restyle; header "Tạo sự kiện" → `…/events?create=1` for `event:manage`; chip "Chờ chapter" (D2) |
| L23 CHP4 | `/ops/org/:orgId/events` | Status chips, row cards with "Quản lý", panel on demand (D3) |
| L26 CHP7 | `/ops/org/:orgId/members` | Tabs, inline "Duyệt" / "Từ chối" through the S04 call, "Ban điều hành" block (D4) |

- **Skipped, Bucket B (1):** L27 CHP8 (HD-10). **Skipped, Bucket C (4):** L21, L22, L24, L25.
- **Reused:** every route, guard, API and DTO; the S04 review PATCH; the S07 create / edit / publish / cancel calls.
- **Conflicts:** none open. Omitted blocks without a P0 source are listed in D1–D4; "Đã rời" became "Tất cả" (no P0 grouping).

## Business / API / DB / RBAC
- Behaviour, lifecycle and permission changes: **0**. API, DB, migration, RBAC matrix: **0**.
- One display flag: `membership:confirm` joins the page-context capability list (`src/lib/ops/organizations.ts`; display only, same matrix, DB test updated). The PATCH still checks it on the server.

## Typography
- Space Grotesk on the four screen roots (DEC-HD-12); OpsShell keeps its faces (HD-11). The prompt listed only the legacy faces; the CLOSED DEC-HD-12 and CLAUDE.md §5 allow Space Grotesk on corrected revision screens.
- Violations: **0** on L19, L20, L23, L26.

## Pixel QA (1440 DPR1, production build)
Rule as DEC-H1-D5: per segment, outside text < 1.5 %, beyond ±2 px < 2 %; components at their own anchors (L20 / L23 drawn without a sidebar, L26 drawn 1600 wide).

| Reference | Segments | Max outside text | Max beyond ±2 px |
|---|---|---|---|
| L20 | title, subtitle, header rule, "Tạo sự kiện", KPI edges, work label / rule, chip | 0.46 % | 1.08 % |
| L23 | title, header rule, two chips, "Tạo sự kiện", column labels, first row | 0.37 % | 0.40 % |
| L26 | title, pending tab, table head, 4 request rows + review buttons (each against the drawn row of the same name), table bottom, leaders | 0.91 % | 1.46 % |
| L19 | bar, hero logo / rules / join, eyebrows, CLB card, event card, join button, footer | 0.59 % | 1.82 % |

| Class | Count | Notes |
|---|---|---|
| Structural / Major / Component | 0 / 0 / 0 | |
| P3 | residual | L26 tints only row 1 (every pending row is tinted, below the diff threshold); L23 draws "Sắp diễn ra" pressed; eyebrow bars on half pixels |
| Intentional | per spec | D1–D4 omissions, OpsShell (HD-11), fixture data, no "Góp ý" |

## Responsive (1440 / 1024 / 768 / 390)
- Page horizontal scroll: **0** on all four screens, the events panel and every member tab.
- Below 1280 px the event and member tables scroll inside their card; below 768 px KPI cards stack and member tabs wrap.
- Pre-existing, out of scope: OpsShell keeps its 216 px sidebar at every width (HD-11 / 22.8).

## Functional and security QA
- Members: tabs, search, leaders block, "Xem cả N thành viên →", inline approve (ACTIVE, ORGANIZATION_VERIFIED, audited) and reject (REJECTED, audited); a server refusal keeps the row pending with a neutral notice.
- A foreign organization's membership through either org path (with `x-org-id` / `x-role` spoofed) → 403 / 404, state unchanged.
- Events: the dashboard CTA opens the panel; chips filter and reset; a member gets 404 on `?create=1`.
- Existing WF03 access tests (foreign / child / parent org, malformed UUID, spoofed headers and query, PRIVATE discovery) unchanged and green.

## Regression and gates
- Gates: format, lint, typecheck, unit 237, DB 349, production build: all PASS.
- **Full visual suite** on the final build: 679 = **655 passed / 24 opt-in skipped / 0 failed** (3 new WF03 tests).
- **Per group:** WF03 69 (protected, full; S02 / S03 / S07 / S09 revision audits, UAT-WF03-J1); WF01 153; WF02 102; WF04 115; WF05 66; P0-LANDING 10; P0-SHELL 14; Internal Alpha release 7 (REL-SEC matrix, IA-P2-03 pointer reachability); auth-session 13, authz-session 8; shell routes 33; pixel-QA 39 (24 opt-in skips); others 58. All green.
- Found and fixed during the run: the new person-name link failed IA-P2-03 at 390 px (an inline link around a flex box); it is now a block box.
- Observed, not changed (WF04 protected): WF04-S05's two quick "next" clicks raced once under full-suite load; 27 / 27 on three repeats and green in the final run.

## Git
- Branch `main`; start HEAD `5b1343c`, checked again before each commit.
- Implementation commit: `cc6ca287a3d549b579ff8c5b6c7f9edd637c03e1`. Report / docs commit: the commit that contains this report.
- Push: **NOT RUN** — LOCAL REVIEW MODE.

## Related
- [../CLAUDE_LATEST_REPORT.md](../CLAUDE_LATEST_REPORT.md) · [TASK-22.3_l2-member-project.md](TASK-22.3_l2-member-project.md)
- [../../design-revision/07_TASK22_IMPLEMENTATION_ORDER.md](../../design-revision/07_TASK22_IMPLEMENTATION_ORDER.md)
