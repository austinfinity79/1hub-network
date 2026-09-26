# Decision Log

Human-approved implementation decisions with stable IDs. A decision here resolves an ambiguity *between* frozen sources; it never edits the SOT itself.

## DEC-WF01-S03 — Auth callback state board

Every row below carries these shared fields. **Status:** APPROVED (human review, 2026-09-26). **Scope:** WF01-S03 `/auth/callback`. **Context:** the AUTH3 reference is a state board holding three panels. The frozen sources name the callback states but not their runtime composition, actions or token transport. **Evidence:** [WF01_S03_STATE_BOARD_MAPPING.md](../implementation/WF01_S03_STATE_BOARD_MAPPING.md), [WF01-S03 report](../implementation/reports/WF01-S03_auth-callback-states.md).

| ID | Decision | Rationale | Impact |
|---|---|---|---|
| <a id="dec-wf01-s03-d1"></a>DEC-WF01-S03-D1 | EXPIRED / USED "request new link" navigates to `/auth` for a fresh request; no resend from the callback | Callback links must work on another device, where no `auth_request_id` exists; resend of a used request returns 409 | `<Link href="/auth">`; asserted 0 resend calls |
| <a id="dec-wf01-s03-d2"></a>DEC-WF01-S03-D2 | The red outline on the board's middle panel is a designer annotation, not UI | It marks one panel on a board; no contract state implies a bordered card | Not rendered; pixel crops inset 1px |
| <a id="dec-wf01-s03-d3"></a>DEC-WF01-S03-D3 | INVALID token (and missing token, blocked account, any other failure) routes to `/auth/error` (WF01-S04); no reason passed | WF01 assigns error/blocked states to S04; a reason in the URL would widen leakage | S03 has three visual states only |
| <a id="dec-wf01-s03-d4"></a>DEC-WF01-S03-D4 | Processing is transient technical behaviour, not an approved state | No frozen state or board panel exists for it | Screen-reader status only; not pixel-tested |
| <a id="dec-wf01-s03-d5"></a>DEC-WF01-S03-D5 | Runtime renders ONE state in ONE centred AuthCard; the board is evidence only | The board is a design artefact, not a page | Per-state panel crops aligned on the icon disc |
| <a id="dec-wf01-s03-d6"></a>DEC-WF01-S03-D6 | Approved panel copy is preserved verbatim | Avoids copy drift from the approved design | Titles, bodies and labels as on the board, amended only by D6a |
| <a id="dec-wf01-s03-d6a"></a>DEC-WF01-S03-D6a | The EXPIRED body's second sentence is reworded to "Đây không phải lỗi của bạn — hãy quay lại nhập email để nhận link đăng nhập mới." | The board text promised an in-place resend that D1 rules out; business/security behaviour wins over bitmap copy | EXPIRED copy only; layout, style and behaviour unchanged |
| <a id="dec-wf01-s03-d7"></a>DEC-WF01-S03-D7 | P0 link format `/auth/callback?token=<opaque-single-use-token>`; token never logged, stored or rendered; stripped from the URL after handling; no Referer | The contract names the path (`return_to`) but not the token transport | Browser-side token handling; static page; `referrer: no-referrer` |
| <a id="dec-wf01-s03-icon"></a>DEC-WF01-S03-ICON | INTENTIONAL-ICON-RENDERING: state icons are deterministic inline SVG, not OS emoji or glyphs | The board's ✓ ⏱ ↻ are platform-dependent emoji/glyph rasters; an OS emoji would render differently per environment | Recorded pixel deviation inside the icon discs (≤173 px per state), classified intentional |

## DEC-WF01-S04 — Auth error state board

Every row carries these shared fields. **Status:** APPROVED (human review). **Date:** 2026-09-26. **Scope:** WF01-S04 `/auth/error`. **Evidence (shared):** [WF01_S04_STATE_BOARD_MAPPING.md](../implementation/WF01_S04_STATE_BOARD_MAPPING.md), [WF01-S04 report](../implementation/reports/WF01-S04_auth-errors.md).

| ID | Topic | Context | Decision | Rationale | Evidence | Impact | Supersedes |
|---|---|---|---|---|---|---|---|
| <a id="dec-wf01-s04-d1"></a>DEC-WF01-S04-D1 | Public error state transport | S03 passed no reason (DEC-WF01-S03-D3), so S04 could not distinguish its states | S04 reads an allowlisted public code `/auth/error?reason=<code>` (`blocked`, `session_expired`, `generic`); unknown or missing → GENERIC; the query value is never rendered or echoed | Lets S04 show the right state without leaking internals; an allowlist makes injection impossible | `auth-error-screen.tsx` `publicReason`; Playwright: 7 hostile/unknown values fall back to GENERIC and never appear in the HTML | S03 now routes `AUTH_ACCOUNT_BLOCKED` to `?reason=blocked`; the page is static so no query reaches server HTML | DEC-WF01-S03-D3 in part ("no reason passed"); the rest of D3 stands |
| <a id="dec-wf01-s04-d2"></a>DEC-WF01-S04-D2 | LINK-INVALID / GENERIC | S03 routes invalid and other failures here; the AUTH4 board has no generic panel | `/auth/error` and `?reason=generic` render the same GENERIC state in the shared centred AuthCard, as a FUNCTIONAL FALLBACK; pixel mode DESIGN-GAP-GENERIC | No approved panel may be fabricated from an unrelated state | Functional, a11y, typography and geometry checks; `WF01-S04.generic.review.json` | Requires manual PO visual review; no strict pixel claim | — |
| <a id="dec-wf01-s04-d3"></a>DEC-WF01-S04-D3 | Rate limit stays inline | R1 shows a rate-limit panel; S01/S02 already show it inline | `AUTH_RATE_LIMITED` remains inline at the causing action (S01/S02) and never redirects to S04; R1 is not a runtime state | Keeps the user in context; R1's numbers and Google action are unfrozen | Playwright: 429 on S01 shows the inline alert, URL stays `/auth`; `?reason=rate_limited` → GENERIC | R1 excluded from runtime and pixel QA | — |
| <a id="dec-wf01-s04-d4"></a>DEC-WF01-S04-D4 | BLOCKED date | R2 copy cites a date ("20/09") that no data source provides | No hard-coded date; copy keeps the approved meaning without it | Fabricated data is worse than an absent detail | Playwright asserts no date pattern | INTENTIONAL-DATA-ABSENCE; a reliable date can be rendered later through approved data | — |
| <a id="dec-wf01-s04-d5"></a>DEC-WF01-S04-D5 | Support contact | R2 action shows `hotro@1hub.network`; no support contact is configured | No email address is invented; generic support copy, no action element | A dead or invented contact misleads users | Playwright asserts no `@` and no link/button on BLOCKED | INTENTIONAL-DATA-ABSENCE; R2's action button is not rendered | — |
| <a id="dec-wf01-s04-d6"></a>DEC-WF01-S04-D6 | Runtime composition | The AUTH4 reference is a board of horizontal rows | ONE state in ONE centred AuthCard on the 1440×900 canvas; the rows' components stack vertically | The board is a design artefact, as for DEC-WF01-S03-D5 | Component crops: disc 1 px, action 3 px outside text | INTENTIONAL-COMPOSITION; pixel QA compares approved components (disc, action), not whole rows | — |
| <a id="dec-wf01-s04-d7"></a>DEC-WF01-S04-D7 | Mail blocked by domain | R4 needs a provider/bounce signal that does not exist | R4 is OUT_OF_P0 / UNSUPPORTED; not implemented or inferred | No frozen signal can detect it | `?reason=mail_blocked` → GENERIC; no "chặn thư" text | R4 excluded | — |
| <a id="dec-wf01-s04-d8"></a>DEC-WF01-S04-D8 | Session expired | R3 exists; no protected route detects expiry yet | S04 supports `reason=session_expired` with the R3 presentation; no new global redirect is invented; deterministic test setup via the URL | Future protected flows may route here per the auth contract | Playwright: R3 state, lifetime from `SESSION_TTL_SECONDS`, relogin to `/auth` | The lifetime in the copy follows the provisional TTL (pre-UAT) | — |

## DEC-WF01-S05 — Onboarding purpose (intent contract)

Every row carries these shared fields. **Status:** HUMAN APPROVED — P0. **Date:** 2026-09-26. **Scope:** WF01-S05 `/onboarding/purpose`, `GET /api/v1/me/onboarding`, `PUT /api/v1/me/onboarding/intent`. **Evidence (shared):** [WF01_S05_INTENT_CONTRACT_GAP.md](../implementation/WF01_S05_INTENT_CONTRACT_GAP.md), [WF01-S05 report](../implementation/reports/WF01-S05_onboarding-purpose.md).

