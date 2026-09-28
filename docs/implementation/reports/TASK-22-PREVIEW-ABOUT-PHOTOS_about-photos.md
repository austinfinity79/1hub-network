# TASK-22-PREVIEW-ABOUT-PHOTOS About Photos

**ABOUT PAGE — real photos in the placeholder slots: DONE (local review).** Implementation `0479579`. Not deployed, not pushed. No auth, DB, API, RBAC or e-mail change.

## Source and PO decisions
| Question | Answer (PO, 28/09) |
|---|---|
| The prompt's 01–13.png mapping is `About.zip`, the design pack /about was built from: each file is a whole-section screenshot whose photo slots are themselves placeholders | Use the real photos from "Ảnh About Hub" instead; the 13 mock-ups stay design reference only (01–04 text fragments not placed) |
| Humans of HUB portraits have a name (file name) but no role or term | Portrait + name as in the file (trailing HUB tag "USA", "- Sing", "- Uk" dropped); role and term "Chờ cập nhật"; listed under "Tất cả" only |

## Asset mapping (`public/about/`, WebP q80)
| Slot | File | Source |
|---|---|---|
| Hero cards 1–3 | `hero-community`, `hero-summit`, `hero-workshop` | Hero section 2, 1, 3 |
| Sứ mệnh 01, 02 | `mission-community`, `mission-resources` | Sứ mệnh 1, 2 |
| Quy mô tầng 2, tầng 3 | `scale-member-hubs`, `scale-clubs` | quy mô · 13 hub thành viên, 60 CLB |
| Dấu ấn 2021, 2023, 2024, 2025, 2026 | `milestone-<year>` | dấu ấn · <year> |
| Humans of HUB (34) | `humans/<name-slug>` | Human of Hub/ |
| Kept as placeholders (no supplied photo) | Sứ mệnh 03, milestone 11 · 2025, org-diagram leader panel, activity banners | — |

## Optimisation
70.1 MB of originals → 2.61 MB. Section photos: long edge 1600 px (hero 1200 px), 69–332 KB. Portraits: at most 720 × 1080 px, 11–32 KB. EXIF orientation applied, metadata stripped. WebP chosen: photos only, no text art; checked sharp at DPR 2. Rendered through `next/image` (`fill`, `object-fit: cover`, `sizes` per slot); hero `priority`, everything else lazy; the frame keeps its size, so no layout shift.

## QA (production build, local)
| Check | Result |
|---|---|
| 1440 / 1024 / 768 / 390 | 46 images, 0 broken, 0 distorted; page overflow 0; off-screen controls 0 |
| Humans of HUB | 34 portraits inside the "Cơ cấu tổ chức" section at every width |
| Footer | 8 / 8 links pass the hit test at every width |
| Homepage → /about | "Về HUB Network" (nav and footer) opens `/about` |
| Runtime | console errors 0; 4xx / 5xx 0 |
| Regression | P0-LANDING + P0-SHELL + shell-routes 57 / 57; unit 245 / 245; format, lint, typecheck, build PASS |

## Remaining gaps (minor)
- Photos for Sứ mệnh 03, milestone 11 · 2025, HUB leaders (diagram panel) and activities are not in the pack ("Ảnh theo tag sự kiện — cập nhật sau").
- Portrait names follow the file names; several lack diacritics. Roles and terms await a list, so the term filters show "Chờ cập nhật".
- The hero card captions ("THÀNH VIÊN QUỐC TẾ" …) no longer show; the card holds the photo.

## Related
- [TASK-22-PREVIEW-ABOUT_about-page.md](TASK-22-PREVIEW-ABOUT_about-page.md)
