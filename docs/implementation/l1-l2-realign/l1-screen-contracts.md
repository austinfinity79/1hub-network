# L1 Screen Contracts

Screen contracts of the L1 flow as built ([DEC-L1R](../../decisions/DECISION_LOG.md#dec-l1r)). The machine-readable form is `docs/design/SCREEN_CONTRACTS_WF01_WF03_v1.0.yaml`. Actor everywhere: the signed-in account, on its own profile only.

## Flow
```
AUTH1 → AUTH2 → AUTH3 → ACC-05 → ACC-06 → ACC-07 → ACC-08 → ACC-09 → ACC-10 → /me
                  └ AUTH4 (errors)
```

## Screens
| Frame | Id | Route | Precondition | Shows | Actions | Mutation | Next |
|---|---|---|---|---|---|---|---|
| AUTH1 | WF01-S01 | `/auth` | guest | e-mail field, Google control | send link; Google (explains, signs nobody in) | `POST /auth/magic-link` | AUTH2 |
| ACC-05 | WF01-S09 | `/onboarding` | session, onboarding open | four stages, AI block (inert) | Bắt đầu; Để sau | none | ACC-06; `/` |
| ACC-06 | WF01-S06 | `/onboarding/profile` | session, onboarding open | avatar, full name *, display name *, current role, introduction, country *, province *, e-mail (read only), phone (private) | Tiếp tục; Lưu và hoàn tất sau; Tải ảnh lên | `PATCH /me/profile`, `POST /me/profile/avatar` | ACC-07; `/` |
| ACC-07 | WF01-S10 | `/onboarding/capability` | stage 1 complete | fields, specialisations (≤ 5), skills, experience, links | Tiếp tục; Quay lại; Lưu và hoàn tất sau; experience dialog | `PATCH /me/profile`, `PUT /me/onboarding/stage` | ACC-08; ACC-06; `/` |
| ACC-08 | WF01-S05 | `/onboarding/purpose` | stage 2 passed | six roles, HUB panel "Chờ xác minh" | Tiếp tục; Quay lại; Lưu và hoàn tất sau; add / remove position | `PUT /me/onboarding/roles`, `PUT /me/onboarding/stage` | ACC-09; ACC-07; `/` |
| ACC-09 | WF01-S07 | `/onboarding/privacy` | stage 3 passed | three review cards, preview, completion, visibility switch, required confirmation | Hoàn tất hồ sơ; Sửa ×3; Quay lại; Lưu và hoàn tất sau | `PUT /me/visibility`, `POST /me/consents/accept` ×2, `POST /me/onboarding/complete` | ACC-10; stage; `/` |
| ACC-10 | WF01-S08 | `/onboarding/complete` | onboarding complete | next actions, completion percent | Vào Tài khoản của tôi; Lập hồ sơ đội; Xem trạng thái | none | `/me`; `/projects/new`; `/me/roles` |

## States
| Screen | Validation | Error state | Refresh / resume |
|---|---|---|---|
| ACC-05 | none | none | stays; a new account returns here until stage 1 saves something |
| ACC-06 | the four required fields; phone 8–15 digits | field messages; server refusal keeps the form | saved values are shown; the account resumes here while a required field is missing |
| ACC-07 | skills must be vocabulary items; link must be http(s); dialog: title, months, order | field messages; archived item refused | saved values are shown; resumes here until the stage is passed |
| ACC-08 | a row with text needs its unit; one claim per unit | unit message; unavailable unit refused | saved values are shown; resumes here until the stage is passed |
| ACC-09 | confirmation required | stale version reloads the documents; missing stage named with its link | acceptance already given stays checked; resumes here until completion |
| ACC-10 | none | not completed → the account's step | stays viewable |

## Guards
| Rule | Where |
|---|---|
| no session → `/auth` | every onboarding page |
| a stage refreshes before it is left, so the browser's Back shows stored values | ACC-06 … ACC-09 |
| completion is a document load: no page drawn before it is shown again | ACC-09 |
| onboarding complete → `/me` | ACC-05 … ACC-09 |
| stage ahead of the current step → the current step | ACC-07, ACC-08, ACC-09 |
| onboarding open → the current step | ACC-10, every member and ops page |
| the API re-checks order, ownership and completion | every endpoint above |

## Related
- [overview.md](overview.md) · [l1-delta-matrix.md](l1-delta-matrix.md) · [l1-conflict-record.md](l1-conflict-record.md) · [l1-closure.md](l1-closure.md)
