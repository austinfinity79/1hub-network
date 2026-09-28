# TASK-22.3 L2 Member Project

**TASK 22 — Bucket A, BATCH 22.3 Corrected L2 Member / Profile / Project: DONE.**
- **References:**
  - `design-reference/final/revision/L2` (L11, L13a, L13b, L13c);
  - byte-identical copies from `L2.zip` (`6fee10fb…04b9`).
- **Governing decisions:**
  - [DEC-L2-D1…D5](../../decisions/DECISION_LOG.md#dec-l2-d1), under [DEC-HD-12](../../decisions/DECISION_LOG.md#dec-hd-12);
  - Task 21 v2 defaults HD-05, HD-06, HD-08, HD-11.

## Scope
| Screen | Route | Result |
|---|---|---|
| L11 ME0 | `/me/settings` | Overview rows, member shell kept (D1): login email, sessions (open in place), visibility and Terms / Privacy status (→ `/me/privacy`), deletion request |
| L13a PRJ1 | `/projects/new` step 1 | Type cards, name, domains, one-line summary, region; draft save and exit (D2) |
| L13b PRJ2 | `/projects/new?venture=…&step=team` | Email invitation over the existing API; team list from the DTO (D3) |
| L13c PRJ3 | `/projects/new?venture=…&step=done` | Created card, server chips, one next action to the editor (D4) |

- **Skipped, Bucket B (6):** L10 FP1, L12 FP1-EDIT, L13 ME7, L14 ORGP1, L16 EV2, L18 EV1.
- **Skipped, Bucket C (2):** L15 DIR1, L17 NOTI1.
- **Annotation:** the L2 ↔ L5 bridge is not a screen.
- **Unchanged:** `/me/privacy` (WF02-S03, no revision frame) and `/projects/:id/edit` / `team` (WF02-S05 / S06).
- **Profile:** model, fields and visibility unchanged; no member-to-member profile view.
- **Organization:** no schema, type or representation change; no shared account.
- **Venture:**
  - one canonical record: `POST /ventures` once, then PATCH the same id (D2, D5);
  - owner only;
  - invitation lifecycle unchanged (`PENDING_CONFIRMATION`);
  - WF05 still reads the same venture: the WF05 UAT journey creates it through the wizard.

## Typography
- Space Grotesk (self-hosted, DEC-HD-12) on the wizard and the settings content. The step label, eyebrow and index use IBM Plex Mono 500. The member shell keeps its legacy type.
- Violations: **0** on L11, L13a, L13b and L13c.

## Pixel QA (1440 DPR1, production build, full page)
- **Rule** (DEC-H1-D5): per segment, outside text < 1.5 % and beyond ±2 px < 2 %.
- **Anchors:** components at their own anchors.

| Reference | Segments | Max outside text | Max beyond ±2 px |
|---|---|---|---|
| L13a | header, card head, name field, footer | 0.61 % | 0.94 % |
| L13b | header, title, invite email, team head, pending pill, back | 0.24 % | 0.51 % |
| L13c | header, head, chips, lede, next index, next action | 0.22 % | 0.95 % |
| L11 | head, account head, sessions title / action, visibility head / action, closing head | 0.13 % | 0.40 % |

| Class | Count | Notes |
|---|---|---|
| P0 / P1 / P2 | 0 / 0 / 0 | Header, cards, radios, inputs, pills, footer and rows match within 1 px |
| P3 raster | residual | The reference draws pill top / bottom edges on a half pixel |
| Intentional | 7 | D1 shell and omitted rows; D2 stage / AI / role / SUB0 and copy; D3 permissions / link / "Hoàn tất"; D4 one card and exit label; no "Góp ý" (HD-11) |

## Responsive
- Wizard (new, step 1 to 3) and settings (closed, sessions open, delete confirm) at 1440 / 1024 / 768 / 390: **0 overflow**, 0 off-screen controls, 0 `href="#"`, 0 page errors.
- The wizard header stacks; cards, invite row, team rows and the next action wrap below 768 px.
- `/me/settings` uses the existing member-shell responsive variant (D5).
- Pre-existing: the other member pages stay desktop-first (DEC-P0-SHELL-D7).

## Functional and security QA
- **Wizard:**
  - validation before any request;
  - one POST on a double click;
  - PATCH on the way back;
  - refresh and revisit resume the same record;
  - draft save / exit;
  - "Huỷ" saves nothing;
  - invite, duplicate and invalid email;
  - done step → editor.
- **Guards:** guest → `/auth`; onboarding not done → resolver.
- **Wizard URL:** a stranger's venture, an ACTIVE member (read-only), a malformed id or spoofed `x-*` headers all → 404, with no data leak.
- **Settings:**
  - sessions list / revoke / revoke-all;
  - failure and retry;
  - deletion request (201 → 200 idempotent, one audit);
  - failure keeps the confirmation.
- **Leaks:** no token, hash, cookie or PII in pages or DTOs; member emails are never listed.

## Regression and gates
- Gates: format, lint, typecheck, unit 237, DB 349, production build: all PASS.
- **Full visual suite** on the final build: 676 = **652 passed / 24 opt-in skipped / 0 failed** (8 new L2 tests).
- **Per group:** WF02 102 (protected, full); WF01 153; P0-LANDING 10, P0-SHELL 14; WF03 66, WF04 115, WF05 66 (the WF05 UAT journey creates its venture in the wizard); Internal Alpha release 7; auth-session 13, authz-session 8; shell routes 33; pixel-QA 39 (24 opt-in skips); others 50. All green.
- Business, API, DB, RBAC, audit and migration changes: 0.

## Git
- Branch `main`; start HEAD `3bd34fd`, checked again before each commit.
- Implementation commit: `2a57fe943571a79c062e636b2ec75fdeb44f7dd1`. Report / docs commit: the commit that contains this report.
- Push: **NOT RUN** — LOCAL REVIEW MODE.

## Related
- [../CLAUDE_LATEST_REPORT.md](../CLAUDE_LATEST_REPORT.md) · [TASK-22.2_l1-auth-onboarding.md](TASK-22.2_l1-auth-onboarding.md)
- [../../design-revision/07_TASK22_IMPLEMENTATION_ORDER.md](../../design-revision/07_TASK22_IMPLEMENTATION_ORDER.md)
