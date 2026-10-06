# DEMO-SP1-FOUNDER-01

Startup profile Tổng quan (DM10), the founder click-through and the public Founder Profile (DM13) with the DEMO-only verified state, for the 07/10 demo.

- Branch: `feat/sprint1-completion`, from `7dd5230`.
- Contract: [DEMO_SOT_v1](../../demo-0710/DEMO_SOT_v1.md), [DEMO_DATA_CONTRACT](../../demo-0710/DEMO_DATA_CONTRACT.md).
- Decisions: [DEC-DEMO-SP1](../../decisions/DECISION_LOG.md#dec-demo-sp1).
- No migration. Not pushed, merged or deployed.

## Scope
| Surface | Result |
|---|---|
| `/products/[slug]` (DM10 Tổng quan) | The page (detail below this table) gives way when a startup has no fixture: AgriTrace and Kho Lạnh Miền Tây show Giới thiệu + team. |
| SP1 tabs | Tổng quan current. Chỉ số / Cập nhật are labels: **MISSING_OPTIONAL_SP1_VISUAL_ASSET**. The pack's files 12 / 13 are still the withdrawn export (`bbef05d8…`). |
| `/talents/[handle]` (DM13, PUBLIC VIEW) | The page (detail below this table). The verified chip shows only where the fixture flag is set. |
| Journey | `/products` → "Xem hồ sơ" → `/products/tracely` → Đặng Kim Chi → `/talents/dang-kim-chi`. Direct refresh and back / forward keep the route. |

DM10 page:
- **Head:** identity (logo, name, domain chip), status "Đang pilot", "Từ 2025 · Seed · Đà Nẵng", follow / connect, focus line and tagline.
- **Tabs.**
- **Main column:**
  - Bài toán + 3 figures
  - Giải pháp + 3 features
  - Thị trường + sizes + Phương pháp
  - customer quotes
  - Đội ngũ, with founders clickable when allow-listed
  - Tầm nhìn
- **Rail:**
  - Cập nhật · Q3 2026
  - Gọi vốn + progress + dataroom
  - Dấu ấn
  - Nhu cầu

DM13 page:
- **Profile card:** cover, avatar, name, "Đã xác thực danh tính qua 1Hub", headline, place · HUB role, 4 HUB badges, tags, Kết nối / Theo dõi.
- **Sections:** Giới thiệu, Kinh nghiệm, Dự án/doanh nghiệp…, Học vấn, Chuyên môn, Chứng chỉ.
- **Rail:** Sản phẩm, Nhà sáng lập khác.

## Data and privacy
| Rule | Detail |
|---|---|
| Canonical | Startup identity, stage, place, domains, summary, team (`project_members`). Founder name, headline, region, bio, ventures. No new model, no migration. |
| Demo fixture (DEMO STATE ONLY) | `src/lib/demo-0710/startup-overview.ts` holds the Tổng quan copy, quarter figures, funding, milestones and needs. `src/lib/demo-0710/founders.ts` holds the allow-list, verified flag, badges, tags, experience, education, expertise and certificates. |
| Seed | `demo_0710.sql` now sets Đặng Kim Chi's canonical bio. A re-run refreshes `bio` only. |
| Founder route | A fixed handle from the allow-list. Any other handle, a profile UUID or a non-founder team member returns 404. The id never reaches the page. |
| Projection | Canonical fields pass `projectDiscovery` at the profile's own PROFILE_DISCOVERY level. A PRIVATE demo profile gets a 404 and disappears from the team and from "Nhà sáng lập khác". |
| Never rendered | E-mail, phone, contact / privacy card, "+ Tạo sản phẩm", programme applications, rounds and scores, ids. |
| Verified | Fixture flag `identityVerifiedDemo` (Kim Chi, Gia Bảo), marked `data-demo="DEMO-0710"`. No column, role, permission or call. |

## Visual QA (1440 × DPR1, gated < 1.5 % / < 2 %)
| Block | outside / beyond % |
|---|---|
| DM10 head + tabs · overview · market + quotes · team + vision | 0.71 / 0.30 · 0.13 / 0.41 · 0.47 / 0.68 · 0.00 / 0.16, all gated. Team names are excluded as data. |
| DM13 profile card · about · education · expertise + certificates | 1.13 / 1.21 · 0.59 / 0.48 · 0.76 / 0.35 · 1.05 / 0.25, all gated. |
| DM13 experience · rail | 1.57 / 2.68 · 6.31 / 7.69, reported only. The privacy omissions below change these blocks. |
| 768 / 390 | No overflow. Tabs, rail, founder link and CTAs are reachable. Avatars are square. |

## Tests
| Gate | Result |
|---|---|
| format · lint · typecheck · build | PASS (`/products/[slug]`, `/talents/[handle]` dynamic) |
| unit | 458 / 458 (45 files) |
| db (`src/lib/library`, `public`, `profile`) | 107 / 107 (6 files) |
| `demo-sp1-founder-01` | 13 / 13: DM10 overview, fallback overview, journey + refresh + back, every link 200, 404s, founder public view, verified flag only, PRIVATE hidden everywhere, member view, 768 / 390, typography, DM10 / DM13 pixel |
| Tier B visual slice (27 specs incl. WF02 S03/S05/S06/T00, WF05, WF06, L5, L6) | 434 passed, 2 skipped, 0 failed |
| UAT | 19 / 19 |
| server log | hydration 0 · 5xx 0 · secret 0 · hex40 0 |

## Known deviations
- **Team names:** DM10 draws "Nguyễn An / Lê Minh Tú". The canonical team is Đặng Kim Chi / Nguyễn Minh Anh (data contract, INTENTIONAL-DATA).
- **Omitted from DM13 for privacy (task §5):**
  - The contact / privacy card.
  - The "Vòng trong" badge.
  - The challenge bullet and challenge submissions. "Dự án" lists the canonical venture instead.
- **DM13 counts and durations:** "Xem tất cả N" counts are not drawn. Durations counted to "nay" are not drawn, which keeps the page deterministic.
- **Website:** "tracely.vn ↗" is not linked. There is no canonical website and no approved external URL.
- **Header:** guest header, while the frames draw a signed-in one. "Nhân tài" stays a label until `/talents` exists.
- **Avatars:** initials stand in for the blank avatars, since no avatar asset exists.

## Related
- [DEMO-DIR2-01](DEMO-DIR2-01.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