| ID | Topic | Context | Decision | Rationale | Evidence | Impact | Supersedes |
|---|---|---|---|---|---|---|---|
| <a id="dec-wf01-s05-d1"></a>DEC-WF01-S05-D1 | Intent allowlist | API 05 §4.2 leaves `primary_intent` to launch configuration; none existed | P0 server-side allowlist `SUBMIT_SOLUTION`, `POST_CHALLENGE`, `ORGANIZE_COMMUNITY`, `EXPLORE_NETWORK`; no `INVESTOR`; unknown values rejected (422 `PROFILE_VALIDATION_FAILED`), never coerced (no trim, no case folding) | Investor/VC/Dataroom is Future scope; exact match keeps stored data clean | `src/lib/onboarding/intent.ts`; DB tests reject 9 values and write nothing; Playwright 422 for `INVESTOR`, `UNKNOWN`, lowercase, empty, null | Bitmap investor option not rendered: INTENTIONAL-P0-SCOPE in pixel QA | — |
| <a id="dec-wf01-s05-d2"></a>DEC-WF01-S05-D2 | Endpoint and payload | Contract freezes `PUT /me/onboarding/intent` | Use the frozen endpoint; persist only `individual_profiles.primary_intent`; the first write creates the DRAFT profile | No schema change; nothing beyond the intent is captured | `setPrimaryIntent` upsert; Playwright checks the DB row (intent, DRAFT, not completed) | No migration | — |
| <a id="dec-wf01-s05-d3"></a>DEC-WF01-S05-D3 | "Bỏ qua, làm sau" | The action was named, its persistence was not | Skips THIS step only: no write, `primary_intent` stays NULL, goes to S06; no fake intent; onboarding not marked complete | A skip must not fabricate data | Playwright: 0 intent requests, no profile row, state `current_step: PURPOSE` | S06 is reached with intent NULL | **Amended by [DEC-WF01-RESUME-D1](#dec-wf01-resume-d1)**: skip now records the Purpose step (still no intent) |
| <a id="dec-wf01-s05-d4"></a>DEC-WF01-S05-D4 | Default selection | The bitmap shows option 1 selected | Nothing selected by default; a saved value is preselected | The runtime must not fabricate an intent | Playwright: 0 checked, CTA disabled; saved value checked | Pixel QA selects option 1 in-page (no submit) to match the reference | — |
| <a id="dec-wf01-s05-d5"></a>DEC-WF01-S05-D5 | Unauthenticated access | No page guard existed | Server-authoritative guard: no valid session → redirect `/auth` | Access control must not depend on the client | Playwright: guest → `/auth`; API 401 for guests | `shell-routes.spec.ts` treats S05 as a guarded screen | — |
| <a id="dec-wf01-s05-d6"></a>DEC-WF01-S05-D6 | Revisit | WF01: resume at the first incomplete step | Before completion the intent can be edited; once onboarding is completed the page follows the existing rule and redirects to `/me` | Keeps choices reversible until onboarding closes | Playwright: preselected, edited, DB updated; completed → `/me` | — | — |

## DEC-WF01-S06 — Onboarding profile (field contract)

Every row carries these shared fields. **Status:** HUMAN APPROVED — P0. **Date:** 2026-09-26. **Scope:** WF01-S06 `/onboarding/profile`, `GET/PATCH /api/v1/me/profile`, `GET /api/v1/me/profile/completion`, `POST /api/v1/me/profile/avatar`, `GET /api/v1/vocabularies/{type}`, `GET /session` completion. **Evidence (shared):** [WF01_S06_PROFILE_FIELD_CONTRACT.md](../implementation/WF01_S06_PROFILE_FIELD_CONTRACT.md), [WF01-S06 report](../implementation/reports/WF01-S06_onboarding-profile.md).

**Precedence note (not a decision):** `NETWORK_CONTEXT` in the API 05 `/me/profile/completion` example is stale. The Data Decisions Freeze (priority 4) defines group 3 as HEADLINE, which outranks the API example (priority 6). Recorded as **RESOLVED_BY_PRECEDENCE**; the historical SOT is not edited.

| ID | Topic | Context | Decision | Why | Evidence | Impact |
|---|---|---|---|---|---|---|
| <a id="dec-wf01-s06-d1"></a>DEC-WF01-S06-D1 | "Chuyên môn" | The bitmap shows one expertise picker whose chips mix domains and skills; the Freeze has DOMAIN and SKILL, no EXPERTISE | One UI picker over the existing DOMAIN + SKILL vocabularies; each option keeps its type; DOMAIN ids → `domain_ids`, SKILL ids → `skill_ids`. The server checks existence, type and ACTIVE status for new selections; archived links stay readable. No EXPERTISE taxonomy | Honours the design without inventing a taxonomy; DOMAIN and SKILLS stay separate completion groups | DB tests: wrong type, unknown, archived new → 422; archived kept; Playwright: PATCH body split by type, DB relations | Completion may satisfy DOMAIN and/or SKILLS independently |
| <a id="dec-wf01-s06-d2"></a>DEC-WF01-S06-D2 | Required to leave S06 | The design lede says only photo and bio may be left blank | Continue needs `display_name`, `headline`, `region` and ≥1 DOMAIN/SKILL item; avatar and bio optional. An S06 progression rule only: not the activation minimum, no 80% gate, S06 never activates the profile or completes onboarding | Approved design text; the Freeze keeps activation (name, region, legal) at S08 | Playwright: each missing field blocks with 0 requests; save → S07 with status DRAFT and no `onboarding_completed_at`; onboarding step moves to PRIVACY only when met | `GET /me/onboarding` `current_step` gains PRIVACY |
| <a id="dec-wf01-s06-d3"></a>DEC-WF01-S06-D3 | Avatar storage | `file_assets` is absent (DB gap P9) and no object storage is configured | `POST /me/profile/avatar` (multipart, part `file`) sniffs PNG/JPEG/WebP, stores bytes privately under `MEDIA_STORAGE_DIR` with an opaque `asset_<32 hex>` id and a sidecar owner record; only the id is saved in `avatar_asset_id`; served by `/media/assets/:id` to signed-in sessions, `Cache-Control: private, no-store`. Limits are provisional technical config (2 MiB default). No table, no migration | Smallest abstraction meeting the frozen contract; no public URL is ever canonical | Unit: sniffing, limits, id format; Playwright: upload → id stored, image served, guest 404, non-image refused; completion AVATAR counts only a stored, owned asset | Seeded demo avatar ids point at no stored file, so they count as incomplete |
| <a id="dec-wf01-s06-d4"></a>DEC-WF01-S06-D4 | Max 5 | The bitmap says "chọn tối đa 5" | `count(domain_ids) + count(skill_ids) ≤ 5`, counting kept relations; enforced in the picker (further chips disabled) and on the server (422 `PROFILE_VALIDATION_FAILED`) | Design is authoritative for S06; no bypass by direct API | DB tests (incl. kept relations); Playwright: UI stops at 5, API 422 for 6 | Existing error envelope only |
| <a id="dec-wf01-s06-d5"></a>DEC-WF01-S06-D5 | No skip on S06 | The bitmap header shows "Bỏ qua, làm sau"; the Screen Contract lists only `upload_avatar`, `save_profile` | S06 has no skip; the header action is not rendered and no no-op button is created. The header keeps the action column width, so the stepper stays where the baselines place it | Contract actions win over a visual element | Playwright: no skip text, no header link or button | Pixel: INTENTIONAL-CONTRACT at the skip region |
| <a id="dec-wf01-s06-d6"></a>DEC-WF01-S06-D6 | QA vocabulary | The seed has 2 DOMAIN + 2 SKILL items; the bitmap shows 7 chips and "+ 42 nhóm khác" | `tests/visual/fixtures/wf01-s06-qa-vocabulary.sql`: 45 ACTIVE + 1 ARCHIVED QA-only items with deterministic ids, applied only by the S06 spec; never a production seed, never hard-coded, not launch taxonomy | Pixel parity without touching production data | Chip count and labels come from the database; the "+ N" count is computed | Dev database keeps the QA items after a test run |

## DEC-WF01-S07 — Privacy & visibility (consent contract)

Every row carries these shared fields. **Status:** HUMAN APPROVED — P0. **Date:** 2026-09-26. **Scope:** WF01-S07 `/onboarding/privacy`, `GET /legal/current`, `/legal/{kind}/{version}`, `GET /me/consents`, `POST /me/consents/accept`, `GET/PUT /me/visibility`, `/media/assets/:id` authorisation. **Evidence (shared):** [WF01_S07_PRIVACY_CONSENT_CONTRACT.md](../implementation/WF01_S07_PRIVACY_CONSENT_CONTRACT.md), [WF01-S07 report](../implementation/reports/WF01-S07_privacy-visibility.md).

| ID | Topic | Context | Decision | Why | Evidence | Impact |
|---|---|---|---|---|---|---|
| <a id="dec-wf01-s07-d1"></a>DEC-WF01-S07-D1 | Legal acceptance UI | The bitmap has no legal control; acceptance is an activation requirement | One required acknowledgement ("Tôi đồng ý với …") linking both current documents; it creates TWO ConsentRecords (TERMS_ACCEPTANCE, PRIVACY_DATA_PROCESSING); S07 continues to S08 only when both current documents are accepted | Legal correctness over bitmap parity; no merged boolean | Playwright: two rows, none without the checkbox, partial failure retried without duplicates | Pixel: INTENTIONAL-LEGAL-REQUIREMENT |
| <a id="dec-wf01-s07-d2"></a>DEC-WF01-S07-D2 | PROFILE_DISCOVERY | Group codes were never frozen (DB gap P8) | One P0 group `PROFILE_DISCOVERY` (display_name, avatar, headline, bio, domain; never email, phone, identity or internal data). "Hiện thẻ của tôi trong Thư viện": ON → NETWORK_ONLY, OFF → PRIVATE; never PUBLIC | The P0 Library is inside the authenticated network | API/DB tests; bitmap copy that would misstate this ("Google tìm thấy", "người chưa đăng nhập thấy…") is not rendered | Region shown on the card is outside the frozen field list (open note) |
| <a id="dec-wf01-s07-d2a"></a>DEC-WF01-S07-D2A | PROFILE_DISCOVERY fields (amends D2) | The approved card and its copy ("tỉnh") show region; D2's list omitted it | PROFILE_DISCOVERY fields are display_name, avatar, headline, bio, domain **and region**. Clarification only; no new visibility system, S07 UI unchanged | Matches the approved member card | No profile projection exists yet (`GET /profiles/{id}` unimplemented; only the owner's `/me/profile` returns region). The projection must omit region, like every group field, when PROFILE_DISCOVERY denies the viewer | `src/lib/profile/visibility.ts` doc comment updated with the next code task |
| <a id="dec-wf01-s07-d3"></a>DEC-WF01-S07-D3 | Future purposes | The bitmap shows investor, challenge-owner and recruitment toggles | Not implemented: no control, no purpose code, no P7 migration | Investor is Future; no frozen purpose model for the others | Playwright: one switch; the API rejects other groups | Pixel: INTENTIONAL-P0-SCOPE |
| <a id="dec-wf01-s07-d4"></a>DEC-WF01-S07-D4 | Default | DB `default_level = NETWORK_ONLY` | New profiles: PROFILE_DISCOVERY = NETWORK_ONLY through the default; OFF stores `group_overrides.PROFILE_DISCOVERY = PRIVATE`; ON again removes the override | Existing model, no redundant rows | DB and Playwright: `{}` ↔ `{"PROFILE_DISCOVERY":"PRIVATE"}` | Seeded fixture profiles keep their own default levels |
| <a id="dec-wf01-s07-d5"></a>DEC-WF01-S07-D5 | Avatar visibility | S06 served avatars to any signed-in session | The avatar belongs to PROFILE_DISCOVERY. `/media/assets/:id`: the owner is always allowed; another signed-in account only if it is the owner's current avatar and discovery is NETWORK_ONLY (or wider); PRIVATE and guests get 404 | Enforced at the serving boundary, not by hiding URLs | Playwright: owner 200; member 200 → 404 after PRIVATE; guest 404 | Closes the S06 bypass |
| <a id="dec-wf01-s07-d6"></a>DEC-WF01-S07-D6 | No skip | The bitmap header shows "Bỏ qua, làm sau" | S07 has no skip; not rendered, no fake control | Required legal acceptance cannot be bypassed | Playwright: no skip, no header link | Pixel: INTENTIONAL-LEGAL-REQUIREMENT |
| <a id="dec-wf01-s07-d7"></a>DEC-WF01-S07-D7 | Copy artefact | The bitmap lede shows a literal `**mục đích**` | Render "mục đích" with emphasis (semibold); never show asterisks | Formatting artefact, not copy | Playwright: `strong` "mục đích", no `**` | — |
| <a id="dec-wf01-s07-d8"></a>DEC-WF01-S07-D8 | Version / errors / re-acceptance | No codes existed for these cases | `409 LEGAL_DOCUMENT_VERSION_STALE`: a version that is not current is refused; the client reloads `/legal/current`, clears the acknowledgement and asks again. `422 VISIBILITY_VALIDATION_FAILED`: unsupported group or level. Post-onboarding re-acceptance belongs to WF02-S03 | Server-authoritative versions; errors never expose internals | Playwright race B; DB tests; `contract.test.ts` guards that both codes are recorded here | Codes live in `DECISION_ERROR_CODES`, not in the 05 drift list |

