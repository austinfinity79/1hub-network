# J3 Profile Venture

Journey 3 — member profile + venture (canonical Project / Startup, team). Name everything you create `UAT <initials> <nn>`.

### J3-01 · Edit profile
| Field | Value |
|---|---|
| Persona · account | Member · your onboarded account (J2) or `member@example.test` |
| Start URL | `/me` |
| Preconditions | onboarding complete |
| Steps | 1. Open profile edit (`/me/profile/edit`). 2. Change the headline or introduction. 3. Save. 4. Reload |
| Expected UI | a saved confirmation; the change shows on `/me` after reload |
| Expected route | `/me/profile/edit` → `/me` |
| Expected data / state | same profile, updated; completion recomputed by the server |
| Permission | you edit only your own profile |
| Negative | a required field emptied → the field is named, nothing saved |
| Reset | edit it back |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

### J3-02 · Create a Project and a Startup
| Field | Value |
|---|---|
| Persona · account | Venture owner · your own account (preferred) or `member@example.test` |
| Start URL | `/projects` |
| Preconditions | onboarding complete |
| Steps | 1. "+ Tạo dự án / startup". 2. "Dự án / ý tưởng", name `UAT <initials> <nn> Dự án`, a field, a one-line description, a stage. 3. "Tiếp tục · Mời đội ngũ", then leave the team step. 4. Repeat with "Startup" |
| Expected UI | both appear once in your workspace as drafts (private) |
| Expected route | `/projects/new` → `/projects` |
| Expected data / state | two ventures, each DRAFT + PRIVATE, you the owner; a double click creates one, not two |
| Permission | only you (and later your team) see them |
| Negative | another tester opening `/projects/<your id>/edit` sees the not-found page |
| Reset | no delete in Alpha: create a new `UAT …` venture next time |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

### J3-03 · Edit and publish rule
| Field | Value |
|---|---|
| Persona · account | the owner of J3-02 |
| Start URL | `/projects/<id>/edit` |
| Preconditions | a DRAFT venture |
| Steps | 1. Change the description, "Lưu", reload. 2. Try "Công khai" with your own role empty, then with it filled |
| Expected UI | save persists; "Công khai" names what is missing, then succeeds |
| Expected route | stays on the editor |
| Expected data / state | after "Công khai": ACTIVE + PUBLIC. There is no public venture page yet (expected) |
| Permission | only the owner publishes; a "Biên tập" member edits but cannot publish |
| Negative | the type (Dự án / Startup) cannot be changed after creation |
| Reset | none (publication is final in Alpha) |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

### J3-04 · Team: invite, accept (makes persona 5)
| Field | Value |
|---|---|
| Persona · account | owner + your **second** address (ACTIVE venture member) |
| Start URL | `/projects/<id>/team` |
| Preconditions | a venture of yours |
| Steps | 1. "Mời thành viên": your second address, a role label, permission "Biên tập" or "Xem". 2. Second window: sign in with that address → the invitation → "Nhận lời mời" |
| Expected UI | owner sees a pending row, then an ACTIVE member; the member sees the venture read-only ("Xem") or editable ("Biên tập") |
| Expected route | member: `/projects` → `/projects/<id>` pages |
| Expected data / state | one membership row, ACTIVE; the owner stays the owner |
| Permission | membership never makes someone the owner; "Xem" cannot save |
| Negative | `leader@example.test` (pending invitee of Demo Startup) sees only that invitation — **look, do not accept** |
| Reset | owner: "Gỡ khỏi đội" / "Huỷ lời mời"; invitee: "Từ chối" |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

### J3-05 · Outsider cannot edit
| Field | Value |
|---|---|
| Persona · account | Normal member · `pending@example.test` or another tester |
| Start URL | `/projects/<someone else's id>/edit` and `/team` |
| Preconditions | the id of a venture you are not in |
| Steps | 1. Open both URLs. 2. Replace the id with a random one |
| Expected UI | the same not-found page for both; nothing about the venture shows |
| Expected route | not-found |
| Expected data / state | nothing changes |
| Permission | owner / team only |
| Negative | as above |
| Reset | none |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

## Related
- [j2-onboarding.md](j2-onboarding.md) · [j4-chapter-ops.md](j4-chapter-ops.md) · [j6-application.md](j6-application.md)
