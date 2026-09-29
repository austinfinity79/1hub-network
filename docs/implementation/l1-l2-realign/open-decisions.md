# Open Decisions

Points where the workbook, the boards and the approved rules do not give one answer. Nothing is invented: each point has a contained default that keeps the safe flows working. "HD" is the earlier register in [05](../../design-revision/05_BUSINESS_API_DATA_CONFLICT_MATRIX.md).

## PO answers of 2026-09-29
| ID | Answer |
|---|---|
| D-L1 | one required confirmation in stage 4 (ACC-09), with links to both documents; activation needs both versioned consents |
| D-P1 | FP1-OWN draws only sections that have data; FP1 for other viewers is not built. FP1-OWN is scheduled with L2 |
| D-T1 | link invitation drawn, inert until its rules are defined; e-mail invitation works |
| D-N1 | country vocabulary holds Việt Nam only for now |
| D-G1 | no OAuth client available: control drawn as in the board, pressing it explains that Google sign-in is not enabled |
| D-C1 | the frozen 10 completion groups stay |
| D-F1 | "Góp ý" pill drawn, inert with a reason |
| Delivery | L1 first (open sign-up, four-stage onboarding, tests, pixel), commit, report, stop for PO review; L2 follows in the next run |

Still open, contained by their defaults: D-S1, D-H1, D-V1, D-V2, D-T2, D-E1, D-A1.

## Human business decision required
| ID | Question | Sources | Contained default |
|---|---|---|---|
| D-L1 (HD-03) | Where is the acceptance of Terms and Privacy recorded? | Boards: no acceptance control; ACC-09 note says the visibility switch replaces the old privacy screen. Approved legal text A2.2–A2.3: requesting a link is not acceptance; after sign-in the user confirms actively. Hard rule: consent is versioned and separate from visibility | activation still needs both consents; one required confirmation stays in stage 4 |
| D-N1 | Which countries does "Quốc gia/Khu vực" offer, and what is "Tỉnh/Thành phố" outside Việt Nam? | Board: both required, province list depends on the country. Schema: REGION vocabulary only | country vocabulary with Việt Nam only; provinces from REGION |
| D-H1 | Who verifies a HUB position, and by which steps? | Workbook rows 58, 69: "tự khai / chờ xác minh". ACC-08: "quản trị viên hoặc đơn vị liên quan xác nhận". No verification flow is specified | the named unit gets an ordinary membership request, `PENDING_APPROVAL` / `SELF_DECLARED`; the stated position is display text and is confirmed by nothing; no permission follows |
| D-S1 | Items of "Chuyên môn" and whether skills may be free text | Board: six sample specialisations, a tag input with "Gợi ý chuẩn". Hard rule: SKILL uses controlled vocabulary IDs | new controlled type; skills picked from the SKILL vocabulary, no free text |
| D-C1 | Profile completion groups | Board: 75 % with "ảnh, website, số điện thoại" missing. Data SOT: frozen 10 groups, two of them (goal, need) are no longer asked | frozen 10 groups stay; the percentage differs from the sample |
| D-P1 (HD-05, HD-08) | FP1-OWN sections without a data source: member badges, activity counts, "Ai đang xem hồ sơ", "Dự án trên HUB", "Tiến trình phát triển", public URL, "Xem như Guest", "Mở với" | Workbook row 86 names activity and achievements; features ACC-05, ENT-07 are P1 and belong to WF-07 | sections with data are drawn (identity, introduction, experience, education, specialisation, ventures); the others are left out; FP1 for other viewers is not built |
| D-V1 | When is a venture public? | Workbook row 92 "đủ điều kiện"; rules B4 "hoàn thiện thông tin tối thiểu / xuất bản"; PRJ3 "gửi duyệt" through an admin screen | every venture stays DRAFT and private; no publish action |
| D-V2 | The 48 fields behind "Hồ sơ 6/48 trường" | PRJ3, ME7 only | the count is not shown |
| D-T1 (HD-06) | Link invitation: who may join, with which role and permission, expiry, revocation | Workbook row 90 "email/link"; PRJ2 shows one link and a copy button | link row drawn, inert; e-mail invitation works |
| D-T2 | Permission levels against rule BR-ENT-06 ("mọi Startup Member đang hiệu lực cùng quản lý dữ liệu shared") | PRJ2 "Ba mức quyền" and workbook row 90 define levels | the three levels of the board; the rule is read as "members with Biên tập" |
| D-F1 (HD-11) | What "Góp ý" opens | Workbook rows 63, 93; the pill is on every frame; no dialog frame exists | pill drawn, inert with a reason |
| D-E1 | Text of the invitation e-mail | no mail frame (the boards name MAIL1 only) | short transactional text built from the board's own sentence |

## External configuration blocker
| ID | Item | State | Effect |
|---|---|---|---|
| D-G1 | Google OAuth client (ID, secret, consent screen, redirect URI for `1hubnetwork.io.vn`) | none in the repository or the server environment | Google control is drawn, no sign-in happens; e-mail sign-in is complete |
| D-A1 (HD-A1) | AI provider, key, data-processing terms for CV content | none | AI blocks are drawn, their action is inert; manual entry is complete; no suggestion record is written |

## Related
- [overview.md](overview.md) · [l1-delta-matrix.md](l1-delta-matrix.md) · [l2-delta-matrix.md](l2-delta-matrix.md)
