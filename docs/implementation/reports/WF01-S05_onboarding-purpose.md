# Claude Task Report

## 1. Task
- Task ID / name: WF01-S05-DECISION-FREEZE + WF01-S05 — Onboarding Purpose (`/onboarding/purpose`)
- Status: **DONE**
- Mode: LOCAL REVIEW. Committed locally, not pushed. WF01-S06 not started.

## 2. Decisions
DEC-WF01-S05-D1..D6 are recorded in [DECISION_LOG.md](../../decisions/DECISION_LOG.md) with stable anchors. [WF01_S05_INTENT_CONTRACT_GAP.md](../WF01_S05_INTENT_CONTRACT_GAP.md) is marked **HUMAN APPROVED — P0**.

## 3. Scope implemented
| Item | Result |
|---|---|
| Allowlist (D1) | `SUBMIT_SOLUTION`, `POST_CHALLENGE`, `ORGANIZE_COMMUNITY`, `EXPLORE_NETWORK`. Exact match only; anything else → 422 `PROFILE_VALIDATION_FAILED`, nothing written |
| API (D2) | `GET /api/v1/me/onboarding` → `{completed, current_step, intent}`; `PUT /api/v1/me/onboarding/intent` persists only `primary_intent` (the first write creates the DRAFT profile). Guests get 401 |
| Skip (D3) | "Bỏ qua, làm sau" is a plain link to S06: no request, intent stays NULL, onboarding stays open |
| Default (D4) | Nothing selected and Continue disabled; a saved value is preselected |
| Guard (D5) | Server-side: no session → `/auth` |
| Revisit (D6) | Editable before completion; completed → `/me` |
| Shell | `OnboardingShell` (header, stepper, action slot), shared by the S05–S08 references |

## 4. Files
- API/domain: `src/lib/onboarding/{intent,state}.ts`, `src/app/api/v1/me/onboarding/{route,intent/route}.ts`
- UI: `purpose/{page,purpose-form}.tsx`, `purpose.module.css`, `components/shell/onboarding-shell.{tsx,module.css}`
- Onboarding group layout: the placeholder container moved into the S06–S08 placeholder pages
- Tests: `onboarding.db-test.ts`, `wf01-s05-onboarding-purpose.spec.ts`, `shell-routes.spec.ts` (S05 guarded)
- Migrations/data: **none**. `primary_intent text` already exists, and the seed is unchanged

## 5. Playwright (17/17)
Covered:
- guest → `/auth`;
- four options with approved copy, no investor option;
- no default selection;
- select and change;
- Continue persists (DB checked) → `/onboarding/profile`;
- skip: 0 writes, intent NULL, `current_step: PURPOSE`;
- server 422 for `INVESTOR`, `UNKNOWN`, lowercase, empty and null;
- guest 401;
- inline 422 message;
- 500 recoverable with a retry that succeeds;
- triple submit → 1 request;
- preselect and edit;
- completed → `/me`;
- keyboard (Tab, Space, arrows, Enter, visible focus);
- a11y (one h1, named radio group, `aria-current` step);
- **computed text colours** (title, lede, option, selected option, CTA label) within ±3 of the reference inks;
- pixel QA;
- no console errors.

## 6. Pixel QA
Capture: 1440×900 DPR1, seeded newcomer, first option selected in-page (the reference state; nothing submitted). Typography contract PASS.

Segments, outside-text diff:
- header-left / header-right: 0 / 0;
- step discs: 0 / 0 / 0 (dx 0 / +5 / +8);
- connectors: 0 / 0;
- canvas-left / canvas-right: 0 / 0;
- card-upper: 193 px (0.048%);
- card-lower (dy −95): 245 px (0.110%).

All below 0.2%.

- **Intentional:** P0-SCOPE (investor option, reference y 541–636; the card is 95 px shorter), TYPOGRAPHY-MIGRATION (wider BVP stepper labels move discs 2–3 by 5–8 px).
- **Classification:** Structural 0 / Major 0 / Component 0.
- **Fixed during QA:**
  - stepper centred between wordmark and action (disc 1 at x544, as on the reference);
  - connector-to-disc gap 11 px;
  - option gap 11 px;
  - option text 2 px higher;
  - divider gap 23 px.
- **Not compared:** plain canvas below the shortened card.

## 7. Validation
| Gate | Result |
|---|---|
| Format / Lint / Typecheck | PASS |
| Unit / DB | 110 / 136 |
| Build | PASS (`/onboarding/purpose` dynamic) |
| S01–S04 regression | PASS. Segments unchanged: S01 0/0/0/0/1; S02 0/0/0/14/3; S03 71/247/97; S04 1 and 1/3 |
| Full Playwright | 192 passed (175 + 17), 24 screen runs skipped by design |
| `design-reference/**` | no diff vs HEAD |

## 8. Notes for review
1. The 422/500 inline messages have no approved bitmap copy and await design copy review.
2. The lede says "đổi được bất cứ lúc nào trong Cài đặt"; editing in Settings (WF02-S07) is not built yet.
3. `OnboardingShell` is used by S05 only; S06–S08 will adopt it in their own tasks.

## 9. Git
- Branch `main`; start HEAD `d4e978b`
- Implementation commit: `eb5c49e` feat(wf01-s05): onboarding purpose with a P0 intent allowlist
- Report/final commit: the commit containing this report
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `e1a458b`
- Working tree: clean after commit except the untracked `AGENTS.md`

## Related
- [DECISION_LOG.md](../../decisions/DECISION_LOG.md) — decision records
- [WF01_S05_INTENT_CONTRACT_GAP.md](../WF01_S05_INTENT_CONTRACT_GAP.md) — approved intent contract
- [P0_STATUS.md](../P0_STATUS.md) — overall P0 state
