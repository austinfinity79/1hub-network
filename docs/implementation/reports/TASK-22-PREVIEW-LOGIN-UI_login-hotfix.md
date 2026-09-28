# TASK-22-PREVIEW-LOGIN-UI Login Hotfix

**TASK 22-PREVIEW-LOGIN-UI — L1 login UI hotfix: DONE.** UI only; auth behaviour unchanged. Decision: [DEC-L1-D9](../../decisions/DECISION_LOG.md#dec-l1-d9).

## Precheck and PO choice
| Item | Finding |
|---|---|
| Route / files | `/auth` → `src/app/(auth)/auth/page.tsx` (AuthSplitLayout) + `auth-entry-form.tsx` + `auth-entry.module.css`; shared `AuthCard`, `Field`, `TextInput`, `Button` untouched |
| Reference | `design-reference/final/revision/L1/AUTH1__auth-entry__SOURCE.png` (sha `2c453178…`): **split layout** (brand panel + card); the card has "Tiếp tục với Google", the "hoặc tiếp tục bằng email" divider, Email, "Gửi liên kết đăng nhập" and no terms notice |
| Conflict | The task described a single centred card without the panel; the only approved asset draws the panel (the Desktop screenshot `12.00.29` is the AUTH1 card cropped). Asked instead of guessing |
| PO answers (2026-09-28) | Keep the AUTH1 split layout · show the Google control disabled with a visible "Sắp có" · keep the terms notice (DEC-L1-D3) |

## Change
- Card: the drawn Google control (50 px, 1 px `#b9aeae`, radius 8, coral 11.5 px / 600 "G", 15 px / 500 label) and the divider (12 px, `#edeaea` rules, 15 px gaps) between the title and the form, at AUTH1 geometry (±1 px).
- The control is `<button disabled>` with no handler, `aria-label` "Tiếp tục với Google (sắp có)" and a "Sắp có" pill (right edge; inline below 480 px so it never covers the label). No provider request, no fake flow.
- Unchanged: request / idempotency / validation / loading / error handling in `onSubmit`, magic link, callback, session, redirect, guards, providers API (`[]`).
- Spec: WF01-S01 asserts the disabled control, the pill, the divider, and that a forced click sends no request; pixel audit gains `card-google`, `card-google-right-edge`, `card-divider`.

## QA
| Gate | Result |
|---|---|
| Pixel 1440 DPR1 vs AUTH1 | Structural / Major / Component 0; 8 segments, max 1.10 % outside text, 1.12 % beyond ±2 px; typography 0 violations. P3: AUTH1 draws the control's top / bottom edges on a half pixel (interior compared) |
| Responsive | 1440 / 1024 / 768 / 390: 0 overflow, card and controls fully visible, pill inline at 390 |
| Regression (final build) | **219 passed / 0 failed**: WF01 153 (S01 13 incl. the new control test), P0-SHELL 14, P0-LANDING 10, auth-session 13, authz-session 8, SEC-OBS 3, console-health 4, Internal Alpha release 7, WF02 smoke 7 |
| Build | format, lint, typecheck PASS; unit 237 / 237; production build PASS |
| Runtime | #418 = 0; 0 console errors on `/auth` at four widths; 0 5xx |

## Git
| Field | Value |
|---|---|
| OLD APP PREVIEW SHA | `cc6ca287a3d549b579ff8c5b6c7f9edd637c03e1` |
| NEW APP PREVIEW SHA | `33f8b0c2c2cb7b78ce7d6b8979def4d7660025bd` (local tag `internal-alpha-preview-02`) |
| ROLLBACK SHA | `cc6ca287a3d549b579ff8c5b6c7f9edd637c03e1` (deployed now; schema-safe) |
| REPORT / DOCS SHA | the commit that contains this report |

Branch `main`; start HEAD `701a896`, checked again before each commit. Push **NOT RUN**; nothing deployed.

## Related
- [../INTERNAL_ALPHA_PREVIEW_RELEASE.md](../INTERNAL_ALPHA_PREVIEW_RELEASE.md) · [TASK-22-PREVIEW-01_preview-release.md](TASK-22-PREVIEW-01_preview-release.md)
