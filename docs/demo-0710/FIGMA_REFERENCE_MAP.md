# Figma reference map — 07/10 demo

Part of [DEMO_SOT_v1](DEMO_SOT_v1.md). The source is the PO pack `hub New Design 7:10` (14 PNG, 06/10/2026). The files are byte-identical copies in `design-reference/final/demo-0710/`. They are added beside the existing baselines and overwrite none.

## Pixel references (H)
| ID | Baseline file | Source file | Size | SHA-256 |
|---|---|---|---|---|
| DM01 | `DM01__homepage-v2__SOURCE.png` | `1. homepage.png` | 1440×4661 | `9b06532151f81fa285b1f9195177db928496272b3088c0a26c1ffc53d5c6ba3e` |
| DM02 | `DM02__about-hub-v2__SOURCE.png` | `2. about-1.png` | 1440×8350 | `e2cc09b221332f89bab32a0cac7ec89e31ba3c4eb93da6122975039510b1c4a0` |
| DM03 | `DM03__about-hub-popup__SOURCE.png` | `3. thẻ HUB.png` | 1440×1100 | `629d1098a83dc22b7f792001e3b2191537edc42aac3ff52a231096ced2ffc5e8` |
| DM04 | `DM04__about-humans-khu-vuc__SOURCE.png` | `4. ABT1 · trạng thái · Humans of HUB — tab HUB Khu vực (…).png` | 1440×1899 | `180e2f89e1abe1d3e8527c36f1e57e826f2dedfa1688afc88b0395ba65b3b3a8` |
| DM05 | `DM05__about-humans-clb__SOURCE.png` | `5. ABT1 · trạng thái · Humans of HUB — tab Câu lạc bộ.png` | 1440×1139 | `e3c887785569f58aabba03886c7f4de37b2a7e597b690de3a8194ae5d4edf0db` |
| DM06 | `DM06__programme-directory__SOURCE.png` | `6. DIR2.1 · Chương trình, cuộc thi.png` | 1440×1953 | `aa555e5c68a965ec1d8e8c6af60ee51ac0166bb70be8431edaa78131560da20f` |
| DM07 | `DM07__event-directory__SOURCE.png` | `9. DIR2.2 - Sự kiện.png` | 1440×2042 | `2ca431697ab0ede6631b7b4913da4ada8ec685ba1868063a5408f0a12f9c41c6` |
| DM08 | `DM08__product-directory__SOURCE.png` | `7. DIR3 - SẢN PHẨM.png` | 1440×2414 | `faeb2e8d6ea9cd830ede3ab1442a25d9e5f86fddacf569ba052359e1c61e099a` |
| DM09 | `DM09__talent-directory__SOURCE.png` | `8. DIR4 - NHÂN TÀI.png` | 1440×2364 | `2405dc38035225902133ca4b6af63e9ece5f10f2ec55fa186a9badca7ecb3337` |
| DM10 | `DM10__startup-overview__SOURCE.png` | `10. SP1 hồ sơ sản phẩm.png` | 1440×2085 | `afe42c3e7a18ff4410b46f2a87de790f6fda344de9c2ee9ab722e155bc467656` |
| DM11 | `DM11__startup-metrics__SOURCE.png` | `11. Sp2.png` | 1440×1493 | `ee4f6dde0750c907b37e19cdbed4813b1c638f12523a8386a0433279a28dd47b` |
| DM12 | `DM12__startup-updates__SOURCE.png` | `12. Tab cập nhật.png` | 1440×1489 | `bbef05d8d8a9315b2826424a460ec46607b18ab553e01637f373cb0b83dd55d1` |
| DM13 | `DM13__founder-profile__SOURCE.png` | `14. NT1 - Nhân tài - Chi tiết hồ sơ cá nhân.png` | 1440×3142 | `fac7899a7c339d496ab702b8163d778c812a05a3037f1023f1d0e9b1b35c474e` |

Not copied: `13. SP Tab chỉ số.png`. It is byte-identical to file 12 and shows the Cập nhật tab, so the "updated" Chỉ số frame is missing. DM11 uses `11. Sp2.png` (an earlier export that does show the Chỉ số tab) as a **provisional** reference until the PO supplies the updated frame.

## Pixel QA rules (H)
| Rule | Value |
|---|---|
| Viewport | 1440 wide, DPR 1. Long pages are captured full-page at the source height and never squashed into 900 |
| Comparison | per-block anchors (the DEC-H1-D5 method): diff outside text < 1.5 % and beyond a ±2 px shift < 2 % per block |
| Text | text that comes from demo or catalogue data (counts, names, CLB lists, stage labels) is INTENTIONAL-DATA when it differs from the drawn placeholder; layout, type and colour still count |
| States | DM03 opens the HUB Đà Nẵng popup; DM04 / DM05 select their tab with HUB Đà Nẵng chosen in DM04; DM11 / DM12 load their route |
| Header | DM10–DM13 compare signed in (as drawn); the guest variant is checked functionally |
| Baselines | never overwritten; a new PO frame is added as a new file and recorded here |

## Responsive targets (G)
| Width | Bar |
|---|---|
| 1440 | pixel QA against DMxx |
| 768 | no reference: no horizontal overflow, nav collapses to the existing public mobile disclosure, grids 3→2 columns, filter rail stacks above the results, every CTA reachable |
| 390 | no reference: one column, the same containment and pointer checks as IA-P2-03 (each control's first line box centre is hittable), popup becomes a full-height sheet |

## Missing design states (I)
| Screen | Missing |
|---|---|
| all | 768 / 390 frames; open dropdowns "Giới thiệu ▾" and "Chương trình ▾"; EN copy |
| DM01 | hero video asset and poster (the image shows only a gradient and "VIDEO · CHƯƠNG TRÌNH" with a pause control) |
| DM02 | map asset with HUB coordinates; the Vietnam view must show Hoàng Sa and Trường Sa; the "Xem thêm" full HUB / Chapter / CLB list; real partner logos (drawn as "Doanh nghiệp A…") |
| DM08 | empty result, loading and error states; the open "Sắp xếp" menu |
| DM10–12 | guest header variant (derivable); empty Chỉ số / Cập nhật states for a startup without data; the "Xem vị trí tuyển dụng" overlay |
| DM11 | the updated Chỉ số frame (see above) |
| DM13 | a pure public-viewer frame: the drawn frame mixes owner controls ("+ Tạo sản phẩm") with the public view |

## Related
- [DEMO_SOT_v1](DEMO_SOT_v1.md) · [SCREEN_ROUTE_MAP](SCREEN_ROUTE_MAP.md)
- [Revision baselines](../../design-reference/final/revision/README.md)
