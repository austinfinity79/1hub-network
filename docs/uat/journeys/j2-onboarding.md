# J2 Onboarding

Journey 2 — new member → onboarding (stages "Thông tin cơ bản", "Chuyên môn", "Vai trò trong hệ sinh thái", "Hoàn tất"; resolver BASIC → CAPABILITY → ROLE → REVIEW → complete).

### J2-01 · Stage 1 BASIC
| Field | Value |
|---|---|
| Persona · account | New member · your own **new** address (or `newcomer@example.test`, once) |
| Start URL | the onboarding page after J1-03 |
| Preconditions | the account has never finished onboarding |
| Steps | 1. Pass the intro. 2. Fill full name, display name, country, province. 3. Continue |
| Expected UI | stage 1 of 4 marked done; stage 2 opens |
| Expected route | onboarding stage 2 |
| Expected data / state | profile basics saved |
| Permission | only your own profile |
| Negative | leave a required field empty → the field is named; you cannot continue |
| Reset | new address |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

### J2-02 · Resume
| Field | Value |
|---|---|
| Persona · account | same as J2-01 |
| Start URL | a new sign-in link after closing the window |
| Preconditions | stage 1 done, stage 2 not |
| Steps | 1. Close the window. 2. Sign in again (J1-02 / J1-03) |
| Expected UI | you land on the first unfinished stage with stage 1 data kept |
| Expected route | onboarding stage 2 (not the intro, not `/me`) |
| Expected data / state | still **one** account and **one** profile |
| Permission | — |
| Negative | typing `/me` before finishing brings you back to the unfinished stage |
| Reset | new address |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

### J2-03 · CAPABILITY, ROLE, REVIEW, complete
| Field | Value |
|---|---|
| Persona · account | same |
| Start URL | onboarding stage 2 |
| Preconditions | J2-02 done |
| Steps | 1. Stage 2: specialisations, fields, skills. 2. Stage 3: declare roles, including a HUB / CLB leadership one. 3. Stage 4: review, visibility, accept the terms. 4. Finish |
| Expected UI | the review lists what you entered and the completion the server computes; finishing shows the completion screen, then `/me` |
| Expected route | … → `/me` |
| Expected data / state | onboarding complete; consents recorded; profile completion from the server (you never type a percentage) |
| Permission | declared roles are self-declared labels only |
| Negative | stage 4 cannot finish without accepting the terms |
| Reset | new address |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

### J2-04 · No elevation from self-declaration
| Field | Value |
|---|---|
| Persona · account | the account from J2-03 |
| Start URL | `/me/roles` |
| Preconditions | leadership role declared in stage 3 |
| Steps | 1. Open "Vai trò & liên kết". 2. Type `/ops/network`. 3. Type `/demo/programmes` |
| Expected UI | the declaration shows as self-declared; no leader or admin tools |
| Expected route | `/ops/network` and `/demo/programmes` show the "not found" page |
| Expected data / state | no role assignment, no ACTIVE membership created by onboarding |
| Permission | only an organisation / platform decision grants a role |
| Negative | as above |
| Reset | none |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

## Related
- [j1-guest-auth.md](j1-guest-auth.md) · [j3-profile-venture.md](j3-profile-venture.md)
