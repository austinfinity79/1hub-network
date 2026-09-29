# L2 Screen Contracts

Screen contracts of the L2 workspace, written before the code. Actor everywhere: the signed-in member with onboarding complete, on their own profile and on ventures they own or belong to. The machine-readable form is `docs/design/SCREEN_CONTRACTS_WF01_WF03_v1.0.yaml`.

## Flow
```
/me (FP1-OWN) ⇄ /projects (ME7) → /projects/new (PRJ1 → PRJ2 → PRJ3) → /projects/:id/edit
      │              │ accept / decline                                  └ /projects/:id/team
      └ L12 dialog   └ /me/settings (ME0) → /me/privacy
```

## Screens
| Frame | Id | Route | Precondition | Visible data | Actions | Mutation | Next |
|---|---|---|---|---|---|---|---|
| FP1-OWN | WF02-S01 | `/me` | member | identity, introduction, experience, education, specialisation and skills, completion, own ventures | pencils, "+", "Cài đặt hồ sơ", "Thông tin liên hệ", venture link | experience and education through the dialog | editor; `/me/settings`; `/projects` |
| L12 | — | dialog on `/me` | opened from a record or "+" | one experience record | Lưu, Huỷ, Xoá mục này, Đóng | `PATCH /me/profile` `experience` | `/me` |
| L12 pattern | — | dialog on `/me` | opened from a record or "+" | one education record | Lưu, Huỷ, Xoá mục này, Đóng | `PATCH /me/profile` `education` | `/me` |
| — | WF02-S02 | `/me/profile/edit` | member | every profile field, contact included | Lưu | `PATCH /me/profile`, avatar upload | stays |
| ME7 | WF02-S08 | `/projects` | member | ventures as owner or member, own pending invitations, empty state | "+ Tạo dự án / startup", Hoàn thiện hồ sơ, Sửa hồ sơ, Mời thành viên, Thành viên, Chấp nhận, Từ chối | accept, decline | `/projects/new`; editor; team |
| PRJ1 | WF02-S05 | `/projects/new` | member | type, name, field, description, stage, own role; AI block (inert) | Tiếp tục, Lưu nháp, Lưu nháp và thoát, Huỷ | `POST /ventures` once, then `PATCH` | PRJ2; `/projects` |
| PRJ2 | WF02-S05 | `/projects/new?venture=&step=team` | owner of the venture | invite form, team, permission levels; link row (inert) | Gửi lời mời, Quay lại, Bỏ qua, Hoàn tất | `POST …/team/invitations` | PRJ3; PRJ1 |
| PRJ3 | WF02-S05 | `/projects/new?venture=&step=done` | owner of the venture | name, type, draft state, pending invitations | Hoàn thiện hồ sơ, Về Dự án & startup | none | editor; `/projects` |
| — | WF02-S05 | `/projects/:id/edit` | owner or member | venture fields; read only without the edit permission | Lưu, Đội ngũ | `PATCH /ventures/{id}` | stays; team |
| — | WF02-S06 | `/projects/:id/team` | owner, member, or the invitee | team with role and permission; the invitee sees only the invitation | Mời thành viên, Sửa, Gỡ, Huỷ lời mời, Nhận lời mời, Từ chối | invite, change, remove, accept, decline | stays |
| ME0 | WF02-S07 | `/me/settings` | member | account, visibility, consent, pending invitations, deletion | Xem, Đổi, Gửi yêu cầu | sessions, deletion request | `/me/privacy`; `/projects` |

## Success and failure
| Screen | Success | Failure |
|---|---|---|
| FP1-OWN dialogs | the list shows the stored record | field message; the dialog stays open with its values |
| ME7 accept | the venture joins the list; the banner leaves | closed or archived invitation: message, list reloaded |
| ME7 decline | the banner leaves | as above |
| PRJ1 | one DRAFT venture; the URL carries its id | required field named; server refusal keeps the form; a repeated submit returns the same venture |
| PRJ2, team invite | pending row, e-mail sent | invalid address, own address, already pending, 20 pending, send limit (D13), e-mail not sent: message, nothing created |
| Editor, venture editor | stored values shown | field message; archived or read only: notice |

## Guards
| Rule | Where |
|---|---|
| guest → `/auth`; onboarding open → its step | every screen |
| venture unknown, or no relation to it → 404 | editor, team, wizard with an id |
| wizard with an id: the owner only | PRJ1–PRJ3 |
| the invitee of a pending invitation sees that invitation and nothing else | team |
| the API re-checks actor, relation, permission and lifecycle | every mutation |

## Related
- [l2-delta-matrix.md](l2-delta-matrix.md) · [l2-delta-team.md](l2-delta-team.md) · [overview.md](overview.md) · [open-decisions.md](open-decisions.md)
