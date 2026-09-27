# Asset Inventory

> **SUPERSEDED — DO NOT IMPLEMENT.** Unfinished TASK 21 draft (paused 2026-09-28), built from the Homepage / L1–L6 ZIPs that the designer / PO has since replaced with a corrected revision. Nothing in this file is approved or frozen, and it is not a Design Revision SOT. Do not use it for Task 22. The corrected package will be audited from scratch; only the generic method in [AUDIT_METHODOLOGY.md](../AUDIT_METHODOLOGY.md) carries over.

All 148 files of the 7 revision ZIPs. Per-file tables (screen, class, size, duplicate, confidence, notes): [assets/home-l1-l2.md](assets/home-l1-l2.md) · [assets/l3.md](assets/l3.md) · [assets/l4.md](assets/l4.md) · [assets/l5-l6.md](assets/l5-l6.md). Slices are **not** counted as screens.

## Totals
| Class | Files | Meaning |
|---|---|---|
| FULL SCREEN | 25 | A complete screen or modal in one file (Homepage 1, L1 1, L2 12, L4 1, L5 9, L6 1) |
| SLICE | 92 | Part of a long page or a sidebar / content half; reassembled in [02](02_SCREEN_INVENTORY.md) |
| SECTION | 1 | L6 error-state cards |
| COMPONENT | 27 | Floating "Góp ý" button: 9 files in each of L3, L4, L6. Two renders that differ only in shadow (148×80, 148×90) |
| ANNOTATION | 3 | L2 bridge diagram "Cầu nối · Luồng 2 ↔ Luồng 5", L5 "Lối vào khác · PRJ1", L6 error-page note |
| **Total** | **148** | **110 unique** by content hash; **38 exact duplicates** |

## Per group
| Group | Files | Unique | Full | Slice / section | Component | Annotation | Duplicates | Viewport |
|---|---|---|---|---|---|---|---|---|
| Homepage | 1 | 1 | 1 | — | — | — | — | 1440 × 17 999 |
| L1 | 1 | 1 | 1 | — | — | — | — | 1640 × 1200 (modal on a dimmed frame) |
| L2 | 13 | 13 | 12 | — | — | 1 | — | 1440 wide |
| L3 | 33 | 26 | — | 24 | 9 | — | 7 | 1440 wide; S8 / S9 are 248 + 1352 = 1600 |
| L4 | 55 | 37 | 1 | 45 | 9 | — | 19 | 1440 wide |
| L5 | 10 | 10 | 9 | — | — | 1 | — | 1440 wide |
| L6 | 35 | 25 | 1 | 23 + 1 | 9 | 1 | 12 | 1440; S3 1600; S4 / S5 sidebar + content = 1600 |

## Duplicate and variant groups
| Content | Copies | Relationship |
|---|---|---|
| Floating "Góp ý" button | 27 (2 renders) | Same component in L3, L4 and L6 |
| L4 cover "Bia — no ra tu the DIR1" | 6 | Identical; one cover of the problem detail |
| L4 "S22 Bai toan lien quan" | 6 | Identical; one related-problems section |
| L6 cover "Bia — no ra tu the startup" | 4 | Identical; one cover of the startup profile |
| L4 "Thanh tab dinh" (6), L6 "Thanh tab dinh" (4) | 10 | **Variants**: the same sticky tab bar with a different active tab |
| L5 SP1 (L44, L45) + L6 startup profile slices | — | Same canonical screen **SP1** (tabs 1 and 5 in L5; tabs 2, 3, 4, 6 in L6) |
| L2 EV1 + L6 Frame-1…7 | — | Same canonical screen **EV1**; L6 shows the external-partner variant |

## Referenced but not supplied
FP1-OWN (owner view hosting FP1-EDIT), PRO1 / PR01 and PRO3 / PR03 (venture editor and team, revised), ADM6 (venture approval), P1 (problem page entry), MAIL1 (email templates), the Thư viện "Startup" and "Nhà sáng lập" tabs, SP1 tab bodies 01 / 05 (drawn only in L5), L6 room tabs other than "Dòng làm việc", and the HTML prototype cited as "(XEM HTML)". Anything that depends on these cannot be frozen.

## Source quality notes
| Issue | Where |
|---|---|
| Placeholders: empty pills, "Hồ sơ các dự án, giải pháp ……", "CHỜ ẢNH THẬT", "chờ nội dung chính thức", generic partner names | Homepage |
| Inconsistent mock data: 02/2024 vs 02/2026; two emails for one person; `hubnetwork.vn` vs `1hub.network`; 34 vs 10–20 teams; prizes 120/150/80 vs 120/150/130 M; "5 đội" with 2 ticked; 5 requests with 4 rows; "Còn 6 giờ" vs "quá hạn 2 ngày"; "Chưa ký" vs a signed log entry | L2, L3, L4, L6 |
| Typos / ambiguity: "cưng ứng"; PRO1 vs PR01; "T1+" unexplained; L1 "10 MB" per file or total unclear | L4, L2, L1 |
| Clipped text: last line of the L5 entry annotation; L6 sandbox hint | L5, L6 |

Design mock data are not product data; none is copied into the product.

## Related
- [00_REVISION_OVERVIEW.md](00_REVISION_OVERVIEW.md) — overview and hashes
- [02_SCREEN_INVENTORY.md](02_SCREEN_INVENTORY.md) — canonical screens
