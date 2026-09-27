# Audit Methodology

Generic method for a design-revision audit (TASK 21). It contains **no source-specific finding**. Everything drawn from the superseded Homepage / L1–L6 package is in [superseded/](superseded/README.md), each file marked **SUPERSEDED — DO NOT IMPLEMENT**. Applied by TASK 21 v2 to the corrected source set ([00_CORRECTED_SOURCE_MANIFEST.md](00_CORRECTED_SOURCE_MANIFEST.md)).

## Steps
| # | Step | How |
|---|---|---|
| 1 | Source verify | Locate every named ZIP; record path, size and SHA-256. If one is missing, STOP and report it. Never infer a missing screen |
| 2 | Extract safely | Decode legacy ZIP file names (cp437 → UTF-8, NFC); skip `__MACOSX` and `.DS_Store`; watch for "/" inside names creating folders. Crop tall images with PIL (the `sips --cropOffset` crops were wrong) |
| 3 | Asset inventory | Per file: source ZIP, name, size, content hash, class (FULL SCREEN / SLICE / SECTION / COMPONENT / ANNOTATION), screen, duplicate-of (by hash, across groups), confidence, notes. Slices are never counted as screens |
| 4 | Screen reconstruction | Stack slices by content continuity; pair sidebar and content halves; merge the same screen drawn in several groups; record referenced-but-missing frames |
| 5 | Current mapping | Per screen: route, page / component, shell, actor, auth, data source, API, workflow. No equivalent → NEW; never invent a route |
| 6 | Business delta | Compare against Business / Data SOT, API contract, RBAC and approved decisions. Separate UI-only from API / data / RBAC delta. A design never authorises new behaviour |
| 7 | UI delta | Shell, navigation, structure, section order, typography, spacing, colour (check tokens), components, forms, CTAs, badges, copy, responsive, states. Size by real change: XS–XL. **Typeface:** never assert a family from a visual impression. Render the candidate faces (with the Vietnamese subset) and compare ink masks with the frame (IoU after bbox fit) on ≥ 3 samples per group; record the scores |
| 8 | Routes | KEEP / CHANGE / ADD / REMOVE / FUTURE / CONFLICT; check the root `/` contract (public homepage, no forced `/auth`); classify every CTA |
| 9 | Decisions | Only true product decisions, each with options, a conservative default and whether it blocks implementation |
| 10 | Buckets | A approved UI revision · B business delta (PO) · C future / new scope; exactly one primary bucket per screen; subsets named explicitly |
| 11 | Plan | Implementation batches for Bucket A only, with regression and pixel scope; Test Pack impact |

## Vocabularies
- **Revision status:** UNCHANGED · VISUAL_ONLY · LAYOUT_CHANGE · COMPONENT_CHANGE · COPY_CHANGE · NAVIGATION_CHANGE · BUSINESS_DELTA · NEW_SCREEN · REMOVED_SCREEN · CONFLICT · FUTURE.
- **CTA:** ACTIVE_ROUTE · AUTH_REQUIRED_ROUTE · EXISTING_FEATURE · DEMO · FUTURE · NO_VALID_ROUTE · BUSINESS_DECISION_REQUIRED.

## Rules that stay in force
- Presentation precedence: revision > previous Design SOT > implementation. Behaviour precedence: SOT, contracts and decisions.
- `design-reference/final` changes only after the PO approves the audit.
- Docs only; runtime / DB / API / RBAC changes are 0.

## Related
- [../implementation/P0_STATUS.md](../implementation/P0_STATUS.md) — status
