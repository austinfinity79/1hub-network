# ADMIN-PROD-07-prod08-handoff

**Evidence 34: the Pixel / Responsive closure matrix ADMIN-PROD-08 owns.** Parent: [ADMIN-PROD-07-qa-summary.md](ADMIN-PROD-07-qa-summary.md). Not started. No pixel baseline exists for these screens (ADMIN-DESIGN-01 was never produced): PROD-08 must first obtain approved references or record the token-vocabulary baseline as the reference, per Design SOT — not decide it alone.

## Routes × actors
| Route | admin | HUB / Chapter / CLB leader | capability-only grantee | member |
|---|---|---|---|---|
| `/ops/admin` (home, KPI cards) | 7 cards | Verification + Access cards | its one card | 404 |
| `/ops/admin/verification` · `/[requestId]` | all units | own + PD-1 fallback | if `verification:review` | 404 |
| `/ops/admin/ventures` · `/[reviewId]` | ✓ | 404 | 404 | 404 |
| `/ops/admin/access` · `/[orgId]` | every unit, revoke everywhere | own unit + children; revoke on own unit only (D02) | 404 | 404 |
| `/ops/admin/feedback` · `/[feedbackId]` | ✓ | 404 | 404 | 404 |
| `/ops/admin/categories` | ✓ | 404 | 404 | 404 |
| `/ops/admin/accounts` · `/[requestId]` | ✓ | 404 (D04) | 404 | 404 |

## States to capture per screen
| State | How to reach (deterministic) |
|---|---|
| loading | throttle the list / detail API |
| empty | accounts queue `kind = ESCALATION` (always empty, D04); verification with no pending |
| error / denied / not found | API 500 via route stub; leader on a foreign unit's access page; unknown id |
| session expired | clear cookie, then act |
| success / action notice | approve, triage save, revoke |

## Tables, forms, confirms, filters
| Screen | Tables / lists | Inline confirm forms | Filters |
|---|---|---|---|
| verification | request rows | reject (reason optional) | status |
| ventures | review rows; detail public-vs-pending diff columns | reject (reason) | status |
| access | org rows; grant rows; history | revoke (focus on Cancel); grant form | — |
| feedback | feedback rows; weekly summary card | triage form (note required NEW → DONE) | status, type, priority, owner, from, to, week |
| categories | item rows per type tab, usage counts | label edit, archive / activate, move up / down | type tabs |
| accounts | request rows | process, decline (reason required for deletion), direct lock / unlock / deactivate / reactivate | status, kind |

## Long text / data stress
Long Vietnamese org and person names; 500-char reasons and resolution notes; 2,000-char feedback body; long position titles; venture website at the bound; many grants on one unit; 50-row pages with "Tải thêm".

## Responsive
| Width | PROD-07 result | PROD-08 work |
|---|---|---|
| 1440 (DPR1, baseline) | no overflow | pixel compare against the approved reference |
| 1024 / 768 | no overflow | visual review of wrapping (filters, KPI grid, diff columns) |
| 390 | no page overflow (content scrolls inside the column) | PRE_EXISTING_OPSSHELL_DEBT: fixed 216 px sidebar leaves 174 px — a shell decision (collapsible nav), shared with WF03, not admin-local |

## Known baseline debt (not regressions)
OpsShell 390 layout (above) · queue filters not in the URL (reload resets them) · approve is one step (not a destructive confirm) · `GET /ops/summary` absent (home composes counts) · no modal dialogs by design (inline confirm idiom).

## Related
- [ADMIN-PROD-07-modules-ui.md](ADMIN-PROD-07-modules-ui.md) · [ADMIN-PROD-06-prod07-handoff.md](ADMIN-PROD-06-prod07-handoff.md)
