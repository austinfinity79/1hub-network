# Corrected Source Manifest

TASK 21 v2 — design revision audit of the **corrected** Homepage + L1–L6 set. Audited 2026-09-28 against deployed release `9c614585ca61fe2e4c957f28d7cc5c78fafe7bc0`. **Docs only:** runtime, DB, API and RBAC changes are 0. `design-reference/final` is untouched; a revision frame becomes a pixel baseline only after the PO approves this audit.

## Source identity (frozen)
The corrected ZIPs are the only source. The prompt names them `Homepage(1).zip` … `L6(1).zip`; no file with those names exists on this machine. The corrected set was delivered by **overwriting** the files in `~/Desktop/hubnetwork-new/` under their plain names (L1–L6 re-dated 2026-09-28 01:34–01:39). Identity is therefore frozen by content hash, and the content matches the prompt's inventory exactly: **64 files**, same screen codes.

| ZIP | Bytes | Modified | SHA-256 | Assets (expected) |
|---|---|---|---|---|
| `Homepage.zip` | 2 653 130 | 2026-09-27 00:10 | `31d6e5cc099255682738ec617b68c3884620ed38e8801675c0dba87acef0ae35` | 1 (1) ✓ |
| `L1.zip` | 2 964 556 | 2026-09-28 01:34 | `c1049e5c972c797bf584cf1b003f3d3d508e58b9856345dc7bf1a7d0ceba4467` | 13 (13) ✓ |
| `L2.zip` | 3 891 784 | 2026-09-28 01:37 | `6fee10fb186e3cf86c1a287060025c08368034ad5fa9d124ded106c55e2904b9` | 13 (13) ✓ |
| `L3.zip` | 2 601 741 | 2026-09-28 01:37 | `180908cd92b6d37e8528f01b5eef49f9f70a7283ae50f50425a56ba85db3623c` | 9 (9) ✓ |
| `L4.zip` | 8 379 934 | 2026-09-28 01:38 | `7b9024de95c0d79c5c2cd8d6806e5dfeff5c3e893deeb5022d0b2e70492557c1` | 9 (9) ✓ |
| `L5.zip` | 1 613 740 | 2026-09-28 01:38 | `60283b014ca1d6a350ddc046cd7ded21bc17be271f5f1f4864d97f93e3b76e34` | 10 (10) ✓ |
| `L6.zip` | 4 669 857 | 2026-09-28 01:39 | `0a2c91f828fe7677d94aefa9fac1c9559ea58392675dcc1c66222f62ef82fc56` | 9 (9) ✓ |
| **Total** | | | | **64 (64) ✓** |

If the PO holds different `(1)` files, compare them against these hashes before Task 22.

## Relation to the superseded set
| Group | Corrected vs superseded |
|---|---|
| Homepage | ZIP byte-identical (the Homepage was not changed) |
| L2 (13), L5 (10) | ZIPs re-packed, but **every image is byte-identical** to the superseded images (SHA-256 per file) |
| L1, L3, L4, L6 | **New content.** L1 is Auth / Onboarding / My profile (not feedback); L3 / L4 / L6 are now full screens, not slices |

The superseded drafts are in [superseded/](superseded/README.md), marked **SUPERSEDED — DO NOT IMPLEMENT**, and nothing is merged from them. Every classification here was re-derived. For the 24 byte-identical images the content reading was re-used, because identical bytes prove identical content.

## Method and evidence
- Method: [AUDIT_METHODOLOGY.md](AUDIT_METHODOLOGY.md).
- Every image was read in full, with tall frames cropped in bands.
- The L1 auth frames were pixel-diffed against the approved WF01 references (`design-reference/final/WF01`).
- Current behaviour was checked in code, schema and SOT, and read-only on https://1hubnetwork.io.vn: guest `GET /` → 200 homepage; guest `/me`, `/onboarding/purpose`, `/ops/network` → 307 `/auth`.

## Result
| Item | Result |
|---|---|
| Assets | 64 = 62 screen frames + 2 annotations (L2 "Cầu nối · Luồng 2 ↔ Luồng 5", L5 "Lối vào khác · PRJ1") |
| Shared concepts | EV1 event detail (L18 + L47) · SP1 startup profile (L44, L45, L48–L51) · P1 problem detail (L29–L34) · ACC-06 step 1 (ACC-06, L06b, L06c) |
| Root `/` | Already the public homepage (DEC-P0-LANDING-D1); **no route correction**; presentation revision only |
| Buckets (62 frames) | **A 15** · **B 26** · **C 21** ([06](06_SCOPE_BUCKETS.md)) |
| Human decisions | **11** ([05](05_BUSINESS_API_DATA_CONFLICT_MATRIX.md)); Bucket A needs only the conservative defaults |

## Documents
[01 asset inventory](01_CORRECTED_ASSET_INVENTORY.md) · [02 screen inventory](02_SCREEN_INVENTORY.md) · [03 routes](03_ROUTE_DELTA_MATRIX.md) · [04 UI delta](04_UI_DELTA_MATRIX.md) · [05 business / API / data](05_BUSINESS_API_DATA_CONFLICT_MATRIX.md) · [06 buckets](06_SCOPE_BUCKETS.md) · [07 Task 22 plan](07_TASK22_IMPLEMENTATION_ORDER.md)

## Related
- [superseded/README.md](superseded/README.md) — withdrawn first audit
- [../design/00_DESIGN_PIXEL_SOT_FINAL_v1.0.md](../design/00_DESIGN_PIXEL_SOT_FINAL_v1.0.md) — current Design SOT
