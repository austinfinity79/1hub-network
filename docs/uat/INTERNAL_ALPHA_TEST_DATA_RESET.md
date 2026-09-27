# Internal Alpha Test Data Reset

The review data are the deterministic seed plus whatever earlier reviews created. Names marked "Fixture" / "(demo)" are test data, not copy defects.

## Test data inventory
| Fixture (as shown) | Type | Owner / organization | State | Used by |
|---|---|---|---|---|
| HUB Network | HUB | top of the tree | Published; parent of Chapter 01 and Chapter 02 | WF-TEST-01 (public page), 04 |
| Chapter 01 | Chapter | under HUB Network | Published. Members: Demo Member (ACTIVE), Demo Leader (ACTIVE + **Chapter Leader**), Demo Pending (**pending request**) | WF-TEST-04, 06 |
| Chapter 02 | Chapter | under HUB Network | Published; **no members** (cross-scope denial checks) | WF-TEST-04 |
| Club 01 | CLB | under Chapter 01 | Published | WF-TEST-04 (relationships, public page) |
| Demo Startup | Startup | owner Demo Member | Active; team: owner + 1 pending invitation (Demo Leader, "Contributor") | WF-TEST-03, 06 |
| Demo Event | Event (standalone) | Chapter 01 | Published (15/11/2026) | WF-TEST-04 |
| Demo Draft Event | Event (linked to Demo Challenge) | Chapter 01 | Draft | WF-TEST-04 |
| Demo Challenge | Programme record (Challenge) | Chapter 01 | Draft; not shown in the WF04 demo | — |
| Chương trình ươm tạo (demo) | WF04 demo Programme | Chapter 01 | **Published**; 3 stages, 2 events, operating team, 2 questions | WF-TEST-05, 06 |
| Thử thách đổi mới (demo) | WF04 demo Challenge | Chapter 01 | **Draft** (never open for applications) | WF-TEST-05, 06 (negative) |
| Vocabulary | Controlled lists | platform | Tỉnh: Hà Nội, Đà Nẵng, TP. Hồ Chí Minh · Lĩnh vực: Công nghệ khu vực công, Giáo dục · Kỹ năng: Sản phẩm, Kỹ thuật | WF-TEST-02, 03 |

| Demo state | Where it lives | Starting state |
|---|---|---|
| WF04 Programme / Challenge demo | This browser tab only (session storage), per account | The two fixtures above; your drafts appear only in your tab |
| WF05 applications | This browser tab only (session storage), per account | No application |

Nothing in either demo is written to the database, sent to an organiser, or visible to another tester.

## Reset methods
| Method | Clears | Keeps | Who | When | Affects others? |
|---|---|---|---|---|---|
| A. Close the private window (or open a new one) | Your sign-in in that window; all WF04 / WF05 demo state of that tab | Everything in the database | Tester | End of a run; switching account | No |
| B. WF04 "Đặt lại demo" (top of any Programme / Challenge demo page → "Đặt lại") | Your WF04 drafts, edits and publishes in this tab | The two fixtures; the database | Tester | Before WF-TEST-05; when the demo looks confusing | No |
| C. WF05 "Đặt lại demo" (top of any Dự án & Startup demo page → "Đặt lại") | Your applications in this tab (drafts and submitted) | Your ventures and programmes (real data) | Tester | Before and after WF-TEST-06 | No |
| D1. "Đăng xuất" on another session row (Cài đặt tài khoản → Phiên đăng nhập) | That one other session | Your current session | Tester | Removing an old window's session | Only that window |
| D2. "Đăng xuất khỏi mọi thiết bị" | **Every** session of that account | Data | Tester, **own address only** | Testing sign-out | **Yes**: every tester on that account |
| D3. New sign-in link | — (a new session) | Data | Operator | Lost / expired / used link | No |
| E. Database reseed | See below | See below | **ADMIN / OPERATOR ONLY** | Seed personas or fixtures broken for everyone | **Yes**: all testers |

Testers must never try to reset the database. Do not use "Yêu cầu xoá tài khoản" on a shared persona.

## E. Operator reseed (ADMIN / OPERATOR ONLY)
```
ssh hub-vps /opt/1hub-network/app/bin/backup.sh
ssh hub-vps 'cd /opt/1hub-network/app && docker compose run --rm --no-deps app node scripts/db.mjs seed'
```
- **Restores** the fixture rows to their seed values: the 5 personas' accounts, profiles, memberships and roles, Demo Leader's leadership, Demo Pending's pending request, Demo Startup and its pending invitation, the organizations, relationships, events, vocabulary and legal rows.
- **Keeps** everything testers created: new accounts, new ventures, invitations, events, sessions, consents, and extra chips or experience added to personas.
- A reseeded `newcomer@example.test` keeps the consents and chips it gained, so it will not replay onboarding cleanly. Use a new address per onboarding run instead.
- Never run `node scripts/db.mjs reset` on the server. Tell testers before and after; running sessions stay signed in.

## Related
- [INTERNAL_ALPHA_TEST_ACCOUNTS.md](INTERNAL_ALPHA_TEST_ACCOUNTS.md) — accounts and sign-in
- [INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md](INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md) — journeys
