# Claude Task Report

## 1. Task
- Task ID / name: WF01-S07-DECISION-FREEZE + WF01-S07 — Privacy & Visibility (`/onboarding/privacy`)
- Status: **DONE**. The one remaining blocker is release content: `PRODUCTION_LEGAL_CONTENT_REQUIRED`.
- Mode: LOCAL REVIEW. Committed locally, not pushed. WF01-S08 not started.

## 2. Decisions
- DEC-WF01-S07-D1..D8 are recorded in [DECISION_LOG.md](../../decisions/DECISION_LOG.md).
- [WF01_S07_PRIVACY_CONSENT_CONTRACT.md](../WF01_S07_PRIVACY_CONSENT_CONTRACT.md) is now **HUMAN APPROVED — P0**.
- `LEGAL_DOCUMENT_VERSION_STALE` (409) and `VISIBILITY_VALIDATION_FAILED` (422) sit in `DECISION_ERROR_CODES`; a unit test guards that both are recorded in the log.

## 3. Scope implemented
| Area | Result |
|---|---|
| Legal | `GET /legal/current`: per type, the latest effective, non-retired document. `/legal/{kind}/{version}` serves text from `LEGAL_CONTENT_DIR`; dev servers fall back to marked non-production fixtures, production has no fallback (404 = release blocker) |
| Consent | `GET /me/consents`, `POST /me/consents/accept`. Idempotency store with the key scoped to the actor; UNIQUE-backed deduplication; 201 new / 200 existing; server timestamp; `CONSENT_ACCEPTED` audit |
| Visibility | `GET/PUT /me/visibility`, own profile only; `PROFILE_DISCOVERY` NETWORK_ONLY / PRIVATE; the override is stored only when it departs from the default; `PROFILE_VISIBILITY_CHANGED` audit on real changes |
| Media | `/media/assets/:id`: owner always; others only for the current avatar with discovery NETWORK_ONLY or wider; otherwise 404 (D5 closes the S06 bypass) |
| UI | One switch, one acknowledgement with links to both current documents, read-only card preview, "Quay lại", "Xong, vào HUB" → `/onboarding/complete`. No skip (D6), no Future purposes (D3), lede emphasis without asterisks (D7) |
| Lifecycle | S07 never sets ACTIVE or `onboarding_completed_at`; S08 owns completion |
| Bug found by the DB tests | Legal state first matched acceptances by version string, so an old Terms acceptance could count when its version string equalled the current Privacy version. It now matches by document id |

## 4. Files
- **API/domain:**
  - `src/lib/{legal/legal,legal/content,audit/audit,profile/visibility}.ts`
  - Routes: `api/v1/legal/current`, `api/v1/me/consents{,/accept}`, `api/v1/me/visibility`, `app/legal/[kind]/[version]`
  - `media/assets/[id]` (authorisation)
  - `lib/api/error-codes.ts` plus its contract test
- **UI:** `onboarding/privacy/{page,privacy-form}.tsx`, `privacy.module.css`
- **Tests:**
  - `legal.db-test.ts` (14)
  - `wf01-s07-onboarding-privacy.spec.ts` (21)
  - `shell-routes`: S07 marked as guarded
- **Content/config:** `content/legal-fixtures/*` (marked non-production), `.env.example` (`LEGAL_CONTENT_DIR`)
- **Migrations / production data:** **none**

## 5. Security / privacy QA (Playwright 21/21, DB 14/14)
Covered:
- guest → `/auth` and 401 on all S07 APIs;
- current documents from the server, with content links working and fixtures marked;
- versions never asserted as literals;
- one checkbox → two records;
- no acceptance → no progression;
- triple submit → 2 accept calls and 2 records;
- idempotent replay and duplicate-safe re-accept (one audit event);
- stale version → 409;
- race A (Privacy fails, retry, Terms not duplicated), race B (V2 published while S07 is open → reload, V2 required), race C (revisit, nothing re-sent);
- default NETWORK_ONLY; OFF → PRIVATE override; ON removes it;
- audit events for both mutation types; unknown group or level → 422;
- no cross-profile write; DTOs without contact data or metadata;
- avatar: owner 200 / member 200 → 404 after PRIVATE / guest 404;
- no skip, no Future purpose;
- D7 emphasis;
- keyboard/a11y; computed text colours;
- zero console errors.

## 6. Pixel QA (1440×900 DPR1)
The typography contract passes. Outside-text diff by segment:
- header and canvas: 0;
- card-upper (title, lede, discovery option): 26 px (0.013%);
- card-lower (preview, divider, footer): 75 px (0.035%).

The discovery option, preview card, Back button and CTA all sit exactly at the baseline position + dy.

**Classification:** Structural 0 / Major 0 / Component 0.

| Class | What differs |
|---|---|
| INTENTIONAL-LEGAL-REQUIREMENT | Acknowledgement block and links (D1); skip omitted (D6); two copy clauses omitted because they would misstate D2 visibility ("Thẻ này Google tìm thấy được", "người chưa đăng nhập thấy đúng ngần này") |
| INTENTIONAL-P0-SCOPE | Investor, challenge-owner and recruitment toggles (reference y 300–620) |
| INTENTIONAL-COMPOSITION | The baseline is a scrolled viewport with the card over the header, and the stepper is hidden under the card, so the stepper is not compared |
| INTENTIONAL-TYPOGRAPHY-MIGRATION | Text glyphs, including the 13px preview caption and chips |
| RASTER-NOISE | Half-pixel box edges; the boxes are asserted within 1px instead |

## 7. Validation
| Gate | Result |
|---|---|
| Format / Lint / Typecheck | PASS |
| Unit / DB | 115 / 169 |
| Build | PASS |
| S01–S06 regression | PASS. Segments unchanged: S01 0/0/0/0/1; S02 0/0/0/14/3; S03 71/247/97; S04 1, 1/3; S05 193/245; S06 6/503 |
| Full Playwright | 236 passed (215 + 21); 24 screen runs skipped by design |
| `design-reference/**` | untouched |

## 8. Notes for review
1. **Release blocker `PRODUCTION_LEGAL_CONTENT_REQUIRED`.** Real Terms and Privacy text and versions must be supplied through `LEGAL_CONTENT_DIR` plus `legal_documents` rows.
2. **Region vs D2.** The approved copy and preview include region ("tỉnh"); D2's field list does not. The preview is owner-only; confirm before building the `/profiles/{id}` projection.
3. **Copy review.** The acknowledgement sentence and the error/stale messages have no approved bitmap.
4. **Seed.** The newcomer and ops personas have `default_level = PRIVATE` and pending has PUBLIC, so the pixel test sets NETWORK_ONLY explicitly. The PUBLIC seed value is displayed as ON and is not offered.

## 9. Git
- Branch: `main`; start HEAD `250d263`
- Implementation commit: `8167942` feat(wf01-s07): privacy and visibility with versioned legal acceptance
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `2093836`
- Working tree: clean after commit, except the untracked `AGENTS.md`

## Related
- [DECISION_LOG.md](../../decisions/DECISION_LOG.md) — decision records
- [WF01_S07_PRIVACY_CONSENT_CONTRACT.md](../WF01_S07_PRIVACY_CONSENT_CONTRACT.md) — approved contract
- [P0_STATUS.md](../P0_STATUS.md) — overall P0 state
