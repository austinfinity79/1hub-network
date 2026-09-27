# Design Revision Overview

> **SUPERSEDED — DO NOT IMPLEMENT.** Unfinished TASK 21 draft (paused 2026-09-28), built from the Homepage / L1–L6 ZIPs that the designer / PO has since replaced with a corrected revision. Nothing in this file is approved or frozen, and it is not a Design Revision SOT. Do not use it for Task 22. The corrected package will be audited from scratch; only the generic method in [AUDIT_METHODOLOGY.md](../AUDIT_METHODOLOGY.md) carries over.

> **Invalidated (source correction 2026-09-28): the previous ZIPs were incorrect.** Do not carry over any of these: "L1 = feedback workflow"; the L1–L6 screen identities and counts (148 files / 110 unique / 36 screens, and the L3 / L4 / L6 screen lists); the classification of L6; the homepage CTA list; the buckets, decisions HD-01…HD-10 and the Task 22 order. Only the checks against the current product (root `/` is public per DEC-P0-LANDING-D1; current routes / SOT facts) remain true, and they must be re-verified against the corrected package.

TASK 21 — DESIGN REVISION AUDIT (Homepage + L1–L6), pre-implementation freeze. Audited 2026-09-28 against deployed release `9c614585ca61fe2e4c957f28d7cc5c78fafe7bc0` (the prompt's `…fa7ef7bc0` is a typo). **Docs only: no runtime, DB, API or RBAC change.** `design-reference/final` untouched: the revision becomes a pixel baseline only after the PO approves this audit and the approved subset is frozen.

## Sources (all 7 present)
| ZIP (`~/Desktop/hubnetwork-new/`) | Bytes | SHA-256 | Files | Unique |
|---|---|---|---|---|
| `Homepage.zip` | 2 653 130 | `31d6e5cc…ae35` | 1 | 1 |
| `L1.zip` | 176 770 | `7b993e98…e030` | 1 | 1 |
| `L2.zip` | 3 891 784 | `78a2b5a2…de84b` | 13 | 13 |
| `L3.zip` | 2 763 581 | `6cfb9f32…223c` | 33 | 26 |
| `L4.zip` | 7 981 241 | `13b4bded…b8d7` | 55 | 37 |
| `L5.zip` | 1 613 740 | `3ef81d01…d49e` | 10 | 10 |
| `L6.zip` | 4 708 080 | `c35fba1b…24bc` | 35 | 25 |
| **Total** | | | **148** | **110** |

Full hashes: [01_ASSET_INVENTORY.md](01_ASSET_INVENTORY.md). Vietnamese file names were decoded from the ZIPs' legacy encoding; one name contains "/", which becomes a folder when extracted.

## Precedence applied
Presentation: revision > previous Design SOT > current implementation. **Behaviour:** Business SOT, Data SOT, API contract, RBAC and approved decisions stay authoritative. The design alone authorises no new behaviour.

## Headline findings
| # | Finding |
|---|---|
| 1 | 148 files → **36 canonical screens**, plus 1 shared component (floating "Góp ý" button) and 3 annotation strips. 92 files are slices of long pages; 38 are exact duplicates |
| 2 | **Root `/` already satisfies the contract.** It is the public homepage for guests and signed-in users (DEC-P0-LANDING-D1; checked read-only on the domain). **No route correction**; the revision replaces its presentation (XL) |
| 3 | Palette matches `DESIGN_TOKENS_v1.0` (`#fc523c` primary, `#160002` burgundy, `#efefef` canvas). Typefaces cannot be proven from PNGs; they look consistent with Be Vietnam Pro / Archivo / IBM Plex Mono. Task 22 typography assertions confirm |
| 4 | The revision redraws only part of the current product. Redrawn with the same behaviour: homepage, project creation, settings, chapter public page, dashboard, members, events, 404 / 500. The **existing WF04 operator demo and the existing WF05 screens are not redrawn** |
| 5 | Most new frames depict **capabilities that do not exist**: feedback with attachments, notifications, event calendar / registration / waitlist, problem library, public programme / problem / startup pages, summit landing editor, qualifier scoring, email campaigns, leadership handover, organisation approval, a new application wizard and a collaboration room |
| 6 | **L5 conflicts with the accepted WF05 contract.** It creates a draft venture inside the submission flow, targets a problem instead of a programme, uses a fixed S1–S6 schema with uploads, allows editing after submission, and sends milestone emails |
| 7 | **L6 is not one workspace.** It holds a collaboration room (**NEW PRODUCT SCOPE → FUTURE**), a public startup profile and event page, two HUB admin screens (new) and 404 / 500 / maintenance pages |
| 8 | Mock data inside the designs contradict each other (dates, counts, prize amounts, domains). They are recorded, not resolved |

## Result
| Bucket | Screens | Meaning |
|---|---|---|
| **A** — approved UI revision / low risk | 10 | Existing behaviour, restyled. Several are subsets: design blocks with no behaviour behind them are left out |
| **B** — business delta, PO confirmation | 14 | New behaviour implied; not implemented until approved |
| **C** — future / new product scope | 12 | Outside Internal Alpha; not in Task 22 |

**Human decisions: 10** ([05](05_BUSINESS_DELTA_CONFLICT_MATRIX.md)). Bucket A is not blocked if the PO accepts the conservative defaults. Recommended: PO approves the audit and the defaults → TASK 22 implements Bucket A only.

## Documents
| File | Content |
|---|---|
| [01_ASSET_INVENTORY.md](01_ASSET_INVENTORY.md) + [assets/](assets/home-l1-l2.md) | Every file: screen, class, size, duplicate, confidence |
| [02_SCREEN_INVENTORY.md](02_SCREEN_INVENTORY.md) | 36 canonical screens, current mapping, revision status |
| [03_ROUTE_DELTA_MATRIX.md](03_ROUTE_DELTA_MATRIX.md) | Routes: keep / change / add / future / conflict; homepage CTAs |
| [04_UI_DELTA_MATRIX.md](04_UI_DELTA_MATRIX.md) | Current vs revision UI; impact XS–XL |
| [05_BUSINESS_DELTA_CONFLICT_MATRIX.md](05_BUSINESS_DELTA_CONFLICT_MATRIX.md) | Business deltas by group; human decisions |
| 06_SCOPE_BUCKETS.md (never written) | A / B / C per screen |
| 07_TASK22_IMPLEMENTATION_ORDER.md (never written) | Task 22 batches; Test Pack impact |

## Related
- [../../design/00_DESIGN_PIXEL_SOT_FINAL_v1.0.md](../../design/00_DESIGN_PIXEL_SOT_FINAL_v1.0.md) — current Design SOT
- [../../implementation/P0_STATUS.md](../../implementation/P0_STATUS.md) — status
