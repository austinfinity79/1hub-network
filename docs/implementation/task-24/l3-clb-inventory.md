# L3 CLB Inventory

TASK 24.2 screen inventory and SOT delta for `Luông 3 - CLB Operations.png` (PO, 29/09 19:25; 16440×2792, sha256 in the report). Business SOT: DEC-WF03-*, [DEC-L3-D1…D5](../../decisions/DECISION_LOG.md#dec-l3-d1), DEC-PDF-D6B and the 28/09 refreeze ([DEC-2809](../../decisions/DECISION_LOG.md#dec-2809)).

## Board delta
| Frame (board x, y) | Screen | Against the repository | 24.2 |
|---|---|---|---|
| 120, 120 (1440×2561) | L19 CHP0 public chapter | pixel-identical to `L19__chapter-public__SOURCE.png` | verify |
| 1920, 120 (1440×856) | L20 CHP1 dashboard | pixel-identical to L20 | verify |
| 7320, 120 (1440×736) | L23 CHP4 events | pixel-identical to L23 | verify |
| 12720, 120 (1600×1530) | L26 CHP7 members & review | pixel-identical to L26 | verify |
| 3720 · 5520 · 9120 · 10920 | L21 CHP2 summit landing editor · L22 CHP3 registrants · L24 CHP5 regional round · L25 CHP6 mail campaign | never in the repository | FUTURE (DEC-2809) |
| 14520, 120 (1600×745) | L27 CHP8 leader handover | never in the repository | FUTURE (DEC-2809, was HD-10) |

## Inventory (built screens)
| Frame | Actor | Route | Precondition | Data | CTA | Mutation | Result | Permission |
|---|---|---|---|---|---|---|---|---|
| L19 | anyone | `/organizations/:slug` | PUBLISHED org | public projection, three counts, children, upcoming published events | "Xin vào …" → `/me/roles` (guest → `/auth`) | none here; the request is WF02-S04 | own PENDING_APPROVAL membership, never ACTIVE | none (public read) |
| L20 | unit leader, platform admin | `/ops/org/:id` | ops scope on the org | four canonical KPIs, one work item | "Tạo sự kiện" → events `?create=1` | none | — | `organization:read`; create shown for `event:manage` |
| L23 | leader, admin | `/ops/org/:id/events` | scope | the org's events by status chip | "Tạo sự kiện", "Quản lý" | create / edit / publish / cancel (S07) | event lifecycle, audited | `event:manage` in scope |
| L26 | leader, admin | `/ops/org/:id/members` | scope | members (one row per person, PRIVATE discovery hidden), leadership | "Duyệt" / "Từ chối" on pending rows, "Mở →" | PATCH membership (S04) | ACTIVE or REJECTED, audited; grants no capability | `membership:confirm` in scope; HUB declarations platform only |

## Security coverage
| Check | Evidence |
|---|---|
| outsider cannot manage | `authz` role denial; `members` / `review` / `ops` "member refused"; release identity matrix |
| no self-promotion | `ops`: membership, leadership, a "Chủ tịch" title grant nothing; **new**: an approved or rejected applicant holds no capability and cannot decide a request of their own unit |
| role / header / body spoof | `authz` forged role and scope; release matrix "plain and spoofed" |
| cross-organization IDOR | `review` 404 through another org; member detail 404; sibling / child ids 404 |
| reviewer permission | `review` exact scope; DEC-PDF-D6B declarations verified at platform scope only |
| approval ≠ platform admin | **new** test in `review.db-test.ts`: no capability in the unit, another chapter or the platform |
| removed / expired authority | `authz` ignores expired, not-started and non-ACTIVE assignments |
| onboarding declaration ≠ membership | DEC-PDF-D6B test: the declared position stays text, no leadership, no RoleAssignment |

## Human decisions (closed by the PO, 29/09)
| # | Decision |
|---|---|
| L3-H1 | L21, L22, L24, L25 stay FUTURE — [DEC-2909-L3H1](../../decisions/DECISION_LOG.md#dec-2909-l3h1) |
| L3-H2 | L27 stays FUTURE — [DEC-2909-L3H2](../../decisions/DECISION_LOG.md#dec-2909-l3h2) |

## Related
- [l2-library-delta.md](l2-library-delta.md) · [../reports/TASK-24.2_l3-clb-closure.md](../reports/TASK-24.2_l3-clb-closure.md)
