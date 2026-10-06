# DEMO-QA-01

Final demo QA, consolidated regression and the exact demo candidate freeze, on `feat/sprint1-completion`, starting from the product candidate `f309520`.

- Independent input: Claude B, `fda6c92` on `qa/demo-sync-0710`. It was read only, never merged.
- No migration. Not pushed, merged or deployed.

## P2 disposition (B findings, reproduced first)
| ID | Reproduced | Disposition | Fix (`58da5d1`) / residual |
|---|---|---|---|
| QA-B-04 About map < 1024 | Yes. Thế giới: HN, HCM, DN covered at 768 / 390. Việt Nam view at 390: HN, QN covered by the view switch. | **ACCEPTED_P2_DEMO_DEBT** (partly fixed) | Fixed: 12 px markers below 1024; on phones the view switch sits at the bottom. Every Việt Nam view marker is reachable at 1440 / 1023 / 768 / 390, and so is every overseas marker. Residual: in the Thế giới view the four domestic HUBs lie 1–5 px apart at every width, 1440 included, as DM02 draws them. Separating them needs a cluster design. The HUB chips under the map open each popup. |
| QA-B-05 team row cue | Yes. Hover underline only. | **FIXED** | Linked founder rows get a coral outline and a coral arrow badge on the avatar. This works on touch, and names are not truncated at 1440. |
| QA-B-06 390 polish | Yes. The placeholder (427 px text in a 339 / 322 px field) was cut at 768 / 390. "3 năm" wrapped. Bullets sat on the divider. | **FIXED** | Below 1024 the placeholder is "Tìm theo tên sản phẩm, lĩnh vực…", set after hydration, with ellipsis as fallback. Years never wrap. Experience rows keep a 12 px gap on phones. |

After the fixes, the targeted specs `demo-sp1-founder-01`, `demo-dir2-01` and `demo-home-about-01` ran 40 / 40.

## Full protected regression on `58da5d1`
Fresh `rm -rf .next` build. Guarded `reset` of the isolated `hubnetwork_s1uat03` (001 → 020, seed, catalogue). One `next start` server.

| Suite | Total | Pass | Fail | Skip | Flaky |
|---|---|---|---|---|---|
| Visual (99 specs, every spec incl. auth / security / privacy, WF01–WF06, admin, demo) | 1296 | 1267 | 0 | 29 | 0 |
| UAT technical L1–L2 (10 specs) | 19 | 19 | 0 | 0 | 0 |
| Unit (45 files) | 458 | 458 | 0 | 0 | 0 |
| DB (57 files) | 873 | 873 | 0 | 0 | 0 |
| **Total** | **2646** | **2617** | **0** | **29** | **0** |

The 29 skips are the existing conditional ones (pixel-qa screens, admin captures, wf06), unchanged from S1-UAT-03. Format, lint, typecheck and build all PASS. Server log: hydration 0 · 5xx 0 · invite secret 0 · 40-hex 0.

## Exact vertical demo QA (guest, prod server, 115 / 115)
| Check | Result |
|---|---|
| Journey | `/` → Sản phẩm → `/products` → Tracely "Xem hồ sơ" → Đặng Kim Chi → `/talents/dang-kim-chi` → Giới thiệu → `/about` → logo → `/` |
| Verified badge | "Đã xác thực danh tính qua 1Hub" with `data-demo="DEMO-0710"` |
| Refresh / history | Founder refresh works. Back ×5 and forward ×2 land on the expected routes. |
| Direct URLs | 5 / 5 return 200 |
| 404 | Profile UUID, zero UUID, non-founder member, unknown handle, unknown startup. The body holds no name or data; Next only echoes the requested path. |
| Verified only on approved founders | Kim Chi 1, Gia Bảo 1, Thanh Hà 0, Minh Anh 0. A PRIVATE founder is 404 (spec, in the regression). |
| Privacy | No `de710000-` id, `@example.test` address, `tel:` / `mailto:` link, contact card or owner-only control on the 5 surfaces |
| Responsive | 1440 / 768 / 390 × Home, About, Directory, Startup, Founder. No overflow, no dead link, no broken or distorted image. Primary CTA inside the viewport. Mobile nav opens. Directory filter narrows 3 → 2. Tabs fit. |
| Runtime | Console errors 0 · unexpected 5xx 0 · broken assets 0 |

## DB safety
- Only the isolated `hubnetwork_s1uat03` was reset or seeded.
- The shared `hubnetwork_p0` stays at 17 migrations with 0 demo rows.
- No migration file changed: the last is still 020.

## Deploy gate (outside this task)
- QA-B-02 (HIGH): the demo target and the demo-data policy there need PO approval before DEMO-DEPLOY-01.
- QA-B-01 (MEDIUM): `db.mjs demo` is MUTATING, so the shared / production refusal does not cover it. Unchanged; it is a deploy-safety item.

## Related
- [DEMO-SP1-FOUNDER-01](DEMO-SP1-FOUNDER-01.md) · [DEMO-DIR2-01](DEMO-DIR2-01.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
