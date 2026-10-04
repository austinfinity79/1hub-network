# Admin Portal candidate baseline

**Status: CANDIDATE — awaiting PO approval (ADMIN-DESIGN-01).** Not a `design-reference/final` baseline until the PO approves; ADMIN-PROD-08 promotes it then. Source: the ADMIN-PROD-07 UI after the ADMIN-DESIGN-01 consistency fixes (no redesign). 82 frames, Chromium, DPR1, Be Vietnam Pro on every frame, 0 console errors, 0 page overflow.

## Naming
`<SCREEN>__<state>__1440x900.png` (viewport baseline) · `<SCREEN>__<state>__<width>__full.png` (full page; 1440 / 1024 at 900 high, 768 at 1024, 390 at 844). Every 1440 / 1024 / 768 frame is **CANONICAL_REFERENCE**; every 390 frame is **KNOWN_DEBT** (shared shell sidebar, smoke only). Per-frame route, viewport, status, font, overflow, height: [capture-matrix.json](capture-matrix.json).

## Frames
| Route | Module | State | Files | CANONICAL_REFERENCE | KNOWN_DEBT | Notes |
|---|---|---|---|---|---|---|
| `/ops/admin` | Home | default | `ADMIN-HOME__default__*` | 1440x900, 1440 full, 1024 full, 768 full | 390 full |  |
| `/ops/admin/verification` | Verification | queue | `ADMIN-VERIFICATION__queue__*` | 1440x900, 1440 full, 1024 full, 768 full | 390 full |  |
| `/ops/admin/verification/:id` | Verification | detail | `ADMIN-VERIFICATION-DETAIL__detail__*` | 1440x900, 1440 full, 1024 full, 768 full | 390 full |  |
| `/ops/admin/ventures` | Venture Review | queue | `ADMIN-VENTURES__queue__*` | 1440x900, 1440 full, 1024 full, 768 full | 390 full |  |
| `/ops/admin/ventures/:id` | Venture Review | detail | `ADMIN-VENTURE-DETAIL__detail__*` | 1440x900, 1440 full, 1024 full, 768 full | 390 full | first publication: public column empty |
| `/ops/admin/access` | Organizations / Delegation | list | `ADMIN-ACCESS__list__*` | 1440x900, 1440 full, 1024 full, 768 full | 390 full |  |
| `/ops/admin/access/:CH_A` | Organizations / Delegation | detail | `ADMIN-ACCESS-MANAGER__detail__*` | 1440x900, 1440 full, 1024 full, 768 full | 390 full |  |
| `/ops/admin/feedback` | Feedback | queue | `ADMIN-FEEDBACK__queue__*` | 1440x900, 1440 full, 1024 full, 768 full | 390 full |  |
| `/ops/admin/feedback/:id` | Feedback | detail | `ADMIN-FEEDBACK-DETAIL__detail__*` | 1440x900, 1440 full, 1024 full, 768 full | 390 full |  |
| `/ops/admin/categories` | Categories | list | `ADMIN-CATEGORIES__list__*` | 1440x900, 1440 full, 1024 full, 768 full | 390 full |  |
| `/ops/admin/accounts` | Account Ops | queue | `ADMIN-ACCOUNTS__queue__*` | 1440x900, 1440 full, 1024 full, 768 full | 390 full |  |
| `/ops/admin/accounts/:id` | Account Ops | detail | `ADMIN-ACCOUNT-REQUEST-DETAIL__detail__*` | 1440x900, 1440 full, 1024 full, 768 full | 390 full |  |
| `/ops/admin/verification/:id` | Verification | confirm | `ADMIN-VERIFICATION-DETAIL__confirm__*` | 1440x900, 1440 full | — | reject confirm (reason optional) |
| `/ops/admin/ventures/:id` | Venture Review | confirm | `ADMIN-VENTURE-DETAIL__confirm__*` | 1440x900, 1440 full | — | reject confirm |
| `/ops/admin/access/:CH_A` | Organizations / Delegation | confirm | `ADMIN-ACCESS-MANAGER__confirm__*` | 1440x900, 1440 full | — | revoke confirm, focus on Huỷ |
| `/ops/admin/accounts/:id` | Account Ops | confirm | `ADMIN-ACCOUNT-REQUEST-DETAIL__confirm__*` | 1440x900, 1440 full | — | decline confirm (reason required) |
| `/ops/admin/feedback` | Feedback | weekly-summary | `ADMIN-FEEDBACK__weekly-summary__*` | 1440x900, 1440 full | — | week pinned to 2026-W40 |
| `/ops/admin/accounts` | Account Ops | empty | `ADMIN-ACCOUNTS__empty__*` | 1440x900, 1440 full | — | kind = ESCALATION (always empty, DEC-ADM-D04) |
| `/ops/admin/verification` | Verification | loading | `ADMIN-VERIFICATION__loading__*` | 1440x900, 1440 full | — | list API held open (never answers) |
| `/ops/admin/feedback` | Feedback | error | `ADMIN-FEEDBACK__error__*` | 1440x900, 1440 full | — | list API stubbed 500: controlled notice + retry |
| `/ops/admin/feedback/:id` | Feedback | not-found | `ADMIN-FEEDBACK-DETAIL__not-found__*` | 1440x900, 1440 full | — | unknown id |
| `/ops/admin/access/:CH_B` | Organizations / Delegation | denied | `ADMIN-ACCESS-MANAGER__denied__*` | 1440x900, 1440 full | — | Chapter A leader on Chapter B |
| `/ops/admin` | Home | leader | `ADMIN-HOME__leader__*` | 1440x900, 1440 full | — | leader nav: Home · Verification · Access |

## Reproduce
```
pnpm db:reset   # then apply tests/visual/fixtures/wf01-acc07-qa-vocabulary.sql
pnpm build && ADMIN_DESIGN_CAPTURE=1 pnpm visual admin-design-01-capture
```
Deterministic: fixture rows from the real writers, every timestamp pinned (staggered by minute), summary week pinned. Three re-captures matched all frames pixel for pixel (pixelmatch, threshold 0.1).

## Related
- [ADMIN-DESIGN-01-visual-baseline.md](../../../docs/implementation/reports/ADMIN-DESIGN-01-visual-baseline.md) · [route / state matrix](../../../docs/implementation/reports/ADMIN-DESIGN-01-route-state-matrix.md) · [known debt](../../../docs/implementation/reports/ADMIN-DESIGN-01-known-debt.md)
