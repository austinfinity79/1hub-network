# Homepage CTA Map

[DEC-2809-D1](overview.md#d1). Current state: [DEC-H1-D3](../../decisions/DECISION_LOG.md#dec-h1-d3), `src/components/landing/*` (audited 2026-09-28). Auth rule: **P** public · **L** login required, return to the action · **X** external. "Sắp có" = visible Coming soon label (today an inert item shows its reason only in `title` / `aria-label`, which 28/09 no longer accepts).

## Frozen by the 28/09 source
| CTA (section) | Today | New target | Auth | Delta |
|---|---|---|---|---|
| Tạo hồ sơ startup của bạn (hero) | `/projects/new`; a guest lands on bare `/auth`, intent lost | Guest: `/login?redirect=/onboarding?intent=create-startup` → onboarding with the startup intent preselected → `/projects/new` (type STARTUP). Onboarded member: `/projects/new` | L | Backend: return path through magic link (BD-02); intent mapping (HD-A3) |
| Tạo tài khoản (One… Endless…) | entry → `/auth` | `/login?mode=signup` = the same magic-link entry; no separate sign-up flow | P | `/login` alias (BD-01) |
| Tạo chương trình (Chương trình ĐMST) | inert | Guest: login → `/programmes/create`. Signed in without permission: "không có quyền" state with contact-admin CTA. With permission: create | L | New route + permission state (BD-06, HD-A4) |
| Three CTAs of the closing section | Khám phá cơ hội `#co-hoi` · Triển khai chương trình inert · Khám phá mạng lưới HUB page | `/login` or `/login?mode=signup` per CTA | L | Proposed: "Khám phá cơ hội" / "Khám phá mạng lưới" → `/login?mode=signup`, "Triển khai chương trình" → `/login?redirect=/programmes/create` (PO review) |
| Truy cập ihub.ventures (Tiếp cận pipeline) | not rendered (DEC-H1-D2) | `https://ihub.ventures`, new tab, `rel="noopener noreferrer"` | X | UI only |
| Tìm hiểu về HUB Network (Được xây dựng bởi cộng đồng) | published HUB page | `/about` | P | New page; content source open (HD-A5) |
| Chi tiết / Xem tất cả (Hoạt động, Sự kiện) | rows not rendered | `/events` directory (L16 EV2) | P | Public events read API (BD-07) |
| Chi tiết (Chương trình ĐMST) | not rendered | `/programmes` directory | P | No corrected frame; public programme data (HD-A6, BD-08) |
| Hero search | disabled | Search over existing public data only (organizations, published events, published programmes); no universal engine | P | Public search read (BD-09); results target PO review |
| Out-of-scope CTAs | inert, hidden reason | Hidden, or visible "Sắp có" | — | UI only; supersedes DEC-P0-SHELL-D2 on `/` |

## Discovery CTAs — proposed, PO review before freeze
| CTA | Proposed target | Why |
|---|---|---|
| Mạng lưới đổi mới sáng tạo (header) | `/library`, the public Library demo ([DEC-L15-D4](../../decisions/DECISION_LOG.md#dec-l15-d4), PO 28/09) | Discovery surface |
| Khám phá mạng lưới (03/03, footer) | `/organizations/hub-network` (public, exists) | Only public network surface |
| Khám phá mạng lưới (Cửa 01 Giải pháp & Startup) | "Sắp có" | A startup directory needs public ventures; ventures are private (HD-08) |
| Khám phá mạng lưới (Cửa 02 Nhà sáng lập) | "Sắp có" | A founder directory conflicts with PROFILE_DISCOVERY never public (DEC-WF01-S07-D2) |
| Đăng bài toán · Kết nối nguồn lực | "Sắp có" | Problem entity is Future |
| Challenge / problem library | `/library` static demo ([DEC-L15](../../decisions/DECISION_LOG.md#dec-l15)) | Labelled demo data; a real directory still needs HD-A7 |
| Chương trình · Sự kiện (header, footer) | `/programmes` · `/events` | Same directories as above |
| Về HUB Network (header, footer) | `/about` | Same as "Tìm hiểu về HUB Network" |
| Tham gia mạng lưới (01/03) | `/login?redirect=/me/roles` | Membership request stays WF02-S04 |
| Triển khai chương trình · Trao đổi giải pháp · Kết nối hợp tác · Câu hỏi thường gặp · email · social · VI \| EN · Tạo sự kiện | "Sắp có" | No Alpha destination |
| Legal links | `/legal/...` | Unchanged |

## Return-to rule (all **L** CTAs)
- Only a same-origin relative path is accepted (starts with `/`, not `//`, no scheme); anything else falls back to the onboarding resolver.
- Order after the link is consumed: onboarding steps still come first; then the return path instead of `/me`.
- An intent the user may not perform (e.g. `/programmes/create` without permission) lands on the no-permission state, never on a 404.

## Related
- [overview.md](overview.md) · [backend-deltas.md](backend-deltas.md) · [human-decisions.md](human-decisions.md)
- [../03_ROUTE_DELTA_MATRIX.md](../03_ROUTE_DELTA_MATRIX.md) — earlier CTA classes (superseded where they differ)
