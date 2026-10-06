# Demo data contract — 07/10 demo

Part of [DEMO_SOT_v1](DEMO_SOT_v1.md). No migration. No new canonical concept. Everything in this file is demo data and never runs against a production database.

## Reuse (B)
| Need | Canonical source reused | Demo-only addition |
|---|---|---|
| Startup list and filters (DM08, DM01 product blocks) | `projects` (type STARTUP, status ACTIVE, visibility PUBLIC; DEC-PDF-D1), `region_id`, `project_domains`, `stage_id`; read through the library canonical source (`GET /api/v1/library/startups`, `src/lib/library/canonical-source.ts`) | none |
| Startup header and team (DM10) | `projects` (name, slug, website, logo), `project_members` (role_label, ACTIVE) + `individual_profiles` | none |
| Tổng quan / Chỉ số / Cập nhật content | none exists (only `projects.metadata`) | read-only code fixture keyed by project id (the WF04 pattern, DEC-WF04-T00-D1): problem, solution, market, quotes, vision, funding, milestones, needs, quarterly metrics, update log |
| Founder profile (DM13) | `individual_profiles` through `src/lib/profile/projection.ts` (public projection, visibility filters) | code fixture for experience, education, expertise, certificates and HUB badges; allow-list of demo profile ids |
| "Đã xác thực danh tính qua 1Hub" | none: there is no identity-verification column (CCCD is Tương lai, DEC-P0-LANDING-D2) | fixture flag `identityVerifiedDemo: true` on demo profiles only, rendered with a DEMO marker in code; never written to the DB. **DEMO STATE ONLY** |
| Regions, countries | REGION / COUNTRY catalogue (S1-UAT-03, `catalog_sprint1.sql`) | none |
| Domains | DOMAIN vocabulary; Logistics, Nông nghiệp & AgriTech, AI and IoT are not canonical | UNNORMALIZED items (the S1-UAT-03 free-tag rule); no invented canonical id |
| Stages | VENTURE_STAGE as migrated (012): IDEA Ý tưởng · MVP · PILOT Pilot / Thử nghiệm · SELLING Đang bán · GROWTH Tăng trưởng | none; demo startups use PILOT and SELLING |
| HUB / Chapter / CLB, popup, Humans tabs | catalogue 1 / 13 / 55 (PARENT relationships), `/organizations/[slug]` | none |
| About copy, people, milestones, activities | S1-UAT-08A sources (`src/components/about/about-source.ts`, `public/about/`) | none; a Figma-only line is PO content and is flagged, not invented |

## Demo startups and founders (C)
Fixed UUID prefix `de710000-`. All people are fictional, taken from the PO pack, and use `@example.test` e-mail addresses.

| Startup (slug) | Stage | Region | Domains | Founders and team (profile → role_label) |
|---|---|---|---|---|
| Tracely (`tracely`) | pilot | Đà Nẵng | Logistics, Nông nghiệp & AgriTech | **Đặng Kim Chi** → Đồng sáng lập · CEO (owner); **Nguyễn Minh Anh** → Đồng sáng lập kỹ thuật; Phạm Quốc Việt → Kỹ sư backend; Trần Hạnh → Vận hành thí điểm |
| AgriTrace (`agritrace`) | pilot | Đồng Tháp | Nông nghiệp & AgriTech | **Lý Gia Bảo** → Đồng sáng lập (owner) |
| Kho Lạnh Miền Tây (`kho-lanh-mien-tay`) | selling | Cần Thơ | Nông nghiệp & AgriTech, Logistics | **Võ Thanh Hà** → Nhà sáng lập · CEO (owner) |

- **Journey anchor:** `/products/tracely` → Đặng Kim Chi → `/talents/<her profile id>`, with the verified mark.
- **Verified mark:** Đặng Kim Chi and Lý Gia Bảo carry the demo-verified flag. Võ Thanh Hà does not, so the unverified state is visible too.
- **Tracely team names:** the team follows DM13 and DM09. DM10 draws "Nguyễn An · CEO / Lê Minh Tú · CTO". That difference is a [content conflict](DEMO_SOT_v1.md#sot-conflicts) and is recorded INTENTIONAL-DATA.
- **HUB badge:** the "Phó Chủ tịch Chapter Đà Nẵng" badge on DM13 is presentation text from the fixture. It is not a membership, leadership or role record and grants nothing.
- **Other startups in the reference:** LogiSense, KhoAI, RouteMind, ColdGrid and others are not seeded, because no founder for them is drawn. Lists show live data, so they show three startups.

## Content rules
| Rule | Detail |
|---|---|
| Counts | hero and filter counts are computed from live data. Drawn numbers such as "142 sản phẩm", "48 / 23 / 9" and "128" are illustrative and INTENTIONAL-DATA |
| Homepage blocks | product blocks are live (the demo set). Programme cards, "Cập nhật chương trình", the marquee and news are static presentation copy from DM01, render non-clickable, and carry no programme record |
| Metrics / updates | fixed quarters Q4 2025 … Q3 2026 for Tracely, copied from the UPDATED DM11 / DM12 frames once the files are on the workstation. "Nguồn: Đội ngũ" stays. No visibility tiers are computed; the lock row is static |
| Missing content | anything not in this file or in S1-UAT-08A renders nothing and is never made up: CLB chủ nhiệm names, Ban chuyên môn names ("Họ tên — chờ cập nhật" in the frame), HUB popup member / event / project counts beyond the catalogue |
| Determinism | fixed ids, fixed timestamps, idempotent upsert, no `now()` or random values; the same state hash after repeated runs (the S1-UAT-03 method) |

## Delivery and safety
- Canonical rows come from `db/seed/demo_0710.sql`, applied by a separate data step `node scripts/db.mjs demo`, class MUTATING under DB-SAFETY-01.
  - The step is not part of `seed`.
  - It refuses `hubnetwork_p0` and any database it cannot name.
- Presentation fixtures live in `src/lib/demo-0710/`, server-side only.
- The demo allow-list gates the founder route. A real profile never renders through it.

## Related
- [DEMO_SOT_v1](DEMO_SOT_v1.md) · [SCREEN_ROUTE_MAP](SCREEN_ROUTE_MAP.md) · [OUT_OF_SCOPE_POST_DEMO](OUT_OF_SCOPE_POST_DEMO.md)
