# ADMIN-PROD-06-prod07-handoff

**Evidence 23: the QA matrix PROD-07 covers.** Parent: [ADMIN-PROD-06-qa.md](ADMIN-PROD-06-qa.md). Not started.

## Actors × routes
| Actor | `/ops/admin` entry | Reaches |
|---|---|---|
| PLATFORM_ADMIN | `requireOpsAdmin` → all six | Everything; every org's Access tab |
| Whole-role HUB/Chapter/CLB leader | via its granted capabilities (verification:review, access:delegate always come together with the whole role) | Verification (own + PD-1 fallback), Access (grant on own unit + direct children; revoke on own unit only, DEC-ADM-D02) |
| Capability-only grantee (PD-6, e.g. `verification:review` alone) | `requireOpsAdmin` admits it; no `network:read` link shown | Exactly the one granted queue |
| Member / guest | 404 on `/ops/admin` and every sub-route | Nothing |

## Capabilities → screens (05 §26–28)
| Capability | Scope | Screen |
|---|---|---|
| `verification:review` | org or platform | `/ops/admin/verification` |
| `venture:review` | platform only | `/ops/admin/ventures` |
| `access:delegate` | org (whole role) or platform | `/ops/admin/access` |
| `feedback:manage` | platform only | `/ops/admin/feedback` |
| `vocabulary:manage` | platform only | `/ops/admin/categories` |
| `account:administer` | platform only | `/ops/admin/accounts` |
| ~~`account:escalate`~~ | — | withdrawn ([DEC-ADM-D04](../../decisions/DECISION_LOG.md#dec-adm-d04)): no capability, no route |

## IDOR
| Case | Expected |
|---|---|
| Unknown / malformed / out-of-scope id, any of the six detail routes | 404, identical |
| A leader opens a request/review/grant outside their routed unit or reach | 404 |
| A non-admin opens any `/ops/admin/*` id directly (deep link) | 404 at the layout, or 403 rendered inline if they hold a different admin capability |

## Delegation
| Case | Expected |
|---|---|
| Grant a capability not in `CAPABILITY_MATRIX.delegable` | Form cannot select it; server would 422 if forced |
| Grant to self, upward, or cross-branch | Server refuses; UI never offers it (PD-6) |
| Co-leader revokes another leader's grant on the same unit | Allowed only with a current `access:delegate` on exactly that unit; parent / child / sibling, lost-capability grantor → 403 ([DEC-ADM-D02](../../decisions/DECISION_LOG.md#dec-adm-d02), fixed in ADMIN-PROD-07-CONTRACT-FIX) |

## Verification / venture review
| Case | Expected |
|---|---|
| Approve / reject with a stale `version` | 409, detail reloads, no duplicate submit |
| Self-approval | Never offered (`can_act` excludes it server-side) |
| First-publish venture review | "Chưa có phiên bản công khai" — never rendered as if already public |

## Feedback / categories / account actions
| Case | Expected |
|---|---|
| NEW → DONE with no note | 422, same inline warning shown before submit |
| Screenshot past 90 days | "Ảnh đã hết hạn lưu trữ…", no broken image, no path |
| Decline a deletion request with no reason | Submit disabled client-side; server 422 if forced |
| Direct lock/deactivate on the viewer's own account | Never offered |
| VENTURE_STAGE archive | No control rendered (policy: label/order only) |

## Loading / error / responsive
Every screen: loading, empty, denied, not-found, 401→sign-in (§14 of the QA report). 1440/1024/768 no-overflow: Admin Home + Feedback proven; PROD-07 should extend the same check to the remaining four screens. 390 is shell debt, not this task's.

## Audit / permission transitions
Every mutation already audits server-side (PROD-02–05); the frontend renders no new audit surface. A capability revoked mid-session: the next API call 403s and the screen shows "denied" — not covered by an automated test here (would need a live revoke-while-open scenario); recommended for PROD-07.

## Gaps PROD-06 raises, not builds
| Item | Note |
|---|---|
| ~~`account:escalate` UI~~ | Closed by [DEC-ADM-D04](../../decisions/DECISION_LOG.md#dec-adm-d04): no leader escalation in P0; the API was removed in ADMIN-PROD-07-CONTRACT-FIX |
| `GET /ops/summary` | Still not built; Admin Home composes counts from each list's own `limit=1` call, as the PROD-05 handoff suggested |
| Filter state in the URL | Queues reset filters on reload; acceptable, flagged as a possible PROD-07 enhancement |
| ADMIN-DECISION-02 (co-leader revoke) | Closed: [DEC-ADM-D02](../../decisions/DECISION_LOG.md#dec-adm-d02), implemented in ADMIN-PROD-07-CONTRACT-FIX |

## Related
- [ADMIN-PROD-06-qa.md](ADMIN-PROD-06-qa.md) · [ADMIN-PROD-06-frontend.md](ADMIN-PROD-06-frontend.md) · [ADMIN-PROD-06-modules.md](ADMIN-PROD-06-modules.md)
