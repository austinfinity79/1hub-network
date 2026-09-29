# L2 Library Delta

TASK 24.1 precheck, SOT delta matrix and contract freeze for `/library`, from `Luồng 2 · Member Profile & Network Management.png` (PO, 29/09 19:24; 16440×5465, sha256 `db7294a9…61b6`). Business SOT stays DEC-L15-D1…D9; decisions below are [DEC-L15-D10…D13](../../decisions/DECISION_LOG.md#dec-l15-d10).

## Frame inventory (board → current)
| Frame (board crop) | Screen | Delta | 24.1 |
|---|---|---|---|
| x 9120, y 100, 1440×2470 | DIR1 Bài toán | pixel-identical to `L15__library__SOURCE.png` | no change |
| x 9120, y 2901, 1440×2383 → `L15b__library-startup__SOURCE.png` | DIR1 Startup | new white card, facets, hero placeholder and chips | in scope |
| x 10760, y 2901, 1440×2464 → `L15c__library-founder__SOURCE.png` | DIR1 Nhà sáng lập | new white card, facets, hero placeholder and chips | in scope |
| EV1 list, EV2 detail, NOTI1, ORGP1, ME7, FP1, L12, L13a–c | events, notifications, org profile, workspace | not Library | out (other flows / closed L2) |

## SOT delta matrix — Startup card (L15b)
| Element | Source (`startup.json`, DEC-L15-D7) | Rendered |
|---|---|---|
| square mark with initials, name, stage pill | name 72/72, stage 65/72 | yes (stage as written; none → no pill) |
| ✓ HUB-verified mark | none | hidden |
| "N thành viên · city" | members 72/72; no city | "N thành viên" |
| tagline, domain chips | 72/72, 70/72 | yes |
| "ĐANG CẦN" chips | none | hidden |
| programme line | self-declared `chuong_trinh_tung_tham_gia` 57/72, excluded by D7 | hidden (H1) |
| note "…do hệ thống ghi nhận…" | would be untrue for this source | not rendered |
| "Xem hồ sơ" / "Theo dõi" | website 44/72 (D7 card link) / no follow contract | website link, else inert / inert |

## SOT delta matrix — Nhà sáng lập card (L15c)
| Element | Source | Rendered |
|---|---|---|
| round mark, name, "role · startup" | founder roles of `thanh_vien` (D7) | yes (short role · first startup) |
| location, badges, expertise chips, "ĐANG MỞ CHO" | none (experience excluded by D7) | hidden |
| startup row (mark, name, stage) | first startup | yes; links to its website when set |
| note about contact and "Đề nghị kết nối" | no connect contract | not rendered |
| "Xem hồ sơ" / "Kết nối" | no person profile / founders are not accounts | inert / inert |

## Facets, hero, sort
| Item | Design | Rendered |
|---|---|---|
| Startup facets | Lĩnh vực, Giai đoạn, Đang cần, Địa bàn, Nguồn hồ sơ | Lĩnh vực, Giai đoạn (D7); the rest hidden — no data |
| Founder facets | Vai trò hiện tại, Chuyên môn, Đang mở cho, Địa bàn, Nguồn hồ sơ | none has data; Lĩnh vực (D7) kept (H4) |
| Startup placeholder | "…tên startup, sản phẩm, lĩnh vực hoặc nhà sáng lập…" | adopted; search now covers product and founder names |
| Founder placeholder | "…tên, vai trò, chuyên môn hoặc startup…" | current text kept (no expertise data) |
| "Tìm nhanh" per tab | Đang gọi vốn, Tìm pilot, Tìm đồng sáng lập, Mở nhận cố vấn, Kỹ thuật, Hà Nội … | unchanged data-backed chips (need / openness / place have no data) |
| Sort "Hoạt động gần nhất" | no activity data | existing sorts kept |

## Human decisions (open)
| # | Decision |
|---|---|
| H1 | Show the self-declared programmes (D7 excludes them) on the Startup card? |
| H2 | Map `startup.json` stages (Ideation … Scale-up) to the venture stages Ý tưởng / MVP / Pilot / Đang bán / Tăng trưởng (DEC-PDF-D5)? |
| H3 | Source for need, openness, city, verification, badges and expertise (the startup spreadsheet has city sheets and private contacts; not approved) |
| H4 | Founder facets while the designed groups have no data |
| H5 | "Xem hồ sơ" / "Theo dõi" / "Kết nối" destinations once profiles, follow and connect exist |

## Related
- [../l1-l2-realign/alpha-backlog.md](../l1-l2-realign/alpha-backlog.md) — item 10
- [../reports/LIBRARY-DATA_deploy.md](../reports/LIBRARY-DATA_deploy.md) — DEC-L15-D9
