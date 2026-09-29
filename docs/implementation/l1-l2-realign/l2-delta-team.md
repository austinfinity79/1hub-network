# L2 Delta Team

Team, invitations and security of WF-02, audited at `5d8cf56`. Continues [l2-delta-matrix.md](l2-delta-matrix.md).

## Team and invitations
| SOT requirement | Frame | Current route | Current API | Current DB | Match | Required change |
|---|---|---|---|---|---|---|
| Invite by e-mail (row 90) | PRJ2 "Gửi lời mời" | wizard step 2, `/projects/:id/team` | `POST /ventures/{id}/team/invitations` creates the pending row; **no e-mail** | `project_members` PENDING_CONFIRMATION | partly | e-mail through the existing sender; a failed send creates nothing |
| Invite by link (row 90) | PRJ2 "Sao chép link" | none | none | none | contained | who may join, role, expiry and revocation are defined nowhere: drawn, inert (D-T1, PO answer) |
| No membership from sending (BR-ENT-05) | PRJ2 lede | — | accept is explicit | state machine of migration 008 | yes | none |
| Role of a member (rows 90, 102) | PRJ2 "Vai trò" | free text field | `role_label`, display only | `project_members.role_label` | yes | select of the three board values; stored as before |
| Permission of a member (rows 90, 102) | PRJ2 "Quyền", "Ba mức quyền" | column "Quyền": Chủ sở hữu or none | none; members read only | none | **no** | Biên tập, Xem stored per member; Chủ sở hữu derived from ownership |
| Member confirms (row 91) | ME7 banner | `/projects/:id/team` when the URL is known | accept, decline | — | partly | listed for the invitee on ME7 |
| Pending invitations of the account (row 86) | ME7, ME0 row | none; sidebar "Lời mời" inert | none | index on the invited address | **no** | `GET /me/venture-invitations`; ME7 banner; ME0 row |
| Invitee without an account | PRJ2 row 3 | — | allowed | — | yes since L1 | open sign-up lets the address sign in and find the invitation |
| Notification (BR-NOT-01) | NOTI1 | none | none | none | contained | e-mail and ME7 only; no notification model (NOTI1 is outside WF02) |
| Feedback (row 93) | "Góp ý" pill | not drawn on member pages | none | none | contained | drawn, inert (D-F1, PO answer) |

## Authorization
| Rule | Current | Match | Required change |
|---|---|---|---|
| Owner edits the venture | `venture:manage` owner only | yes | members with Biên tập edit as well |
| Owner manages the team | `venture:team_manage` owner only | yes | none: Biên tập does not invite or remove |
| Unrelated member cannot read or edit | 404 for both | yes | none |
| Owner, profile, status never from the client | unknown keys refused | yes | new keys keep the rule |
| Role label grants nothing | yes | yes | creator role likewise; never platform RBAC |
| Headers, query and body cannot raise a permission | covered for owner-only rules | yes | extended to the permission levels |
| Pending data only for the owner; an invitee sees only their own invitation | yes | yes | kept for the new list |
| Inviting reveals nothing about an address | no account lookup | yes | kept: a pending row shows the address only, never a name or "has no account" |

## Tests that pin superseded behaviour
| Pin | Where |
|---|---|
| no stage, no creator role on create | `venture.db-test.ts`, `wf02-s05` |
| "Tạo lời mời", "Chưa có email nào được gửi", no permission levels | `wf02-s05`, `wf02-s06`, `wf02-uat-journey` |
| members cannot edit the venture | `venture.db-test.ts`, `wf02-s05`, `wf02-s06` |
| `/me` is "Tài khoản của tôi"; "học vấn" never shown | `wf02-s01`, `home-model.test.ts` |
| sidebar of seven items, "Lời mời" inert; 27 routes, 8 member routes | `nav.test.ts`, `routes.test.ts`, `wf02-t00`, `shell-routes` |
| `education` refused by PATCH; migration list 001…010 | `profile-edit.db-test.ts`, `schema.db-test.ts` |

## Related
- [l2-delta-matrix.md](l2-delta-matrix.md) · [l2-screen-contracts.md](l2-screen-contracts.md) · [open-decisions.md](open-decisions.md)
