# Internal Alpha Test Data Reset

The review data are the deterministic seed plus whatever earlier reviews created. Names such as "Fixture …", "Demo …" or "(demo)" are test data, not copy defects. Accounts: [INTERNAL_ALPHA_TEST_ACCOUNTS.md](INTERNAL_ALPHA_TEST_ACCOUNTS.md).

## Test data inventory
| Record (as shown) | Type | Actor / owner | State at seed | Flows | Reset behaviour |
|---|---|---|---|---|---|
| Demo Member / Leader / Ops / Pending / Newcomer | Member profiles | the persona | Newcomer onboarding not done; others done | 1–6 | Operator reseed restores the seeded fields |
| HUB Network | HUB | top of the tree | Published; parent of Chapter 01 and 02 | 1, 4 | Reseed |
| Chapter 01 | Chapter | under HUB Network | Published. Demo Member ACTIVE; Demo Leader ACTIVE + **Chapter Leader**; Demo Pending **pending request** | 4, 6 | Reseed restores the request (an approval made in Flow 4 stays until then) |
| Chapter 02 | Chapter | under HUB Network | Published; no members (scope check) | 4 | Reseed |
| Club 01 | CLB | under Chapter 01 | Published | 4 | Reseed |
| Demo Startup | Startup | owner Demo Member | ACTIVE; team: owner + 1 pending invitation (Demo Leader, "Contributor") | 3, 6 | Reseed |
| Demo Event | Event (standalone) | Chapter 01 | Published, 15/11/2026, on the public page | 1, 4 | Reseed |
| Demo Draft Event | Event linked to Demo Challenge | Chapter 01 | Draft (not public) | 4 | Reseed |
| Demo Challenge | Programme record (Challenge) | Chapter 01 | Draft; not shown in the WF04 demo | — | Reseed |
| Chương trình ươm tạo (demo) | WF04 demo Programme | Chapter 01 | **Published**: 3 stages, 2 events, operating team, 2 questions | 5, 6 | Built into the demo |
| Thử thách đổi mới (demo) | WF04 demo Challenge | Chapter 01 | **Draft** (never open for applications) | 5, 6 | Built into the demo |
| Vocabulary | Controlled lists | platform | Tỉnh: Hà Nội, Đà Nẵng, TP. Hồ Chí Minh · Lĩnh vực: Công nghệ khu vực công, Giáo dục · Kỹ năng: Sản phẩm, Kỹ thuật | 2, 3 | Reseed |

## What persists and what does not
| Kind | Where it lives | Examples | Survives closing the window? |
|---|---|---|---|
| **Persistent** (review database) | Server | Accounts, profiles, consents, visibility, sessions, memberships and requests, leadership, organisations, relationships, events, ventures, team invitations | Yes. Only an operator reseed restores seed rows |
| **Session / browser state** | This browser tab, per account | WF04 Programme / Challenge drafts and publishes; WF05 applications (draft and submitted) | No. They are never sent to the server, an organiser or another tester |
| **Sign-in** | Cookie in this window | Your session | No: closing the private window signs you out of it |

## Reset methods for testers
| Method | Clears | Keeps | When | Affects others? |
|---|---|---|---|---|
| A. Close the private window (or open a new one) | Your sign-in in that window; all WF04 / WF05 demo state of that tab | Everything persistent | End of a run; switching account | No |
| B. WF04 "Đặt lại demo" → "Đặt lại" (Programme / Challenge demo list) | Your WF04 drafts, edits and publishes | The two built-in demo records | Before Flow 5; when the demo looks confusing | No |
| C. WF05 "Đặt lại demo" → "Đặt lại" (Dự án & Startup · Demo) | Your applications in this tab | Your ventures and programmes | Before and after Flow 6 | No |
| D. "Đăng xuất" on another session row (Cài đặt tài khoản → Phiên đăng nhập) | That one other session | Your current session | Removing an old window's session | Only that window |
| E. "Đăng xuất khỏi mọi thiết bị" | **Every** session of that account | Data | Testing sign-out, **own address only** | **Yes**: every tester on that account |
| F. New sign-in link | — (a new session) | Data | Link lost, expired or used | No (the operator issues it) |

Nothing resets automatically. The WF04 / WF05 demo state is cleared only by method A, B or C.

## Never do this
- Delete, rename or archive **Demo Startup**, **Chapter 01 / 02**, **Club 01**, **HUB Network** or any seeded persona's profile.
- Click "Yêu cầu xoá tài khoản" on a shared persona.
- Accept or decline Demo Leader's pending Demo Startup invitation, or end organisation relationships, unless the flow says so.
- Try to reset anything beyond methods A–F. Ask the operator.

## Restoring the deterministic starting state
| Situation | Do this |
|---|---|
| A demo looks wrong | Method B or C, or a new private window |
| A persona or fixture was changed for everyone | Ask the operator for the **technical reset** below |
| An onboarding run is needed again | Use a new address; do not reuse `newcomer@` |

## TECHNICAL RESET (OPERATOR / ADMIN ONLY)
Only the operator runs this, on the review server, after warning every tester. Running sessions stay signed in.
1. Back up with the release script `backup.sh`.
2. Re-apply the seed with `node scripts/db.mjs seed` inside the app container. It is rerun-safe and never drops data.

| Restores to seed values | Keeps (not undone) |
|---|---|
| The 5 personas' accounts, profiles, memberships and roles; Demo Leader's leadership; Demo Pending's pending request; Demo Startup and its pending invitation; organisations, relationships, seeded events, vocabulary and legal rows | Everything testers created: new accounts, new ventures, invitations, events, sessions, consents, extra chips or experience on personas. A reseeded `newcomer@` keeps what it gained, so it will not replay onboarding cleanly |

Never run the database **reset** command on the review server: it drops data. The exact commands are in the "Commands" section of the [release manifest](INTERNAL_ALPHA_RELEASE_MANIFEST.md).

## Related
- [INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md](INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md) — the six flows
- [INTERNAL_ALPHA_TEST_ACCOUNTS.md](INTERNAL_ALPHA_TEST_ACCOUNTS.md) — accounts and sign-in
- [INTERNAL_ALPHA_RELEASE_MANIFEST.md](INTERNAL_ALPHA_RELEASE_MANIFEST.md) — release record and commands
