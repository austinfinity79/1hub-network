# ADMIN-PROD-08-pixel-responsive

**Evidence 2–5: baseline authority, pixel matrix, responsive matrix, layout safety, confirmation states.** Parent: [ADMIN-PROD-08-closure.md](ADMIN-PROD-08-closure.md).

## 2. Baseline authority
PO-approved ADMIN-DESIGN-01 pack (candidate commit `0bccca3`) promoted byte-identically to [`design-reference/final/ADMIN/`](../../../design-reference/final/ADMIN/README.md) (82 frames, `SHA256SUMS` equal to the candidate files at `0bccca3`); the candidate folder stays as the approval record; `final/manifest.yaml` (M0-T11 harness) unchanged — the frames are read by their own spec, like `final/revision/`. 1440 = primary baseline, 1024 / 768 = responsive references, 390 = KNOWN_DEBT smoke.

## 3. Pixel matrix (fresh DB, capture spec → `admin-prod-08-pixel.spec.ts`, pixelmatch 0.1; cell = class (differing pixels))
| Screen | State | 1440x900 | 1440 full | 1024 full | 768 full | 390 full |
|---|---|---|---|---|---|---|
| ADMIN-HOME | default | MATCH (0) | MATCH (0) | MATCH (0) | MATCH (0) | KNOWN_DEBT (0) |
| ADMIN-VERIFICATION | queue | MATCH (0) | MATCH (0) | MATCH (0) | MATCH (0) | KNOWN_DEBT (0) |
| ADMIN-VERIFICATION-DETAIL | detail | MATCH (0) | MATCH (0) | MATCH (0) | MATCH (0) | KNOWN_DEBT (0) |
| ADMIN-VENTURES | queue | MATCH (0) | MATCH (0) | MATCH (0) | MATCH (0) | KNOWN_DEBT (0) |
| ADMIN-VENTURE-DETAIL | detail | MATCH (0) | MATCH (0) | MATCH (0) | MATCH (0) | KNOWN_DEBT (0) |
| ADMIN-ACCESS | list | MATCH (0) | MATCH (0) | MATCH (0) | MATCH (0) | KNOWN_DEBT (0) |
| ADMIN-ACCESS-MANAGER | detail | MATCH (0) | MATCH (0) | MATCH (0) | MATCH (0) | KNOWN_DEBT (0) |
| ADMIN-FEEDBACK | queue | MATCH (0) | MATCH (0) | MATCH (0) | MATCH (0) | KNOWN_DEBT (0) |
| ADMIN-FEEDBACK-DETAIL | detail | MATCH (0) | MATCH (0) | MATCH (0) | MATCH (0) | KNOWN_DEBT (0) |
| ADMIN-CATEGORIES | list | MATCH (0) | MATCH (0) | MATCH (0) | MATCH (0) | KNOWN_DEBT (0) |
| ADMIN-ACCOUNTS | queue | MATCH (0) | MATCH (0) | MATCH (0) | MATCH (0) | KNOWN_DEBT (0) |
| ADMIN-ACCOUNT-REQUEST-DETAIL | detail | MATCH (0) | MATCH (0) | MATCH (0) | MATCH (0) | KNOWN_DEBT (0) |
| ADMIN-VERIFICATION · ADMIN-VENTURE · ADMIN-ACCESS-MANAGER · ADMIN-ACCOUNT-REQUEST | confirm (×4) | MATCH (0) ×4 | MATCH (0) ×4 | — | — | — |
| ADMIN-VERIFICATION | loading | MATCH (0) | MATCH (0) | — | — | — |
| ADMIN-ACCOUNTS | empty | MATCH (0) | MATCH (0) | — | — | — |
| ADMIN-FEEDBACK | error · weekly-summary | MATCH (0) ×2 | MATCH (0) ×2 | — | — | — |
| ADMIN-FEEDBACK-DETAIL | not-found | MATCH (0) | MATCH (0) | — | — | — |
| ADMIN-ACCESS-MANAGER | denied | MATCH (0) | MATCH (0) | — | — | — |
| ADMIN-HOME | leader | MATCH (0) | MATCH (0) | — | — | — |

Totals: **70 MATCH · 0 MINOR · 0 STRUCTURAL_APPROVED · 0 REGRESSION · 12 KNOWN_DEBT** (the 390 frames also differ by 0 pixels). **REAL_VISUAL_REGRESSION = 0.** No application code changed after the baseline commit.

## 4. Responsive + layout safety (`admin-prod-08-layout.spec.ts`, 12 screens × 1440 / 1024 / 768)
| Width | Result | Class |
|---|---|---|
| 1440 | clean: no page overflow, clipped header / label / button / chip, covered or unreachable control, collapsed / misaligned column, field outside its card | MATCH |
| 1024 | clean (same checks) | MATCH |
| 768 | clean; wide tables scroll inside their card | ACCEPTABLE_DESKTOP_FIRST |
| 390 | no page overflow (PROD-07 spec); 174 px column beside the 216 px sidebar | KNOWN_DEBT — PRE_EXISTING_OPSSHELL_DEBT |

The detector is proven, not assumed: re-creating the two ADMIN-DESIGN-01 defects in the live page (grant table without column tracks; feedback status column at 3rem) is flagged (6 and 1 findings); the clean pages report none.

## 5. Confirmation states (keyboard)
| State | Focus on open | Reason | Cancel | Executed by opening / cancelling |
|---|---|---|---|---|
| Verification reject | reason field | optional | closes, Từ chối back | no (PENDING) |
| Venture reject | reason field | optional | closes | no (PENDING) |
| Delegation revoke | Huỷ (Enter cancels) | — | closes, Thu hồi back | no (grants intact) |
| Account deletion-request reject | reason field | required: submit disabled empty / blank, enabled with text | closes | no (PENDING) |

Button clarity: destructive confirm = danger button with the action's own verb; secondary = Huỷ; no layout finding inside any open form.

## Related
- [ADMIN-PROD-08-closure.md](ADMIN-PROD-08-closure.md) · [ADMIN-PROD-08-readiness.md](ADMIN-PROD-08-readiness.md) · [ADMIN-DESIGN-01-visual-baseline.md](ADMIN-DESIGN-01-visual-baseline.md)
