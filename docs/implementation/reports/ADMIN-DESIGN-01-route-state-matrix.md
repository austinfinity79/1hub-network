# ADMIN-DESIGN-01-route-state-matrix

**Every Admin route × actor × state × viewport the candidate baseline covers, and what PROD-08 compares.** Parent: [ADMIN-DESIGN-01-visual-baseline.md](ADMIN-DESIGN-01-visual-baseline.md). File-level index: [pack README](../../../design-reference/candidate/admin/README.md).

## Screens (admin actor; 1440x900 + 1440 / 1024 / 768 full = CANONICAL_REFERENCE; 390 full = KNOWN_DEBT)
| Screen id | Route | Module | Main components |
|---|---|---|---|
| ADMIN-HOME | `/ops/admin` | Home | KPI cards (counts per queue) |
| ADMIN-VERIFICATION | `/ops/admin/verification` | Verification | status filter, 5-column table |
| ADMIN-VERIFICATION-DETAIL | `/ops/admin/verification/:id` | Verification | header actions, position / routing / relations / history cards |
| ADMIN-VENTURES | `/ops/admin/ventures` | Venture Review | status filter, table |
| ADMIN-VENTURE-DETAIL | `/ops/admin/ventures/:id` | Venture Review | public-vs-pending diff card, history |
| ADMIN-ACCESS | `/ops/admin/access` | Organizations / Delegation | org list table |
| ADMIN-ACCESS-MANAGER | `/ops/admin/access/:orgId` | Organizations / Delegation | grants table, grant form, history |
| ADMIN-FEEDBACK | `/ops/admin/feedback` | Feedback | 6 filters, summary toggle, table, priority chips |
| ADMIN-FEEDBACK-DETAIL | `/ops/admin/feedback/:id` | Feedback | content, screenshot, triage form, history |
| ADMIN-CATEGORIES | `/ops/admin/categories` | Categories | type tabs, item table with text actions |
| ADMIN-ACCOUNTS | `/ops/admin/accounts` | Account Ops | status / kind filters, table |
| ADMIN-ACCOUNT-REQUEST-DETAIL | `/ops/admin/accounts/:id` | Account Ops | target card, direct actions, process / decline |

## Shared states (1440x900 + 1440 full, CANONICAL_REFERENCE)
| State | Frame | How it is produced |
|---|---|---|
| confirm (reject) | ADMIN-VERIFICATION-DETAIL, ADMIN-VENTURE-DETAIL `__confirm` | click Từ chối |
| confirm (revoke) | ADMIN-ACCESS-MANAGER `__confirm` | click Thu hồi on the first grant |
| confirm (decline, reason required) | ADMIN-ACCOUNT-REQUEST-DETAIL `__confirm` | click Từ chối |
| weekly summary | ADMIN-FEEDBACK `__weekly-summary` | toggle, week 2026-W40 |
| empty | ADMIN-ACCOUNTS `__empty` | kind = ESCALATION |
| loading | ADMIN-VERIFICATION `__loading` | list API held open |
| error | ADMIN-FEEDBACK `__error` | list API stubbed 500 |
| not found | ADMIN-FEEDBACK-DETAIL `__not-found` | unknown id |
| permission denied | ADMIN-ACCESS-MANAGER `__denied` | Chapter A leader opens Chapter B |
| leader home | ADMIN-HOME `__leader` | Chapter A leader (3 nav items, 2 cards) |

Dialogs / drawers: none exist — the admin area uses the WF03 inline confirm form inside the page (PD-8); the four confirm frames are that pattern. Session-expired notice (`data-state="session-expired"`) is reachable but not captured (it is the shared notice frame shown above).

## Not captured (PROD-08 may add)
Long-text stress (500-char reasons, long names), 50-row pages with "Tải thêm", a venture core-edit diff (public + pending both filled), feedback with a live / expired screenshot, archived category rows, account LOCKED / DEACTIVATED detail. All use the same components as the frames above.

## Related
- [ADMIN-DESIGN-01-visual-baseline.md](ADMIN-DESIGN-01-visual-baseline.md) · [ADMIN-DESIGN-01-known-debt.md](ADMIN-DESIGN-01-known-debt.md) · [ADMIN-PROD-07-prod08-handoff.md](ADMIN-PROD-07-prod08-handoff.md)
