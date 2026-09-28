# TASK-22-PREVIEW-LIBRARY Library

**TASK 22-PREVIEW-LIBRARY — Homepage → public L2 Thư viện: DONE (local).** Implementation `4c38745`. Decisions [DEC-L15-D1..D6](../../decisions/DECISION_LOG.md#dec-l15). Not deployed, not pushed.

## Precheck and PO decisions (28/09)
| Finding | Decision |
|---|---|
| No library route anywhere; L15 DIR1 was FUTURE / Bucket C, kept out of the repo (DEC-L2-D1); HD-A7, HD-08 open | Static demo at `/library` (DEC-L15-D1); DEC-L2-D1 reopened for L15 only |
| No public problem data (one DRAFT demo challenge; no prize, deadline, domain fields). The pack's cards name real companies with invented prizes | Six-problem fixture, neutral sector labels, visible "Dữ liệu minh hoạ" (D2) |
| Startups private; profiles never public | Startup, Nhà sáng lập "Sắp có" (D3); counts derived from the fixture |
| Homepage item fixed to `/organizations/hub-network` by the CTA map and P0-LANDING | Header item → `/library` (D4); test and CTA map updated |
| No feedback endpoint; floating "Góp ý" under HD-11 | Visible, inert (D5) |

## Implementation
| Part | Result |
|---|---|
| Route | `src/app/(public)/library/page.tsx`, public, reads only the visitor's entry point |
| Components | `src/components/library/` (`library.tsx` header + feedback, `library-client.tsx` search / tabs / directory, `library-data.ts` fixture + pure filter / sort, `library.module.css`) |
| Search | entity selector (Bài toán · Startup · Nhà sáng lập, synced with the tabs), accent-insensitive text search, quick filters toggling domains |
| Directory | facets (Lĩnh vực, Giai đoạn, Địa bàn) multi-select with counts and zeros kept, chips, "Xoá tất cả", count, sort (Sắp hết hạn / Giải thưởng cao nhất), empty state, 9 per page |
| Homepage | `landing.tsx`: the header "Mạng lưới đổi mới sáng tạo" → `/library`; nothing else |
| Test infra | `auditRevision` `referenceBackdrop`: composites transparent references in memory (files untouched) |

## QA (production build, local)
| Gate | Result |
|---|---|
| Spec `public-library` | 10 / 10: public access, refresh, homepage link, inert nav, derived counts, filters / chips / empty state, search / quick / sort, tabs + keyboard, feedback, no API call, no `@` on the page |
| Pixel 1440 DPR1 | Structural 0 · Major 0 · Component 0. Hero: header 0 / 0.003, heading 0.0006 / 0.0114, search 0.0006 / 0.0041, quick 0 / 0.0024, glow 0 / 0; tabs 0.0008 / 0.0055; facets 0.0002 / 0.0046, chips 0.0033 / 0.0077, cards row 1 0.0037 / 0.006, row 2 0.0028 / 0.0062; feedback 0.0111 / 0.0056 (outside / beyond ±2 px; limits 0.015 / 0.02) |
| P3 / intentional | fixture content and counts; legible facet labels; designer note and "Xem thêm 22" not rendered; metrics row not compared; quick-chip widths pinned to the pack at desktop |
| Responsive 1440 / 1024 / 768 / 390 | overflow 0; off-screen controls 0; search fits; cards 3 / 2 / 1 / 1 columns; tabs reachable (scroll at 390); filters stack |
| Regression | 139 / 139: P0-LANDING 10, P0-SHELL 14, shell-routes 33, WF01-S01 13, S02 14, S03 15, e-mail flow 5, auth-session 13, authz-session 8, console-health 4, public-library 10. `/about`: 46 images, 34 portraits, footer 8 / 8, homepage → `/about` |
| Gates | format, lint, typecheck, build PASS; unit 245 / 245 |
| Runtime | #418 0; console errors 0; 4xx / 5xx 0 |

## Remaining (non-blocking)
- Real directory needs public problem data (HD-A7), public ventures / profiles (HD-08) and a problem detail route.
- The About page header still sends "Mạng lưới đổi mới sáng tạo" to the HUB page (out of this task's scope).

## Git
Branch `main`; start HEAD `4aed631`, checked again before each commit. Push **NOT RUN**; deploy **NOT RUN**.

## Related
- [TASK-22-PREVIEW-ABOUT-DEPLOY_about-deploy.md](TASK-22-PREVIEW-ABOUT-DEPLOY_about-deploy.md) · [../INTERNAL_ALPHA_PREVIEW_RELEASE.md](../INTERNAL_ALPHA_PREVIEW_RELEASE.md)