## DEC-WF01-S08 — Onboarding complete (lifecycle)

Every row carries these shared fields. **Status:** HUMAN APPROVED — P0. **Date:** 2026-09-26. **Scope:** WF01-S08 `/onboarding/complete`, `POST /api/v1/me/onboarding/complete`, `/session`, analytics writer. **Evidence (shared):** [WF01_S08_COMPLETION_CONTRACT.md](../implementation/WF01_S08_COMPLETION_CONTRACT.md), [WF01-S08 report](../implementation/reports/WF01-S08_onboarding-complete.md).

| ID | Topic | Context | Decision | Why | Evidence | Impact |
|---|---|---|---|---|---|---|
| <a id="dec-wf01-s08-d1"></a>DEC-WF01-S08-D1 | Completion trigger | The API maps completion to S08; the bitmap has no confirm control | S07 saves consent and visibility, then navigates to S08. S08 issues the idempotent `POST /me/onboarding/complete` on entry and shows success only after the server confirms; a refusal shows what is missing, a failure offers a retry | S08 owns the write; no false success | Playwright: success after 200; 422 and 500 views without success | S07 unchanged |
| <a id="dec-wf01-s08-d2"></a>DEC-WF01-S08-D2 | Challenge Library | WF04 is demo; no Production route | Card 01 not rendered; no route, no demo navigation | Demo must not look like Production | Playwright: no challenge text or link | Pixel: INTENTIONAL-DEMO-SCOPE |
| <a id="dec-wf01-s08-d3"></a>DEC-WF01-S08-D3 | Create Project | `/projects/new` is a placeholder; `POST /ventures` is missing | Card 02 not rendered until WF02-S05 is Production-ready | No stub success | Playwright: no project link | Pixel: TEMPORARY-PRODUCTION-DEPENDENCY |
| <a id="dec-wf01-s08-d4"></a>DEC-WF01-S08-D4 | Chapter action | No region → chapter data, route or request UX | Card 03 not rendered; S08 creates or infers no relationship; existing ACTIVE/PENDING rows stay as they are | Never fabricate network data | DB test: PENDING stays PENDING, no new membership | Pixel: TEMPORARY-PRODUCTION-DEPENDENCY |
| <a id="dec-wf01-s08-d5"></a>DEC-WF01-S08-D5 | Primary intent | Intent may be NULL (S05-D3) | No per-intent cards or copy; NULL never blocks completion | Intent is stored for future logic only | DB test: NULL intent completes | Lede keeps only intent-neutral text |
| <a id="dec-wf01-s08-d6"></a>DEC-WF01-S08-D6 | Exit and stepper | The bitmap has no `/me` exit and shows a skip link | CTA "Vào 1hub.network" → `/me`; no "Bỏ qua, làm sau"; stepper finished (all done, none current, not interactive) | One safe exit that depends on no optional action | Playwright: the only link is `/me`; no `aria-current` | Pixel: INTENTIONAL-CONTRACT (skip, disc 3, CTA, shorter card) |
| <a id="dec-wf01-s08-d7"></a>DEC-WF01-S08-D7 | Info copy and icon | Panel claims events and solution-submission rules; OS emoji ℹ | Neutral copy: the server's percent plus "Bạn có thể cập nhật hồ sơ bất cứ lúc nào."; deterministic SVG info mark | No invented product rules; deterministic pixels | Playwright: no "dự sự kiện"; percent equals the server's | Pixel: INTENTIONAL-ICON-RENDERING, replaced-copy regions masked |
| <a id="dec-wf01-s08-d8"></a>DEC-WF01-S08-D8 | Audit and analytics | No analytics writer existed | Audit `PROFILE_ACTIVATED` once on the real DRAFT → ACTIVE transition (before/after status, request id). One analytics writer on `analytics_events`: `onboarding_completed` once at first completion; `profile_completion_changed` when the authoritative percent moves. Frozen common properties only | Once-only, non-personal telemetry | DB and Playwright: 5 concurrent calls → 1 audit, 1 event; payloads without names, email or consent content | Other API §10 events are not emitted yet (open) |

## DEC-WF01-ANALYTICS-EXT-DEFER — Deferred analytics events

<a id="dec-wf01-analytics-ext-defer"></a>**DEC-WF01-ANALYTICS-EXT-DEFER.** **Status:** APPROVED P0 DEFERRED. **Date:** 2026-09-26. **Scope:** API 05 §10 event list vs WF01.

| Context | Decision | Why | Evidence | Impact |
|---|---|---|---|---|
| API 05 §10 lists more "P0 minimum" events than WF01 emits (audit item ANALYTICS-EXT) | WF01's required analytics for current P0 are `account_created`, `profile_completion_changed` and `onboarding_completed`. **Deferred, not blocking WF01:** `account_authenticated`, `onboarding_started`, `consent_accepted`, `visibility_changed`, `membership_*`, `profile_saved`, `feedback_submitted` | The registration and profile-completion funnel minimum is already measurable | [WF01-REMEDIATION-02 report](../implementation/reports/WF01-REMEDIATION-02_gap-analytics-registration.md) (funnel proof) | Each deferred event is added later through the SAME analytics writer (`src/lib/analytics/analytics.ts`) when its owning workflow or release analytics scope is implemented; no other analytics system |

## DEC-WF01-RESUME-D1 — Purpose step persistence and one resume resolver

