# Claude Task Report

## 1. Task
- Task ID / name: WF01-S04-DECISION-FREEZE + WF01-S04 — Auth Errors (`/auth/error`)
- Status: **DONE**
- Mode: LOCAL REVIEW. Committed locally, not pushed. WF01-S05 not started.

## 2. Decisions
DEC-WF01-S04-D1..D8 are recorded in [DECISION_LOG.md](../decisions/DECISION_LOG.md). Each entry has Status, Date, Scope, Context, Decision, Rationale, Evidence, Impact and Supersedes, with stable anchors. **D1 supersedes DEC-WF01-S03-D3 in part:** S03 now routes `AUTH_ACCOUNT_BLOCKED` to `?reason=blocked`; everything else still goes to GENERIC with no reason.

## 3. States
| State | Result |
|---|---|
| BLOCKED | PASS. `?reason=blocked`, also reached from a real blocked account through S03. No date (D4), no invented email and no action element (D5) |
| SESSION_EXPIRED | PASS. `?reason=session_expired`; lifetime from `SESSION_TTL_SECONDS`; "Đăng nhập lại" → `/auth` (D8; no new global redirect) |
| GENERIC | PASS (functional/a11y). Missing, unknown or `generic` reason, and an invalid callback. Neutral copy |
| RATE_LIMITED | stays inline on S01/S02 (D3); a 429 never redirects |
| MAIL_DOMAIN_BLOCKED | not implemented (D7); `?reason=mail_blocked` → GENERIC |

## 4. Security
| Item | Evidence |
|---|---|
| Raw error leakage | Copy is static per state. No API code, message or request id is shown |
| Query allowlist | Own-property allowlist. `unknown`, `AUTH_ACCOUNT_BLOCKED`, `rate_limited`, `mail_blocked`, `__proto__`, `constructor` and a `<script>` payload all render GENERIC and never appear in the HTML. The page is **static** (`○`), so no query value, a stray `?token=` included, reaches server HTML |
| Enumeration | GENERIC names no account, link state, provider or internal reason (asserted). BLOCKED is reachable only after consuming a valid link, and `?reason=blocked` on its own identifies no account |
| Support contact | none invented (D5) |

## 5. Pixel QA
The board rows become one centred AuthCard (D6), so approved **components** are compared at their own positions (1440×900 DPR1, vi-VN, fonts ready). Excluded annotations: the board title, the four "Vì sao viết thế này" lines, R1 and R4.

| State | Result |
|---|---|
| BLOCKED | disc vs R2 disc: **1 px** outside text. PASS |
| SESSION_EXPIRED | disc: **1 px**; outline action vs R3 button, border and fill compared: **3 px**. PASS |
| GENERIC | **DESIGN-GAP-GENERIC.** No approved panel, so no strict pixel claim. Typography, centring and card geometry sanity pass; manual PO review required |

- **Typography:** DOM contract PASS for all three states.
- **Classification:** Structural 0 / Major 0 / Component 0. Intentional: COMPOSITION (D6), DATA-ABSENCE (D4 date, D5 support action), TYPOGRAPHY-MIGRATION.
- **Gate limitation found and handled:** text masks hide text **colour**, and the typography contract checks family and weight only. A visual review caught the body text set in the muted colour where the board uses burgundy `#170002`; it is fixed and was verified against the board ink.

## 6. Shared UI
Shared primitives: **NONE** (AuthCard reused). Global tokens: **0**. The S04 components (34px disc, 128×41 outline action) are local to the screen.

S03 changed only in routing blocked accounts (D1). QA infrastructure:
- the WF01-S04 dry-run gap is cleared (15 ready, 9 gaps);
- the now-unused `STATE_BOARD_GAP` is removed;
- the obsolete state-board refusal assertion is removed.

## 7. Validation
| Gate | Result |
|---|---|
| Format / Lint / Typecheck / `verify` | PASS |
| Unit / DB | 110 / 121 |
| Build | PASS (`/auth/error` static) |
| S01 / S02 / S03 regression | PASS. Segments unchanged: S01 0/0/0/0/1; S02 0/0/0/14/3; S03 71/247/97 |
| S04 Playwright | 22 / 22 |
| Full Playwright | 175 / 175, plus 24 screen runs skipped by design |
| `design-reference/**` | hash unchanged |

## 8. Notes for review
1. BLOCKED body keeps "Lý do và cách mở nằm trong mail HUB gửi bạn." This still claims a HUB email was sent, which depends on an operational process outside P0. Please confirm the wording.
2. GENERIC needs the PO visual review required by D2.
3. The body-colour miss shows that the pixel gate is blind to text colour. A computed-colour assertion for text could be added to the typography contract in a later task.

## 9. Git
- Branch `main`; start HEAD `7e0c22d`
- Implementation commit: `968d9a5` feat(wf01-s04): auth error states behind an allowlisted public reason
- Report/final commit: the commit containing this report
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `e1a458b`
- Working tree: clean after commit except the untracked `AGENTS.md`

## Related
- [DECISION_LOG.md](../decisions/DECISION_LOG.md) — decision records
- [WF01_S04_STATE_BOARD_MAPPING.md](WF01_S04_STATE_BOARD_MAPPING.md) — frozen mapping
- [P0_STATUS.md](P0_STATUS.md) — overall P0 state
