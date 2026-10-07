# Product detail readiness audit

PRODUCT-DETAIL-DATA-NORMALIZATION-01 — rapid, read-only readiness ranking of the safe product population for the next Product Detail build. No product data was added, normalised, imported or published. Live app at audit time: `642c143`; repo main `74a52c9`.

## Summary
| Item | Value |
|---|---|
| SOURCE | `1hub.network - Tổng hợp thông tin sprint 1 (1).xlsx` (latest variant, 07/10 16:59), sha256 `4b023eaf44991621…264c3bfc`; tabs "Sản phẩm chi tiết" (header rows 1–2, **one data row: r3 Smart Campus**) and "Thư viện sản phẩm" (r2–r178: name, logo link, short description, sector, stage) |
| Safe population | the 92 products of the v2 safe batch (`docs/demo-content/sprint1-v2/02-products-selected-100.json`, built from the same file); every pack row matches its source row (92 / 92). The 3 fictional demo ventures (Tracely reference slice, AgriTrace, Kho Lạnh Miền Tây) are not workbook products and are outside the population |
| TOTAL_SAFE_PRODUCTS | 92 |
| UNIQUE_CANONICAL_PRODUCTS | 92 (42 of them merged from several library rows; 7 of those groups carried conflicting content and keep the pack's chosen row) |
| DETAIL_READY_COUNT | 1 |
| PARTIAL_READY_COUNT | 0 |
| CARD_ONLY_COUNT | 91 |
| EXCLUDE_COUNT | 0 (upstream exclusions already removed 85 rows; VNSPECIAL archived) |

**Main finding.** Only one product (Smart Campus) has a row in "Sản phẩm chi tiết". The 91 others exist only in "Thư viện sản phẩm", which carries name, short description, sector and stage (plus a logo link for 7). That is enough for a card, not for a detail page: problem, solution, team, location and public link are absent for all 91, so a detail page would only repeat the card. More detail pages need more "Sản phẩm chi tiết" rows from the source owner — they cannot be derived.

## Method
- Core fields (10): N name · O overview · P problem · S solution · Se sector · St stage · L location · T team · U public link · A logo / approved asset. A field counts only when source-backed and usable as is; a conflicting field does not count until the PO resolves it.
- Library products: N, O, Se, St from the kept library row; A = one of the 7 logos already bound under the public logo rule (DEMO-CONTENT-V2-PATCH-A). No library row has location or a link (pack flag `LOCATION_NOT_IN_SOURCE` on all 92).
- Risky claims: library descriptions scanned for numbers + units, rankings, awards, money (0 hit). Smart Campus detail blocks reviewed by hand.
- Conflicts: duplicate library rows with differing description / stage / sector; truncated source descriptions; PO-decided mappings.

## Smart Campus (DETAIL_READY, conditional)
| Block | Source (detail r3) | Use |
|---|---|---|
| Name / identity | A "Smart Campus" = library r2 "1Hub - Smart Campus Solution" (same product, site `1hub.global`) | USE canonical name; NAME_VARIANT flagged |
| Overview | I one-line description · H slogan | USE |
| Problem | N | USE |
| Solution | O | USE |
| Vision | R | USE |
| Needs | M | USE |
| Customer voice | Q (App Store praise, NFC complaint; states no confirmed school testimonial) | USE only as written, or omit |
| Sector | C "SaaS" vs library "Công nghệ giáo dục" | USE PO lock "Giáo dục" (edtech) |
| Stage | D "Đã có sản phẩm, đang triển khai thử nghiệm…" vs library "Growth" | **PO PICK** — omit until resolved |
| Location | G "Thành phố Hà Nội" | USE |
| Public link | B `https://1hub.global/en` | USE |
| Team | S–U: Nguyễn Quang Dũng (Tổng Giám đốc), Nguyễn Duy Thanh (Giám đốc Công nghệ), Vũ Tuấn Anh (Giám đốc Marketing) | USE under the existing team-visibility rule (guest-locked); real persons |
| Logo | bound (EXACT, v2 patch) | USE |
| Updates Q3/2026 | Z dated plan / log | REVIEW before use (dates, plans) |
| Founding date | E 2026-03-01 (date-typed cell; known malformed year) | QUARANTINE — UNVERIFIED |
| Funding | F "Vòng đã hoàn tất" · K pre-seed, "Đang gọi 5 tỷ VNĐ — giả định", "Đã cam kết 0 VNĐ — số mẫu để mô phỏng" | QUARANTINE — self-declared simulation |
| Highlights / milestones | J "20+ trường, 10+ đối tác" · L dated milestones repeating those counts | QUARANTINE — UNVERIFIED counts |
| Market | P total 25 000 vs serviceable 200 000 students (contradiction) + 12-month target | QUARANTINE — conflicting |
| Metrics | W 3 000 MAU / 10 000 activated · X 150 triệu VNĐ/quý · Y CSAT ≥80% | QUARANTINE — UNVERIFIED |

Core score 9 / 10 (stage pending). Quarantined claims: 9 blocks. A credible detail page is possible with the USE blocks only; nothing has to be invented.

## Matrix
Legend: N name · O overview · P problem · S solution · Se sector · St stage · L location · T team · U link · A asset.

| # | Product | Class | Score | Available | Missing | Conflict flags | Risky claims quarantined | Asset | Source |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1Hub - Smart Campus Solution | DETAIL_READY | 9/10 | N O P S Se L T U A | St | NAME_VARIANT ("Smart Campus" detail r3 vs library r2); STAGE_CONFLICT (detail D "đang triển khai thử nghiệm…" vs library "Growth"); SECTOR_VARIANT (detail "SaaS" vs library "Công nghệ giáo dục"; PO lock = Giáo dục); MARKET_INTERNAL_CONTRADICTION (P) | 9 (see above) | YES (bound) | Sản phẩm chi tiết r3 + Thư viện sản phẩm r2 |
| 2 | Centauri Labs | CARD_ONLY | 5/10 | N O Se St A | P S L T U | — | — | YES (bound) | Thư viện sản phẩm r12 |
| 3 | Databuckets | CARD_ONLY | 5/10 | N O Se St A | P S L T U | — | — | YES (bound) | Thư viện sản phẩm r10 |
| 4 | ParkWave | CARD_ONLY | 5/10 | N O Se St A | P S L T U | — | — | YES (bound) | Thư viện sản phẩm r7,87 |
| 5 | SOLEMATE | CARD_ONLY | 5/10 | N O Se St A | P S L T U | — | — | YES (bound) | Thư viện sản phẩm r8,88 |
| 6 | Inverted Lambda | CARD_ONLY | 5/10 | N O Se St A | P S L T U | DESC_TRUNCATED_IN_SOURCE | — | YES (bound) | Thư viện sản phẩm r11 |
| 7 | 1ManBiz | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r32,81 |
| 8 | AIRFI | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r168 |
| 9 | AiSee | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r127 |
| 10 | AIVOS Vision Virtual Assistant | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r27,76 |
| 11 | Align Health | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r59,112 |
| 12 | APPTHUETHO | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r154 |
| 13 | AquaNexus | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r132 |
| 14 | Argo | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r138 |
| 15 | Auto FarmChain | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r170 |
| 16 | BA3 | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r18 |
| 17 | Banana Leather | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r72,124 |
| 18 | Bandly - WiFiShare | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r166 |
| 19 | BioFi Frontier | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r162 |
| 20 | Bloom | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r43,95 |
| 21 | BrandFlow | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r136 |
| 22 | CADUCEUS | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r64,116 |
| 23 | Career Up | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r68,120 |
| 24 | CarePath | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r140 |
| 25 | Cat Speak | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r153 |
| 26 | CC - AI Rabbit as super-companion for Autism | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r28,77 |
| 27 | Cenergy | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r62,103 |
| 28 | CERTCHAIN | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r158 |
| 29 | CoPlay | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r33,82 |
| 30 | Dancemilling – Robot Development Kit | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r66,118 |
| 31 | Debatium | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r137 |
| 32 | dRobot - a hi-tech petdog | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r38,90 |
| 33 | ECO LEATHER - Công nghệ tạo da giả từ Cellulose | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r63,115 |
| 34 | EnerTrade | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r19 |
| 35 | Finsey | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r26,75 |
| 36 | Finwit | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r40,92 |
| 37 | FITA | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r126 |
| 38 | Fruitcare AI | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r167 |
| 39 | GCC - Bệ phóng Startup xanh | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r41,93 |
| 40 | KCash | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r134 |
| 41 | KOLA | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r139 |
| 42 | LeoFi | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r42,94 |
| 43 | LifeTrack | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r37,86 |
| 44 | LinguaSphere | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r133 |
| 45 | Lover | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r61,114 |
| 46 | M-Carbon | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r163 |
| 47 | MailGuard | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r129 |
| 48 | Markat | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r35,84 |
| 49 | MEDLEDGER | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r159 |
| 50 | MedViet AI | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r143 |
| 51 | MiQuant | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r17 |
| 52 | Nature Voice | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r20 |
| 53 | Nền tảng 'Thuê chuyên gia' theo giờ | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r156 |
| 54 | Nền tảng dMRV On-chain | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r161 |
| 55 | OMILEARN | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r45,97 |
| 56 | OpenADAS | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r135 |
| 57 | OPENSENS VELO | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r51,104 |
| 58 | Peannut.studio | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r130 |
| 59 | PennyWorth | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r73,125 |
| 60 | Pitcam | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r30,79 |
| 61 | Praxis Labs | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r142 |
| 62 | S2M - DA TỪ VỎ XOÀI | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r65,117 |
| 63 | SATY RICE FARM | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r67,119 |
| 64 | SMARTKET | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r155 |
| 65 | SoftHerb Gel | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r171 |
| 66 | TIKERA | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r70,122 |
| 67 | VeriChainIDS | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r160 |
| 68 | VietGarden | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r131 |
| 69 | VietSoil | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r34,83 |
| 70 | VIETSOUL | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r172 |
| 71 | Vietspace - GEOCLEAR 3D | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r165 |
| 72 | WeaveCarbon | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r164 |
| 73 | Website AI | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r15 |
| 74 | WEEUP | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r157 |
| 75 | WINDOU | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r39,91 |
| 76 | WiSe | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r71,123 |
| 77 | ZestAroma | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r52,105 |
| 78 | Zion-HUB | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r141 |
| 79 | ZPATH | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r128 |
| 80 | Ứng dụng Blockchain rau củ Organic SME | CARD_ONLY | 4/10 | N O Se St | P S L T U A | — | — | NO (initials) | Thư viện sản phẩm r169 |
| 81 | BunnyWallet | CARD_ONLY | 4/10 | N O Se St | P S L T U A | DESC_TRUNCATED_IN_SOURCE | — | NO (initials) | Thư viện sản phẩm r36,85 |
| 82 | Calmio | CARD_ONLY | 4/10 | N O Se St | P S L T U A | DESC_DIFFERS_ACROSS_DUP_ROWS; STAGE_DIFFERS_ACROSS_DUP_ROWS | — | NO (initials) | Thư viện sản phẩm r54,107 |
| 83 | Drippy | CARD_ONLY | 4/10 | N O St A | P S Se L T U | SECTOR_UNMAPPED_P0 (PO) | — | YES (bound) | Thư viện sản phẩm r5 |
| 84 | E-Motion | CARD_ONLY | 4/10 | N O Se St | P S L T U A | STAGE_DIFFERS_ACROSS_DUP_ROWS | — | NO (initials) | Thư viện sản phẩm r55,108 |
| 85 | EcoSmart | CARD_ONLY | 4/10 | N O Se St | P S L T U A | SECTOR_DIFFERS_ACROSS_DUP_ROWS | — | NO (initials) | Thư viện sản phẩm r44,96 |
| 86 | GypFoam | CARD_ONLY | 4/10 | N O Se St | P S L T U A | DESC_DIFFERS_ACROSS_DUP_ROWS | — | NO (initials) | Thư viện sản phẩm r46,98 |
| 87 | Knack | CARD_ONLY | 4/10 | N O Se St | P S L T U A | DESC_DIFFERS_ACROSS_DUP_ROWS | — | NO (initials) | Thư viện sản phẩm r47,99 |
| 88 | NatLife | CARD_ONLY | 4/10 | N O Se St | P S L T U A | DESC_DIFFERS_ACROSS_DUP_ROWS | — | NO (initials) | Thư viện sản phẩm r48,100 |
| 89 | PURE ALGAE | CARD_ONLY | 4/10 | N O Se St | P S L T U A | DESC_DIFFERS_ACROSS_DUP_ROWS | — | NO (initials) | Thư viện sản phẩm r50,102 |
| 90 | Spine | CARD_ONLY | 4/10 | N O Se St | P S L T U A | DESC_TRUNCATED_IN_SOURCE | — | NO (initials) | Thư viện sản phẩm r89 |
| 91 | Travie | CARD_ONLY | 4/10 | N O Se St | P S L T U A | DESC_TRUNCATED_IN_SOURCE | — | NO (initials) | Thư viện sản phẩm r60,113 |
| 92 | VentDx | CARD_ONLY | 4/10 | N O Se St | P S L T U A | DESC_TRUNCATED_IN_SOURCE | — | NO (initials) | Thư viện sản phẩm r23 |

## Top implementation candidates
| Rank | Product | Class | Why | Next step |
|---|---|---|---|---|
| 1 | 1Hub - Smart Campus Solution | DETAIL_READY | only product with a detail row; all narrative blocks + team + link + logo | build with USE blocks; PO picks the stage; 9 claim blocks stay hidden |
| 2 | ParkWave | CARD_ONLY | logo bound, no conflict | needs a "Sản phẩm chi tiết" row |
| 3 | SOLEMATE | CARD_ONLY | logo bound, no conflict | needs a detail row |
| 4 | Databuckets | CARD_ONLY | logo bound, no conflict | needs a detail row |
| 5 | Centauri Labs | CARD_ONLY | logo bound, no conflict | needs a detail row |
| 6 | Inverted Lambda | CARD_ONLY | logo bound; description truncated in source | needs a detail row + full description |
| 7 | Drippy | CARD_ONLY | logo bound; sector unmapped by PO decision | needs a detail row; sector stays empty |
| 8 | Bloom | CARD_ONLY | sector mapped (Giáo dục), no conflict, no logo | needs a detail row + logo |
| 9 | Debatium | CARD_ONLY | sector mapped (Giáo dục), no conflict, no logo | needs a detail row + logo |
| 10 | LinguaSphere | CARD_ONLY | sector mapped (Giáo dục), no conflict, no logo | needs a detail row + logo |

Ranks 2–10 are the order to request detail rows in, not pages to build now. Just outside the safe population, HubLock, Pictor Network, UCTalent, PSI 69, AIDIA and CarOn have source logos but stay excluded upstream (stage alias pending PO / unverified claim) — a PO stage-alias decision would make them the next logo-ready group.

## High risk or conflict
- Smart Campus: 9 quarantined claim blocks (incl. self-declared simulated funding), stage conflict, internal market contradiction, name variant.
- Duplicate-content conflicts (pack kept one row): Calmio, E-Motion, EcoSmart, GypFoam, Knack, NatLife, PURE ALGAE.
- Descriptions truncated in the source: BunnyWallet, Inverted Lambda, Spine, Travie, VentDx.

## Related
- [v2 patch manifest](../demo-content/sprint1-v2/v2-patch-manifest.md) · [featured product approval](../demo-content/sprint1-v2/04-featured-product-approval.md) · [final acceptance](../acceptance/final-0710/FINAL_ACCEPTANCE_REPORT.md)
