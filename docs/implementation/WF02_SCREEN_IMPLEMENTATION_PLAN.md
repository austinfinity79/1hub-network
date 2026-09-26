# WF02 Screen Implementation Plan

Derived from [WF02_PRE_IMPLEMENTATION_AUDIT.md](WF02_PRE_IMPLEMENTATION_AUDIT.md). Ordered by data and API dependency, not by screen number. Nothing is implemented yet.

| Order | Screen | Route | Scope | Dependencies | API/Data readiness | Pixel readiness | Human decision |
|---|---|---|---|---|---|---|---|
| 0 | WF02 foundation | — | Member shell (dark header + sidebar), editor header, `GET /me/network` (memberships + leadership + owned/member ventures read), network projection filter | WF01 profile, visibility, roster | Tables ready; endpoints missing | Shell regions strict | H9 (shell links), H12 |
| 1 | S01 Account home | `/me` | Summary, completion bar, navigation cards, "Tổ chức của tôi" | 0 | Profile/completion ready; network read from 0 | viewport strict; full-page gap | H10, H13, H3 (public link) |
| 2 | S03 Privacy | `/me/privacy` | PROFILE_DISCOVERY management, consent history/re-acceptance (WF01 services) | 0 | Visibility/consent ready; revoke missing | long-page ready | H4 |
| 3 | S04 Roles & links | `/me/roles` | Read-only memberships, leadership, project roles | 0 | Read model from 0 | long-page ready | H5 |
| 4 | S02 Profile edit | `/me/profile/edit` | Canonical profile fields, preview | 0, (3 for preview) | PATCH needs extension; tables ready | viewport strict; full-page gap | H1, H2, H3 |
| 5 | S07 Settings | `/me/settings` | Sessions list/revoke, deletion request (scope per H8) | 0 | `user_sessions` ready (no device metadata); P13 DB gap | long-page ready | H8 |
| 6 | S05 Project/Startup | `/projects/new`, `/projects/:id/edit` | Canonical venture create/edit | 0; H6, H7 | `projects` ready for name/summary/type; catalogue and permissions missing | viewport strict; create state not drawn | **H6, H7 (blocking)** |
| 7 | S06 Team | `/projects/:id/team` | Team roles, invitations | 6; H7 | P12 DB gap; API missing | viewport strict; full-page gap | **H7 (blocking)** |

## Why this order
| Step | Reason |
|---|---|
| 0 before all | Four screens share the member shell, and S01/S04 read the same network model |
| S01 first | The WF01 handoff target; needs only ready data plus the read model |
| S03 early | Reuses the WF01-S07 services; closes the post-onboarding re-acceptance deferral |
| S04 | Read-only over the foundation read model |
| S02 after decisions | Its field set decides whether completion groups 8–10 become reachable |
| S07 | Independent of S01–S04 beyond the shell |
| S05 → S06 | S06 needs a venture and a permission model from S05 |

**Independent after the foundation:** S03, S04 and S07 can proceed in parallel.

## Happy paths retained (frozen scope)
| ID | Path | Status |
|---|---|---|
| HC-WF02-01 | Completed member opens `/me` | Ready after 0/1 |
| HC-WF02-02 | Member edits profile, completion recalculates | After H1/H2 |
| HC-WF02-03 | Member changes permitted visibility (PROFILE_DISCOVERY) | Ready after 2 |
| HC-WF02-04 | Member views the network-visible profile (own preview only in WF02; directory is WF06) | After H3 |
| HC-WF02-05 | Roster member sees membership/leadership | Ready after 0/3 |
| HC-WF02-06 | Unknown member requests membership | **Not retained**: no owning screen (H11) |
| HC-WF02-07 | Member creates canonical Project/Startup | After H6/H7 |

## Related
- [WF02_PRE_IMPLEMENTATION_AUDIT.md](WF02_PRE_IMPLEMENTATION_AUDIT.md) — findings and decisions
- [P0_STATUS.md](P0_STATUS.md) — status
