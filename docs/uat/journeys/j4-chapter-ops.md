# J4 Chapter Ops

Journey 4 — CLB / Chapter operations at Chapter 01 scope (the leader persona is a Chapter 01 leader; see [accounts](../INTERNAL_ALPHA_TEST_ACCOUNTS.md) 7 / 7b).

### J4-01 · Member sends a membership request
| Field | Value |
|---|---|
| Persona · account | Member · your onboarded account (not yet a Chapter 01 member) |
| Start URL | `/me/roles` ("Vai trò & liên kết") |
| Preconditions | onboarding complete |
| Steps | 1. "Tổ chức": Chapter 01 (or Club 01). 2. "Gửi yêu cầu" |
| Expected UI | "Đã gửi yêu cầu. Trạng thái: đang chờ duyệt." |
| Expected route | stays on `/me/roles` |
| Expected data / state | one PENDING_APPROVAL request; you are **not** an ACTIVE member |
| Permission | self-selection never creates an ACTIVE membership |
| Negative | send it again → "Bạn đã có tư cách thành viên hoặc một yêu cầu đang chờ ở tổ chức này." |
| Reset | a rejected request can be sent again; an approved one stays (use a new account) |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

### J4-02 · Leader workspace
| Field | Value |
|---|---|
| Persona · account | Chapter leader · `leader@example.test` |
| Start URL | `/ops/network` |
| Preconditions | operator link |
| Steps | 1. Open Chapter 01. 2. Dashboard, "Thành viên", "Sự kiện", profile page |
| Expected UI | Chapter 01 dashboard with counts; members with tabs "Đơn chờ duyệt", "Đang hoạt động", "Tất cả"; events list (Demo Event published, Demo Draft Event) |
| Expected route | `/ops/org/10000000-0000-0000-0000-000000000101[/members\|/events\|/profile]` |
| Expected data / state | read only so far |
| Permission | `org:read` on Chapter 01 only |
| Negative | Chapter 02 (`/ops/org/10000000-0000-0000-0000-000000000102`) → not-found page (no cross-org access) |
| Reset | none |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

### J4-03 · Approve and reject
| Field | Value |
|---|---|
| Persona · account | `leader@example.test` |
| Start URL | Chapter 01 → "Thành viên" → "Đơn chờ duyệt" |
| Preconditions | at least one request from J4-01 (yours, named by your display name). Leave `Demo Pending`'s request alone unless agreed |
| Steps | 1. Open your test request. 2. "Duyệt" — or, on a second request, "Từ chối" |
| Expected UI | approved → moves to "Đang hoạt động"; rejected → leaves the queue and stays in "Tất cả" |
| Expected route | stays under `/ops/org/…/members` |
| Expected data / state | approved: ACTIVE, organisation-verified, one audit event, **no** role granted; rejected: history kept |
| Permission | only a leader of that organisation decides; approving twice → a conflict message |
| Negative | the member cannot approve their own request |
| Reset | new account + new request |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

### J4-04 · Normal member is refused
| Field | Value |
|---|---|
| Persona · account | Normal member · `pending@example.test` or `member@example.test` |
| Start URL | `/ops/network`, `/ops/org/10000000-0000-0000-0000-000000000101/members` |
| Preconditions | signed in |
| Steps | open both |
| Expected UI | not-found page; no leader tools anywhere in the shell |
| Expected route | not-found |
| Expected data / state | nothing |
| Permission | leader / admin only |
| Negative | an ACTIVE membership still gives no leader tools |
| Reset | none |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

### J4-05 · Public chapter page
| Field | Value |
|---|---|
| Persona · account | Guest |
| Start URL | `/organizations/chapter-01` |
| Preconditions | signed out |
| Steps | read the page |
| Expected UI | name, description, counts, child CLB, upcoming published event |
| Expected route | stays |
| Expected data / state | counts only: **no member names, e-mails or ids** |
| Permission | public |
| Negative | the draft event never appears |
| Reset | none |
| Result | ☐ PASS ☐ FAIL |
| Notes | Platform admin `ops@example.test` may repeat J4-02 on `/ops/network` (all organisations) |

## Related
- [j3-profile-venture.md](j3-profile-venture.md) · [j5-programme.md](j5-programme.md)
