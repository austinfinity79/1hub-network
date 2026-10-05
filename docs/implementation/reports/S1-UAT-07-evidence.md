# S1-UAT-07 evidence

Evidence for [S1-UAT-07-invite](S1-UAT-07-invite.md) on the final build, isolated DB `hubnetwork_s1invite`.

## Gates
| Gate | Result |
|---|---|
| format · lint · typecheck · build | PASS |
| Unit | 42 files · 444 / 444 (routes 29 screens / 30 routes, contract codes) |
| DB | 55 files · 848 / 848 (incl. `invite-link` 18, `invite-link-migration` 5) |
| S1-UAT-07 browser spec | 11 / 11 (`s1-uat-07-invite.spec.ts`) |
| L1-L2 UAT (`tests/uat`) | 10 specs · 19 / 19 |
| Protected regression | **96 specs · 1260 tests · 1231 PASS · 0 FAIL · 29 SKIP · 0 FLAKY** on `6a3a485` (20.9 min) |

Skips: opt-in / env-gated only, unchanged (`pixel-qa-screens` 24, `admin-design-01-capture` 2, `admin-prod-08-pixel` 1, `wf06-prod-library` 1, `wf06-prod-qa` 1). Earlier full run on `d37c36c`: 1 STALE_TEST (`wf03-uat-journey` audit-code list missing the 3 new codes) → fixed in `6a3a485`, then the clean run above after a guarded reset of `hubnetwork_s1invite`. Before it, the affected-spec run found 9 STALE_TEST (inert link, "Nhận lời mời", no expiry, DTO keys) and 1 REAL_REGRESSION (a nested `role="alert"` on the receiver card) — all fixed. Server log (final run): 0 5xx, 0 hydration, 0 runtime exceptions; 1 expected `ApiError` (a deliberately refused `/dev/login`); 0 secret, 0 token.

## Migration 020 (isolated scratch databases)
| Check | Result |
|---|---|
| FRESH 001 → 020 + seed; second run and manual re-apply are no-ops | PASS |
| UPGRADE 019 → 020 with team rows: 020 only, rows kept, pending rows valid 7 days | PASS |
| One unrevoked link per venture; unique, well-formed hash (constraints) | PASS |
| RECOVERY: rollback refused while a link exists; lossless to 019 otherwise; re-apply | PASS |
| Seed schema-agnostic (pre-020 upgrade tests seed without the column) | PASS |

## Link invitation (US-02.12)
| AC (contract §5–§8, D3) | Where | Result |
|---|---|---|
| Owner only creates / regenerates; Editor / Viewer / stranger refused | DB + UAT H | PASS |
| One live link; 6 concurrent regenerations → 1 open | DB | PASS |
| 7 days: valid before, invalid after; ensure replaces an expired link | DB + browser | PASS |
| Regenerate invalidates the old link at once (keyboard) | DB + browser | PASS |
| Guest → `/auth?redirect=/moi/…` → back → preview; opening joins nothing | browser | PASS |
| Preview only name, type, "Thành viên", "Xem", expiry, "Tham gia" | DB + browser | PASS |
| A new member · B existing member / owner → team, no row · C 20 people (pending counted) → TEAM_FULL | DB + browser | PASS |
| D expired · E revoked → one INVITE_LINK_INVALID card, no row | DB + browser | PASS |
| F double · G concurrent join → one membership | DB | PASS |
| H forged role / level (`EDIT`, "Founder") → 422, nothing created | DB + API | PASS |
| Token 160 bits, hash only; no token in DB, audit JSON, server log | DB + log scan | PASS |

## E-mail invitation (US-02.11)
| AC (contract §3, §9, D4) | Where | Result |
|---|---|---|
| AC1 row note "Chưa có tài khoản HUB" | — | **PASS_WITH_DEVIATION** (not shown, PO 05/10 privacy) |
| Owner chooses role (3 roles, PO 05/10) and level; PENDING; e-mail sent | browser + UAT UC07 | PASS |
| Invited address only; accept / reject work | browser + UAT UC08 | PASS |
| Expires in 7 days; expired not accepted / listed / counted | DB + UAT UC07 / UC08 | PASS |
| Re-send: same row, + 7 days, role / level kept, rate-limited | DB + browser | PASS |
| Current member → "Người này đã ở trong đội."; self-invite refused | DB + browser + UAT UC07 | PASS |
| ≤ 10 addresses per send; bad addresses named, others sent | browser | PASS |
| ≤ 20 people; Editor / Viewer cannot invite; double click → one row | DB + browser | PASS |

## FB-14 · FB-18
| AC | Result |
|---|---|
| FB-14 detail in WorkspaceShell, 5-item sidebar, ME7 header / card, "Từ chối" · "Chấp nhận" (keyboard) | PASS |
| FB-18 copies the real URL (clipboard read back); "Đã sao chép" only after success, then reverts | PASS |
| FB-18 clipboard refused → alert + read-only selected field, never "Đã sao chép" | PASS |

## Responsive · accessibility
1440 / 768 / 390: PRJ2 link row, team invite panel, receiver, invalid card, invitation detail — no horizontal overflow, buttons inside the viewport (screenshots `tests/visual/diff/s1-uat-07/`). Copy, regenerate, join, accept by keyboard; status via `aria-live` / `role="alert"` (one alert, nested role removed).

## Stale assumptions
| Assumption | Files | Class |
|---|---|---|
| Link inert / FUTURE / no endpoint | `pdf-alpha-decisions`, `wf02-s05`, `wf02-uat-journey` H, UAT UC07, `wf02-l2-revision` note, gap register row | STALE_AND_FIXED |
| No expiry; duplicate refused 409; 20 pending | `wf02-s05`, `wf02-s06`, UAT UC08, API §19.3 | STALE_AND_FIXED |
| "Nhận lời mời"; DTO keys without `expires_at` | `wf02-s06`, `wf02-s08`, `wf02-uat-journey` L, j3 journey | STALE_AND_FIXED |
| Audit code list | `wf03-uat-journey` | STALE_AND_FIXED |
| DEC-PDF-D2, D-T1, l1-l2-realign / TASK-22 reports, design-revision, registries | docs | HISTORICAL_ONLY (marked superseded where read as current) |
| E-mail role / level selection, accept / decline | — | STILL_VALID |

## Related
- [S1-UAT-07-invite](S1-UAT-07-invite.md)
- [DECISION_LOG DEC-S1I](../../decisions/DECISION_LOG.md#dec-s1i)
