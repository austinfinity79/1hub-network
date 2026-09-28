# Internal Alpha Test Accounts

Review site: **https://1hubnetwork.io.vn**, release `9c614585ca61fe2e4c957f28d7cc5c78fafe7bc0` (Task 20, deployed GREEN; rollback `0a2df094b941f6d0f0fc87cdb7767b2e92272198`).
- Every account is a **review persona** on `@example.test`; nothing here is a real person.
- There are **no passwords**.
- Start with the [self-review guide](INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md).

## How to sign in (Internal Alpha method)
The Internal Alpha has **no email provider**. Typing an address on `/auth` shows "Mở hộp thư của bạn", but no email ever arrives. Sign-in works only through a **one-time link issued by the operator**.

| Who | Step |
|---|---|
| Tester | Ask the operator privately for a link: one account below, or your own new address `<name>-<purpose>-<nn>@example.test` |
| Operator (server access) | Runs the release tool `issue-login-link.sh <address>@example.test` on the review server. It prints one link, single use, valid 15 minutes, and refuses any address that is not `@example.test` |
| Operator | Sends the link to that tester **only**, in a private message |
| Tester | Opens it within **15 minutes** in a **private / incognito window**, one window per account. A second open shows "Link đã dùng rồi" |
| Tester | A new address becomes a **new account** at first sign-in and starts onboarding. The session lasts 30 days in that window |

- **To sign out:** close the private window.
- **"Đăng xuất khỏi mọi thiết bị"** signs out **every** tester on that account; use it only with your own address.

## Actor inventory
| ID | Actor | Account | Role / organisation | Project / Startup | Programme / Challenge | Starting state | Flows |
|---|---|---|---|---|---|---|---|
| A | Guest | not signed in | — | — | — | — | 1 |
| B | New member (onboarding not done) | **your own new address** `<name>-new-<nn>@example.test` (recommended) · `newcomer@example.test` (Demo Newcomer, first run only) | none | none | none | Account created at first sign-in; step 1 "Bạn đến HUB để làm gì?" | 2, 3 (invitee) |
| C | Member | `member@example.test` (**Demo Member**) | Chapter 01: ACTIVE member | Owner of **Demo Startup** | none | Onboarding done; profile about 90 % | 1, 3, 6 |
| D | Project / Startup owner | `member@example.test` | as C | STARTUP: Demo Startup · PROJECT: created in Flow 3 | Applies in Flow 6 | Demo Startup exists; **no PROJECT in the seed** | 3, 6 |
| E | ACTIVE project team member | your own address `<name>-mate-<nn>@example.test` | none | ACTIVE member of the Flow 3 PROJECT after "Nhận lời mời" | — | **MISSING in the seed**: made in Flow 3 (invite + accept) | 3, 6 |
| F | Pending invitee | `leader@example.test` | — | Invited to Demo Startup as "Contributor" (pending) | — | Invitation pending | 3 (look only) |
| G | Community Leader | `leader@example.test` (**Demo Leader**) | Chapter 01: ACTIVE member + **Chapter Leader**; operates Chapter 01 only | Pending invite (F) | WF04 demo operator | Chapter 01 has 1 pending request (Demo Pending) | 4, 5 |
| H | Platform Admin | `ops@example.test` (**Demo Ops**) | Platform admin: sees every organisation | none | WF04 demo operator | — | 4 (compare), 5 |
| I | Unrelated member (negative checks) | `pending@example.test` (**Demo Pending**) | Chapter 01: membership request **pending** | none | none | Profile about 60 % | 3, 4, 6 |

Optional roster actor: `unclaimed@example.test` is pre-listed on the Chapter 02 roster. Its **first** sign-in creates an ACTIVE Chapter 02 member without a request. It works once per environment.

## Missing actors
| Missing | How the flows cover it | Smallest seed addition (not made) |
|---|---|---|
| E — ACTIVE team member | Flow 3 steps 7–9: invite a new address, accept | A 6th persona with an ACTIVE membership on a seeded PROJECT |
| D (PROJECT type only) | Flow 3 step 6: the member creates one | One seeded PROJECT owned by Demo Member |

## Caveats
| Caveat | Why it matters |
|---|---|
| Accounts are **shared** | Keep edits reversible; name your own records with your initials; never rename or delete Demo Startup |
| `newcomer@` works for one onboarding run | After it, use a new address per run |
| `leader@` is also the pending invitee of Demo Startup | Do not accept or decline that invitation unless the test says so |
| Deployed ≠ local repository | The repository already holds TASK 22.1–22.3 (new homepage, auth, settings, project wizard). They are **not deployed**; this pack follows the deployed release |

## Never put in a document, chat or screenshot
Sign-in links or tokens, cookies, server secrets, real people's emails.

## Related
- [INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md](INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md) — the six flows and the checklist
- [INTERNAL_ALPHA_TEST_DATA_RESET.md](INTERNAL_ALPHA_TEST_DATA_RESET.md) — test data and reset
- [INTERNAL_ALPHA_RELEASE_MANIFEST.md](INTERNAL_ALPHA_RELEASE_MANIFEST.md) — release record