<a id="dec-wf01-resume-d1"></a>**DEC-WF01-RESUME-D1.** **Status:** HUMAN APPROVED — P0 (option A of [WF01-REMEDIATION-03](../implementation/reports/WF01-REMEDIATION-03_defect-resume.md)). **Date:** 2026-09-26. **Amends:** [DEC-WF01-S05-D3](#dec-wf01-s05-d3) (history kept).

| Context | Decision | Why | Evidence | Impact |
|---|---|---|---|---|
| `primary_intent = NULL` means either "S05 never completed" or "S05 skipped" (D3 wrote nothing), so resume could not tell them apart | WF01 Purpose completion is **persisted explicitly**: `individual_profiles.purpose_step_completed_at` (migration 005, additive, existing rows NULL, no backfill). Set once by the server when an intent is saved **or** S05 is skipped; skip still creates no intent and never clears one. **API amendment (05 §4.2):** `PUT /me/onboarding/intent` takes `{ "action": "SKIP" }` or `{ "action": "SAVE", "primary_intent": … }`; `action` may be omitted for the frozen SAVE shape; any other field, including a client timestamp, is 422 `PROFILE_VALIDATION_FAILED`. **One resolver** (`src/lib/onboarding/state.ts`): DONE (ACTIVE + `onboarding_completed_at`) → `/me`; else PURPOSE (no step timestamp) → PROFILE (S06 progression rule) → PRIVACY (current Terms and Privacy, by document) → COMPLETE → `/onboarding/complete`. Used by sign-in `next_step`, `/session`, `GET /me/onboarding` and the page guards | Resume must be derived from persisted facts, never inferred | `resume.db-test.ts` (matrix), UAT-03b, fresh-DB restart proof | S05 skip is now a server write (DRAFT profile created). Page guards keep the existing convention: revisits before completion allowed, DONE → `/me` (S08 stays viewable) |

## DEC-WF02 — WF02 decision freeze (H1–H13)

**Status:** HUMAN APPROVED — P0.
**Date:** 2026-09-26.
**Source packet:** [WF02_HUMAN_DECISION_PACKET.md](../implementation/WF02_HUMAN_DECISION_PACKET.md), audit [WF02_PRE_IMPLEMENTATION_AUDIT.md](../implementation/WF02_PRE_IMPLEMENTATION_AUDIT.md).

These records are addenda to the WF02 screen contracts and the API contract. The frozen SOT files themselves are unchanged. No runtime code and no migration are created by this freeze.

**Source abbreviations used below:**

| Short name | Source |
|---|---|
| Freeze | `00_DATA_DECISIONS_FREEZE_v1.1` |
| SOT | Data SOT v1.1 |
| WF02 | WF02 workflow contract |
| SCR | Screen contracts |
| API | `05_API_CONTRACT_P0` |
| GAPS | `DB_SCHEMA_GAPS_P0` |
| Matrix | `AUTHORIZATION_CAPABILITY_MATRIX_P0` |

<a id="dec-wf02-h1"></a>**DEC-WF02-H1 — Profile completion UI (addendum to SCR WF02-S02)**

| Field | Record |
|---|---|
| Context | P0 completion has 10 groups, but no approved UI edits EXPERIENCE, DEVELOPMENT_GOAL or CURRENT_NEED. Approved UI tops out at 70%, so the ≥80% KPI cannot be reached |
| Decision | WF02-S02 gains Experience, Development goal and Current need sections. Experience = ≥1 `profile_experience` item OR `no_experience_yet` |
| Unchanged | The 10 groups × 10% algorithm; 80% stays a KPI, not an access gate; Education is never a completion group |
| Rationale | Makes the frozen roadmap metric reachable without changing the metric |
| Consequences | S02 renders sections that are not in the PRO2 bitmap; they carry a pixel intentional class (P0-SCOPE/CONTRACT per the existing convention) |
| Affected screens | WF02-S02 |
| API/data impact | `PATCH /me/profile` allowlist extended (see H2). Storage already exists: `profile_experience`, `individual_profiles.development_goal`, `current_need`, `no_experience_yet`. **No migration** |
| Supersedes/amends | Amends SCR WF02-S02 (sections); extends the WF01 PATCH allowlist of DEC-WF01-S06 (history kept) |
| Source anchors | Freeze §D3; Master Spec v1.3:172; `db/migrations/001_p0_init.sql:58-60,98` |

<a id="dec-wf02-h2"></a>**DEC-WF02-H2 — WF02-S02 write scope**

| Field | Record |
|---|---|
| Context | The field set fixes the S02 write API. The "Ẩn mục trong tiến trình" panel needs ActivityRecord, which P0 does not produce |
| Decision | S02 edits canonical IndividualProfile data only: the fields drawn for S02, the WF01 canonical fields where appropriate, and the H1 groups. The activity-hide panel is **FUTURE / INTENTIONAL-P0-SCOPE**. No empty or fake activity subsystem |
| Rationale | Production ActivityRecord is owned by WF04–WF06, which are demo-only in P0 |
| Consequences | The panel region is masked and classified |
| Affected screens | WF02-S02 |
| API/data impact | One `PATCH /me/profile` allowlist covering IndividualProfile fields only; no activity API |
| Supersedes/amends | Extends DEC-WF01-S06 field set |
| Source anchors | SOT:116; CLAUDE.md §2; SCR WF02-S02; WF02 "Profile trust rule" |

<a id="dec-wf02-h3"></a>**DEC-WF02-H3 — No public profile; preview links**

| Field | Record |
|---|---|
| Context | The bitmaps promise public/guest visibility and link to a public profile that has no route |
| Decision | No guest/public profile in P0. PROFILE_DISCOVERY stays NETWORK_ONLY or PRIVATE, never PUBLIC. No `/profiles/{id}` UI route in current WF02 P0. Preview/public links without a destination are **omitted**. A status label that must remain uses network wording, e.g. "Hiển thị trong mạng lưới". Never imply Google or Internet visibility |
| Rationale | Keeps DEC-WF01-S07-D2/D2A; no invented routes |
| Consequences | Omitted links → INTENTIONAL-P0-SCOPE; reworded status → INTENTIONAL-CONTRACT |
| Affected screens | S01, S02, S03, S05 |
| API/data impact | None now; `GET /profiles/{id}` stays unimplemented |
| Supersedes/amends | Narrows the SCR actions `preview_public` (S02, S05) and `preview_as_other` (S03) to not rendered in P0 |
| Source anchors | DEC-WF01-S07-D2/D2A; API §5.2; CLAUDE.md §7 |

<a id="dec-wf02-h4"></a>**DEC-WF02-H4 — WF02-S03 privacy scope**

| Field | Record |
|---|---|
| Context | The S03 contract lists viewer history and export, but neither has a model |
| Decision | P0 S03 = PROFILE_DISCOVERY management, consent history, and re-acceptance when the current Terms/Privacy version changes. Uses the WF01 visibility and consent services |
| Not in P0 | Viewer history, export-my-data, Future purpose groups, consent revocation UI. Consent ≠ Visibility |
| Rationale | Closes the DEC-WF01-S07-D8 deferral with existing services |
| Consequences | The excluded regions are INTENTIONAL-P0-SCOPE. PRODUCTION_LEGAL_CONTENT_REQUIRED stays a release dependency |
| Affected screens | WF02-S03 |
| API/data impact | Existing `/me/consents`, `/me/consents/accept` (409 stale), `/me/visibility`, `/legal/current`. `POST /me/consents/revoke` is not used by P0 UI |
| Supersedes/amends | Narrows SCR WF02-S03 (`ProfileViewerLog`, `export_my_data` → Future); fulfils DEC-WF01-S07-D8 |
| Source anchors | WF02 S03; SCR S03; Freeze §D4; DEC-WF01-S07-D3/D8 |

<a id="dec-wf02-h5"></a>**DEC-WF02-H5 — WF02-S04 network / role scope**

| Field | Record |
|---|---|
| Context | The bitmap shows an activity journal and person-level approver names; neither is stored |
| Decision | S04 shows CommunityMembership, LeadershipRecord, and canonical Project/Startup role/relation when available, with the source/trust classification that canonical data supports. No invented approver names ("Trần Quốc Huy duyệt" or similar) unless stored canonically. Activity Journal is **FUTURE / INTENTIONAL-P0-SCOPE** |
| Rationale | Honours the WF02 trust rule without fabricated history |
| Consequences | Provenance label comes from `community_memberships.source` only (P11 stays open) |
| Affected screens | WF02-S04 |
| API/data impact | `GET /me/network`: `memberships`, `leadership`, `roles` (venture relations); `activity_summary` is always `[]` |
| Supersedes/amends | Narrows SCR WF02-S04 `ActivityRecord` |
| Source anchors | WF02 S04 and "Profile trust rule"; SOT:116; GAPS P11; API §5.1 |

<a id="dec-wf02-h6"></a>**DEC-WF02-H6 — Minimal P0 venture write model**

| Field | Record |
|---|---|
| Context | The PRO1 bitmap draws groups A–J; the contracts define only five fields |
| Decision | Client-written fields: `type`, `name`, `summary`, `domain_ids`, `region_id`. Server-derived: `owner_profile_id`. Server-managed: lifecycle/status |
| Not in P0 | Fundraising, Data Room, investor fields, `STARTUP_STAGE`, the other A–J fields, unfrozen conditional rules. `metadata` is not a store for unfrozen fields. "Gửi HUB duyệt" appears only if a frozen launch configuration enables review; none exists, so it is omitted |
| Rationale | No invented business fields; one canonical entity that WF05 reuses |
| Consequences | Omitted groups and the review button → INTENTIONAL-P0-SCOPE |
| Affected screens | WF02-S05 |
| API/data impact | `POST/GET/PATCH /ventures*` limited to the five fields |
| Open item | `projects` has **no region column and no domain link** (`001_p0_init.sql:244-255`), and neither P12 nor P13 covers it. See [OPEN-WF02-VENTURE-TAXONOMY-STORAGE](#open-wf02-venture-taxonomy-storage) |
| Supersedes/amends | Freezes API §5.3 body as the full P0 write model |
| Source anchors | API §5.3; WF02 non-goals; Freeze §D4; `db/migrations/001_p0_init.sql:244` |

<a id="dec-wf02-h7"></a>**DEC-WF02-H7 — Venture ownership, team and capabilities**

| Field | Record |
|---|---|
| Context | No authorization rule, team state or invitation storage existed for ventures |
| Ownership | One owner (`owner_profile_id`), the only writer/manager. Members are read-only participants |
| Not in P0 | Editor/Viewer tiers, custom permissions, ownership transfer |
| Team lifecycle | `PENDING_CONFIRMATION → ACTIVE`; terminal `LEFT`, `REMOVED`, `REJECTED`. An email invitation never creates an ACTIVE member |
| Capabilities (`resource:action`) | `venture:read` = owner + confirmed ACTIVE members. `venture:manage` = owner only. `venture:team_manage` = owner only. Never derived from `role_label`. Checks are server-side: actor + capability + resource scope + lifecycle |
| Rationale | The smallest model that lets S05/S06 be authorized |
| Consequences | The S06 permission column shows `role_label` only; the S07 "Chuyển giao" control is omitted (INTENTIONAL-P0-SCOPE). These three identifiers are added to the Matrix when WF02-S05 is implemented (Matrix §E) |
| Affected screens | S05, S06, S07, S01 (H10), S04 |
| DB authorized | **P12 additive migration:** invitation persistence; invitation email / normalised identity target; team lifecycle state (per-entity enum, not `record_state`); uniqueness/integrity |
| API | `/ventures/{id}/team*` per API §5.4 |
| Supersedes/amends | Closes GAPS P12 scope; amends API §5.3 "authorized management relation" |
| Source anchors | API §5.3–5.4; SOT team lifecycle; GAPS P12; Matrix:7, :70 |

<a id="dec-wf02-h8"></a>**DEC-WF02-H8 — WF02-S07 settings scope**

| Field | Record |
|---|---|
| Context | Several S07 sections need providers or storage that P0 does not have |
| Decision | P0 S07 = active sessions list, revoke one session, revoke all sessions, account deletion **request** (a request lifecycle, never direct deletion) |
| Not in P0 | Email change, Google/external identity linking, notification categories, ownership transfer |
| Session data | Only stored data is shown (`user_sessions`: created, expires, revoked). No invented browser/OS/city |
| Rationale | Account lifecycle controls without unsupported auth flows |
| Consequences | Device rows and excluded sections → INTENTIONAL-P0-SCOPE |
| Affected screens | WF02-S07 |
| DB authorized | **Minimal P13 subset:** deletion-request storage only |
| API | `GET /me/sessions`, `DELETE /me/sessions/{id}`, `POST /me/account-deletion-request`. Revoke-all has no endpoint in API §5.5; its shape is frozen in the WF02-S07 task contract as an API addendum |
| Supersedes/amends | Narrows SCR WF02-S07; notification-preference endpoints not used in P0 |
| Source anchors | SCR S07; API §5.5; Auth arch §1; GAPS P13; `001_p0_init.sql:39` |

<a id="dec-wf02-h9"></a>**DEC-WF02-H9 — Member shell**

| Field | Record |
|---|---|
| Context | The shared shell shows nav items, a bell counter and sidebar entries with no P0 Production route |
| Decision | Build the approved shell structure. Only items backed by real P0 Production routes are links. Demo/Future/missing items do not navigate, show no fabricated counter, and claim nothing. They keep their visual presence where Pixel QA needs it but render inert/disabled with accessible semantics. No authorization logic in navigation |
| Rationale | Resolves the CLAUDE.md §5 vs §7 tension |
| Consequences | The bell count "2" is not rendered (INTENTIONAL-P0-SCOPE) |
| Affected screens | Foundation shell: S01, S03, S04, S07 |
| API/data impact | None |
| Supersedes/amends | — |
| Source anchors | CLAUDE.md §2/§5/§7; ME0, ME2, ME6, ME4 |

<a id="dec-wf02-h10"></a>**DEC-WF02-H10 — "Đang chờ bạn"**

| Field | Record |
|---|---|
| Context | No invitation or notification read model exists |
| Decision | The first WF02-S01 build omits the block, classified **TEMPORARY-PRODUCTION-DEPENDENCY**. After H7/P12 lands, it MAY show confirmed canonical venture team invitations only. Never Chapter approval items, generic or Challenge notifications without a canonical source |
| Rationale | No fabricated pending items |
| Consequences | Re-enabling the block is a later, separate task |
| Affected screens | WF02-S01 |
| API/data impact | None now |
| Supersedes/amends | Narrows SCR WF02-S01 `Invitations` |
| Source anchors | SCR S01; API §5.4; GAPS P12/P13 |

<a id="dec-wf02-h11"></a>**DEC-WF02-H11 — Membership request owner (addendum to SCR WF02-S04)**

| Field | Record |
|---|---|
| Context | Freeze §D2 requires a P0 request/pending UI; no screen owned it |
| Decision | WF02-S04 owns the request. Flow: authenticated unmatched member → selects a valid organization → `POST /me/membership-requests` → `PENDING_APPROVAL`. Never self-selection → ACTIVE |
| Display | ACTIVE and PENDING_APPROVAL from canonical membership data |
| Rationale | Fulfils Freeze §D2 |
| Consequences | Approval administration stays WF03. S04 contract `writes` gains CommunityMembership (request only) |
| Affected screens | WF02-S04 |
| API/data impact | `POST /me/membership-requests`. Existing `community_memberships` (`PENDING_APPROVAL`, unique open membership). No migration |
| Supersedes/amends | Amends SCR WF02-S04 `writes: []` |
| Source anchors | Freeze §D2 "P0 UI rule"; API §5.1; `002_p0_schema_alignment.sql:150-167` |

<a id="dec-wf02-h12"></a>**DEC-WF02-H12 — Short full-page pixel references (QA rule)**

| Field | Record |
|---|---|
| Context | A full-page capture is never under 900 px, but four WF02 references are shorter (S01 837, S02 620, S05 883, S06 719) |
| Decision | For references shorter than 900 px: (1) the 1440×900 DPR1 viewport comparison is authoritative; (2) never scale the reference; (3) still produce the full-page capture; (4) crop it to the reference height for comparison; (5) content below that height must be only page/background continuation, with no unexpected UI |
| Scope | Applies to WF03's short references later. `design-reference/final` is not modified |
| Rationale | Closes `SHORT_FULL_PAGE_GAP` ("undefined in the SOT") |
| Consequences | This record is the single documented rule. The harness change (`tests/visual/pixel-qa/qa-screens.ts`, test code) lands with the first WF02 pixel task |
| Affected screens | S01, S02, S05, S06 (WF03 later) |
| API/data impact | None |
| Supersedes/amends | Supplements QA v1.1 §9 |
| Source anchors | `design-reference/final/README.md:4`; QA v1.1 §9; `qa-screens.ts:65` |

<a id="dec-wf02-h13"></a>**DEC-WF02-H13 — S01 copy: RESOLVED_BY_PRECEDENCE**

| Field | Record |
|---|---|
| Context | The S01 bitmap says "còn thiếu ảnh và học vấn" and makes event/solution claims |
| Decision | **RESOLVED_BY_PRECEDENCE**; no new business decision. S01 messaging uses the authoritative completion service and names only actual missing groups, in neutral copy. No "học vấn" unless Education becomes a frozen group. No event/solution eligibility claims |
| Rationale | Freeze §D3 outranks the design bitmap; CLAUDE.md §3 and §7 |
| Consequences | Replaced copy → COPY class, as in [DEC-WF01-S08-D7](#dec-wf01-s08-d7) |
| Affected screens | WF02-S01 |
| API/data impact | `GET /me/profile/completion` |
| Supersedes/amends | — |
| Source anchors | Freeze §D3; CLAUDE.md §3/§7; DEC-WF01-S08-D7 |

<a id="dec-wf02-venture-taxonomy-storage"></a>**DEC-WF02-VENTURE-TAXONOMY-STORAGE — Venture region and domain storage**

**Status:** HUMAN APPROVED — P0.
**Date:** 2026-09-26.
**Resolves:** [OPEN-WF02-VENTURE-TAXONOMY-STORAGE](#open-wf02-venture-taxonomy-storage).
**Amends:** [DEC-WF02-H6](#dec-wf02-h6) (storage only; fields unchanged).

| Field | Record |
|---|---|
| Context | H6 froze `domain_ids` and `region_id` as venture write fields. `projects` has neither a region column nor a domain link, and `metadata` is forbidden for them |
| Decision | Keep all five H6 fields. Canonical persistence: `projects.region_id` → a REGION vocabulary item (nullable); `project_domains (project_id, vocabulary_item_id)` → DOMAIN vocabulary items (zero or more). Never `metadata` JSON, never free text |
| Rules | Only ACTIVE vocabulary items may be newly selected. Archived existing links stay readable. Wrong vocabulary type → rejected. A duplicate domain relation is impossible (unique `project_id, vocabulary_item_id`). Domain replacement is atomic (one transaction) |
| Rationale | Mirrors the frozen profile pattern (`region_vocab_id`, `profile_domains`, DEC-WF01-S06-D1); taxonomy stays controlled (Freeze §D5, CLAUDE.md §3) |
| Consequences | An additive migration is required. It belongs to the S05 foundation task and is **not created now** |
| Affected screens | WF02-S05 (write), WF02-S04 / S01 (read, later) |
| API/data impact | `POST/PATCH /ventures` validate `region_id` / `domain_ids` against vocabulary type and status. New migration: `projects.region_id` FK to `vocabulary_items`; `project_domains` table with FKs and a unique pair |


<a id="open-wf02-venture-taxonomy-storage"></a>**OPEN-WF02-VENTURE-TAXONOMY-STORAGE — Human decision required (found during this freeze)**

| Field | Record |
|---|---|
| Context | DEC-WF02-H6 freezes `domain_ids` and `region_id` as venture write fields |
| Problem | `projects` has no region column and there is no project↔DOMAIN link table (`001_p0_init.sql:244-255`; no later migration adds them). H6 forbids storing them in `metadata`. The only authorized migrations are P12 (team) and the P13 deletion subset. Storing them would therefore need a migration nobody has authorized |
| Options found | (a) Authorize an additive migration for venture region + domain storage (vocabulary-backed IDs, like `profile_domains` / `region_vocab_id`). (b) Drop `domain_ids` / `region_id` from the P0 venture write model |
| Blocks | WF02-S05 (and so S06) |
| Status | **RESOLVED 2026-09-26** by [DEC-WF02-VENTURE-TAXONOMY-STORAGE](#dec-wf02-venture-taxonomy-storage) (option a). Record kept for history |

## DEC-WF02-T00 — Member foundation / network read model (technical)

**Status:** IMPLEMENTATION DECISIONS within approved scope (no new business rule).
**Date:** 2026-09-26.
**Task:** [WF02-T00](../implementation/reports/WF02-T00_member-foundation-network-read-model.md).

| ID | Topic | Decision | Source anchors |
|---|---|---|---|
| <a id="dec-wf02-t00-d1"></a>DEC-WF02-T00-D1 | Member-shell page guard | `/me`, `/me/privacy`, `/me/roles`, `/me/settings`: no session → `/auth`. An account whose onboarding is not DONE → `routeFor(state)` of the one resolver. Page routing only; every API re-authorizes | DEC-WF01-RESUME-D1 (DONE → `/me`); WF01 page-guard convention; CLAUDE.md §4 |
| <a id="dec-wf02-t00-d2"></a>DEC-WF02-T00-D2 | Membership provenance | DTO key `source_type` (05 §11.3 MembershipDTO; §5.1's `source` example is the older spelling, GAPS P11). Values are Data SOT §7 codes only. The dev seed's `PRESEED` maps to `ORGANIZATION_VERIFIED` (Freeze §D2 preseed = confirmed roster, as the roster importer stores it). Any other stored value → `null`, never guessed. Leadership has no provenance column, so none is shown | SOT §7; API §11.3; Freeze §D2; `004_p0_roster_bootstrap.sql` |
| <a id="dec-wf02-t00-d3"></a>DEC-WF02-T00-D3 | `roles` content | `roles` = canonical venture relations (DEC-WF02-H5): `OWNER` via `projects.owner_profile_id`; `MEMBER` via an ACTIVE `project_members` row (not repeated for owned ventures). `role_label` is display text only. `activity_summary` is always `[]` | DEC-WF02-H5/H7; API §5.1 |
| <a id="dec-wf02-t00-d4"></a>DEC-WF02-T00-D4 | Dates and order | `valid_from` / `valid_to` are calendar dates in Asia/Ho_Chi_Minh, as in the §11.3 example. Order: organisation name, then creation, then id; ventures OWNER first, then name | API §11.3 |
| <a id="dec-wf02-t00-d5"></a>DEC-WF02-T00-D5 | Shell and layout | The member route group no longer imposes PageContainer (as the onboarding group); placeholder pages wrap it themselves. The M0-T03 harness shell evidence moves from `/me` (now guarded) to `/projects/new`: `tests/visual/baseline/shell-member.png` is removed and `shell-member-placeholder.png` added. It is a harness baseline, not a design reference | M0-T03; CLAUDE.md §6 |
| <a id="dec-wf02-t00-d6"></a>DEC-WF02-T00-D6 | Bell | Inert deterministic SVG bell with no counter, in place of the OS emoji and "2" | DEC-WF02-H9/H10; precedent DEC-WF01-S08-D7 |

## DEC-WF02-S01 — Account Home

**Status:** IMPLEMENTATION DECISIONS within approved scope.
**Date:** 2026-09-26.
**Task:** [WF02-S01](../implementation/reports/WF02-S01_account-home.md).
**Builds on:** DEC-WF02-H3/H9/H10/H13, DEC-WF02-T00-D1..D6.

| ID | Topic | Decision | Source anchors |
|---|---|---|---|
| <a id="dec-wf02-s01-d1"></a>DEC-WF02-S01-D1 | Lower row composition | "Đang chờ bạn" is omitted (H10, TEMPORARY-PRODUCTION-DEPENDENCY). "Tổ chức của tôi" keeps the approved card geometry but takes the FIRST slot of the two-column row, so no empty card-sized hole leads the row. Pixel: compared with dx −527 (INTENTIONAL-COMPOSITION) | DEC-WF02-H10; ME0 |
| <a id="dec-wf02-s01-d2"></a>DEC-WF02-S01-D2 | Copy | Lede drops "Cộng hai thứ đang chờ bạn". Completion line = "Hồ sơ hoàn thiện {server %}" + "· còn thiếu {labels of the server's incomplete groups}" (labels: họ và tên, ảnh đại diện, chức danh, tỉnh / thành phố, giới thiệu, lĩnh vực, kỹ năng, kinh nghiệm, mục tiêu phát triển, nhu cầu hiện tại). Event/solution claims → "Bạn có thể cập nhật hồ sơ bất cứ lúc nào." Card descriptions drop education, viewer history, email change and notifications (Future per H4/H8). Pending PO copy review | DEC-WF02-H13, H4, H8; DEC-WF01-S08-D7 |
| <a id="dec-wf02-s01-d3"></a>DEC-WF02-S01-D3 | Organisation rows | Only from `GET /me/network`, in order: ventures (OWNER "Chủ sở hữu · startup/dự án"; MEMBER `role_label` or "Thành viên"), ACTIVE ("Thành viên · {type}") and PENDING_APPROVAL ("Đang chờ duyệt") memberships, ACTIVE leadership ("{title} · {type}"). Ended states are left to S04. Links follow SCR S01 actions: owner venture → `/projects/:id/edit` (open_project), all others → `/me/roles` (open_roles). No PROSPECT label: no such canonical value exists | SCR WF02-S01; DEC-WF02-H5/H7; DEC-WF02-T00-D3 |
| <a id="dec-wf02-s01-d4"></a>DEC-WF02-S01-D4 | Data loading and failure | The body reads `/session` (own email), `/me/profile`, `/me/profile/completion` and `/me/network` from the client. Profile and network sections fail independently with "Thử lại". The avatar image renders only when the completion service counts AVATAR complete (a stored, valid asset) | CLAUDE.md §3/§4; DEC-WF01-S06-D3 |
| <a id="dec-wf02-s01-d5"></a>DEC-WF02-S01-D5 | "Điền nốt" | Shown only below 100%; links to `/me/profile/edit` (frozen route; body lands with S02). 80% is not presented as a gate | Freeze §D3; DEC-WF02-H1 |
| <a id="dec-wf02-s01-d6"></a>DEC-WF02-S01-D6 | Pixel fixture and H12 harness | The QA state (60%, owned startup, ACTIVE Chapter 01) is set by a test-only hook on the seeded member, then the seed is restored. The first application of DEC-WF02-H12 lands in the harness: short full-page references are no longer dry-run gaps; the full-page capture is cropped to the reference height and rows below are checked against the reference's last row | DEC-WF02-H12; Pixel QA §4/§9 |

## DEC-WF02-S03 — Privacy & Visibility

**Status:** IMPLEMENTATION DECISIONS within approved scope.
**Date:** 2026-09-26.
**Task:** [WF02-S03](../implementation/reports/WF02-S03_privacy-visibility.md).
**Builds on:** DEC-WF02-H3/H4, DEC-WF01-S07-D1..D8, DEC-WF02-T00-D1.

| ID | Topic | Decision | Source anchors |
|---|---|---|---|
| <a id="dec-wf02-s03-d1"></a>DEC-WF02-S03-D1 | Composition | Card 1 keeps the approved frame and its first row only: the PROFILE_DISCOVERY switch. The Future rows and footnote, the viewer-history card and the "Dữ liệu của bạn" card are not rendered (INTENTIONAL-P0-SCOPE). The freed area holds the H4 content, which has no approved geometry: "Điều khoản đang áp dụng" (current Terms/Privacy, "Đọc" link, re-acceptance) and "Lịch sử đồng ý". Both reuse this screen's eyebrow/row/divider pattern and are not pixel-compared (INTENTIONAL-CONTRACT) | DEC-WF02-H4; DEC-WF01-S07-D3 |
| <a id="dec-wf02-s03-d2"></a>DEC-WF02-S03-D2 | Copy | The eyebrow is "HIỂN THỊ HỒ SƠ", not "ĐỒNG Ý THEO MỤC ĐÍCH": visibility is not consent. The hint "Google tìm thấy được…" becomes "Chỉ thành viên mạng lưới thấy. Tắt thì không ai tìm ra bạn." The lede (which claimed revocation) becomes "Bạn quyết định ai thấy thẻ hồ sơ của mình. Thay đổi có hiệu lực ngay." History states read "phiên bản hiện hành / phiên bản cũ / đã rút lại". Pending PO copy review | DEC-WF02-H3/H4; DEC-WF01-S07-D2 |
| <a id="dec-wf02-s03-d3"></a>DEC-WF02-S03-D3 | APIs | No new or changed API. The page reuses `GET/PUT /me/visibility`, `GET /legal/current`, `GET /me/consents` and `POST /me/consents/accept` (Idempotency-Key per document version). "Accepted" = a non-revoked record of the same type and the current version, the WF01-S07 client rule; a stale record stays in the history | DEC-WF01-S07-D1/D8; API 05 §4.5 |
| <a id="dec-wf02-s03-d4"></a>DEC-WF02-S03-D4 | Switch and re-acceptance | The switch saves immediately (`PUT`) and shows the server's answer; a failed save keeps the previous state with an error. Re-acceptance needs the explicit acknowledgement (as WF01-S07-D1), sends only the missing current documents, and handles 409 by reloading the new version. It never changes visibility, profile status or `onboarding_completed_at` | DEC-WF01-S07-D1/D4/D8 |
| <a id="dec-wf02-s03-d5"></a>DEC-WF02-S03-D5 | Repeated evidence | The 46×26 switch now appears on two approved references (WF01-S07, WF02-S03); the card frame (radius 14, #e4dede border, soft shadow) on two WF02 references (S01, S03). Recorded here; the values stay local until promoted by a design-system task | CLAUDE.md §7; Design SOT §2.5 |
| <a id="dec-wf02-s03-d6"></a>DEC-WF02-S03-D6 | Legal content | Documents and texts come from `legal_documents` (fixture content in dev). PRODUCTION_LEGAL_CONTENT_REQUIRED stays a release dependency | DEC-WF01-S07 legal fixture note |

## OPEN-WF02-S04 — Membership request preflight gaps (human decision required)

**Status:** CLOSED 2026-09-26 by [DEC-WF02-S04-G1..G5](#dec-wf02-s04-g1) (history kept). Found by the WF02-S04 preflight.
**Report:** [WF02-S04 preflight](../implementation/reports/WF02-S04_roles-network.md).

**Supported without a decision:**
- memberships and leadership (T00 read model);
- PENDING_APPROVAL (`membership_state`);
- `POST /me/membership-requests` shape (API §5.1);
- duplicate and concurrency protection (`uq_open_membership`, PENDING_APPROVAL/ACTIVE);
- source `SELF_DECLARED` for a request.

| ID | Gap | Evidence | Options found | Recommended |
|---|---|---|---|---|
| <a id="open-wf02-s04-g1"></a>S04-G1 | No member-facing source for the organisations a member may choose, and the "requestable" rule is only partly frozen | API has `/ops/organizations` (managers only), `/organizations/{orgId}` and `/by-slug/{slug}` (known target only); Data SOT:168/566 names HUB/Chapter/CLB; nothing freezes publication status | (a) `/me/roles` server-renders the options from `organizations` where type ∈ {HUB, CHAPTER, CLB} and status = PUBLISHED, the same predicate the POST validates; no new API route. (b) API addendum `GET /organizations?requestable=true` → `{id, name, type}`. (c) Defer the request action | (a) |
| <a id="open-wf02-s04-g2"></a>S04-G2 | Audit action for a membership request is required but has no frozen code | Data SOT:93 (AuditLog required for membership changes); Auth arch:208; CLAUDE.md §4 | `MEMBERSHIP_REQUESTED` on `community_membership`, after `{organization_id, state: PENDING_APPROVAL}`, request id | `MEMBERSHIP_REQUESTED` |
| <a id="open-wf02-s04-g3"></a>S04-G3 | 409 "duplicate relation" has no frozen error code for this endpoint | API §2.5 (409 meaning); frozen list has `MEMBERSHIP_INVALID_TRANSITION` (ops PATCH) | (a) reuse `MEMBERSHIP_INVALID_TRANSITION`; (b) new decision code (e.g. `MEMBERSHIP_REQUEST_CONFLICT`) | (a) |
| <a id="open-wf02-s04-g4"></a>S04-G4 | Whether a new request is allowed when the member already has a SUSPENDED, ALUMNI, REJECTED or WITHDRAWN membership in that organisation | DB blocks only PENDING_APPROVAL/ACTIVE; API §13 "REJECTED → ACTIVE requires explicit reopen/new process" | 409 for ACTIVE, PENDING_APPROVAL and SUSPENDED; a new PENDING_APPROVAL record allowed after REJECTED, WITHDRAWN or ALUMNI (history kept) | as stated |
| <a id="open-wf02-s04-g5"></a>S04-G5 | The H11 design / screen-contract addendum for the request UI was never produced; SCR S04 still has `writes: []` | DEC-WF02-H11 ("Add a design/screen-contract addendum") | (a) Reuse the S04 card/row pattern: one card with an organisation select + "Gửi yêu cầu" (INTENTIONAL-CONTRACT, not pixel-compared), as S03 did for H4 content. (b) Wait for a design addendum | (a) |

Not a gap: `membership_requested` analytics stays deferred (DEC-WF01-ANALYTICS-EXT-DEFER). RoleAssignment is listed in SCR S04 reads, but H5 fixes the S04 content without it.

## DEC-WF02-S04 — Membership request (G1–G5, human approved)

**Status:** HUMAN APPROVED — P0.
**Date:** 2026-09-26.
**Closes:** [OPEN-WF02-S04 G1–G5](#open-wf02-s04-g1).
**Remaining S04 human decisions:** 0.

<a id="dec-wf02-s04-g1"></a>**DEC-WF02-S04-G1 — Requestable organisations**

| Field | Record |
|---|---|
| Context | No member-facing source for the organisations a member may request; status rule not frozen (G1) |
| Decision | No generic organisation-directory API. The `/me/roles` server flow reads requestable organisations from the canonical organisations table: type ∈ {HUB, CHAPTER, CLB} and the existing `publication_status` value `PUBLISHED`. `POST /me/membership-requests` re-checks the same predicate; the UI list is convenience only |
| Rationale | Data SOT:168/566 name HUB/Chapter/CLB; PUBLISHED is the existing live state of `publication_status` |
| Consequence | Only `organization_id` is read from the client; an unknown, unpublished or other-type organisation is 404 (hidden) |
| Affected | API `POST /me/membership-requests`; UI `/me/roles` selector; data read only |
| Anchor | S04-G1; Data SOT:168, 566; `001_p0_init.sql` `publication_status` |

<a id="dec-wf02-s04-g2"></a>**DEC-WF02-S04-G2 — Audit action**

| Field | Record |
|---|---|
| Context | Data SOT:93 and Auth arch:208 require an audit record for membership changes |
| Decision | `MEMBERSHIP_REQUESTED`, written in the request's transaction only when a record is created: resource `community_membership` / new id, after `{organization_id, state: PENDING_APPROVAL}`, request id |
| Rationale | Minimum identifiers and state transition; the existing audit writer |
| Consequence | Nothing for refused or failed requests; no email, profile copy, roster data or metadata |
| Affected | `audit_events`; `AuditAction` type |
| Anchor | S04-G2 |

<a id="dec-wf02-s04-g3"></a>**DEC-WF02-S04-G3 — Conflict error**

| Field | Record |
|---|---|
| Context | 409 "duplicate relation" had no code for this endpoint |
| Decision | Reuse the frozen `MEMBERSHIP_INVALID_TRANSITION` (409) in the standard error envelope; no new code |
| Rationale | The refusal is a membership lifecycle conflict (API §13) |
| Consequence | Also used when the database uniqueness rejects a concurrent duplicate |
| Affected | API error mapping |
| Anchor | S04-G3; API §2.5, §13 |

<a id="dec-wf02-s04-g4"></a>**DEC-WF02-S04-G4 — Re-request lifecycle**

| Field | Record |
|---|---|
| Context | The database blocks only open (PENDING_APPROVAL, ACTIVE) duplicates |
| Decision | Existing membership in the same organisation: ACTIVE, PENDING_APPROVAL, SUSPENDED or ALUMNI → 409 `MEMBERSHIP_INVALID_TRANSITION`. REJECTED or WITHDRAWN → a new PENDING_APPROVAL record is allowed. Old records are never changed or reactivated |
| Rationale | API §13: a rejected membership needs a new process, never a silent reopen |
| Consequence | History is preserved; ALUMNI is not converted in P0 |
| Affected | `community_memberships` inserts only |
| Anchor | S04-G4 |

<a id="dec-wf02-s04-g5"></a>**DEC-WF02-S04-G5 — S04 screen-contract addendum (fulfils DEC-WF02-H11)**

| Field | Record |
|---|---|
| Context | H11 required an addendum; SCR S04 had `writes: []` |
| Decision | Addendum: WF02-S04 also `writes: CommunityMembership (request → PENDING_APPROVAL)` with action `request_membership`. UI: one card in the S04 card/row language with one organisation selector and one "Gửi yêu cầu" action. Nothing else in S04 changes |
| Rationale | The business requirement was frozen after the bitmap |
| Consequence | The added region is INTENTIONAL-CONTRACT and not pixel-compared; unchanged regions keep the approved bitmap as reference; `design-reference/final` untouched |
| Affected | UI `/me/roles`; SCR WF02-S04 (addendum recorded here, SOT file unchanged) |
| Anchor | S04-G5; DEC-WF02-H11 |

## DEC-WF02-S04-D — Roles & Network implementation decisions

**Status:** IMPLEMENTATION DECISIONS within approved scope (G1–G5, H5, H11).
**Date:** 2026-09-26.
**Task:** [WF02-S04](../implementation/reports/WF02-S04_roles-network.md).

| ID | Topic | Decision | Source anchors |
|---|---|---|---|
| <a id="dec-wf02-s04-d1"></a>DEC-WF02-S04-D1 | Rows | One row per canonical record from `GET /me/network`, in order: ventures, memberships (every stored state, labelled: Thành viên, Đang chờ duyệt, Không được duyệt, Đã rút yêu cầu, Tạm ngưng, Cựu thành viên), leadership (title; "đã kết thúc"/"đã thu hồi" for ALUMNI/REVOKED). Rows are read-only (no navigation), per SCR "system-recorded history is read-only". Chip = organisation or venture type | SCR WF02-S04; DEC-WF02-H5 |
| <a id="dec-wf02-s04-d2"></a>DEC-WF02-S04-D2 | Right-hand provenance | Stored source only: SELF_DECLARED → "Tự khai báo", ORGANIZATION_VERIFIED → "Tổ chức xác nhận", SYSTEM_RECORDED → "Hệ thống ghi nhận", plus "từ {start date}" when stored. Venture owner/team relations are server-recorded → "Hệ thống ghi nhận". Leadership has no source column → date only. Never an approver name (bitmap "Trần Quốc Huy duyệt", "HUB tổng gán" = INTENTIONAL-CONTRACT) | Data SOT §7; DEC-WF02-T00-D2; DEC-WF02-H5 |
| <a id="dec-wf02-s04-d3"></a>DEC-WF02-S04-D3 | Request card copy and behaviour | Eyebrow "YÊU CẦU THAM GIA TỔ CHỨC", label "Tổ chức", placeholder "Chọn tổ chức", action "Gửi yêu cầu", hint "Yêu cầu sẽ ở trạng thái chờ duyệt cho đến khi tổ chức xác nhận." The selector hides organisations where a blocking state exists (G4). After any attempt the view reloads `GET /me/network`; 409/404 get their own messages. Idempotency-Key per organisation. The lede is kept verbatim. Pending PO copy review | DEC-WF02-S04-G1/G3/G4/G5 |
| <a id="dec-wf02-s04-d4"></a>DEC-WF02-S04-D4 | Pixel fixture | The reference's third row (a Chapter leadership) is added to the seeded member by a test-only hook with a fixed id, deleted after the run | Pixel QA §4 |

## DEC-WF02-S02 — Profile Edit implementation decisions

**Status:** IMPLEMENTATION DECISIONS within approved scope (DEC-WF02-H1/H2/H3; API 05 §4.3).
**Date:** 2026-09-26.
**Task:** [WF02-S02](../implementation/reports/WF02-S02_profile-edit.md).
**Migration:** none; every field uses existing storage.

| ID | Topic | Decision | Source anchors |
|---|---|---|---|
| <a id="dec-wf02-s02-d1"></a>DEC-WF02-S02-D1 | Experience write shape | `PATCH /me/profile` accepts `experience: [{title, organization_name?}]`, the fields the GET DTO already returns. The list replaces the stored one, in order. `title` is required; unknown item keys are refused; technical bounds are 20 items and 200 characters. `no_experience_yet: boolean` sets the explicit flag. Records and the flag never coexist: a PATCH whose result would hold both is 422 `no_experience_yet: conflicts_with_experience` (the UI clears the list when the box is ticked) | Freeze §D3 group 8; DEC-WF02-H1; `profile_experience`, `no_experience_yet` |
| <a id="dec-wf02-s02-d2"></a>DEC-WF02-S02-D2 | Goal and need | `development_goal` and `current_need` (API §4.3 example) are trimmed; blank → null (the group becomes incomplete). Technical bound 2000, as bio | API 05 §4.3; DEC-WF02-H1 |
| <a id="dec-wf02-s02-d3"></a>DEC-WF02-S02-D3 | Links | The approved "Liên kết ngoài" field writes `links: [{url, label?}]` to `profile_links`, replacing the list in order. Only absolute http(s) URLs are stored (no `javascript:` or other schemes); technical bounds are 5 links and 500 characters. The client prefixes `https://` to a bare host. Not a completion group | DEC-WF02-H2; `profile_links` |
| <a id="dec-wf02-s02-d4"></a>DEC-WF02-S02-D4 | Activation minimum | An ACTIVE profile cannot clear `display_name` (including whitespace) or `region_id`: 422 `required`. DRAFT onboarding (WF01-S06) is unchanged | Freeze §D3 activation minimum |
| <a id="dec-wf02-s02-d5"></a>DEC-WF02-S02-D5 | Layout | Editor header (no member shell), as the bitmap. Approved fields unchanged. The H1 sections (Kinh nghiệm, Mục tiêu phát triển, Nhu cầu hiện tại) sit below them, and are the only content below the 620px full-page reference height. The freed activity-panel slot holds "THÔNG TIN CƠ BẢN" (avatar, Họ và tên, Tỉnh / thành phố) so every completion group is editable on S02. All of these are INTENTIONAL-CONTRACT | DEC-WF02-H1/H2; DEC-WF02-H12 |
| <a id="dec-wf02-s02-d6"></a>DEC-WF02-S02-D6 | Copy | Status reads "Hiển thị trong mạng lưới" / "Đang ẩn khỏi mạng lưới" from PROFILE_DISCOVERY, plus "đã lưu lúc HH:MM" after a save. "Xem bản public" is omitted (H3). The note body becomes "Email đăng nhập thuộc tài khoản, không phải một ô trong hồ sơ, và không hiển thị cho người khác." (the bitmap's contact-consent claim is not P0). "≤ 60 từ" stays guidance only: no frozen limit exists and WF01-S06 accepts longer text. Pending PO copy review | DEC-WF02-H3/H4; DEC-WF01-S07-D2 |
| <a id="dec-wf02-s02-d7"></a>DEC-WF02-S02-D7 | Save semantics | "Lưu" sends one PATCH with only the fields changed since the last successful save (an unchanged save sends `{}`); the server validates everything before the first write and recomputes completion. The avatar uses the existing upload route immediately. `GET /me/profile` gains the additive `no_experience_yet` | API 05 §4.3; DEC-WF01-S06-D3 |

## OPEN-WF02-S07 — Settings preflight gaps (human decision required)

**Status:** CLOSED 2026-09-26 by [DEC-WF02-S07-G1..G6](#dec-wf02-s07-g1) (history kept). SEC-OBS-01 below stays OPEN as a separate remediation task.
**Report:** [WF02-S07 preflight](../implementation/reports/WF02-S07_settings-sessions-deletion-request.md).

**Supported without a decision:**
- `user_sessions` (id, account_id, token_hash, expires_at, revoked_at, created_at);
- owner key `account_id`;
- revocation by `revoked_at`, filtered in `resolveSession`;
- expiry by `expires_at`;
- `GET /me/sessions` and `DELETE /me/sessions/{sessionId}` (API §5.5);
- `revokeAllSessionsForAccount` in code;
- current session identifiable server-side (`sessionId` from the cookie's token hash);
- safe DTO fields: id (a uuid, not the token), created_at, expires_at, current. No device, last-used or IP data is stored.

| ID | Gap | Evidence | Options found | Recommended |
|---|---|---|---|---|
| <a id="open-wf02-s07-g1"></a>S07-G1 | P13 persistence shape is not frozen: table, columns, states | API §5.5 "controlled deletion/deactivation request"; DEC-WF02-H8 "deletion-request storage only"; GAPS P13 names no fields | (a) Minimal: `account_deletion_requests(id, account_id → user_accounts, requested_at, request_id)`, no status and no processing fields (no workflow is frozen). (b) Same plus a status column, with its values frozen first | (a) |
| <a id="open-wf02-s07-g2"></a>S07-G2 | Duplicate rule | nothing frozen | (a) One request per account, DB `UNIQUE(account_id)`; a repeat returns the existing request (200). (b) Allow several, one "open" (needs G1 b) | (a) |
| <a id="open-wf02-s07-g3"></a>S07-G3 | Venture-owner precondition: the bitmap disables "Yêu cầu xoá tài khoản" for an owner ("Phải chuyển giao … trước khi xoá") but transfer is Future (H7/H8) | S07 bitmap; DEC-WF02-H7/H8 | (a) The request is always allowed; ownership is left to later processing; a neutral note. (b) 409 while the member owns a venture, so owners cannot request in P0 | (a) |
| <a id="open-wf02-s07-g4"></a>S07-G4 | Audit: the deletion request is a sensitive account-lifecycle mutation (CLAUDE.md §4) with no frozen action code. Session revocation is outside the Data SOT audit list, and logout writes none today | CLAUDE.md §4; Data SOT:93; Auth arch:208 | `ACCOUNT_DELETION_REQUESTED` (after `{requested: true}`, request id). Sessions: no audit (as logout), or `SESSION_REVOKED` | `ACCOUNT_DELETION_REQUESTED`; no session audit |
| <a id="open-wf02-s07-g5"></a>S07-G5 | Revoke-all endpoint shape (H8 delegated it to this task contract, which does not state it) | DEC-WF02-H8; API §5.5 | (a) `DELETE /me/sessions` → 204, clears the cookie. (b) `POST /auth/logout-all` | (a) |
| <a id="open-wf02-s07-g6"></a>S07-G6 | Outcomes: foreign vs unknown vs already-revoked session; repeat deletion request | API §2.5; §13 | Foreign or unknown id → 404 (no probing); own revoked/expired → 204 (idempotent); own current → 204 + cookie cleared; repeat deletion request → 200 with the existing request | as stated |

**Security observation SEC-OBS-01 (not part of S07 scope; not fixed):**
- `/auth/callback?token=…` loads its same-origin CSS/JS with the full callback URL, including the token, in the `Referer` header. 10 requests were observed.
- The `<meta name="referrer" content="no-referrer">` comes after those links, and no `Referrer-Policy` header is sent.
- The application log does not contain the token.
- Risk: server or proxy access logs that record Referer.
- Candidate fix, separate task: a `Referrer-Policy: no-referrer` response header on `/auth/callback`.

## DEC-WF02-S07 — Settings, sessions and deletion request (G1–G6, human approved)

**Status:** HUMAN APPROVED — P0.
**Date:** 2026-09-26.
**Closes:** [OPEN-WF02-S07 G1–G6](#open-wf02-s07-g1).
**Remaining S07 human decisions:** 0.

<a id="dec-wf02-s07-g1"></a>**DEC-WF02-S07-G1 — P13 storage**

| Field | Record |
|---|---|
| Context | API §5.5 and DEC-WF02-H8 authorised deletion-request storage without a shape |
| Decision | `account_deletion_requests(id uuid PK, account_id uuid NOT NULL → user_accounts, requested_at timestamptz NOT NULL DEFAULT now())`, `UNIQUE(account_id)`. Nothing else: no status, processing, retention, grace, cancellation, reason or metadata |
| Rationale | Request storage only; no workflow is frozen |
| Consequences | Additive migration `006_p0_account_deletion_request.sql`; older migrations untouched |
| Affected | DB |
| Anchor | S07-G1; GAPS P13 |

<a id="dec-wf02-s07-g2"></a>**DEC-WF02-S07-G2 — One request per account**

| Field | Record |
|---|---|
| Context | No duplicate rule existed |
| Decision | The first request creates the row → 201. Any later request by the same account returns that row → 200, with no new row. Concurrent requests leave exactly one row (`UNIQUE(account_id)` + `ON CONFLICT DO NOTHING`) |
| Rationale | The database is authoritative, not the client |
| Consequences | Idempotency-Key replay is optional; the uniqueness rule decides |
| Affected | DB, API |
| Anchor | S07-G2 |

<a id="dec-wf02-s07-g3"></a>**DEC-WF02-S07-G3 — Request always available**

| Field | Record |
|---|---|
| Context | The bitmap disabled the action for venture owners pending a transfer, which is Future |
| Decision | "Yêu cầu xoá tài khoản" is enabled for every member, behind a deliberate confirmation. It is a request only; nothing is deleted or deactivated |
| Rationale | P0 business contract supersedes the bitmap state |
| Consequences | INTENTIONAL-CONTRACT pixel difference; the transfer button and owner warning are not rendered (INTENTIONAL-P0-SCOPE) |
| Affected | UI |
| Anchor | S07-G3; DEC-WF02-H7/H8 |

<a id="dec-wf02-s07-g4"></a>**DEC-WF02-S07-G4 — Audit**

| Field | Record |
|---|---|
| Context | The deletion request is a sensitive account-lifecycle mutation (CLAUDE.md §4) |
| Decision | `ACCOUNT_DELETION_REQUESTED`, resource `account_deletion_request` / new id, written once in the same transaction as the first insert. A repeat writes nothing. Session revocation writes no audit (outside the Data SOT audit list, as logout) |
| Rationale | Exactly-once, minimal payload |
| Consequences | Never tokens, hashes, cookies, email or raw auth data |
| Affected | `audit_events`, `AuditAction` |
| Anchor | S07-G4 |

<a id="dec-wf02-s07-g5"></a>**DEC-WF02-S07-G5 — Revoke all**

| Field | Record |
|---|---|
| Context | H8 left the revoke-all route to this task |
| Decision | `DELETE /me/sessions`: revokes every valid session of the account, including the current one, in one statement; 204; clears the cookie. No other logout-all endpoint |
| Rationale | The collection resource of API §5.5 |
| Consequences | The next protected request is 401 / redirect to /auth |
| Affected | API |
| Anchor | S07-G5; API §5.5 |

<a id="dec-wf02-s07-g6"></a>**DEC-WF02-S07-G6 — Outcomes**

| Field | Record |
|---|---|
| Context | Outcome semantics were unconfirmed |
| Decision | `GET /me/sessions` 200 with caller-owned active sessions only. `DELETE /me/sessions/{id}`: own active → 204; own current → 204 + cookie cleared; own already revoked/expired → 204 (idempotent); foreign or unknown (or malformed) → 404 `UNCONTRACTED_NOT_FOUND` alike. `DELETE /me/sessions` → 204 + cookie cleared. `POST /me/account-deletion-request` (API §5.5): 201 / 200 as G2. Every route: unauthenticated → 401 |
| Rationale | No existence leak, idempotent retries |
| Consequences | A deletion request never touches account, profile, membership, leadership, roles, ventures, consents, visibility, media or sessions |
| Affected | API |
| Anchor | S07-G6; API §2.5, §13 |

## DEC-WF02-S07-D — Settings implementation decisions

**Status:** IMPLEMENTATION DECISIONS within approved scope (H8, G1–G6).
**Date:** 2026-09-26.
**Task:** [WF02-S07](../implementation/reports/WF02-S07_settings-sessions-deletion-request.md).

| ID | Topic | Decision | Source anchors |
|---|---|---|---|
| <a id="dec-wf02-s07-d1"></a>DEC-WF02-S07-D1 | Session rows | `SessionDTO {id, created_at, expires_at, current}`; current first, then newest. Row title "Phiên này" / "Phiên đăng nhập"; detail "bắt đầu {dd/mm/yyyy HH:MM} · hết hạn {dd/mm/yyyy}" (Asia/Ho_Chi_Minh). Current row shows the "Hiện tại" pill (no button, as the bitmap); other rows "Đăng xuất". Revoking this browser's session or all sessions sends it to `/auth` after the server cleared the cookie | DEC-WF02-H8; DEC-WF02-S07-G5/G6 |
| <a id="dec-wf02-s07-d2"></a>DEC-WF02-S07-D2 | Copy | Login card: email + "Email đăng nhập · đã xác thực" (no verification date is stored) and the approved passwordless note (the 15-minute link matches `MAGIC_LINK_EXPIRES_IN_SECONDS = 900`). Danger card: request-only wording, "Yêu cầu xoá tài khoản" → confirmation "Bạn chắc chắn muốn gửi yêu cầu xoá tài khoản?" / "Xác nhận gửi yêu cầu" / "Huỷ"; after a request "Đã nhận yêu cầu xoá tài khoản lúc {time}." + "Tài khoản của bạn vẫn hoạt động; yêu cầu không xoá dữ liệu nào ngay lập tức." No processing promise. Pending PO copy review | DEC-WF02-S07-G3; API §5.5 |
| <a id="dec-wf02-s07-d3"></a>DEC-WF02-S07-D3 | Existing request and pixel fixture | The page reads the owner's request server-side (no GET route). The pixel run keeps only the session it just created for the seeded member and removes a leftover request (test-only hook) | Pixel QA §4 |

## Related
- [WF02_HUMAN_DECISION_PACKET.md](../implementation/WF02_HUMAN_DECISION_PACKET.md) — WF02 H1–H13 packet (frozen above)

- [p0-status.md](../implementation/P0_STATUS.md) — overall P0 state
- [wf01-s03-state-board-mapping.md](../implementation/WF01_S03_STATE_BOARD_MAPPING.md) — S03 mapping
- [wf01-s04-state-board-mapping.md](../implementation/WF01_S04_STATE_BOARD_MAPPING.md) — S04 mapping (frozen)
- [wf01-s05-intent-contract-gap.md](../implementation/WF01_S05_INTENT_CONTRACT_GAP.md) — S05 intent contract (approved)
- [wf01-s06-profile-field-contract.md](../implementation/WF01_S06_PROFILE_FIELD_CONTRACT.md) — S06 field contract (approved)
- [wf01-s07-privacy-consent-contract.md](../implementation/WF01_S07_PRIVACY_CONSENT_CONTRACT.md) — S07 consent contract (approved)
- [wf01-s08-completion-contract.md](../implementation/WF01_S08_COMPLETION_CONTRACT.md) — S08 completion contract (approved)
