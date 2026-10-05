# S1-UAT-07-FIX-01

Correction to [S1-UAT-07](S1-UAT-07-invite.md): the authoritative US-02.11 team roles are Founder · Co-founder · Thành viên · Cố vấn; the earlier report kept three. Role and level (Chủ sở hữu · Biên tập · Xem) are independent. Decisions [DEC-S1I-D5](../../decisions/DECISION_LOG.md#dec-s1i-d5).

## Preflight
| Check | Result |
|---|---|
| Branch / worktree | `feat/s1-uat-07-invite`, `../1hub-network-s1-invite` |
| Start HEAD | `309574a`, tree clean |
| origin/main | `edd3d24` (unchanged) |
| Shared DB | `hubnetwork_p0` ledger ends at 017, no 020 objects |

## Impact audit
| Item | Finding |
|---|---|
| CURRENT_ROLE_VALUES | PRJ2 select `TEAM_ROLES` = Founder, Co-founder, Thành viên; team-page invite form = free text (≤ 100); server `parseRoleLabel` = any text ≤ 100; DB `project_members.role_label text` |
| ADVISOR_CANONICAL_VALUE | `"Cố vấn"`, stored verbatim as `role_label` (the label the team page already names: "Vai trò như CTO hay Cố vấn không cấp thêm quyền") |
| SCHEMA_CHANGE_REQUIRED | NO — no enum, no migration 021 |
| MODEL_ESCALATION_REQUIRED | NO |
| Authorisation | depends on the level only (`EDIT` / `VIEW`; `OWNER` never given by invitation) — unchanged |
| Out of scope, unchanged | the owner's own role in PRJ1 / venture editor (not US-02.11) |

## Change
`TEAM_ROLES` gains `'Cố vấn'` (fourth option on PRJ2). No API, RBAC, schema or link behaviour change.

## Targeted tests
| Case | Where | Result |
|---|---|---|
| Owner invites Cố vấn · Biên tập and Cố vấn · Xem | DB | PASS |
| Cố vấn · Chủ sở hữu (OWNER) refused, 422 `permission` | DB | PASS |
| Re-send keeps Cố vấn and the level | DB + browser | PASS |
| Accept keeps Cố vấn and the level; advisor sees the team read-only | DB + browser | PASS |
| Forged client role on a link join refused (422), nothing created | DB | PASS |
| Editor / Viewer advisor cannot invite (403) | DB | PASS |
| Founder · Co-founder · Thành viên unchanged; PRJ2 lists four roles | DB + browser | PASS |

## Kept as approved
| Item | Status |
|---|---|
| US-02.11 AC1 "Chưa có tài khoản HUB" note | PO_APPROVED_SECURITY_DEVIATION (not shown, PO 05/10) |
| Link invite | lazy creation on copy, Thành viên · Xem, 7 days, regenerate invalidates, raw token never stored / logged |
| Release prerequisite | `INVITE_LINK_SECRET` required in the deployed env, ≥ 32 characters; missing → controlled `INVITE_LINK_UNAVAILABLE` (500) |

## Gates
| Gate | Result |
|---|---|
| format · lint · typecheck · build | PASS |
| Unit | 42 files · 444 / 444 |
| DB | 55 files · 849 / 849 (`invite-link` 19, +1 advisor case) |
| Targeted e2e | S1-UAT-07 + WF02-S05 / S06 / S08 / UAT / L2 + PDF-alpha: 9 specs · 106 / 106 |
| L1-L2 UAT | 10 specs · 19 / 19 |
| Protected regression | **96 specs · 1261 tests · 1232 PASS · 0 FAIL · 29 SKIP (opt-in, unchanged) · 0 FLAKY** on `63eb2cb` (21.2 min), after a guarded reset of `hubnetwork_s1invite` |
| Server log | 0 5xx, 0 hydration, 0 secret / token; 1 expected refused `/dev/login` |
| Stale test | `wf02-s05` PRJ2 role list (three → four) — STALE_AND_FIXED |

## Related
- [S1-UAT-07-invite](S1-UAT-07-invite.md)
- [S1-UAT-07-evidence](S1-UAT-07-evidence.md)
- [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
