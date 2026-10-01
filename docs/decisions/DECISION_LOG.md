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
| <a id="dec-wf01-s05-d1"></a>DEC-WF01-S05-D1 | **SUPERSEDED in part by [DEC-L1R-D3](#dec-l1r-d3): the purpose screen is gone; the endpoint and its allowlist stay as contracted, outside the flow.** Intent allowlist | API 05 §4.2 leaves `primary_intent` to launch configuration; none existed | P0 server-side allowlist `SUBMIT_SOLUTION`, `POST_CHALLENGE`, `ORGANIZE_COMMUNITY`, `EXPLORE_NETWORK`; no `INVESTOR`; unknown values rejected (422 `PROFILE_VALIDATION_FAILED`), never coerced (no trim, no case folding) | Investor/VC/Dataroom is Future scope; exact match keeps stored data clean | `src/lib/onboarding/intent.ts`; DB tests reject 9 values and write nothing; Playwright 422 for `INVESTOR`, `UNKNOWN`, lowercase, empty, null | Bitmap investor option not rendered: INTENTIONAL-P0-SCOPE in pixel QA | — |
| <a id="dec-wf01-s05-d2"></a>DEC-WF01-S05-D2 | **SUPERSEDED by [DEC-L1R-D3](#dec-l1r-d3): the purpose step left the onboarding; `/onboarding/purpose` now holds stage 3 (ACC-08).** Endpoint and payload | Contract freezes `PUT /me/onboarding/intent` | Use the frozen endpoint; persist only `individual_profiles.primary_intent`; the first write creates the DRAFT profile | No schema change; nothing beyond the intent is captured | `setPrimaryIntent` upsert; Playwright checks the DB row (intent, DRAFT, not completed) | No migration | — |
| <a id="dec-wf01-s05-d3"></a>DEC-WF01-S05-D3 | **SUPERSEDED by [DEC-L1R-D3](#dec-l1r-d3): the purpose step left the onboarding; `/onboarding/purpose` now holds stage 3 (ACC-08).** "Bỏ qua, làm sau" | The action was named, its persistence was not | Skips THIS step only: no write, `primary_intent` stays NULL, goes to S06; no fake intent; onboarding not marked complete | A skip must not fabricate data | Playwright: 0 intent requests, no profile row, state `current_step: PURPOSE` | S06 is reached with intent NULL | **Amended by [DEC-WF01-RESUME-D1](#dec-wf01-resume-d1)**: skip now records the Purpose step (still no intent) |
| <a id="dec-wf01-s05-d4"></a>DEC-WF01-S05-D4 | **SUPERSEDED by [DEC-L1R-D3](#dec-l1r-d3): the purpose step left the onboarding; `/onboarding/purpose` now holds stage 3 (ACC-08).** Default selection (**SUPERSEDED in part**: the create-startup entry preselects once HD-A3 maps the code, [DEC-2809-D1](#dec-2809-d1)) | The bitmap shows option 1 selected | Nothing selected by default; a saved value is preselected | The runtime must not fabricate an intent | Playwright: 0 checked, CTA disabled; saved value checked | Pixel QA selects option 1 in-page (no submit) to match the reference | — |
| <a id="dec-wf01-s05-d5"></a>DEC-WF01-S05-D5 | **SUPERSEDED by [DEC-L1R-D3](#dec-l1r-d3): the purpose step left the onboarding; `/onboarding/purpose` now holds stage 3 (ACC-08).** Unauthenticated access | No page guard existed | Server-authoritative guard: no valid session → redirect `/auth` | Access control must not depend on the client | Playwright: guest → `/auth`; API 401 for guests | `shell-routes.spec.ts` treats S05 as a guarded screen | — |
| <a id="dec-wf01-s05-d6"></a>DEC-WF01-S05-D6 | **SUPERSEDED by [DEC-L1R-D3](#dec-l1r-d3): the purpose step left the onboarding; `/onboarding/purpose` now holds stage 3 (ACC-08).** Revisit | WF01: resume at the first incomplete step | Before completion the intent can be edited; once onboarding is completed the page follows the existing rule and redirects to `/me` | Keeps choices reversible until onboarding closes | Playwright: preselected, edited, DB updated; completed → `/me` | — | — |

## DEC-WF01-S06 — Onboarding profile (field contract)

Every row carries these shared fields. **Status:** HUMAN APPROVED — P0. **Date:** 2026-09-26. **Scope:** WF01-S06 `/onboarding/profile`, `GET/PATCH /api/v1/me/profile`, `GET /api/v1/me/profile/completion`, `POST /api/v1/me/profile/avatar`, `GET /api/v1/vocabularies/{type}`, `GET /session` completion. **Evidence (shared):** [WF01_S06_PROFILE_FIELD_CONTRACT.md](../implementation/WF01_S06_PROFILE_FIELD_CONTRACT.md), [WF01-S06 report](../implementation/reports/WF01-S06_onboarding-profile.md).

**Precedence note (not a decision):** `NETWORK_CONTEXT` in the API 05 `/me/profile/completion` example is stale. The Data Decisions Freeze (priority 4) defines group 3 as HEADLINE, which outranks the API example (priority 6). Recorded as **RESOLVED_BY_PRECEDENCE**; the historical SOT is not edited.

| ID | Topic | Context | Decision | Why | Evidence | Impact |
|---|---|---|---|---|---|---|
| <a id="dec-wf01-s06-d1"></a>DEC-WF01-S06-D1 | **SUPERSEDED by [DEC-L1R-D4](#dec-l1r-d4): fields, specialisations and skills are three separate pickers (ACC-07).** "Chuyên môn" | The bitmap shows one expertise picker whose chips mix domains and skills; the Freeze has DOMAIN and SKILL, no EXPERTISE | One UI picker over the existing DOMAIN + SKILL vocabularies; each option keeps its type; DOMAIN ids → `domain_ids`, SKILL ids → `skill_ids`. The server checks existence, type and ACTIVE status for new selections; archived links stay readable. No EXPERTISE taxonomy | Honours the design without inventing a taxonomy; DOMAIN and SKILLS stay separate completion groups | DB tests: wrong type, unknown, archived new → 422; archived kept; Playwright: PATCH body split by type, DB relations | Completion may satisfy DOMAIN and/or SKILLS independently |
| <a id="dec-wf01-s06-d2"></a>DEC-WF01-S06-D2 | **SUPERSEDED by [DEC-L1R-D3](#dec-l1r-d3): stage 1 needs full name, display name, country and province.** Required to leave S06 | The design lede says only photo and bio may be left blank | Continue needs `display_name`, `headline`, `region` and ≥1 DOMAIN/SKILL item; avatar and bio optional. An S06 progression rule only: not the activation minimum, no 80% gate, S06 never activates the profile or completes onboarding | Approved design text; the Freeze keeps activation (name, region, legal) at S08 | Playwright: each missing field blocks with 0 requests; save → S07 with status DRAFT and no `onboarding_completed_at`; onboarding step moves to PRIVACY only when met | `GET /me/onboarding` `current_step` gains PRIVACY |
| <a id="dec-wf01-s06-d3"></a>DEC-WF01-S06-D3 | Avatar storage | `file_assets` is absent (DB gap P9) and no object storage is configured | `POST /me/profile/avatar` (multipart, part `file`) sniffs PNG/JPEG/WebP, stores bytes privately under `MEDIA_STORAGE_DIR` with an opaque `asset_<32 hex>` id and a sidecar owner record; only the id is saved in `avatar_asset_id`; served by `/media/assets/:id` to signed-in sessions, `Cache-Control: private, no-store`. Limits are provisional technical config (2 MiB default). No table, no migration | Smallest abstraction meeting the frozen contract; no public URL is ever canonical | Unit: sniffing, limits, id format; Playwright: upload → id stored, image served, guest 404, non-image refused; completion AVATAR counts only a stored, owned asset | Seeded demo avatar ids point at no stored file, so they count as incomplete |
| <a id="dec-wf01-s06-d4"></a>DEC-WF01-S06-D4 | **SUPERSEDED by [DEC-L1R-D4](#dec-l1r-d4): at most five specialisations; fields and skills are not counted together.** Max 5 | The bitmap says "chọn tối đa 5" | `count(domain_ids) + count(skill_ids) ≤ 5`, counting kept relations; enforced in the picker (further chips disabled) and on the server (422 `PROFILE_VALIDATION_FAILED`) | Design is authoritative for S06; no bypass by direct API | DB tests (incl. kept relations); Playwright: UI stops at 5, API 422 for 6 | Existing error envelope only |
| <a id="dec-wf01-s06-d5"></a>DEC-WF01-S06-D5 | **SUPERSEDED by [DEC-L1R-D7](#dec-l1r-d7): every stage has "Lưu và hoàn tất sau" in the header.** No skip on S06 | The bitmap header shows "Bỏ qua, làm sau"; the Screen Contract lists only `upload_avatar`, `save_profile` | S06 has no skip; the header action is not rendered and no no-op button is created. The header keeps the action column width, so the stepper stays where the baselines place it | Contract actions win over a visual element | Playwright: no skip text, no header link or button | Pixel: INTENTIONAL-CONTRACT at the skip region |
| <a id="dec-wf01-s06-d6"></a>DEC-WF01-S06-D6 | **SUPERSEDED by [DEC-L1R-D8](#dec-l1r-d8): the ACC-07 fixture replaces the file.** QA vocabulary | The seed has 2 DOMAIN + 2 SKILL items; the bitmap shows 7 chips and "+ 42 nhóm khác" | `tests/visual/fixtures/wf01-s06-qa-vocabulary.sql`: 45 ACTIVE + 1 ARCHIVED QA-only items with deterministic ids, applied only by the S06 spec; never a production seed, never hard-coded, not launch taxonomy | Pixel parity without touching production data | Chip count and labels come from the database; the "+ N" count is computed | Dev database keeps the QA items after a test run |

## DEC-WF01-S07 — Privacy & visibility (consent contract)

Every row carries these shared fields. **Status:** HUMAN APPROVED — P0. **Date:** 2026-09-26. **Scope:** WF01-S07 `/onboarding/privacy`, `GET /legal/current`, `/legal/{kind}/{version}`, `GET /me/consents`, `POST /me/consents/accept`, `GET/PUT /me/visibility`, `/media/assets/:id` authorisation. **Evidence (shared):** [WF01_S07_PRIVACY_CONSENT_CONTRACT.md](../implementation/WF01_S07_PRIVACY_CONSENT_CONTRACT.md), [WF01-S07 report](../implementation/reports/WF01-S07_privacy-visibility.md).

| ID | Topic | Context | Decision | Why | Evidence | Impact |
|---|---|---|---|---|---|---|
| <a id="dec-wf01-s07-d1"></a>DEC-WF01-S07-D1 | **SUPERSEDED in part by [DEC-L1R-D6](#dec-l1r-d6): the acknowledgement and its two records stay; it now sits in stage 4 (ACC-09) and completes onboarding with "Hoàn tất hồ sơ".** Legal acceptance UI | The bitmap has no legal control; acceptance is an activation requirement | One required acknowledgement ("Tôi đồng ý với …") linking both current documents; it creates TWO ConsentRecords (TERMS_ACCEPTANCE, PRIVACY_DATA_PROCESSING); S07 continues to S08 only when both current documents are accepted | Legal correctness over bitmap parity; no merged boolean | Playwright: two rows, none without the checkbox, partial failure retried without duplicates | Pixel: INTENTIONAL-LEGAL-REQUIREMENT |
| <a id="dec-wf01-s07-d2"></a>DEC-WF01-S07-D2 | PROFILE_DISCOVERY | Group codes were never frozen (DB gap P8) | One P0 group `PROFILE_DISCOVERY` (display_name, avatar, headline, bio, domain; never email, phone, identity or internal data). "Hiện thẻ của tôi trong Thư viện": ON → NETWORK_ONLY, OFF → PRIVATE; never PUBLIC | The P0 Library is inside the authenticated network | API/DB tests; bitmap copy that would misstate this ("Google tìm thấy", "người chưa đăng nhập thấy…") is not rendered | Region shown on the card is outside the frozen field list (open note) |
| <a id="dec-wf01-s07-d2a"></a>DEC-WF01-S07-D2A | PROFILE_DISCOVERY fields (amends D2) | The approved card and its copy ("tỉnh") show region; D2's list omitted it | PROFILE_DISCOVERY fields are display_name, avatar, headline, bio, domain **and region**. Clarification only; no new visibility system, S07 UI unchanged | Matches the approved member card | No profile projection exists yet (`GET /profiles/{id}` unimplemented; only the owner's `/me/profile` returns region). The projection must omit region, like every group field, when PROFILE_DISCOVERY denies the viewer | `src/lib/profile/visibility.ts` doc comment updated with the next code task |
| <a id="dec-wf01-s07-d3"></a>DEC-WF01-S07-D3 | Future purposes | The bitmap shows investor, challenge-owner and recruitment toggles | Not implemented: no control, no purpose code, no P7 migration | Investor is Future; no frozen purpose model for the others | Playwright: one switch; the API rejects other groups | Pixel: INTENTIONAL-P0-SCOPE |
| <a id="dec-wf01-s07-d4"></a>DEC-WF01-S07-D4 | Default | DB `default_level = NETWORK_ONLY` | New profiles: PROFILE_DISCOVERY = NETWORK_ONLY through the default; OFF stores `group_overrides.PROFILE_DISCOVERY = PRIVATE`; ON again removes the override | Existing model, no redundant rows | DB and Playwright: `{}` ↔ `{"PROFILE_DISCOVERY":"PRIVATE"}` | Seeded fixture profiles keep their own default levels |
| <a id="dec-wf01-s07-d5"></a>DEC-WF01-S07-D5 | Avatar visibility | S06 served avatars to any signed-in session | The avatar belongs to PROFILE_DISCOVERY. `/media/assets/:id`: the owner is always allowed; another signed-in account only if it is the owner's current avatar and discovery is NETWORK_ONLY (or wider); PRIVATE and guests get 404 | Enforced at the serving boundary, not by hiding URLs | Playwright: owner 200; member 200 → 404 after PRIVATE; guest 404 | Closes the S06 bypass |
| <a id="dec-wf01-s07-d6"></a>DEC-WF01-S07-D6 | **SUPERSEDED by [DEC-L1R-D7](#dec-l1r-d7): stage 4 has "Lưu và hoàn tất sau"; it saves visibility only, acceptance still cannot be skipped.** No skip | The bitmap header shows "Bỏ qua, làm sau" | S07 has no skip; not rendered, no fake control | Required legal acceptance cannot be bypassed | Playwright: no skip, no header link | Pixel: INTENTIONAL-LEGAL-REQUIREMENT |
| <a id="dec-wf01-s07-d7"></a>DEC-WF01-S07-D7 | **SUPERSEDED by [DEC-L1R-D7](#dec-l1r-d7): the screen and its lede are replaced by ACC-09.** Copy artefact | The bitmap lede shows a literal `**mục đích**` | Render "mục đích" with emphasis (semibold); never show asterisks | Formatting artefact, not copy | Playwright: `strong` "mục đích", no `**` | — |
| <a id="dec-wf01-s07-d8"></a>DEC-WF01-S07-D8 | Version / errors / re-acceptance | No codes existed for these cases | `409 LEGAL_DOCUMENT_VERSION_STALE`: a version that is not current is refused; the client reloads `/legal/current`, clears the acknowledgement and asks again. `422 VISIBILITY_VALIDATION_FAILED`: unsupported group or level. Post-onboarding re-acceptance belongs to WF02-S03 | Server-authoritative versions; errors never expose internals | Playwright race B; DB tests; `contract.test.ts` guards that both codes are recorded here | Codes live in `DECISION_ERROR_CODES`, not in the 05 drift list |

## DEC-WF01-S08 — Onboarding complete (lifecycle)

Every row carries these shared fields. **Status:** HUMAN APPROVED — P0. **Date:** 2026-09-26. **Scope:** WF01-S08 `/onboarding/complete`, `POST /api/v1/me/onboarding/complete`, `/session`, analytics writer. **Evidence (shared):** [WF01_S08_COMPLETION_CONTRACT.md](../implementation/WF01_S08_COMPLETION_CONTRACT.md), [WF01-S08 report](../implementation/reports/WF01-S08_onboarding-complete.md).

| ID | Topic | Context | Decision | Why | Evidence | Impact |
|---|---|---|---|---|---|---|
| <a id="dec-wf01-s08-d1"></a>DEC-WF01-S08-D1 | **SUPERSEDED by [DEC-L1R-D6](#dec-l1r-d6): completion is the explicit "Hoàn tất hồ sơ" on ACC-09; ACC-10 completes nothing.** Completion trigger | The API maps completion to S08; the bitmap has no confirm control | S07 saves consent and visibility, then navigates to S08. S08 issues the idempotent `POST /me/onboarding/complete` on entry and shows success only after the server confirms; a refusal shows what is missing, a failure offers a retry | S08 owns the write; no false success | Playwright: success after 200; 422 and 500 views without success | S07 unchanged |
| <a id="dec-wf01-s08-d2"></a>DEC-WF01-S08-D2 | Challenge Library | WF04 is demo; no Production route | Card 01 not rendered; no route, no demo navigation | Demo must not look like Production | Playwright: no challenge text or link | Pixel: INTENTIONAL-DEMO-SCOPE |
| <a id="dec-wf01-s08-d3"></a>DEC-WF01-S08-D3 | Create Project | `/projects/new` is a placeholder; `POST /ventures` is missing | Card 02 not rendered until WF02-S05 is Production-ready | No stub success | Playwright: no project link | Pixel: TEMPORARY-PRODUCTION-DEPENDENCY |
| <a id="dec-wf01-s08-d4"></a>DEC-WF01-S08-D4 | **SUPERSEDED in part by [DEC-L1R-D6](#dec-l1r-d6): completion files the HUB units the member named as pending requests, and ACC-10 shows their card; nothing is inferred from the region.** Chapter action | No region → chapter data, route or request UX | Card 03 not rendered; S08 creates or infers no relationship; existing ACTIVE/PENDING rows stay as they are | Never fabricate network data | DB test: PENDING stays PENDING, no new membership | Pixel: TEMPORARY-PRODUCTION-DEPENDENCY |
| <a id="dec-wf01-s08-d5"></a>DEC-WF01-S08-D5 | Primary intent | Intent may be NULL (S05-D3) | No per-intent cards or copy; NULL never blocks completion | Intent is stored for future logic only | DB test: NULL intent completes | Lede keeps only intent-neutral text |
| <a id="dec-wf01-s08-d6"></a>DEC-WF01-S08-D6 | Exit and stepper (**SUPERSEDED in part**: exits to the stored return path when one exists, [DEC-2809-D1](#dec-2809-d1)) | The bitmap has no `/me` exit and shows a skip link | CTA "Vào 1hub.network" → `/me`; no "Bỏ qua, làm sau"; stepper finished (all done, none current, not interactive) | One safe exit that depends on no optional action | Playwright: the only link is `/me`; no `aria-current` | Pixel: INTENTIONAL-CONTRACT (skip, disc 3, CTA, shorter card) |
| <a id="dec-wf01-s08-d7"></a>DEC-WF01-S08-D7 | Info copy and icon | Panel claims events and solution-submission rules; OS emoji ℹ | Neutral copy: the server's percent plus "Bạn có thể cập nhật hồ sơ bất cứ lúc nào."; deterministic SVG info mark | No invented product rules; deterministic pixels | Playwright: no "dự sự kiện"; percent equals the server's | Pixel: INTENTIONAL-ICON-RENDERING, replaced-copy regions masked |
| <a id="dec-wf01-s08-d8"></a>DEC-WF01-S08-D8 | Audit and analytics | No analytics writer existed | Audit `PROFILE_ACTIVATED` once on the real DRAFT → ACTIVE transition (before/after status, request id). One analytics writer on `analytics_events`: `onboarding_completed` once at first completion; `profile_completion_changed` when the authoritative percent moves. Frozen common properties only | Once-only, non-personal telemetry | DB and Playwright: 5 concurrent calls → 1 audit, 1 event; payloads without names, email or consent content | Other API §10 events are not emitted yet (open) |

## DEC-WF01-ANALYTICS-EXT-DEFER — Deferred analytics events

<a id="dec-wf01-analytics-ext-defer"></a>**DEC-WF01-ANALYTICS-EXT-DEFER.** **Status:** APPROVED P0 DEFERRED. **Date:** 2026-09-26. **Scope:** API 05 §10 event list vs WF01.

| Context | Decision | Why | Evidence | Impact |
|---|---|---|---|---|
| API 05 §10 lists more "P0 minimum" events than WF01 emits (audit item ANALYTICS-EXT) | WF01's required analytics for current P0 are `account_created`, `profile_completion_changed` and `onboarding_completed`. **Deferred, not blocking WF01:** `account_authenticated`, `onboarding_started`, `consent_accepted`, `visibility_changed`, `membership_*`, `profile_saved`, `feedback_submitted` | The registration and profile-completion funnel minimum is already measurable | [WF01-REMEDIATION-02 report](../implementation/reports/WF01-REMEDIATION-02_gap-analytics-registration.md) (funnel proof) | Each deferred event is added later through the SAME analytics writer (`src/lib/analytics/analytics.ts`) when its owning workflow or release analytics scope is implemented; no other analytics system |

## DEC-WF01-RESUME-D1 — Purpose step persistence and one resume resolver

<a id="dec-wf01-resume-d1"></a>**DEC-WF01-RESUME-D1.** **SUPERSEDED in part by [DEC-L1R-D3](#dec-l1r-d3): one server resolver and "first incomplete step" stay; the steps are now INTRO, BASIC, CAPABILITY, ROLE, REVIEW.** **Status:** HUMAN APPROVED — P0 (option A of [WF01-REMEDIATION-03](../implementation/reports/WF01-REMEDIATION-03_defect-resume.md)). **Date:** 2026-09-26. **Amends:** [DEC-WF01-S05-D3](#dec-wf01-s05-d3) (history kept).

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

<a id="dec-wf02-h6"></a>**DEC-WF02-H6 — Minimal P0 venture write model** — **SUPERSEDED by [DEC-L2R-D4…D6](#dec-l2r-d4): stage and the creator's role are collected; name, field, description and stage are required.**

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

<a id="dec-wf02-h7"></a>**DEC-WF02-H7 — Venture ownership, team and capabilities** — **SUPERSEDED in part by [DEC-L2R-D7](#dec-l2r-d7): members carry Biên tập or Xem, and Biên tập may update the venture; one owner, the lifecycle and "a role label grants nothing" stay.**

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

<a id="dec-wf02-h10"></a>**DEC-WF02-H10 — "Đang chờ bạn"** — **SUPERSEDED by [DEC-L2R-D8](#dec-l2r-d8): pending venture invitations are listed for the invitee on ME7 and counted on ME0.**

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
| <a id="dec-wf02-s01-d1"></a>DEC-WF02-S01-D1 | **SUPERSEDED by [DEC-L2R-D1/D2](#dec-l2r-d1): `/me` is FP1-OWN.** Lower row composition | "Đang chờ bạn" is omitted (H10, TEMPORARY-PRODUCTION-DEPENDENCY). "Tổ chức của tôi" keeps the approved card geometry but takes the FIRST slot of the two-column row, so no empty card-sized hole leads the row. Pixel: compared with dx −527 (INTENTIONAL-COMPOSITION) | DEC-WF02-H10; ME0 |
| <a id="dec-wf02-s01-d2"></a>DEC-WF02-S01-D2 | **SUPERSEDED by [DEC-L2R-D1/D2](#dec-l2r-d1): `/me` is FP1-OWN.** Copy | Lede drops "Cộng hai thứ đang chờ bạn". Completion line = "Hồ sơ hoàn thiện {server %}" + "· còn thiếu {labels of the server's incomplete groups}" (labels: họ và tên, ảnh đại diện, chức danh, tỉnh / thành phố, giới thiệu, lĩnh vực, kỹ năng, kinh nghiệm, mục tiêu phát triển, nhu cầu hiện tại). Event/solution claims → "Bạn có thể cập nhật hồ sơ bất cứ lúc nào." Card descriptions drop education, viewer history, email change and notifications (Future per H4/H8). Pending PO copy review | DEC-WF02-H13, H4, H8; DEC-WF01-S08-D7 |
| <a id="dec-wf02-s01-d3"></a>DEC-WF02-S01-D3 | **SUPERSEDED by [DEC-L2R-D1/D2](#dec-l2r-d1): `/me` is FP1-OWN.** Organisation rows | Only from `GET /me/network`, in order: ventures (OWNER "Chủ sở hữu · startup/dự án"; MEMBER `role_label` or "Thành viên"), ACTIVE ("Thành viên · {type}") and PENDING_APPROVAL ("Đang chờ duyệt") memberships, ACTIVE leadership ("{title} · {type}"). Ended states are left to S04. Links follow SCR S01 actions: owner venture → `/projects/:id/edit` (open_project), all others → `/me/roles` (open_roles). No PROSPECT label: no such canonical value exists | SCR WF02-S01; DEC-WF02-H5/H7; DEC-WF02-T00-D3 |
| <a id="dec-wf02-s01-d4"></a>DEC-WF02-S01-D4 | **SUPERSEDED by [DEC-L2R-D1/D2](#dec-l2r-d1): `/me` is FP1-OWN.** Data loading and failure | The body reads `/session` (own email), `/me/profile`, `/me/profile/completion` and `/me/network` from the client. Profile and network sections fail independently with "Thử lại". The avatar image renders only when the completion service counts AVATAR complete (a stored, valid asset) | CLAUDE.md §3/§4; DEC-WF01-S06-D3 |
| <a id="dec-wf02-s01-d5"></a>DEC-WF02-S01-D5 | **SUPERSEDED by [DEC-L2R-D1/D2](#dec-l2r-d1): `/me` is FP1-OWN.** "Điền nốt" | Shown only below 100%; links to `/me/profile/edit` (frozen route; body lands with S02). 80% is not presented as a gate | Freeze §D3; DEC-WF02-H1 |
| <a id="dec-wf02-s01-d6"></a>DEC-WF02-S01-D6 | **SUPERSEDED by [DEC-L2R-D1/D2](#dec-l2r-d1): `/me` is FP1-OWN.** Pixel fixture and H12 harness | The QA state (60%, owned startup, ACTIVE Chapter 01) is set by a test-only hook on the seeded member, then the seed is restored. The first application of DEC-WF02-H12 lands in the harness: short full-page references are no longer dry-run gaps; the full-page capture is cropped to the reference height and rows below are checked against the reference's last row | DEC-WF02-H12; Pixel QA §4/§9 |

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

**Security observation SEC-OBS-01 — CLOSED 2026-09-26** by the SEC-OBS-01 remediation ([report](../implementation/reports/SEC-OBS-01_magic-link-referrer-policy.md)): `next.config.ts` sends `Referrer-Policy: no-referrer` on `/auth/callback` only; 0 token-bearing Referers across valid, used, expired and invalid links (regression spec `sec-obs-01-referrer.spec.ts`). Original record:
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

## OPEN-WF02-S05 — Project / Startup preflight gaps (human decision required)

**Status:** CLOSED 2026-09-26 by [DEC-WF02-S05-G1..G5](#dec-wf02-s05-g1) (history kept). Found by the WF02-S05 preflight.
**Audit:** [WF02_S05_PREFLIGHT_AUDIT.md](../implementation/WF02_S05_PREFLIGHT_AUDIT.md).
**Already frozen:** one `projects` entity (type PROJECT/STARTUP); the H6 write model; the H7 ownership and capability model; the venture taxonomy storage shape.

| ID | Gap | Evidence | Options found | Recommended |
|---|---|---|---|---|
| <a id="open-wf02-s05-g1"></a>S05-G1 | The approved PRO1 bitmap draws none of the five H6 fields except the name: its A–J navigator, "Còn 11 trường bắt buộc", completion %, section C, image upload and editorial rules are all outside P0 | PRO1 bitmap; DEC-WF02-H6 | (a) Addendum as S04-G5/S02-H1: keep the editor header and canvas; one form with Loại (PROJECT/STARTUP), Tên, Tóm tắt, Lĩnh vực (DOMAIN), Tỉnh / thành phố (REGION) in the S02 field language; header "Lưu"; the rest INTENTIONAL-P0-SCOPE; pixel strict on the header only. The same form serves `/projects/new`. (b) Wait for a new S05 design | (a) |
| <a id="open-wf02-s05-g2"></a>S05-G2 | Who may create a venture | API §5.3 names no rule; H7 covers edit/team only | (a) Any authenticated account whose onboarding is DONE (same guard as every WF02 member page), enforced in `POST /ventures` too. (b) Any authenticated account | (a) |
| <a id="open-wf02-s05-g3"></a>S05-G3 | Lifecycle in S05: create → DRAFT is shown in the API example, but no frozen trigger exists for DRAFT → ACTIVE (review is conditional and unconfigured) or → ARCHIVED | SOT §Team/Startup/Solution profile; API §5.3 | (a) S05 creates DRAFT and offers no status transition in P0; edits allowed in DRAFT and ACTIVE, not in ARCHIVED. (b) An owner "publish" DRAFT → ACTIVE action. (c) An owner "archive" action | (a) |
| <a id="open-wf02-s05-g4"></a>S05-G4 | Is `type` (PROJECT/STARTUP) editable after creation? | PATCH has no body example | (a) Set at creation, immutable afterwards (stable identity for WF05 reuse). (b) Editable while DRAFT | (a) |
| <a id="open-wf02-s05-g5"></a>S05-G5 | Does creation also insert a `project_members` row for the owner? | API §5.3 "authorized management relation/team membership according to DB/RBAC schema"; H7 owner = `owner_profile_id` | (a) No: ownership is `owner_profile_id` only; S06 lists the owner from it (S01/S04 already dedupe). (b) Yes, with an owner row (a `role_label` would carry no permission) | (a) |

Resolved by precedence (not asked):
- "Xem bản public" → omitted (H3).
- "Gửi HUB duyệt" → omitted (H6: no launch configuration).
- Data room, fundraising, investor and A–J rules → excluded (H6, WF02 non-goals).
- Region/domain storage → DEC-WF02-VENTURE-TAXONOMY-STORAGE.

## DEC-WF02-S05 — Project / Startup (G1–G5, human approved)

**Status:** HUMAN APPROVED — P0.
**Date:** 2026-09-26.
**Closes:** [OPEN-WF02-S05 G1–G5](#open-wf02-s05-g1).
**Remaining S05 human decisions:** 0.

| ID | Context | Decision | Rationale / consequences | Affected | Anchor |
|---|---|---|---|---|---|
| <a id="dec-wf02-s05-g1"></a>DEC-WF02-S05-G1 | The PRO1 bitmap draws almost none of the H6 fields | Keep the editor header and page frame; add one canonical form: Loại (`type`), Tên (`name`), Tóm tắt (`summary`), Lĩnh vực (`domain_ids`), Tỉnh / Thành phố (`region_id`), "Lưu". The same form serves `/projects/new` | Form = INTENTIONAL-CONTRACT; navigator A–J, required-field bar, completion %, section C, image upload, editorial rules, "Xem bản public", "Gửi HUB duyệt" = INTENTIONAL-P0-SCOPE; `design-reference/final` untouched | UI | S05-G1; H6 |
| <a id="dec-wf02-s05-g2"></a>DEC-WF02-S05-G2 | No creation rule existed | Any authenticated account with onboarding DONE may create; enforced in `POST /ventures` (not DONE → 403 `SCOPE_FORBIDDEN`; guest → 401). No membership, leadership, role or capability required | Same boundary as every WF02 member page; pages redirect via the resolver | API, UI | S05-G2 |
| <a id="dec-wf02-s05-g3"></a>DEC-WF02-S05-G3 | No frozen status trigger | Create → DRAFT. DRAFT and ACTIVE editable; ARCHIVED read-only (PATCH refused, code per [DEC-WF02-S05-D2](#dec-wf02-s05-d2)). No transition UI or endpoint | No publish, submit, approve, reject or restore invented | API, UI | S05-G3; SOT lifecycle |
| <a id="dec-wf02-s05-g4"></a>DEC-WF02-S05-G4 | Type mutability | `type` (PROJECT/STARTUP) is fixed at creation; a PATCH carrying `type` is refused with the standard envelope (code per [DEC-WF02-S05-D2](#dec-wf02-s05-d2)), never silently applied | Stable identity for WF05 reuse | API | S05-G4 |
| <a id="dec-wf02-s05-g5"></a>DEC-WF02-S05-G5 | Owner membership row | `owner_profile_id` from the session; no `project_members` row for the owner. `project_members` stays for team relations (S06/P12) | Ownership lives in one place | DB, API | S05-G5; H7 |

## DEC-WF02-S05-D — Project / Startup implementation decisions

**Status:** IMPLEMENTATION DECISIONS within approved scope (H6, H7, S05-G1..G5).
**Date:** 2026-09-26.
**Task:** [WF02-S05](../implementation/reports/WF02-S05_project-startup.md).

| ID | Topic | Decision | Source anchors |
|---|---|---|---|
| <a id="dec-wf02-s05-d1"></a>DEC-WF02-S05-D1 | API shape | `POST /ventures` 201 and `GET/PATCH /ventures/{id}` 200 return `{id, type, name, summary, status, region, domains, relation, can_edit}`, a superset of the §5.3 create response. `slug` is server-generated (`v-<18 hex>`) and never serialised; `metadata` is never read or written. Technical bounds (not business rules): name 200, summary 2000, 10 domains. Name is trimmed and required; summary blank → null; region and domains optional | API §5.3; DEC-WF02-H6 |
| <a id="dec-wf02-s05-d2"></a>DEC-WF02-S05-D2 | Error codes (frozen set only; the SOT calls the venture a "Startup profile") | Validation → 422 `PROFILE_VALIDATION_FAILED` (`type: immutable` on PATCH; `not_accepted` for owner/status/slug/metadata/other keys). Archived vocabulary → `VOCABULARY_ITEM_INACTIVE` (the shared `assertSelectable`). Create before onboarding DONE → 403 `SCOPE_FORBIDDEN`. Member editing → 403 `SCOPE_FORBIDDEN`. Non-member or unknown id → 404 alike. ARCHIVED edit → 409 `PROFILE_DEACTIVATED` | API §2.5 error set; SOT §lifecycle |
| <a id="dec-wf02-s05-d3"></a>DEC-WF02-S05-D3 | UI | The editor header (84px band, title/status/actions) is identical on the approved S02 and S05 references, so it is extracted as the shared `EditorHeader` (S02 migrated to it, pixel re-proven). Header status shows the lifecycle label (Bản nháp / Đang hoạt động / Đã lưu trữ) + "đã lưu lúc". The form uses the S02 field language. Type is a radio pair, disabled after creation. Members and ARCHIVED ventures see the form read-only with a notice. Copy is pending PO review | DEC-WF02-S05-G1/G3/G4 |

## OPEN-WF02-S06 — Venture team preflight gaps (human decision required)

**Status:** CLOSED 2026-09-26 — G1–G8 by [DEC-WF02-S06-G1..G8](#dec-wf02-s06-g1), G9 by [DEC-WF02-S06-G9](#dec-wf02-s06-g9) (history kept). Found by the WF02-S06 preflight.
**Audit:** [WF02_S06_PREFLIGHT_AUDIT.md](../implementation/WF02_S06_PREFLIGHT_AUDIT.md).
**Already frozen:** owner = `projects.owner_profile_id` (no owner row, S05-G5); team lifecycle `PENDING_CONFIRMATION → ACTIVE → LEFT | REMOVED | REJECTED` (SOT, H7); `venture:team_manage` = owner only; `role_label` display only; email invitations never activate; routes `GET …/team`, `POST …/team/invitations`, `PATCH`/`DELETE …/team/{membershipId}` (API §5.4); P12 authorized, not created.

| ID | Gap | Evidence | Options found | Recommended |
|---|---|---|---|---|
| <a id="open-wf02-s06-g1"></a>S06-G1 | P12 storage shape for a pending email invitation | H7 authorizes P12 without a shape; `profile_id NOT NULL`; API uses one `{membershipId}` | (a) One table: a pending invitation IS a `project_members` row (`profile_id` NULL, `invite_email_normalized`), new enum `team_membership_state` = SOT states; DDL in the audit §2. (b) Separate `project_invitations` table; acceptance creates the member (needs a state such as ACCEPTED, not in SOT; two id spaces) | (a) |
| <a id="open-wf02-s06-g2"></a>S06-G2 | How an invitee accepts or declines. No endpoint exists and no P0 invitee surface (H9 omits "Lời mời"; H10 defers the S01 block) | API §5.4; H9; H10 | (a) API addendum: `GET /me/team-invitations`, `POST /me/team-invitations/{membershipId}/accept` and `/decline`; match = session account `email_normalized` equals the invitation email (magic-link verified); re-enable the S01 "Đang chờ bạn" block for venture invitations only (H10 allows it). (b) S06 creates pending invitations only; acceptance deferred (no one becomes ACTIVE through the UI in P0). (c) Auto-accept at sign-in: forbidden by §5.4 | (a) |
| <a id="open-wf02-s06-g3"></a>S06-G3 | "Gửi lại" (resend) and notification: P0 has no email provider or outbox | M0 report §16; bitmap | (a) Omit "Gửi lại" (TEMPORARY-PRODUCTION-DEPENDENCY); the pending row shows "lời mời gửi dd/MM"; the invite dialog says the invitee sees it after signing in with that email. (b) A resend endpoint that only touches `invited_at` (misleading) | (a) |
| <a id="open-wf02-s06-g4"></a>S06-G4 | "Quyền" column, "Đổi quyền" and where "remove" lives. H7 said the column shows `role_label`, but "Vai trò" already shows it; the bitmap has no remove control | Bitmap; H7 consequences | (a) "Vai trò" = `role_label`; "Quyền" = relation, display only (Chủ sở hữu / Thành viên, never tiers); "Đổi quyền" becomes an owner menu with "Sửa vai trò" (PATCH) and "Gỡ khỏi đội" (DELETE, confirmation). (b) Drop the "Quyền" column; row button "Sửa" opens the same two actions | (a) |
| <a id="open-wf02-s06-g5"></a>S06-G5 | The owner row: the bitmap shows it with a role ("Đồng sáng lập") and a join month, but the owner has no row | Bitmap; S05-G5; seed `seed_dev.sql:71` has an owner member row `'Founder'` | (a) Derive from `owner_profile_id`: name/avatar, "Vai trò" "—", "Quyền" "Chủ sở hữu", "Tham gia từ" = `projects.created_at`, badge "Không gỡ được"; an owner member row (seed) is hidden and not counted. (b) Add `projects.owner_role_label` (outside P12). (c) Allow an optional owner `project_members` row for the label (reverses S05-G5) | (a) |
| <a id="open-wf02-s06-g6"></a>S06-G6 | Terminal states: owner cancels a pending invitation; member leaves; re-invite | SOT:204; API DELETE "only when lifecycle policy permits" | (a) Owner DELETE on PENDING → REMOVED; on ACTIVE → REMOVED (`ended_at`); REJECTED only by the invitee's decline; LEFT not offered in P0 (no design element); re-invite after a terminal state = a new row. (b) Also allow a member DELETE on their own row → LEFT | (a) |
| <a id="open-wf02-s06-g7"></a>S06-G7 | Audit: team mutations are sensitive (they store an email and change access) but no team audit action is frozen | CLAUDE.md §4; audit action list | (a) Mint `VENTURE_TEAM_INVITED`, `VENTURE_TEAM_REMOVED`, `VENTURE_TEAM_ROLE_CHANGED` (+ `VENTURE_TEAM_INVITATION_ACCEPTED/DECLINED` if G2(a)); metadata = ids only, never the email. (b) No audit in P0 (as S05) | (a) |
| <a id="open-wf02-s06-g8"></a>S06-G8 | What an ACTIVE member sees on `/projects/:id/team` | Matrix §E `venture:read`; SCR "within permitted scope" | (a) Members get a read-only team list (owner + ACTIVE members, role_label, join month); pending rows and all emails visible to the owner only. (b) Team page for the owner only; members get 404 | (a) |

Resolved by precedence (not asked):
- Permission tiers (Biên tập / Chỉ xem), the "Ba mức quyền" card, data room, submitting solutions → excluded (H7, WF05).
- Ownership transfer, owner leave or self-removal → out of P0 (H7).
- Invitation expiry / EXPIRED, INVITED, DECLINED states → not frozen; not introduced.
- Error codes (409 `MEMBERSHIP_INVALID_TRANSITION`, 422 `PROFILE_VALIDATION_FAILED`, 403 `SCOPE_FORBIDDEN`, 404) and the `role_label` length bound → implementation decisions (D) at implementation time.

<a id="open-wf02-s06-g9"></a>**OPEN-WF02-S06-G9 — Existing non-ACTIVE `project_members` rows (found while resolving G1–G8) — CLOSED by [DEC-WF02-S06-G9](#dec-wf02-s06-g9)**

| Field | Record |
|---|---|
| Rule | The S06 authorization says to stop if an existing state cannot be mapped to the team lifecycle without guessing |
| Evidence | `db/seed/seed_p0_deterministic.sql:233` (deterministic fixture, SOT rank 7) seeds `11000000-…-0002`: Demo Startup, profile `40000000-…-0002`, `'Contributor'`, **`PENDING_APPROVAL`**. It is profile-targeted with no email and no inviter. DEC-WF02-S06-G1 requires `PENDING_CONFIRMATION` = `profile_id NULL` + email + inviter, so no deterministic mapping exists. The same file (`:232`) seeds the owner as an ACTIVE `'Founder'` member (a legacy artifact per G5). The local dev DB also holds 5 residue rows from earlier DB tests (3 ACTIVE, 2 `PENDING_APPROVAL`) |
| Options | (a) Correct the fixture (not the migration): replace `…-0002` with a canonical `PENDING_CONFIRMATION` email invitation for the account of profile `…-0002` (`invited_by` = owner, literal `invited_at`) and drop the owner `'Founder'` row. Migration 008 keeps a hard guard that aborts on any non-ACTIVE row and never maps. Reset the local dev DB (fixtures and test residue only), then migrate 001→008 and reseed. (b) Migrate `PENDING_APPROVAL` → `REMOVED`/`REJECTED` (a guess about history). (c) Allow a profile-targeted `PENDING_CONFIRMATION` shape (contradicts G1) |
| Recommended | (a) |

## DEC-WF02-S06 — Venture team / members (G1–G8, human approved)

**Status:** HUMAN APPROVED — P0, 2026-09-26. Closes [OPEN-WF02-S06 G1–G8](#open-wf02-s06-g1); G9 closed below. **Remaining S06 human decisions: 0.**

| ID | Decision |
|---|---|
| <a id="dec-wf02-s06-g1"></a>DEC-WF02-S06-G1 | `project_members` holds both pending invitations and accepted memberships; no second aggregate. PENDING_CONFIRMATION: `profile_id NULL`, `invite_email_normalized`, `invited_at`, `invited_by_profile_id` required, `joined_at NULL`. ACTIVE: profile, `joined_at`, no email. The owner stays `projects.owner_profile_id` only. Migration `008_p0_venture_team.sql` authorized: dedicated enum `PENDING_CONFIRMATION, ACTIVE, LEFT, REMOVED, REJECTED`; nullable `profile_id`/`joined_at`; invitation columns; CHECK shapes; partial unique ACTIVE (project, profile) and PENDING (project, email). Stop if an existing state cannot be mapped |
| <a id="dec-wf02-s06-g2"></a>DEC-WF02-S06-G2 | **SUPERSEDED by [DEC-L2R-D8](#dec-l2r-d8) for sending: an invitation is e-mailed; explicit accept and decline stay.** Explicit accept/decline by the authenticated recipient whose normalised account email equals the invitation email; never auto-activate. Routes `POST /ventures/{id}/team/invitations/{membershipId}/accept` and `/decline`. Accept: PENDING → ACTIVE atomically (profile, `joined_at`, email cleared); an already-ACTIVE recipient gets no second row. Decline: PENDING → REJECTED. No expiry, no token endpoints, no email sending (never claimed) |
| <a id="dec-wf02-s06-g3"></a>DEC-WF02-S06-G3 | Resend is out of P0 (no outbound email): no functional control; "Gửi lại" = INTENTIONAL-P0-SCOPE |
| <a id="dec-wf02-s06-g4"></a>DEC-WF02-S06-G4 | **SUPERSEDED by [DEC-L2R-D7](#dec-l2r-d7): "Quyền" shows Chủ sở hữu, Biên tập or Xem.** `role_label` is display text only. "Quyền" shows "Chủ sở hữu" (owner) or "Thành viên" (member row), display only. The row menu has only "Sửa vai trò" and "Gỡ khỏi đội". No RoleAssignment, capability editor, permission matrix or transfer |
| <a id="dec-wf02-s06-g5"></a>DEC-WF02-S06-G5 | The owner row is derived from `owner_profile_id`; "Tham gia từ" = "—" (never `projects.created_at`). Seed owner member rows are legacy fixtures, never authority; correct fixtures where safe |
| <a id="dec-wf02-s06-g6"></a>DEC-WF02-S06-G6 | Owner cancels pending → REMOVED; owner removes ACTIVE → REMOVED; no DELETE of rows; LEFT is modelled but has no P0 UI/API; the owner cannot remove self, leave or transfer |
| <a id="dec-wf02-s06-g7"></a>DEC-WF02-S06-G7 | Audit actions `VENTURE_TEAM_INVITED`, `VENTURE_TEAM_JOINED`, `VENTURE_TEAM_INVITATION_REJECTED`, `VENTURE_TEAM_ROLE_CHANGED`, `VENTURE_TEAM_REMOVED`; only on real transitions, not on retries; payload = ids and states only (no email, token, cookie or metadata) |
| <a id="dec-wf02-s06-g8"></a>DEC-WF02-S06-G8 | The owner sees members, pending invitations with their email, role labels and state. An ACTIVE member sees a read-only list of the owner and ACTIVE members (names, role labels, canonical join dates); never pending, rejected or cancelled emails |
| <a id="dec-wf02-s06-g9"></a>DEC-WF02-S06-G9 | **Context:** the legacy deterministic fixture conflicts with the canonical invitation lifecycle. **Decision (option a):** repair the fixture; the migration never infers legacy business meaning. `seed_p0_deterministic.sql` deletes the owner `'Founder'` member row (`11000000-…-0001`) and replaces `11000000-…-0002` with a canonical PENDING_CONFIRMATION invitation (`profile_id NULL`, `leader@example.test`, inviter = owner, fixed `invited_at`, role `Contributor`), never auto-linked. Migration 008 aborts on any non-ACTIVE or closed row and never maps `PENDING_APPROVAL`. Only the disposable local dev DB is reset. **Rationale:** a profile-bound PENDING_APPROVAL membership is not a PENDING_CONFIRMATION invitation. **Consequences:** owner duplicate removed; pending fixture canonical; explicit acceptance testable; migration deterministic |

## DEC-WF02-S06-D — Venture team implementation decisions

**Status:** IMPLEMENTATION DECISIONS within approved scope (H7, S06-G1..G9); for review.

| ID | Decision |
|---|---|
| <a id="dec-wf02-s06-d1"></a>DEC-WF02-S06-D1 | **API shape.** `GET …/team` → `{venture, viewer: OWNER\|MEMBER, can_manage, counts{members, pending\|null}, rows[]}`; row kinds `OWNER` (derived, `membership_id` null), `ACTIVE_MEMBER`, `PENDING_INVITATION` (owner only; carries the email). Invite → 201 the pending row; PATCH → `{membership_id, state, role_label}`; DELETE / accept / decline → 200 `{membership_id, state}`. Repeated accept or decline of the same row returns the same outcome without a new event. `role_label` trimmed, empty → null, ≤ 100 chars (technical bound). An ARCHIVED venture's team is read-only (G3 of S05); accept on it → 409 |
| <a id="dec-wf02-s06-d2"></a>DEC-WF02-S06-D2 | **Error codes (frozen set reused).** 422 `PROFILE_VALIDATION_FAILED` (fields: invalid email, owner's own email, unknown/authority keys `not_accepted`, `too_long`); 409 `MEMBERSHIP_INVALID_TRANSITION` (duplicate pending email, closed row, already a member); 409 `PROFILE_DEACTIVATED` (archived venture); 403 `SCOPE_FORBIDDEN` (ACTIVE member mutating; accept before onboarding DONE); 404 for strangers, unknown/foreign/cross-project ids, another person's invitation and the owner's legacy row |
| <a id="dec-wf02-s06-d3"></a>DEC-WF02-S06-D3 | **UI.** The shared `EditorHeader` (82px band override); table geometry measured from PRO3; "Đổi quyền" → "Tuỳ chọn" menu; pending row "Huỷ lời mời"; note cards keep the frames with P0 copy; the invite form and the recipient panel (same route, shown only to the matching signed-in recipient, venture name + own invitation only) reuse this screen's card and the S02 field language. All added copy pending PO review |


## OPEN-WF03 — WF03 pre-implementation gaps (human decision required)

**Status:** CLOSED 2026-09-26 by [DEC-WF03-G1..G15](#dec-wf03-g1) (history kept). Found by the WF03 pre-implementation audit. New conflicts found during the freeze: [OPEN-WF03-C1](#open-wf03-c1) (closed by DEC-WF03-C1), [OPEN-WF03-C2](#open-wf03-c2) (closed by DEC-WF03-C2).
**Audit:** [WF03_PRE_IMPLEMENTATION_AUDIT.md](../implementation/WF03_PRE_IMPLEMENTATION_AUDIT.md).
**Already frozen:** 9 screens and routes (WF03 contract); 9 capabilities, exact org scope, no inheritance (Matrix, DECISION-AUTHZ-01B); Membership / Leadership / RoleAssignment separation; Event standalone-or-child (SOT §11); Freeze D2 (preseed + pending fallback).

| ID | Question | Why this matters | Evidence | Recommended | Alternative | Impact | Blocks | Source anchor |
|---|---|---|---|---|---|---|---|---|
| <a id="open-wf03-g1"></a>WF03-G1 | The approved S02 bitmap is an enterprise problem-owner dashboard (bài toán, pilots, data requests), not a HUB/Chapter/CLB unit dashboard. What does S02 render? | Implementing the bitmap would build WF04/WF05 content; implementing the contract has no drawn layout | S02 bitmap; SCR S02 reads `OrganizationOpsReadModel`; API §8.2 summary | Contract addendum (as WF02-S04 G5): keep the approved header, KPI-card and work-list components; show the 4 §8.2 metrics and one work item (pending membership requests); the rest INTENTIONAL-P0-SCOPE; pixel strict on shared components only | Request a new approved S02 reference | UI only | S02 | WF03:29; SCR WF03-S02; API §8.2 |
| <a id="open-wf03-g2"></a>WF03-G2 | S07 is a canvas collage (chapter KPIs, registrants, qualifying round, campaign mail) with **no** event list or form. What is the S07 UI? | The contract requires Event CRUD; no approved layout exists for it | S07 bitmap (derived crop); SCR S07 actions create / edit / publish / manage_registration | P0 addendum: event table + create/edit form + publish/cancel in the WF03 ops component language (INTENTIONAL-CONTRACT); collage frames = WF04 / FUTURE; pixel QA = typography + shared components only | Wait for an approved Event management reference | UI; pixel gate relaxed for S07 | S07 | WF03:34; SCR WF03-S07; Pixel SOT §9 |
| <a id="open-wf03-g3"></a>WF03-G3 | S03/S04 draw platform account administration (12.480 accounts, email verification, lock, last login, resend link, CSV, account log). The contract is org-scoped member list/detail. Which wins? | Account admin exposes PII and has no API, capability or data (no lock/verification/last-login source) | S03/S04 bitmaps; SCR S03/S04; API §8.3; Matrix §B | Contract wins: org-scoped memberships of `orgId` in the drawn table/detail frames; status column = membership state, "Vai trò HUB" = leadership title; account actions / columns = INTENTIONAL-P0-SCOPE | Add a platform account-admin module for PLATFORM_ADMIN (new capability + API) | UI, API | S03, S04 | WF03:30-31; API §8.3; SOT §8 |
| <a id="open-wf03-g4"></a>WF03-G4 | Which member fields may a scoped leader read in ops, and does PRIVATE PROFILE_DISCOVERY apply? | Ops reads could bypass the member's visibility choice or leak contact data | RBAC 03 §8 (visibility before fields); SOT §8 (registration email PRIVATE); API §8.3 "must not expose unrelated private fields" | Ops sees display name, avatar (media rule), membership/leadership facts and a consent summary (PROFILE_DISCOVERY level, legal acceptance dates); never email / phone / sessions; PRIVATE hides headline / bio / skills from ops too | Membership relation overrides visibility (full discovery fields for the org's leaders) | DTO | S03, S04 | 03 §8; SOT §8; DEC-WF02-H3 |
| <a id="open-wf03-g5"></a>WF03-G5 | Which membership transitions may ops perform, and what provenance does confirmation write? | API gives "common transitions … where policy allows" without a table | API §8.3, §13; SOT:190; seed `source` = ORGANIZATION_VERIFIED; gap P11 | PENDING → ACTIVE (`source` = ORGANIZATION_VERIFIED, `started_at`) or REJECTED (`ended_at`); ACTIVE → SUSPENDED or ALUMNI; SUSPENDED → ACTIVE or ALUMNI; WITHDRAWN is member-side only (no P0 UI); REJECTED / ALUMNI / WITHDRAWN terminal; approver kept in audit only, never displayed | Keep `source` unchanged and add `confirmed_by` / `confirmed_at` (migration) | API, audit | S04 | API §8.3; SOT §6, §7 |
| <a id="open-wf03-g6"></a>WF03-G6 | Does creating / closing a LeadershipRecord create / end a RoleAssignment, and who may appoint leaders? | Coupling would grant ops permission through a business fact; S09 says heads are approved by HUB tổng (QĐ-09, bitmap only) | API §8.3 "RoleAssignment … by backend policy only when required"; 03 §7; Matrix §D.3 | Leadership never mints or ends a RoleAssignment in P0 (roles only via roster/seed/admin, no P0 UI); `leadership:manage` per Matrix (leader in the exact org, or PLATFORM_ADMIN); `title` = free display text | (b) Creating a "head" leadership grants HUB_COMMUNITY_LEADER; (c) PLATFORM_ADMIN only | API, security | S04 | API §8.3; 03 §7; Matrix §C |
| <a id="open-wf03-g7"></a>WF03-G7 | Is OrganizationRepresentation in WF03 P0? | S06 manages representatives (invite, types, statuses) and the WF03 actor names "authorized representative", but no table exists and the role is inactive | S06 bitmap; D6; Matrix §A; SOT §14 "schema-ready only" | Out of P0: representative card INTENTIONAL-P0-SCOPE; org management only via HUB_COMMUNITY_LEADER / PLATFORM_ADMIN assignments | Migration `organization_representations` + activate ORGANIZATION_REPRESENTATIVE + invite/accept flow | DB, RBAC, UI | S06 | WF03:4; SOT:201, §14; DB gaps D6 |
| <a id="open-wf03-g8"></a>WF03-G8 | Which organization profile fields and lifecycle does S06 edit (region, website, founding year, contact, focus domains, visibility groups, publish conditions, verification, archive)? | DB has name, description, logo, `publication_status` only; the bitmap shows 7 visibility groups and BR-FS03 rules found in no SOT | S06 / S09 bitmaps; `organizations` (001); gap P6 | P0 edits `description` + logo; name / type / parent read-only; `publication_status` stays the public flag with no lifecycle transitions; region, contact, visibility groups, verification, archive request = FUTURE | Migration for org content columns + `region_id` + SOT lifecycle / `verification_status` (P6) + group visibility | DB, UI | S06, S09 | SOT:196-198; SCR S06; DB gaps P6 |
| <a id="open-wf03-g9"></a>WF03-G9 | Which store is canonical for hierarchy, which relationship types exist, which pairs are valid, and who may create/close them? | Two parent sources (D7); types are "controlled configuration" with no catalogue; S08 shows BR-FS03-09 pair rules and a HUB-approval change-parent queue | `parent_id` + PARENT rows (seed); API §8.7; S08 bitmap | `organization_relationships` canonical with history; P0 types PARENT (child view = "Thuộc") and PARTNER; programme co-organizer = WF04; pairs HUB → CHAPTER, CHAPTER → CLB, one ACTIVE parent per child (server + optional migration 009); PARENT create/close = PLATFORM_ADMIN only, PARTNER = `org:manage_relationship` on the source; `parent_id` synced in the same transaction; change-parent requests FUTURE | `parent_id` canonical; relationships for partners only | DB (optional 009), API | S08, S01, S09 | WF03:35; API §8.7, §13; DB gaps D7 |
| <a id="open-wf03-g10"></a>WF03-G10 | What is a P0 Event: fields, transitions, programme link, registrations? | API body has `timezone` / `registration_enabled` (no columns); no EventRegistration (P5) and no member registration flow; LIVE / ENDED / ARCHIVED have no trigger | API §8.6; `events` (001/002); S09 capacity chips | name, summary, starts_at, ends_at, location_text (time shown in Asia/Ho_Chi_Minh); standalone only (`programme_id` NULL; existing linked events read-only); create DRAFT, edit DRAFT / PUBLISHED, publish DRAFT → PUBLISHED, cancel DRAFT / PUBLISHED → CANCELLED; no LIVE / ENDED / ARCHIVED; registrations, capacity, `registration_enabled` = INTENTIONAL-P0-SCOPE | Migration P5 (registrations, `registration_enabled`, capacity) + member registration flow | DB, API, UI | S07, S09 | WF03:34; SOT:213-216; API §8.6; gap P5 |
| <a id="open-wf03-g11"></a>WF03-G11 | What does S01 list? The bitmap is a platform-admin table (head, members, running summit, events in 30 days, sender email, "Tạo chapter") | "Head" has no field; summit / sender are WF04; no inheritance means a HUB leader sees only its own org | S01 bitmap; AUTHZ-01B; API §8.1 | Orgs where the actor holds `network:read` (PLATFORM_ADMIN: all HUB / CHAPTER / CLB); columns: name, type, active leadership holders (no "head" inference), ACTIVE members, PUBLISHED events in the next 30 days; the rest = WF04 / FUTURE | Add a "head" flag and HUB-wide read inheritance (reopens AUTHZ-01B) | UI, read model | S01 | WF03:28; API §8.1 |
| <a id="open-wf03-g12"></a>WF03-G12 | S05 draws a platform Challenge admin list; the contract is a unit-scoped read bridge whose DTO has `relationship` (e.g. LEAD_ORGANIZER) with no source table | Deriving LEAD_ORGANIZER from `programmes.organization_id` would be a guess | S05 bitmap; API §8.4; `programmes` (001) | Read-only list of programmes with `organization_id = orgId` (name, type, status, dates); no `relationship` value; create / publish rules = WF04 | Wait for WF04 ProgrammeOrganizationRelationship | UI | S05 | WF03:32, :66; API §8.4 |
| <a id="open-wf03-g13"></a>WF03-G13 | What may the public S09 page show about people and counts? The bitmap shows leaders' names + email, member counts, CLB counts, partners, capacity | Guests see no person data in P0 (DEC-WF02-H3 / projection); registration email is PRIVATE | S09 bitmap; SOT §8; `projection.ts` | Public: org identity, parent, child CLBs (PUBLISHED), upcoming PUBLISHED events (date, name, place), aggregate ACTIVE member count; leaders = titles only for guests, names for signed-in NETWORK viewers under PROFILE_DISCOVERY, never email; join: guest → /auth, member → WF02-S04 request; partners, referral link, summit = WF04 / FUTURE | Leadership as a public organizational fact (names public); or no counts at all | DTO, privacy | S09 | SCR S09; SOT §8; DEC-WF02-H3 |
| <a id="open-wf03-g14"></a>WF03-G14 | Which audit action codes do WF03 mutations write? | SOT requires AuditLog for membership, representation and shared entity changes; no WF03 code is frozen | SOT §3 AuditLog; 03 §9; `audit.ts` union | Mint `MEMBERSHIP_STATE_CHANGED`, `LEADERSHIP_CREATED`, `LEADERSHIP_CLOSED`, `ORGANIZATION_PROFILE_UPDATED`, `ORGANIZATION_RELATIONSHIP_CREATED`, `ORGANIZATION_RELATIONSHIP_CLOSED`, `EVENT_CREATED`, `EVENT_UPDATED`, `EVENT_PUBLISHED`, `EVENT_CANCELLED`; payload = ids + states only | Audit membership / leadership / relationships only | Audit | S04, S06, S07, S08 | SOT §3, §15; 03 §9 |
| <a id="open-wf03-g15"></a>WF03-G15 | The 9 references use four different shells (platform "Quản trị" ADM sidebar, "Quản trị HUB tổng" sidebar, unit top nav, public). Which ops shell does P0 use? | Pixel SOT §6: one navigation shell per actor context; many drawn nav items have no P0 screen | S01 / S05, S03 / S04 / S08, S02 / S06 bitmaps | One ops shell from the "Quản trị HUB tổng" sidebar (S03 / S04 / S08) for every `/ops` route, nav = WF03 routes only (H9 precedent); other shells' nav = INTENTIONAL-P0-SCOPE; S09 keeps its public layout | Replicate each drawn shell per screen | UI, pixel | T00, S01–S08 | Pixel SOT §6; DEC-WF02-H9 |

## DEC-WF03 — WF03 decision freeze (G1–G15, human approved)

**Status:** HUMAN APPROVED — P0, 2026-09-26. Closes [OPEN-WF03 G1–G15](#open-wf03-g1). Immutable implementation inputs (PROCESS-P0-ACCELERATED-SAFE-V2 §G); new contradictory evidence → a new conflict record + STOP.

| ID | Decision | Implementation boundary |
|---|---|---|
| <a id="dec-wf03-g1"></a>DEC-WF03-G1 | S02 = dashboard of the selected Organization with only metrics computable from canonical P0 data (e.g. ACTIVE members, pending requests, active leadership, events, upcoming/published events, canonical child orgs). No Challenge/Programme funnel, investor, fundraising, application or startup KPI; no hardcoded numbers | Every counter names its server query. Bitmap enterprise content = INTENTIONAL-P0-SCOPE |
| <a id="dec-wf03-g2"></a>DEC-WF03-G2 | S07 = canonical EVENT MANAGEMENT; the S07 bitmap (WF04 content) is not business authority. A WF03-S07 screen-contract addendum uses only approved WF03 ops primitives (OpsShell, table, form, card, breadcrumb, button, typography, spacing). Business-content difference = INTENTIONAL-CONTRACT | Structures without approved precedent stay local to S07 and never become global tokens; `design-reference/final` untouched |
| <a id="dec-wf03-g3"></a>DEC-WF03-G3 | No platform account administration in WF03. S03 = ORGANIZATION MEMBERS (safe profile projection, membership state and provenance, leadership facts). S04 = MEMBERSHIP REVIEW / LEADERSHIP OPERATIONS (review, approve, reject, inspect provenance, frozen leadership lifecycle where the contract permits) | No password, login/email, account disable, platform-role editing or other account admin |
| <a id="dec-wf03-g4"></a>DEC-WF03-G4 | Ops access does not bypass IndividualProfile visibility. Reuse PROFILE_DISCOVERY, visibility and consent filtering; add only the minimum relationship facts (membership state, organization, leadership title/state, provenance). PLATFORM_ADMIN gets no blanket PII bypass | Server-side DTO filtering; any future admin PII override needs its own decision |
| <a id="dec-wf03-g5"></a>DEC-WF03-G5 | Review path PENDING_APPROVAL → ACTIVE (provenance `ORGANIZATION_VERIFIED`, the existing identifier) or → REJECTED. SUSPENDED / ALUMNI / WITHDRAWN stay valid states, implemented only where the WF03/API contract explicitly supports the transition. Approver identity not stored/displayed (schema has no field) | API §8.3 grants ACTIVE → SUSPENDED / ALUMNI / WITHDRAWN only "where policy allows" and no policy is frozen, so P0 implements the **two review transitions only**; others need a policy decision first |
| <a id="dec-wf03-g6"></a>DEC-WF03-G6 | LeadershipRecord is a business fact: it creates no RoleAssignment, capability or managed scope; the title has zero authority | No inference from Chapter Leader / President / Chairman / Head |
| <a id="dec-wf03-g7"></a>DEC-WF03-G7 | OrganizationRepresentation runtime DEFERRED; no table/migration for P0. Authorization = existing scoped RoleAssignment / capabilities; RoleAssignment is not presented as representation | Representation UI = INTENTIONAL-P0-SCOPE |
| <a id="dec-wf03-g8"></a>DEC-WF03-G8 | Existing organizations only; operational types HUB, CHAPTER, CLB. No create, delete or lifecycle-transition controls unless a frozen contract defines them; archived/inactive records are read per the canonical lifecycle and never mutated through unsupported operations. The profile-edit screen edits only fields present in the canonical Organization model/API **and** approved by the screen contract/design mapping; no design-only DB fields; verification/trust display-only | Profile editing is hosted by S06 ([DEC-WF03-C1](#dec-wf03-c1)) |
| <a id="dec-wf03-g9"></a>DEC-WF03-G9 | Canonical hierarchy for new WF03 logic = `organization_relationships` with the frozen PARENT type; never inferred from name, slug, region or type. No new writes to `parent_id` (legacy / read-compatibility only). One hierarchy service. P0 invariant: at most one ACTIVE PARENT per child (migration 009 may enforce later; none now). Disagreement is reported, never silently reconciled | Current fixture disagreement: [OPEN-WF03-C2](#open-wf03-c2) |
| <a id="dec-wf03-g10"></a>DEC-WF03-G10 | Standalone Events: list, detail, create, edit, publish, cancel per the frozen lifecycle/API; WF03-created events have `programme_id` NULL (existing canonical links are left as they are). No registration, participant application, Programme/Challenge journey, eligibility or operating team (WF04+). Programme never mandatory | Registration fields / `registration_enabled` / capacity not implemented |
| <a id="dec-wf03-g11"></a>DEC-WF03-G11 | S01 = OPS ORGANIZATION SELECTOR / LIST (not the dashboard). HUB_COMMUNITY_LEADER: exact assigned scope only, no inheritance; PLATFORM_ADMIN: per the existing platform-admin contract; types HUB / CHAPTER / CLB. Selection = UI context only | Every API re-authorizes |
| <a id="dec-wf03-g12"></a>DEC-WF03-G12 | WF03-S05 = FUTURE / WF04: not implemented, bitmap not WF03 authority, ID kept for traceability. WF03 executable P0 scope = **8 screens** (S01, S02, S03, S04, S06, S07, S08, S09); completion denominator = 8 | Route `/ops/org/:orgId/programmes` stays a frozen placeholder |
| <a id="dec-wf03-g13"></a>DEC-WF03-G13 | S09 public page shows only public-safe canonical content: name, type, public description, region / approved public links **where canonical**, canonical parent and children, public-safe aggregate counts, published standalone events. Never: member email, pending memberships or requester identity, private profile fields, internal leadership management data, RoleAssignment, capability, audit data. Membership never publishes an IndividualProfile; any rendered person passes canonical visibility | `organizations` has no region or links columns today, so none are rendered |
| <a id="dec-wf03-g14"></a>DEC-WF03-G14 | Frozen audit actions, emitted only when the mutation is implemented: `ORGANIZATION_UPDATED`, `MEMBERSHIP_APPROVED`, `MEMBERSHIP_REJECTED`, `MEMBERSHIP_STATUS_CHANGED`, `LEADERSHIP_CREATED`, `LEADERSHIP_UPDATED`, `LEADERSHIP_ENDED`, `EVENT_CREATED`, `EVENT_UPDATED`, `EVENT_PUBLISHED`, `EVENT_CANCELLED`. No read events; payload = canonical ids + state deltas only | Reuse mapping: **none**. No existing code means the same action (`MEMBERSHIP_REQUESTED` = a member's own request, WF02-S04). No relationship code is frozen (see C1) |
| <a id="dec-wf03-g15"></a>DEC-WF03-G15 | Dedicated **OpsShell** for `/ops/*` (not MemberShell), reusing approved fonts, colours, typography, buttons, cards, tables and spacing. Responsibilities: ops navigation, organization context, breadcrumb, actor-safe menu visibility. Not a security boundary | Leader: exact scope; PLATFORM_ADMIN: per frozen capability/scope; no shared organization login |

<a id="open-wf03-c1"></a>**OPEN-WF03-C1 — S06/S08 naming vs the frozen WF03 contract — CLOSED 2026-09-26 by [DEC-WF03-C1](#dec-wf03-c1)** (history kept)

| Field | Record |
|---|---|
| Question | The freeze task names S06 "Organization Profile/Detail" and S08 "Organization Edit", and applies the G8 profile-edit rule to S08. The frozen WF03 contract defines S06 = `/ops/org/:orgId/profile`, "manage organization profile/content groups", `org:manage` (API `PATCH …/profile`), and S08 = `/ops/org/:orgId/settings`, "parent/child/partner/co-organizer relationships + settings; preserve history", `org:manage_relationship` (API §8.7). Which is intended? |
| Why this matters | Swapping the screens would put profile editing on the relationships route/capability and leave relationship management unscoped. If S08 stays relationships, its mutation scope is still undecided: relationship types, who may create/close PARENT, and audit codes (G14 freezes none for relationships) |
| Evidence | `WF03_HUB_CHAPTER_CLB_OPERATIONS_FINAL_v1.0.md:33,35`; SCR WF03-S06/S08; API §8.5, §8.7; Matrix §B |
| Recommended | Keep the contract: S06 = Organization Profile (G8 field rule applies here); S08 = Organization Relationships, P0 **read + close** of existing relationships, and PARENT create by PLATFORM_ADMIN only under the G9 invariant; mint `ORGANIZATION_RELATIONSHIP_CREATED` / `_CLOSED` |
| Alternative | Follow the freeze text: S08 = organization edit; relationships shown read-only (S06/S08) and relationship mutations deferred |
| Impact | Screen/route/capability mapping; audit catalogue |
| Blocks | S06, S08 (not T00–S04, S07, S09) |
| Source anchor | WF03:33-35; SCR WF03; API §8.5, §8.7 |

<a id="dec-wf03-c1"></a>**DEC-WF03-C1 — S06 / S08 responsibility boundary (APPROVED 2026-09-26; closes OPEN-WF03-C1)**

| Field | Record |
|---|---|
| Decision | The frozen WF03 screen contract takes precedence over earlier task labels. **S06 = Organization Profile / Detail** at `/ops/org/:orgId/profile`: canonical profile display and edit of identity / display fields supported by the model and API (`PATCH /ops/organizations/{orgId}/profile`, `org:manage`). **S08 = Organization Settings / Relationships** at `/ops/org/:orgId/settings`: relationship and hierarchy settings over canonical `organization_relationships` (`org:manage_relationship` where mutation is eventually supported). S08 never edits the general profile |
| S06 does not own | Hierarchy mutation, parent / child administration, RoleAssignment, membership approval, leadership administration, platform account administration. Hierarchy is **read-only** in S06 (DEC-WF03-G9 reader) |
| G8 | The G8 profile-edit field rule applies to S06 |
| Split gap | S08 relationship mutation semantics stay open in [OPEN-WF03-S08-RELATIONSHIP-CONTRACT](#open-wf03-s08-relationship-contract). It blocks S08 relationship mutation only, never S06 |
| Source anchor | WF03:33-35; SCR WF03-S06 / S08; API §8.5, §8.7; Matrix §B; user approval 2026-09-26 |

<a id="open-wf03-s08-relationship-contract"></a>**OPEN-WF03-S08-RELATIONSHIP-CONTRACT — relationship mutation semantics for S08 — CLOSED 2026-09-26 by [DEC-WF03-S08-RELATIONSHIP-CONTRACT](#dec-wf03-s08-relationship-contract)** (history kept)

| Missing item | Why it matters |
|---|---|
| Who may create or change a PARENT (HUB leader of the parent? PLATFORM_ADMIN only? request + approval as drawn in ADM21 / ORGP2 "Yêu cầu đổi chapter cha"?) | Capability `org:manage_relationship` is granted per exact org; a PARENT row touches two organizations |
| Allowed relationship types beyond PARENT (partner, co-organizer…) and their vocabulary | `relationship_type` is free text in the schema |
| Transition / end semantics (close vs revoke, effective dates, request state) | `record_state` today has no request state; "Đổi chapter cha là yêu cầu gửi HUB Tổng duyệt" implies one |
| Audit identifiers (e.g. `ORGANIZATION_RELATIONSHIP_CREATED` / `_CLOSED`) | DEC-WF03-G14 freezes none for relationships |
| Migration / unique constraint (G9 invariant: ≤ 1 ACTIVE PARENT per child; optional migration 009) | Concurrent writes could break the invariant without a DB constraint |

Resolution: a focused S08 preflight / decision freeze before any S08 relationship mutation. Nothing in this list is decided by S06.

<a id="dec-wf03-s08-relationship-contract"></a>**DEC-WF03-S08-RELATIONSHIP-CONTRACT — P0 organization relationship contract (APPROVED 2026-09-26; closes OPEN-WF03-S08-RELATIONSHIP-CONTRACT)**

| Item | Decision |
|---|---|
| Relationship | Only `PARENT`, stored in `organization_relationships` as source = parent → target = child. `organizations.parent_id` is never read or written (no dual write). Other types (partner, co-organizer, programme) are not P0 → 422 `not_supported` |
| Organization types | HUB, CHAPTER, CLB only; COMPANY / FUND / PARTNER → 404 through S08 |
| Valid pairs | **HUB → CHAPTER, CHAPTER → CLB.** Delta vs the task list: HUB → CLB is **excluded**, because the higher-precedence Design SOT (ADM21 "Cặp cha-con hợp lệ", BR-FS03-09: "CLB: cha = đúng 1 HUB Chapter"; "Chỉ CLB có cha là Chapter") is narrower. Every other pair, self-parenting and any cycle → 422 (`type_not_allowed` / `self` / `cycle`) |
| One ACTIVE parent | ≤ 1 ACTIVE PARENT per child, enforced by migration 009 (`uq_active_parent_per_child`) and checked in the transaction. A duplicate or second parent → 409, never a silent replace |
| Create | `POST /ops/organizations/{orgId}/relationships {target_organization_id, relationship_type: "PARENT"}`: the path organization is the parent of the target (as stored). Both must exist, be operational and not ARCHIVED (409); valid pair; the child has no ACTIVE parent; no cycle |
| Change parent | The same POST plus `replaces_relationship_id` (the child's current ACTIVE PARENT, else 409 stale). The old row is closed (CLOSED + `ended_at`) and the new ACTIVE row is created in one transaction; history is kept. It is never an in-place overwrite |
| End | `POST …/relationships/{id}/close {ended_at?, reason?}` sets `state = CLOSED` and `ended_at` (default now; not future, not before `started_at`). The optional reason (≤ 500) is stored as `metadata.close_reason`. There is no DELETE; a closed row → 409 |
| Lifecycle | No new relationship involving an ARCHIVED organization; closing is always allowed. S08 never changes organization lifecycle |
| Cycles | Server-side ancestor walk over ACTIVE PARENT rows inside a hierarchy-wide advisory lock (`pg_advisory_xact_lock`), so concurrent writes cannot form a cycle |
| Authority | `org:manage_relationship` on **both** organizations of the relationship (and on the previous parent for a change), exact scope, no inheritance. `org:manage`, membership, leadership, titles and `role_label` grant nothing. PLATFORM_ADMIN holds it for every organization; HUB_COMMUNITY_LEADER only for its exact scoped organization — so in P0 a leader scoped to one organization can read S08 but cannot mutate a relationship that reaches another organization |
| Audit | Minimum new codes (none existed): `ORGANIZATION_RELATIONSHIP_CREATED`, `ORGANIZATION_RELATIONSHIP_ENDED`. A parent change writes ENDED + CREATED (the CREATED carries `replaces_relationship_id`) in the same transaction and request. Payload: `relationship_id`, `parent_organization_id`, `child_organization_id`, `relationship_type`, `state` (+ replaces id). Never the reason text, names, email, tokens or metadata. Refused calls write nothing |
| Migration | 009: one guard (aborts with DATA INCONSISTENCY if any child already has more than one ACTIVE PARENT; no repair) + one partial unique index. Additive, fresh / upgrade / rerun safe |
| Not P0 | Change-parent request / approval queue, notifications, partner / co-organizer / programme relationships, audit-log card (INTENTIONAL-P0-SCOPE) |
| Human decisions remaining | 0 |

<a id="open-wf03-s07-event-lifecycle"></a>**OPEN-WF03-S07-EVENT-LIFECYCLE — Event lifecycle / edit / publish semantics for S07 — CLOSED 2026-09-26 by [DEC-WF03-S07-EVENT-LIFECYCLE](#dec-wf03-s07-event-lifecycle)** (history kept)

Found by the S07 focused preflight. The frozen sources give only the chain `DRAFT → PUBLISHED → LIVE → ENDED | CANCELLED → ARCHIVED` (Data SOT §state machines; API §8.6) and three operation sentences: PATCH "only in allowed lifecycle states", publish "`DRAFT → PUBLISHED` after required validation", cancel "lifecycle-controlled". The `event_status` enum matches the chain. Nothing below is decided by S07.

| Gap | Question | Why it blocks | Options (recommended first) |
|---|---|---|---|
| E1 Cancel source states | From which states may `POST /ops/events/{id}/cancel` move to CANCELLED? Read literally, the chain puts CANCELLED only after LIVE | The central lifecycle guard of the screen | (a) PUBLISHED and LIVE → CANCELLED; DRAFT is not cancellable (never visible). (b) DRAFT, PUBLISHED, LIVE → CANCELLED. (c) LIVE only (literal) |
| E2 Edit states | In which states does `PATCH /ops/events/{id}` accept changes, and are any fields locked after publish? | "Allowed lifecycle states" is undefined | (a) DRAFT and PUBLISHED, all editable fields; LIVE / ENDED / CANCELLED / ARCHIVED read-only. (b) DRAFT only. (c) PUBLISHED with a restricted field set |
| E3 Publish validation | Which fields are "required validation" for `DRAFT → PUBLISHED` (starts_at, ends_at, ends ≥ starts, future start, location)? | Publish must refuse an incomplete draft | (a) name + starts_at + ends_at with ends_at ≥ starts_at; starts_at not in the past; summary / location optional. (b) name only |
| E4 Field set | The create example carries `timezone` and `registration_enabled` (no column; registration excluded by G10), while the columns `summary` and `location_text` are not in the example. Which fields does S07 create / edit? | Create and PATCH payloads | (a) name, summary, starts_at, ends_at, location_text; `programme_id` must be null or absent (else 422); `registration_enabled` rejected (G10); `timezone` accepted only as `Asia/Ho_Chi_Minh` (display zone) and not stored. (b) reject `timezone` |
| E5 LIVE / ENDED | Are LIVE and ENDED set by time, by an operator, or not at all in P0? | Status display, edit guard (E2) and cancel guard (E1) all depend on it | (a) Not in P0: no operation and no time derivation; S07 shows the stored status only. (b) Derive LIVE / ENDED for display from starts_at / ends_at without storing |

Already settled by frozen sources (no decision needed): canonical `events` table; organization ownership from the path, server-set; `programme_id` NULL for WF03-created events (G10) and existing links left as they are; capability `event:manage`, exact organization scope; audit codes `EVENT_CREATED` / `EVENT_UPDATED` / `EVENT_PUBLISHED` / `EVENT_CANCELLED` (G14); Idempotency-Key on create / publish (API §2.3, provisional leniency); no registration (G10); the bitmap is not authority (G2).

Resolution: a human decision on E1–E5, recorded as DEC-WF03-S07-EVENT-LIFECYCLE, then a fast-path S07 implementation.

<a id="dec-wf03-s07-event-lifecycle"></a>**DEC-WF03-S07-EVENT-LIFECYCLE — P0 standalone Event lifecycle (HUMAN APPROVED 2026-09-26; closes OPEN-WF03-S07-EVENT-LIFECYCLE; all recommended options)**

| Gap | Decision |
|---|---|
| E1 Cancel | `POST /ops/events/{id}/cancel`: **PUBLISHED → CANCELLED** and **LIVE → CANCELLED** only. DRAFT is not cancellable (409). CANCELLED is terminal for S07: not editable, not publishable. No hard delete |
| E2 Edit | `PATCH /ops/events/{id}` in **DRAFT and PUBLISHED**, all editable fields; LIVE / ENDED / CANCELLED / ARCHIVED are read-only (409) |
| E3 Publish | `POST /ops/events/{id}/publish`: **DRAFT → PUBLISHED** only when `name`, `starts_at` and `ends_at` are present, `ends_at ≥ starts_at`, and `starts_at` is not in the past. `summary` / `location_text` optional. Otherwise 422 with field reasons; any other state 409 |
| E4 Fields | Create / edit: `name` (required), `summary`, `starts_at`, `ends_at`, `location_text`. `programme_id` must be null or absent on create (a value → 422) and is not editable. `registration_enabled` is rejected (G10). `timezone` is accepted only as `Asia/Ho_Chi_Minh` (the display zone) and is not stored. Everything else (id, slug, status, organization, metadata, timestamps) is server-owned → 422 |
| E5 LIVE / ENDED | Not in P0: no operation and no time derivation; S07 shows the stored status only |

<a id="open-wf03-c2"></a>**OPEN-WF03-C2 — Hierarchy fixture disagreement (reported per DEC-WF03-G9) — CLOSED by [DEC-WF03-C2](#dec-wf03-c2)**

| Field | Record |
|---|---|
| Question | `chapter-02` has `parent_id` = `hub-network` but no ACTIVE PARENT relationship; the other rows agree (checked on the dev DB). Under the canonical source Chapter 02 has **no parent**. Fix the fixture? |
| Why this matters | S01/S08/S09 would show Chapter 02 without a parent, while legacy `parent_id` says HUB |
| Evidence | `seed_p0_deterministic.sql` organizations (Chapter 02 → HUB) vs `organization_relationships` d000…01/02 (HUB → Chapter 01, Chapter 01 → Club 01) |
| Recommended | Fixture remediation in the first task that needs hierarchy (T00): add the PARENT relationship HUB → Chapter 02 to the deterministic seed (seed change needs that task's authorization); never write `parent_id` |
| Alternative | Keep the fixture; Chapter 02 is a parentless test chapter |
| Impact | Seed only |
| Blocks | Nothing for T00 logic; S01/S08/S09 hierarchy display of Chapter 02 |
| Source anchor | DEC-WF03-G9; DB gaps D7 |

<a id="process-p0-accelerated-safe-v2"></a>**PROCESS-P0-ACCELERATED-SAFE-V2 — execution process (installed 2026-09-26)**

| Field | Record |
|---|---|
| Decision | Contract freeze gate; fast path vs full preflight; design lock; targeted tests/pixel with full regression at defined triggers; immutable CLOSED decisions; human-stop policy; workflow closing gate; protected WF01/WF02; SHA-exact deploy handoff; shorter reports; golden rules |
| Product/business decisions changed | **NONE** |
| Where | [PROCESS_P0_ACCELERATED_SAFE_V2.md](../implementation/PROCESS_P0_ACCELERATED_SAFE_V2.md); CLAUDE.md §14 |

<a id="dec-wf03-c2"></a>**DEC-WF03-C2 — Hierarchy fixture remediation (human approved; closes OPEN-WF03-C2)**

| Field | Record |
|---|---|
| Decision | Deterministic fixture remediation only: `seed_p0_deterministic.sql` gains `d0000000-…-0003`, an ACTIVE PARENT HUB Network → Chapter 02, matching what the fixture's legacy `parent_id` already expressed |
| Not done (by decision) | No runtime fallback to `parent_id`, no inference of production relationships from it, no reconciliation migration, no repair of arbitrary data; `parent_id` stays non-canonical |
| Runtime | Hierarchy is read only from `organization_relationships` (`src/lib/ops/hierarchy.ts`). Future disagreement in non-fixture data is reported as DATA INCONSISTENCY |
| Applied | WF03-T00 |

## DEC-WF03-T00-D — Ops foundation implementation decisions

**Status:** IMPLEMENTATION DECISIONS within DEC-WF03-G1..G15 (for review).

| ID | Decision |
|---|---|
| <a id="dec-wf03-t00-d1"></a>DEC-WF03-T00-D1 | **OpsShell family.** OpsShell follows the "Quản trị HUB tổng" sidebar drawn identically on S03/S04/S08 (216px column, wordmark, subtitle, group label, 38px items, bordered active box), per the OPEN-WF03-G15 recommendation approved with G15. The ADM-coded S01/S05 sidebar and the S02/S06 top nav are INTENTIONAL-CONTRACT differences. Drawn items without an executable destination are not rendered |
| <a id="dec-wf03-t00-d2"></a>DEC-WF03-T00-D2 | **Context + breadcrumb.** The subtitle slot carries "Tổ chức › {organization}" (breadcrumb nav) inside an org route and "Vận hành tổ chức" otherwise, so no bar is added above the screens' content. Nav: "Danh sách tổ chức"; in an org: Tổng quan, Thành viên, Hồ sơ tổ chức, Sự kiện, Quan hệ tổ chức, each shown only with its capability; S05 not listed. Copy pending PO review |
| <a id="dec-wf03-t00-d3"></a>DEC-WF03-T00-D3 | **Guard / API semantics.** Pages: guest → /auth; onboarding not DONE → resolver; no ops scope, or an out-of-scope / malformed / non-operational `orgId` → the same 404. Layouts check `network:read` / `org:read`; each screen still checks its own capability. `GET /ops/organizations`: 401 without a session, 403 `SCOPE_FORBIDDEN` with no ops scope; DTO = OrganizationRefDTO + `status` + canonical `parent` (shown if PUBLISHED or in the actor's scope) + `active_members`; ordered by name; keyset cursor; ≤ 50 per page. An unknown `type` matches nothing and an unusable cursor starts from page one (the `parseListQuery` convention; no error code is contracted) |
| <a id="dec-wf03-t00-d4"></a>DEC-WF03-T00-D4 | **Migration 009 not required for T00.** No relationship is written yet; the reader reports more than one ACTIVE PARENT as DATA INCONSISTENCY and shows no parent. Enforcement is decided with the first relationship writes (S08, after C1) |

## DEC-WF03-S01-D — Organization selector / list implementation decisions

**Status:** IMPLEMENTATION DECISIONS within DEC-WF03-G1..G15 and T00-D1..D4 (for review).

| ID | Decision |
|---|---|
| <a id="dec-wf03-s01-d1"></a>DEC-WF03-S01-D1 | **Mapping of the ADM8 bitmap.** The drawn header band and table card, with its six column tracks, are kept. The columns are canonical T00 DTO fields: Tổ chức (name, the row link), Trực thuộc (canonical parent), Thành viên (`active_members`), Loại (HUB / Chapter / CLB), Trạng thái (publication status label); the sixth track stays empty. "Trưởng chapter", "Summit đang chạy", "Sự kiện 30 ngày", "Sender", "Tạo chapter" and the summit-lock notice have no P0 source (INTENTIONAL-CONTRACT / P0-SCOPE). Title "Tổ chức & thành viên"; the subtitle counts organizations only, because a member-total would double-count people in a Chapter and its CLB. Copy pending PO review |
| <a id="dec-wf03-s01-d2"></a>DEC-WF03-S01-D2 | **Selection = URL.** A row opens `/ops/org/:orgId`, whose layout authorizes it (T00). No client storage, no second context mechanism. The list loads every page of `GET /ops/organizations` in the browser; states: loading, list, empty ("Chưa có tổ chức nào trong phạm vi quản lý của bạn."), failed (neutral text + "Thử lại"; no status, code or scope shown) |
| <a id="dec-wf03-s01-d3"></a>DEC-WF03-S01-D3 | **Pixel state.** The S01 QA state uses the PLATFORM_ADMIN persona (seeded HUB, Chapter 01/02, Club 01 + one test-hook CLB = the 5 drawn rows); the leader path is proven functionally. Below the 550px reference only the OpsShell sidebar continues (its colour differs from the ADM sidebar by T00-D1); the content area must be pure canvas |
| <a id="dec-wf03-s01-d4"></a>DEC-WF03-S01-D4 | **Fixture convergence fix.** `seed_p0_deterministic.sql` now also resets `role_assignments.valid_to` on reseed. An authz test that expires the leader restores by reseeding, but the old upsert left the expiry in place, so targeted runs saw an expired leader. No product behaviour change |

## DEC-WF03-S02-D — Organization dashboard implementation decisions

**Status:** IMPLEMENTATION DECISIONS within DEC-WF03-G1/G10/G11/G15 (for review).

| ID | Decision |
|---|---|
| <a id="dec-wf03-s02-d1"></a>DEC-WF03-S02-D1 | **Metrics and API.** `GET /ops/organizations/{orgId}/dashboard` (API §8.2) returns `{organization, summary, permissions}`. `summary` holds `active_members` (ACTIVE memberships), `pending_memberships` (PENDING_APPROVAL), `active_leaders` (ACTIVE leadership records), `standalone_events` and `published_events` (events with `programme_id IS NULL`, the WF03 Event scope; PUBLISHED by status) and `child_organizations` (direct ACTIVE PARENT relations via the hierarchy reader). `linked_programmes` (the §8.2 example) and "upcoming" events are omitted: WF04, and no frozen time semantics. `permissions` = the actor's capabilities for the org (display only). Aggregates only; no identities |
| <a id="dec-wf03-s02-d2"></a>DEC-WF03-S02-D2 | **Authorization.** API: `org:read` for exactly this organization via the M0-T09 `require` → out of scope, malformed or foreign id = 403 `SCOPE_FORBIDDEN`; an in-scope id that is not an operational organization → 404; no session → 401. Page: `requireOpsOrg(orgId, 'org:read')` (404), repeated in the page. `require` is imported under an alias because webpack refuses a bare `require(…)` call |
| <a id="dec-wf03-s02-d3"></a>DEC-WF03-S02-D3 | **UI mapping of ORG1.** Header band = organization name + "Bảng điều khiển · {type}". Four KPI cards: Thành viên (sub: direct child organizations), Yêu cầu chờ duyệt, Ban điều hành, Sự kiện đã công khai (sub: of all standalone events). One work item "{n} yêu cầu thành viên chờ duyệt" with the drawn chip and "Làm ngay" → `/ops/org/:orgId/members`; "Không có việc cần làm." at zero. Capability chips, scope notice, enterprise KPIs and the pilot card are not rendered. The reference has no sidebar: inside OpsShell the 48px margins are kept and card widths follow the content width. Chip and button use their drawn sizes (85×28, 97×36) so glyph-width changes cannot move them. Copy pending PO review |

## DEC-WF03-S03-D — Organization members implementation decisions

**Status:** IMPLEMENTATION DECISIONS within DEC-WF03-G3/G4/G5/G6/G11/G15 (for review).

| ID | Decision |
|---|---|
| <a id="dec-wf03-s03-d1"></a>DEC-WF03-S03-D1 | **Rows and DTO.** `GET /ops/organizations/{orgId}/members` (API §8.3) lists one row per person tied to the org by a CommunityMembership and/or a LeadershipRecord. `OpsMemberSummaryDTO`: `profile_id`; `profile` (PROFILE_DISCOVERY projection for a NETWORK viewer: display name, headline, stored avatar via the media route; `null` when hidden); `membership` (the open membership, else the latest: frozen state, provenance through `toSourceType`, the date it started, or was requested if PENDING); `leadership` (ACTIVE titles). Records are never merged or promoted. No email, account id, bio, consent content, RoleAssignment or metadata. Order: visible names alphabetically (vi), hidden identities last. Offset cursor, ≤ 50 per page; unusable cursor → first page |
| <a id="dec-wf03-s03-d2"></a>DEC-WF03-S03-D2 | **Visibility (G4).** There is no ops bypass, PLATFORM_ADMIN included. A PRIVATE profile shows as "Hồ sơ không công khai" with its relationship facts. `q` matches visible names only, so it cannot probe hidden ones. `discoveryLevelsOf` (a batch form of the existing rule) was added to `profile/visibility.ts`; existing functions are unchanged. Authorization: `member:read` for exactly this org (403 `SCOPE_FORBIDDEN` otherwise; non-operational in-scope org 404) |
| <a id="dec-wf03-s03-d3"></a>DEC-WF03-S03-D3 | **UI mapping of ADM17.** Title "Thành viên" + "{org} · {n} đang hoạt động · {m} chờ duyệt" (counts from the S02 dashboard endpoint). Filter card: name search + the two contracted filters as chips (Chờ duyệt = `membership_status=PENDING_APPROVAL`, Ban điều hành = `leadership_status=ACTIVE`). Columns Thành viên / Trạng thái / Nguồn / Vai trò / Từ + "Mở →" to S04. PENDING rows use the drawn attention tint. Not rendered: email, verification, last login, "Xuất CSV", the region and role dropdowns, account counts. The drawn 113px header block and the 15px cell offset in columns 3–5 are kept. Labels reuse the WF02-S04 wording; new copy pending PO review |

## DEC-WF03-S04-D — Membership review / leadership ops implementation decisions

**Status:** IMPLEMENTATION DECISIONS within DEC-WF03-G3/G4/G5/G6/G14/G15 (for review). The full preflight found no new business, data or security decision (no OPEN-WF03-S04-Gx); no migration.

| ID | Decision |
|---|---|
| <a id="dec-wf03-s04-d1"></a>DEC-WF03-S04-D1 | **Membership review (G5).** `PATCH /ops/organizations/{orgId}/memberships/{membershipId}` `{status}` needs `membership:confirm` for exactly this org. P0 allows two moves: PENDING_APPROVAL → ACTIVE (provenance `ORGANIZATION_VERIFIED`, `started_at` = now) and PENDING_APPROVAL → REJECTED (`ended_at` = now; the row is kept as history). Any other frozen state, or any start state other than PENDING_APPROVAL, → 409 `MEMBERSHIP_INVALID_TRANSITION`: the API's "where policy allows" moves have no frozen policy. Unknown values or extra fields → 422. A membership of another organization through this org path → 404. The row is locked (`FOR UPDATE`) and its state re-checked in the transaction, so concurrent approve / reject give exactly one winner and one 409. No Idempotency-Key: review is not on the API §2.3 list; a replay is a 409 and changes nothing |
| <a id="dec-wf03-s04-d2"></a>DEC-WF03-S04-D2 | **Leadership (G6).** `POST /ops/organizations/{orgId}/leadership` `{profile_id, title, valid_from?, valid_to?}` needs `leadership:manage`. The target must hold a CommunityMembership (any state) in this org (member-ops predicate, 03 Example B), else 404. Title is trimmed, 1–100 characters. `valid_from` is an optional past-or-today date (00:00 Asia/Ho_Chi_Minh) → `started_at`. `valid_to` must be null (422 `not_supported`): there is no planned-end column, and ending is an explicit PATCH. An ACTIVE duplicate (`uq_active_leadership`) → 409. `PATCH …/leadership/{id}` `{status: ALUMNI \| REVOKED}` closes an ACTIVE record (`ended_at` = now); a closed record → 409. There is no title edit, since it is not in the contract. No RoleAssignment, capability or scope is created, read or ended |
| <a id="dec-wf03-s04-d3"></a>DEC-WF03-S04-D3 | **Audit (G14) and detail read.** Four codes were added: MEMBERSHIP_APPROVED, MEMBERSHIP_REJECTED, LEADERSHIP_CREATED, LEADERSHIP_ENDED. They are written in the mutation's transaction with ids and states only (no title, name or email); a refused call writes nothing. `GET …/members/{profileId}` needs `member:read` and returns: `organization`, `profile_id`, the PROFILE_DISCOVERY projection (`null` when hidden — no ops bypass, G4), the current membership, every membership and leadership record with its own dates, `consent_summary {discovery_visible}` (read-only) and the actor's `permissions` for display. A person with no record in the org → 404, and the page renders that same 404 |
| <a id="dec-wf03-s04-d4"></a>DEC-WF03-S04-D4 | **UI mapping of ADM18.** Header: name (or "Hồ sơ không công khai") + "{org} · {state} · gửi {date}". The two drawn buttons become "Duyệt thành viên" / "Từ chối", shown only for PENDING_APPROVAL with `membership:confirm`. The alert explains the pending request. "Tổ chức & vai trò" gives the membership + leadership facts, the ACTIVE titles with "Kết thúc" (ALUMNI) / "Thu hồi" (REVOKED), and "Thêm vai trò lãnh đạo →", which opens an inline title + start-date form. "Đồng ý hiện tại" has one row, "Hiện thẻ trong Thư viện", plus a read-only note. "Lịch sử quan hệ" lists the record dates (dd/MM/yyyy HH:mm — the drawn dd/MM plus the year) with the record kind, never an actor. Not rendered (G3): email, resend link, lock account, fund / problem-owner consents, account log, ADM15 proposal. Because the consent card is shorter, the history card sits higher and is compared as a component. Copy pending PO review |

## DEC-WF03-S06-D — Organization profile / detail implementation decisions

**Status:** IMPLEMENTATION DECISIONS within DEC-WF03-C1/G8/G9/G14/G15 (for review). The precheck after the C1 freeze found no new conflict; no migration.

| ID | Decision |
|---|---|
| <a id="dec-wf03-s06-d1"></a>DEC-WF03-S06-D1 | **Editable fields.** `PATCH /ops/organizations/{orgId}/profile` accepts only `name` (trimmed, 1–200) and `description` (trimmed, ≤ 2000; empty → null). These are the only fields that are both canonical `organizations` columns and in the ORGP2 design ("Tên tổ chức", "Mô tả ngắn"). Refused by name with 422 `PROFILE_VALIDATION_FAILED` `not_accepted`: `id`, `slug` (roster import key), `type`, `status`, `parent_id` / `parent` / `children` / relationship fields, `logo_asset_id` (no organization logo upload contract), `metadata`, timestamps, and any other key. Region, links, website and founding year have no column and are neither rendered nor added. The limits mirror the WF02 venture limits (200 / 2000); there is no earlier organization rule |
| <a id="dec-wf03-s06-d2"></a>DEC-WF03-S06-D2 | **Authorization, lifecycle and audit.** The page and PATCH both require `org:manage` for exactly this org (screen contract scope). Out of scope → 403 `SCOPE_FORBIDDEN` (page 404), non-operational type → 404. All validation completes before the write, and the row is locked. An ARCHIVED organization is read-only (G8): 409, reusing `MEMBERSHIP_INVALID_TRANSITION` (the only frozen lifecycle-conflict code, as in DEC-WF03-S04-D2 — contract gap noted, not blocking). A real change writes one `ORGANIZATION_UPDATED` (G14) with `organization_id`, `changed_fields` and the public name delta; the description text is never copied. A no-op writes nothing and does not touch `updated_at`. No Idempotency-Key (not on the API §2.3 list) |
| <a id="dec-wf03-s06-d3"></a>DEC-WF03-S06-D3 | **Read model and hierarchy.** The detail is read on the server: `id`, `slug`, `name`, `type`, `status`, `description`, canonical `parent` and `children` from the one hierarchy reader (G9; `parent_id` ignored; an inconsistent parent shows as none), plus display `permissions`. No email, account, member, RoleAssignment or metadata. Hierarchy is read-only; S06 has no relationship control (DEC-WF03-C1) |
| <a id="dec-wf03-s06-d4"></a>DEC-WF03-S06-D4 | **UI mapping of ORGP2.** OpsShell replaces the drawn top bar and section menu; the header band has the logo tile (placeholder), name, type chip, status chip and "· thuộc {parent}". Card 1 "Thông tin hồ sơ" has a VIEW state (name, type, status, description) and an explicit EDIT state (name, description; "Lưu thay đổi" / "Huỷ") opened by "Chỉnh sửa" in the drawn secondary-button style. Card 2 "Quan hệ tổ chức" shows "Thuộc" / "Trực thuộc" rows, read-only. Not rendered: publication checklist, representatives, visibility groups, verification, programmes, change history, the actor badge, "Chưa xác thực thông tin", "Yêu cầu đổi chapter cha" (S08) and "Yêu cầu lưu trữ" (no lifecycle rule, G8). Status labels reuse S01. Copy pending PO review |

## DEC-WF03-S08-D — Organization settings / relationships implementation decisions

**Status:** IMPLEMENTATION DECISIONS within DEC-WF03-S08-RELATIONSHIP-CONTRACT / C1 / G9 / G15 (for review).

| ID | Decision |
|---|---|
| <a id="dec-wf03-s08-d1"></a>DEC-WF03-S08-D1 | **Read model.** `GET /ops/organizations/{orgId}/relationships` (`org:manage_relationship`, exact scope) returns `organization`, the ACTIVE `parent`, ACTIVE `children`, closed `history` (both directions, with dates and close reason), server-filtered `candidates` (`children`: parentless, non-archived, valid-pair organizations in the actor's scope that are not ancestors; `parents`: valid-pair organizations in scope that are not the current parent and not descendants) and display `permissions`. Each ACTIVE row carries a display-only `manageable` flag (the counterpart is also in scope). No member, account or profile data |
| <a id="dec-wf03-s08-d2"></a>DEC-WF03-S08-D2 | **Errors.** Validation, type, self and cycle → 422 `PROFILE_VALIDATION_FAILED` with field reasons. Duplicate, second parent, stale change, archived and re-close → 409 `MEMBERSHIP_INVALID_TRANSITION` (the only frozen conflict code, as in DEC-WF03-S04-D2 / S06-D2; contract gap noted). Out of scope → 403 `SCOPE_FORBIDDEN`. Unknown / non-operational organization or a relationship of another organization → 404. **Idempotency (API §2.3):** create and close honour `Idempotency-Key` through the durable store (operation `organization.relationship-create-or-close`, keyed per actor; a replay returns the first response, a different body with the same key → 409 `UNCONTRACTED_IDEMPOTENCY_CONFLICT`). A request without a key is still processed — the same PROVISIONAL leniency as the other listed operations (IDEMPOTENCY_STORE_P0.md); the UI always sends a key |
| <a id="dec-wf03-s08-d3"></a>DEC-WF03-S08-D3 | **Tests.** Mutations use test-only organizations; the seeded tree is only read. The T00 test that inserted two ACTIVE parents now asserts that the database refuses the second one (the reader's INCONSISTENT branch stays as a defence) |
| <a id="dec-wf03-s08-d4"></a>DEC-WF03-S08-D4 | **UI mapping of ADM21.** Title "{org} · quan hệ tổ chức" + counts; "+ Thêm quan hệ" (pinned 122×33) focuses the add form. Cards: tree position (parent → current → n trực thuộc); "Đang hiệu lực" table (Thuộc / Đơn vị cha của, organization, since, type, "Kết thúc" when manageable, with an inline reason); "Đã kết thúc · giữ lịch sử"; the add form (Đơn vị cha của / Thuộc — or "Đổi đơn vị cha" when a parent exists, with the history note); and the frozen valid-pair rules. Not rendered: change-parent request card, partner / co-organizer / programme rows, audit-log card. Copy pending PO review |

## DEC-WF03-S07-D — Standalone Event management implementation decisions

**Status:** IMPLEMENTATION DECISIONS within DEC-WF03-S07-EVENT-LIFECYCLE / G2 / G10 / G14 / G15 (for review).

| ID | Decision |
|---|---|
| <a id="dec-wf03-s07-d1"></a>DEC-WF03-S07-D1 | **Standalone only.** Every S07 call (list, detail, PATCH, publish, cancel) works on `events.programme_id IS NULL`; a programme-linked event is WF04 and answers 404 (no edit, no leak). Create sets `organization_id` from the path, `programme_id` NULL and `status` DRAFT; the server generates `slug` (name + 8 hex). Limits: name ≤ 200, summary ≤ 2000, location ≤ 200; timestamps are ISO-8601 with an offset, stored in UTC; the UI enters and shows Asia/Ho_Chi_Minh |
| <a id="dec-wf03-s07-d2"></a>DEC-WF03-S07-D2 | **Detail endpoint.** `GET /events/{eventId}` ("permission-filtered detail") returns the manager DTO to an actor with `event:manage` on the owning organization; every other caller gets the same 404. The public / network projection of published events belongs to S09 |
| <a id="dec-wf03-s07-d3"></a>DEC-WF03-S07-D3 | **Authorization, errors, idempotency, audit.** `event:manage` for exactly the owning organization. Organization routes answer 403 `SCOPE_FORBIDDEN`; event-id routes answer 404 for an event the actor cannot manage (no id probing). Validation → 422 `PROFILE_VALIDATION_FAILED` with field reasons (`required`, `past`, `before_start`, `not_supported`, `not_accepted`). Lifecycle conflicts (re-publish, cancel of DRAFT / ENDED, edit outside DRAFT / PUBLISHED, archived organization) → 409 `MEMBERSHIP_INVALID_TRANSITION` (the only frozen conflict code; contract gap noted as in S04 / S06 / S08). A PUBLISHED event keeps the publish requirements on edit; `past` is checked only when starts_at changes. Row lock (`FOR UPDATE`) + in-transaction state checks give one result under races. Idempotency-Key on create and publish through the store (`event.create-or-publish`; optional, provisional leniency); cancel repeats are 409. Audit EVENT_CREATED / _UPDATED (`changed_fields`) / _PUBLISHED / _CANCELLED with `event_id`, `organization_id` and status only; a no-op PATCH writes nothing |
| <a id="dec-wf03-s07-d4"></a>DEC-WF03-S07-D4 | **UI (G2 addendum).** Built from the ADM21 / S08 primitives: title "Sự kiện" + counts, pinned "+ Tạo sự kiện" (122×33), "Sự kiện độc lập" table (name, one-line time, place, status chip, "Mở"), side card with the create form or the selected event (editable in DRAFT / PUBLISHED, "Công khai" for DRAFT, "Huỷ sự kiện" with confirmation for PUBLISHED / LIVE, read-only otherwise). Not rendered: every WF04 element of the S07 collage (funnel, qualifying round, campaign mail, registrants). Visual QA compares these primitives with the approved S08 reference; the S07 bitmap delta is INTENTIONAL-CONTRACT. Copy pending PO review |

## DEC-WF03-S09-D — Public organization page implementation decisions

**Status:** IMPLEMENTATION DECISIONS within DEC-WF03-G9/G10/G13, DEC-WF01-S07-D2 (for review). The fast-path precheck found no new conflict.

| ID | Decision |
|---|---|
| <a id="dec-wf03-s09-d1"></a>DEC-WF03-S09-D1 | **Public projection.** `GET /organizations/by-slug/{slug}` and `/organizations/:slug` need no session, and a session changes nothing: guest, member, leader and admin get the same `OrganizationPublicDTO` (slug, name, type, description, parent, children with counts, stats, upcoming events). Public = `status = PUBLISHED` and type HUB / CHAPTER / CLB; unknown, DRAFT, ARCHIVED, other types and malformed slugs are the same 404 (identical envelope). No ids, metadata, membership state / provenance, accounts or roles |
| <a id="dec-wf03-s09-d2"></a>DEC-WF03-S09-D2 | **Hierarchy and counts.** Parent and children come from the G9 reader (`organization_relationships`, ACTIVE PARENT; `parent_id` ignored), shown only when PUBLISHED. Counts, each a named query: `active_members` (ACTIVE memberships), `public_events` (standalone PUBLISHED events), `children` (listed PUBLISHED children); per child: ACTIVE members and standalone PUBLISHED events. No bitmap counter without a source (teams, summits, events "held") |
| <a id="dec-wf03-s09-d3"></a>DEC-WF03-S09-D3 | **Events and people.** Upcoming events: standalone (`programme_id IS NULL`), `status = PUBLISHED`, `COALESCE(ends_at, starts_at) ≥ now`, max 6, fields name / summary / times / location. Never DRAFT, CANCELLED, LIVE / ENDED (no P0 operation) or programme-linked. **No person is rendered:** PROFILE_DISCOVERY is never visible to a guest (DEC-WF01-S07-D2 / `canSeeDiscovery`), even with a PUBLIC override, so membership and leadership never surface an IndividualProfile; the leadership section and contact email are omitted |
| <a id="dec-wf03-s09-d4"></a>DEC-WF03-S09-D4 | **UI mapping of "Hồ sơ Chapter".** Its own public layout (no OpsShell / MemberShell), including the drawn 38px white page frame. Top bar (brand / org, three section anchors, "Xin vào …"), hero (type · parent, status chip, logo tile, name, description, three counts, join + "Xem sự kiện sắp tới"), children cards, upcoming events, the join band and footer. "Xin vào …" goes to `/me/roles` (WF02-S04 membership request; guests reach /auth). Gradients fitted to the bitmap. Not rendered: founding date, region line, partner strip, leadership, team / summit numbers, "Bài toán", summit / challenge links, registration chips, capacities, CLB region chips, QĐ notes, footer links. The public route group no longer adds a width container (S09 is its only screen); the M0-T03 shell evidence moved to the last placeholder (WF03-S05, inside OpsShell) with a new baseline. Copy pending PO review |

## DEC-P0-LANDING-D — Public homepage implementation decisions (INTERNAL ALPHA)

**Status:** IMPLEMENTATION DECISIONS under the P0-LANDING authorization (2026-09-27, for review). Outside WF01–WF03; no WF decision is reopened.

| ID | Decision |
|---|---|
| <a id="dec-p0-landing-d1"></a>DEC-P0-LANDING-D1 | **`/` is the public homepage.** It supersedes M0-ENTRY-01 for `/` only, by explicit task authority: `/` renders for guests and signed-in accounts and no longer redirects. The entry decision M0-ENTRY-01 made moved into the primary CTA: guest → `/auth` ("Đăng nhập / Tham gia"); signed-in → `routeFor(getOnboardingState)` from the ONE resolver — `/me` ("Vào tài khoản của tôi") once onboarded, else the first incomplete WF01 step ("Tiếp tục thiết lập tài khoản"). An invalid, revoked or expired session is a guest. No role, scope or ops shortcut is read or shown. Protected routes, their guards and the resolver are unchanged |
| <a id="dec-p0-landing-d2"></a>DEC-P0-LANDING-D2 | **Design and claims.** No approved landing bitmap exists in `design-reference/final`. The page is composed from approved public primitives: the WF03-S09 top bar, hero gradient, red-dash eyebrow, bordered cards, join band and footer, and the WF01-S01 Archivo display headline via `.type-display`. Visual QA compares those primitives with S09 and captures 1440×900 + full page; no pixel equivalence is claimed; PO review decides the layout. Claims trace to Master Spec §1 (shared identity / data and operating layer; activity → canonical records → enriched profiles → future Discovery / Matching) and Data SOT principles 1, 4, 7. Status per surface: "Đang vận hành" = WF01–WF03, "Demo" = WF04 programme / challenge, "Tương lai" = WF06 discovery / matching and 1Hub / CCCD verification. No metric, AI, investor, fundraising, job or marketplace claim. The four pain points are the ones the task supplies from the Overview (not in the repository) |
| <a id="dec-p0-landing-d3"></a>DEC-P0-LANDING-D3 | **Links.** Only real destinations: in-page sections (`#van-de`, `#san-pham`, `#tam-nhin`), the primary CTA above, the WF03-S09 page of a PUBLISHED HUB ("Mạng lưới" / "Khám phá mạng lưới", not rendered when none exists), and the current legal documents' public URLs in the footer. No `#` placeholder, no route to a Demo / Future surface, no contact form. The homepage reads no member, count or private data |


## DEC-P0-SHELL-D — Integrated product shell + navigation decisions (INTERNAL ALPHA)

**Status:** IMPLEMENTATION DECISIONS under the P0-SHELL authorization (2026-09-27). The PO chose D3–D6 (recommended options). No business rule, enum, route, capability or audit code is added; WF01–WF03 decisions are not reopened. Audit: [P0_SHELL_NAVIGATION_AUDIT.md](../implementation/P0_SHELL_NAVIGATION_AUDIT.md).

| ID | Decision |
|---|---|
| <a id="dec-p0-shell-d1"></a>DEC-P0-SHELL-D1 | **Wordmark → `/`.** The "HUB NETWORK" wordmark in AuthSplitLayout, OnboardingShell, MemberShell, OpsShell and the public organization page is a link to the homepage (`HomeLink`, `data-nav="home"`); visuals unchanged. It is the first Tab stop on those screens; the WF01 keyboard specs account for it |
| <a id="dec-p0-shell-d2"></a>DEC-P0-SHELL-D2 | **SUPERSEDED on `/` by [DEC-2809-D1](#dec-2809-d1) (hidden or visible "Coming soon").** **Inert items state their reason.** MemberShell items without a P0 destination stay `aria-disabled`, unfocusable, with the reason in `title` and the accessible name: FUTURE → "Tính năng giai đoạn sau — chưa có trong phiên bản này"; no P0 screen → "Chưa có trong phiên bản này" (also the bell) |
| <a id="dec-p0-shell-d3"></a>DEC-P0-SHELL-D3 | **Member ↔ ops entries.** MemberShell shows "Vận hành tổ chức" → `/ops/network` only when the server reports ops access (`hasOpsAccess(resolveActor)`); OpsShell shows "← Tài khoản của tôi" → `/me` at the sidebar foot. Display convenience only; routes and APIs authorize as before |
| <a id="dec-p0-shell-d4"></a>DEC-P0-SHELL-D4 | **Editor back link.** EditorHeader (profile edit, project / startup editor, team) renders "← Tài khoản của tôi" → `/me` before its actions |
| <a id="dec-p0-shell-d5"></a>DEC-P0-SHELL-D5 | **Venture editor ↔ team.** An existing venture's editor links "Đội ngũ" → `/projects/:id/team`; the team page links "Hồ sơ dự án" → `/projects/:id/edit`. Owner guard unchanged (foreign id → 404) |
| <a id="dec-p0-shell-d6"></a>DEC-P0-SHELL-D6 | **Project creation entry.** WF01-S08 renders reference card 02 "Lập hồ sơ đội" with a secondary button → `/projects/new` (DEC-WF01-S08-D3's condition — WF02-S05 Production-ready — is met; card 01 Challenge and card 03 Chapter stay omitted); WF02-S01 "Tổ chức của tôi" card head carries "+ Tạo dự án / startup" → `/projects/new`. Card 02 is pixel-compared with the reference (segment `project-card`). |
| <a id="dec-p0-shell-d7"></a>DEC-P0-SHELL-D7 | **Auth entry below desktop.** Below 1024px the auth split layout stacks (brand panel above the form) and the auth card is `min(27.5rem, 100%)` wide, so `/auth` — the landing CTA target — has no horizontal scroll at 768 / 390 (Design SOT: responsiveness may adapt below 1440 without changing the hierarchy). 1440 unchanged. Member / ops / onboarding shells remain desktop-first (not certified) |


## OPEN-WF04 — Programme / Challenge demo pre-implementation (human decision required)

**Status:** CLOSED 2026-09-27 by [DEC-WF04-H1..H5](#dec-wf04-h1) (history kept). Found by the WF04 pre-implementation audit. **Audit:** [WF04_PRE_IMPLEMENTATION_AUDIT.md](../implementation/WF04_PRE_IMPLEMENTATION_AUDIT.md).
**Already frozen (not asked):** WF04 = DEMO; one `Programme` aggregate with `PROGRAMME | CHALLENGE` (Freeze D1); lifecycle `DRAFT → PUBLISHED → CLOSED → ARCHIVED` (SOT §6); routes `/demo/programmes/*` and a fixture repository with no production-table writes (architecture 01 §7, 04 A2); Event reuse with `programme_id` (SOT §11); application = applicant reference + programme-specific answers (SOT §12); no new capability; WF03 not reopened (G12).

| ID | Question | Why this matters | Evidence | Recommended | Alternative | Impact | Blocks |
|---|---|---|---|---|---|---|---|
| <a id="open-wf04-h1"></a>WF04-H1 | Which design source do WF04 screens follow? | No approved WF04 bitmap exists; the external reference is not shared with this session (access denied); only ADM5 exists | `WF04_EXTERNAL_REFERENCE.md`; `design-reference/final` has no WF04; ADM5 | Compose from approved primitives (OpsShell, ADM5 table / pill / primary button, S07 form, WF01 stepper, S02 / S04 cards); primitives pixel-compared, no pixel-equivalence claim, PO reviews layout (precedent DEC-P0-LANDING-D2, WF03-G2). If the PO shares the external artifact, it is read as layout reference only | Share and promote the external design to `design-reference/final/WF04` with a pixel map first | UI fidelity, pixel gate | All |
| <a id="open-wf04-h2"></a>WF04-H2 | Who can open `/demo/programmes`, and where is the entry? | Organizer rights have no capability yet; an entry changes a shared shell | 03 §4 (PROGRAMME_ORGANIZER later); Matrix `programme:read`; DEC-P0-SHELL-D2/D3 | Ops actors only (`hasOpsAccess`: HUB_COMMUNITY_LEADER of any org, PLATFORM_ADMIN); all fixture programmes visible to them (demo data, not org data); new drafts may pick an owning org from the actor's scope; entry = one OpsShell link "Chương trình · Demo" at the sidebar foot (as D3); MemberShell "Challenge" stays inert; landing unchanged | Any onboarded member (read-only showcase), entry in MemberShell | Guard, shell, WF03 pixel regression | T00 |
| <a id="open-wf04-h3"></a>WF04-H3 | What is "Structure & Participation Journey"? | SOT names the node with no fields; ADM5 shows a phase with a deadline | Freeze D1; domain 02 §2.5; ADM5 "Giai đoạn" | Ordered **stages** {name, start, end, short description}, DEMO-only (not canonical); current stage = the stage containing today; events shown by date inside stage windows (no stage–event link); no rules / builder | Journey = programme dates + linked events only (no stage concept) | S03, S01 / S08 "current stage" | S03 |
| <a id="open-wf04-h4"></a>WF04-H4 | Do Challenges show problem statements ("Bài toán")? | ADM5 centres the Challenge on them; SOT only says challenge-specific children "may be added later" | ADM5; Data SOT §10; Freeze D1 | Yes, DEMO-only: a Challenge carries an inline list {title, summary} edited in S03 and counted in S01; no problem bank (ADM2), owner pipeline or evaluation | Omit (FUTURE); S01 drops the column | S03, S01, S07 | S03 |
| <a id="open-wf04-h5"></a>WF04-H5 | When may the demo publish? | No frozen publish precondition; ADM5 draws "Challenge rỗng" as unpublishable | SOT §6; ADM5 note; DEC-WF03-S07-EVENT-LIFECYCLE (precedent) | DEMO-only checklist that blocks publish: name, type, owning org, start and end with end ≥ start, ≥1 stage; CHALLENGE also ≥1 problem statement (if H4 = yes). Not a production rule | Informational checklist, publish always allowed | S07 | S07 |


## DEC-WF04 — Programme / Challenge demo decisions (INTERNAL ALPHA)

**Status:** HUMAN APPROVED 2026-09-27 (H1–H5, the WF04 decision freeze); T00 implementation decisions recorded with WF04-T00. Closes [OPEN-WF04 H1–H5](#open-wf04-h1). WF04 stays DEMO: no canonical aggregate, table, migration, production Programme mutation API, audit code, analytics, eligibility / application / notification engine. A later approved WF04 visual reference may replace the visual baseline, never this business model.

| ID | Decision |
|---|---|
| <a id="dec-wf04-h1"></a>DEC-WF04-H1 | **Design source.** WF04 is composed from approved shared primitives and design language (OpsShell, ADM header band, tables, cards, forms, buttons, pills, stepper, approved display type). No WF04 pixel parity is claimed; differences are INTENTIONAL-DEMO. `design-reference/final` is not modified to fabricate a baseline |
| <a id="dec-wf04-h2"></a>DEC-WF04-H2 | **Access and entry.** PLATFORM_ADMIN, and HUB_COMMUNITY_LEADER only inside its assigned organization scope (`programme:read`, exact, no inheritance). PROGRAMME_ORGANIZER is a display label only: it grants no capability, creates no RoleAssignment, grants no scope and bypasses no ops check. One Programme / Challenge entry sits at the OpsShell foot for actors who pass the ops guard; it is convenience only, the server guard and demo API decide |
| <a id="dec-wf04-h3"></a>DEC-WF04-H3 | **Structure & journey** = a simple ordered stage list {position, name, summary, start, end}, demo data only. No workflow builder, branching, rules, conditional transitions, scoring, approval or automation |
| <a id="dec-wf04-h4"></a>DEC-WF04-H4 | **Challenge "Bài toán".** For `type = CHALLENGE` an inline demo list {title, summary}; not rendered for `PROGRAMME`. No ChallengeProblem entity, table, migration, production API, lifecycle, review or scoring |
| <a id="dec-wf04-h5"></a>DEC-WF04-H5 | **Demo publish checklist.** DRAFT → PUBLISHED (browser session only) is blocked until every item passes; each item comes from an existing source: name present (`programmes.name` NOT NULL); type ∈ PROGRAMME / CHALLENGE (`programme_type`); an owning organization inside the actor's scope (architecture 02 §2.5 + H2); when both dates are set, end ≥ start (canonical Event rule, DEC-WF03-S07-EVENT-LIFECYCLE E3); a CHALLENGE has ≥ 1 problem statement (approved ADM5 rule + H4). Stages, events, registration and team are never required. No eligibility or rules engine. Lifecycle: DRAFT → PUBLISHED only; CLOSED / ARCHIVED stay FUTURE (schema gap D1 stays DEFERRED) |
| <a id="dec-wf04-t00-d1"></a>DEC-WF04-T00-D1 | **Fixture.** A frozen code module (`src/lib/programme-demo/fixtures.ts`), not rows: one PROGRAMME (PUBLISHED, 3 stages, 2 events, 2 team rows, application counts) and one CHALLENGE (DRAFT, 2 stages, 2 problem statements, 1 event, 1 team row, no applications), both owned by the development fixture organization Chapter 01. Ids in the reserved `d40…` range; neutral "(demo)" names; no person, company, roster or contact data. Events use `EventDTO` + `programme_id`; application data are counts by SOT §6 status only. A fixture whose owning organization does not exist is not listed |
| <a id="dec-wf04-t00-d2"></a>DEC-WF04-T00-D2 | **Demo API.** `GET /api/v1/demo/programmes` (list envelope; 401 without a session; 403 SCOPE_FORBIDDEN without `programme:read` anywhere) and `GET /api/v1/demo/programmes/{id}` (unknown, non-demo, malformed or out-of-scope id = the same 404). DTO = the `programmes` columns with the API §8.4 `type` name, the owner's OrganizationRefDTO, counts and `demo: true`. Query parameters and headers never widen scope; no mutation method exists (405). Reads one SELECT on `organizations`; writes nothing |
| <a id="dec-wf04-t00-d3"></a>DEC-WF04-T00-D3 | **Session store.** Demo changes live only in `sessionStorage` under `hub.wf04-demo.v1.<actor key>` (first 16 hex of SHA-256 of the account id: per actor, not reversible). Refresh keeps them; a new tab, another actor or "Đặt lại demo" starts from the fixture; unreadable or other-version values are ignored; storage refusal falls back to memory. Reset uses the inline confirmation pattern of WF02 settings and touches only that key: never PostgreSQL, the login session, memberships or permissions. Session drafts are shown only inside the actor's allowance |
| <a id="dec-wf04-t00-d4"></a>DEC-WF04-T00-D4 | **Guard and entry.** `/demo/programmes/*` pages: the existing ops entry (no session → /auth; onboarding → resolver; no ops scope → 404), then `programme:read` somewhere, else 404. OpsShell foot shows "Demo · Internal Alpha / Chương trình & Challenge" → `/demo/programmes` in every OpsShell context, current on demo pages. WF03 navigation and the FUTURE route `/ops/org/:orgId/programmes` (WF03-S05) are unchanged and unlinked |
| <a id="dec-wf04-t00-d5"></a>DEC-WF04-T00-D5 | **Frame and routes.** Every demo screen renders in `DemoPage`: the ADM header band, then the ADM5-style "Dữ liệu demo · Internal Alpha" notice with "Đặt lại demo"; no WF01–WF03 screen uses it. T00 renders `/demo/programmes` as that frame with in-scope totals; the other audit routes (`/new`, `/:id`, `/:id/setup/{basic,journey,events,registration,team,review}`) are built by S01–S08 and are the ordinary 404 until then (no placeholder, no link). Route builders live in `src/lib/programme-demo/routes.ts`, apart from the WF01–WF03 contract manifest |


## DEC-WF04-S01 — Programme / Challenge list implementation decisions

**Status:** IMPLEMENTATION DECISIONS under WF04-S01 (2026-09-27), within DEC-WF04-H1..H5 and T00-D1..D5; no business rule, field, status or route added. Report: [WF04-S01](../implementation/reports/WF04-S01_programme-list.md).

| ID | Decision |
|---|---|
| <a id="dec-wf04-s01-d1"></a>DEC-WF04-S01-D1 | **Rows do not navigate yet.** `/demo/programmes/:id` has no screen until WF04-S08, so rows carry no link (INTENTIONAL-DEMO); no placeholder detail is built. S08 makes the row the entry to the detail (**superseded by [DEC-WF04-S08-D3](#dec-wf04-s08-d3)**: rows now open `/demo/programmes/:id`) |
| <a id="dec-wf04-s01-d2"></a>DEC-WF04-S01-D2 | **"Tạo mới" disabled until S02.** Rendered in the ADM5 header-button family, `disabled` + `aria-disabled`, reason "Chưa có trong phiên bản này" in `title` and the accessible name (the DEC-P0-SHELL-D2 inert pattern; the navigation matrix records it as DISABLED). No link to `/demo/programmes/new`. S02 enables it. **Superseded by [DEC-WF04-S02-D3](#dec-wf04-s02-d3)** (the CTA opens S02) |
| <a id="dec-wf04-s01-d3"></a>DEC-WF04-S01-D3 | **Content and presentation.** One source, `GET /api/v1/demo/programmes`, merged with the actor's session store: session drafts newest first, then the server's order; a session copy replaces its row; an id is shown once. Columns are DTO fields only: Tên, Đơn vị chủ trì (owner organization name), Loại (Chương trình / Challenge), Thời gian (dd/MM/yyyy, Asia/Ho_Chi_Minh), Bài toán (count for CHALLENGE, "—" for PROGRAMME), Trạng thái. Status pills use the ADM5 families: PUBLISHED "Đang công khai" = open-state, DRAFT "Bản nháp" = neutral. ADM5 table card and first four column tracks; the problem-count track is narrowed so the status pill is never clipped. States: loading, populated, empty ("…trong phạm vi tổ chức của bạn"), error with "Thử lại" only. Below 1160px the table scrolls inside its card and the header / notice wrap below 1024px; OpsShell stays desktop-first (P0-SHELL PO item) |


## DEC-WF04-S02 — Create + basic info decisions

**Status:** D1 and D2 HUMAN APPROVED 2026-09-27 (asked during the WF04-S02 precheck: the requested form — Loại, Tên, Tóm tắt, Lĩnh vực, Tỉnh / thành phố, "Lưu", type immutable — is the WF02-S05 Project / Startup form of DEC-WF02-S05-G1/G4, and the Programme model has no domain or region); D3 and D4 are implementation decisions. H1–H5 not reopened. Report: [WF04-S02](../implementation/reports/WF04-S02_programme-create.md).

| ID | Decision |
|---|---|
| <a id="dec-wf04-s02-d1"></a>DEC-WF04-S02-D1 | **Fields = the Programme model.** Loại (`PROGRAMME` / `CHALLENGE`, labels "Chương trình" / "Challenge", chosen once and never changed afterwards), Tên (required after trimming; no invented length limit), Tóm tắt (optional), Thời gian (optional start / end calendar days in Asia/Ho_Chi_Minh, stored as 00:00 / 23:59; end ≥ start), Đơn vị chủ trì (D2). No Lĩnh vực, Tỉnh / thành phố or any other taxonomy or future field |
| <a id="dec-wf04-s02-d2"></a>DEC-WF04-S02-D2 | **Owner from the server-side scope.** The page computes the operational organizations (HUB / CHAPTER / CLB) the actor holds `programme:read` for (all for PLATFORM_ADMIN, exactly the assigned ones for a leader). One → shown read-only; several → a select limited to them (required); a value outside the list is refused; query, header and body are not inputs |
| <a id="dec-wf04-s02-d3"></a>DEC-WF04-S02-D3 | **Navigation.** S01 "Tạo mới" → `/demo/programmes/new`; "Huỷ" → the list; after a save → the list with a one-off confirmation "Đã tạo bản nháp “…”." (INTENTIONAL-DEMO until WF04-S03 makes `setup/journey` the next step). Editing the basic information of an existing programme (`setup/basic`, type locked) is built with the S08 edit entry (**built: [DEC-WF04-S08-D2](#dec-wf04-s08-d2)**). **Post-save destination superseded by [DEC-WF04-S03-D3](#dec-wf04-s03-d3)** (→ `setup/journey`) |
| <a id="dec-wf04-s02-d4"></a>DEC-WF04-S02-D4 | **Save.** Validates first, then stores exactly one DRAFT per save (random v4 id outside the fixture range, slug `demo-<8 hex>`, empty stages / events / team / registration, `problem_statements: []` for a CHALLENGE only). A double submit is ignored. A write the browser refuses shows "Chưa lưu được bản nháp. Vui lòng thử lại." and saves nothing (amends DEC-WF04-T00-D3: no memory fallback for writes). Reset also clears the confirmation |


## DEC-WF04-S03 — Structure / journey implementation decisions

**Status:** IMPLEMENTATION DECISIONS under WF04-S03 (2026-09-27), inside DEC-WF04-H3/H4/H5 and T00-D1..D5; no field, rule, status or route added. Report: [WF04-S03](../implementation/reports/WF04-S03_programme-journey.md).

| ID | Decision |
|---|---|
| <a id="dec-wf04-s03-d1"></a>DEC-WF04-S03-D1 | **Edits.** Stages use the frozen shape only (position, name required, summary optional, start / end days optional with end ≥ start — the S02 / canonical Event rule; no constraint against the programme's own dates). Order is `position`, always contiguous 1..n: add appends, remove renumbers, "↑ / ↓" swap neighbours (first cannot go up, last cannot go down); no drag and drop. Remove uses the inline confirmation pattern. Problem statements ("Bài toán": title required, summary optional; add / edit / remove) exist on a CHALLENGE only and never on a PROGRAMME. Every edit is one pure, atomic change of the session copy (`journey.ts`); an invalid or unknown edit, or a refused browser write, changes nothing. H5 is unchanged: no stage is required; the problems card only restates the frozen CHALLENGE rule. UI composed from ADM5 card chrome, the WF01 stepper language, the WF01-S08 red index, WF03 text actions and WF02 inputs (INTENTIONAL-DEMO) |
| <a id="dec-wf04-s03-d2"></a>DEC-WF04-S03-D2 | **Resolving `/demo/programmes/:id/*`.** Malformed id → 404. Fixture-range id → the fixture read with the actor's `programme:read` scope, else the same 404. Any other UUID can only be a draft of the actor's own browser session: it is shown when present and inside the actor's allowance, otherwise "Không tìm thấy chương trình này trong bản demo của bạn." (the audit's lost-draft state), revealing nothing. Query parameters and headers are not inputs |
| <a id="dec-wf04-s03-d3"></a>DEC-WF04-S03-D3 | **Navigation.** An S02 save continues to `setup/journey` of the new draft; the one-off confirmation moved into `DemoPage`, so any demo screen can show it. S03 "← Danh sách" → the list (`setup/basic` comes with S08); "Tiếp theo" is disabled with "Chưa có trong phiên bản này" until WF04-S04 (**now opens S04, [DEC-WF04-S04-D3](#dec-wf04-s04-d3)**); the setup stepper is information only (no links) |


## DEC-WF04-S04 — Programme events implementation decisions

**Status:** IMPLEMENTATION DECISIONS under WF04-S04 (2026-09-27), inside DEC-WF04-H1..H5, T00-D1..D5 and the canonical Event contract (DEC-WF03-S07-EVENT-LIFECYCLE); no field, state, rule or route added; WF03 Event runtime untouched. Report: [WF04-S04](../implementation/reports/WF04-S04_programme-events.md).

| ID | Decision |
|---|---|
| <a id="dec-wf04-s04-d1"></a>DEC-WF04-S04-D1 | **Event contract reused.** REUSE: `EventDTO` + `programme_id`, fields name (required, ≤ 200), summary (≤ 2000), location_text (≤ 200), starts_at / ends_at (optional; the end is not before the start — the S07 server rule), `EVENT_LIMITS`, Asia/Ho_Chi_Minh entry and the S07 one-line time format, the S07 status wording, create → DRAFT, edit in DRAFT / PUBLISHED, and the S07 list order (starts_at descending, undated first, then newest created, then id). DEMO-ONLY: removing a DRAFT from the demo journey (session copy only). FUTURE / NOT REQUIRED: publish, cancel, registration, LIVE / ENDED / ARCHIVED operations — a published event is not removable (WF03 would cancel it). `programme_id` is always the current programme and `organization_id` its owner; neither is an input. The S07 time helpers are re-stated in `event-time.ts` because they live inside the closed WF03 component |
| <a id="dec-wf04-s04-d2"></a>DEC-WF04-S04-D2 | **Boundary.** S04 renders and edits only events whose `programme_id` equals the current programme, from the fixture plus the actor's session edits; a stored event of another programme (tampered copy) is neither shown nor editable; standalone WF03 events (`programme_id` NULL) are never read. No demo event is a database row, and WF03 APIs never return one |
| <a id="dec-wf04-s04-d3"></a>DEC-WF04-S04-D3 | **Setup frame and navigation.** Setup steps share `SetupScreen` (the S03-D2 resolution, loading / not-found states, header, stepper, a save error with "Thử lại" that retries the same write and closes the editor on success) and the inline `Confirm`. S03 "Tiếp theo" → `setup/events`; S04 "← Hành trình" → `setup/journey`; S04 "Tiếp theo" disabled with its reason until WF04-S05 (**now opens S05, [DEC-WF04-S05-D3](#dec-wf04-s05-d3)**) |


## DEC-WF04-S05 — Registration configuration implementation decisions

**Status:** IMPLEMENTATION DECISIONS under WF04-S05 (2026-09-27), inside DEC-WF04-H1..H5, T00-D1 and SOT §6 / §12; no field, rule, status or route added. Report: [WF04-S05](../implementation/reports/WF04-S05_programme-registration.md).

| ID | Decision |
|---|---|
| <a id="dec-wf04-s05-d1"></a>DEC-WF04-S05-D1 | **Configuration = the frozen `RegistrationConfigDTO`.** CONFIG DEMO: who may apply — primary applicant types `INDIVIDUAL` / `TEAM` / `STARTUP` ("Cá nhân" / "Đội" / "Startup"; SOT §12, one primary applicant per application), and programme-specific questions as plain text (SOT §12 `programme_specific_answers`; no types, rules, branching, uploads or form builder). REUSE: the SOT §12 profile-reuse rule, stated on the screen. DEMO read-only: application counts by SOT §6 state, never changed by S05. FUTURE (not frozen, not rendered): open / close switch, registration period, eligibility conditions, review, verification, notifications, payment. An empty configuration is allowed ("Chưa cấu hình đăng ký"). H5 unchanged: registration is never a publish prerequisite. A choice never grants a capability |
| <a id="dec-wf04-s05-d2"></a>DEC-WF04-S05-D2 | **Edit rules.** One pure, atomic edit (`registration.ts`): an unknown applicant type or a blank question refuses the whole save and changes nothing; types are stored in canonical order, once; questions are trimmed. Save is guarded against a double submit; success shows "Đã lưu cấu hình đăng ký."; a refused browser write uses the `SetupScreen` "Thử lại" |
| <a id="dec-wf04-s05-d3"></a>DEC-WF04-S05-D3 | **Navigation.** S04 "Tiếp theo" → `setup/registration`; S05 "← Sự kiện" → `setup/events`; S05 "Tiếp theo" disabled with its reason until WF04-S06 (**now opens S06, [DEC-WF04-S06-D3](#dec-wf04-s06-d3)**) |


## DEC-WF04-S06 — Operating team implementation decisions

**Status:** IMPLEMENTATION DECISIONS under WF04-S06 (2026-09-27), inside DEC-WF04-H2 and T00-D1; no field, role, capability or route added. Report: [WF04-S06](../implementation/reports/WF04-S06_programme-team.md).

| ID | Decision |
|---|---|
| <a id="dec-wf04-s06-d1"></a>DEC-WF04-S06-D1 | **Display only.** S06 renders the current programme's `team` rows from the fixture / session copy — `display_name` and `role_label` shown as "Người tổ chức chương trình" in a neutral pill — plus a count and an empty state; the WF02-S06 member row language (32 px avatar disc, medium name). No invite, add, remove, role, permission, scope, ownership or account column or control; no member-directory read. PROGRAMME_ORGANIZER stays a display label (H2): it grants no capability and writes no RoleAssignment. IndividualProfile, membership, leadership, RoleAssignment and the programme label stay separate and untouched |
| <a id="dec-wf04-s06-d2"></a>DEC-WF04-S06-D2 | **Read error + retry.** S06 makes no request and no write, so its only failure is a session store the browser refuses to read. `SetupScreen` (all setup steps) then shows "Trình duyệt chưa cho đọc dữ liệu demo của phiên này." with "Thử lại" (re-read), shows no programme data, and every store write is refused until the store can be read, so session data is never overwritten |
| <a id="dec-wf04-s06-d3"></a>DEC-WF04-S06-D3 | **Navigation.** S05 "Tiếp theo" → `setup/team`; S06 "← Đăng ký" → `setup/registration`; S06 "Tiếp theo" disabled with its reason until WF04-S07 (**now opens S07, [DEC-WF04-S07-D3](#dec-wf04-s07-d3)**) |


## DEC-WF04-S07 — Review + publish implementation decisions

**Status:** IMPLEMENTATION DECISIONS under WF04-S07 (2026-09-27), inside DEC-WF04-H5 and the SOT §6 lifecycle (demo: DRAFT → PUBLISHED only); no checklist item, state or route added. Report: [WF04-S07](../implementation/reports/WF04-S07_programme-review.md).

| ID | Decision |
|---|---|
| <a id="dec-wf04-s07-d1"></a>DEC-WF04-S07-D1 | **Publish.** The checklist is exactly `publishReadiness` (H5: name, type, owning organization in the actor's scope, date order, CHALLENGE ≥ 1 problem statement), each shown "Đạt" / "Còn thiếu", no percentage. `publishProgramme` is the only transition: DRAFT → PUBLISHED on the actor's session copy, atomic (a failing item or a non-DRAFT changes nothing, so a repeat is a no-op), keeping every setup value. No unpublish, close or archive; a fixture already PUBLISHED shows its state read-only. Authority is the server route guard (`requireDemoProgrammeRoute`) plus the scope item of the checklist; there is no server publish (T00-D3: demo changes never reach the server). A refused browser write keeps DRAFT and "Thử lại" retries the same transition |
| <a id="dec-wf04-s07-d2"></a>DEC-WF04-S07-D2 | **Review summary.** Read-only sections from the demo DTO only: basic information (type, name, owner, time, summary, status), journey (stages), CHALLENGE problem statements, this programme's events, registration (applicant types, question count), operating team. "Sửa" links go to built steps only (journey, events, registration, team; a missing problem statement links to the journey); basic information has no edit link until S08 builds `setup/basic` (**now built: basic information and a missing date item link to `setup/basic`, [DEC-WF04-S08-D3](#dec-wf04-s08-d3)**) |
| <a id="dec-wf04-s07-d3"></a>DEC-WF04-S07-D3 | **Navigation.** S06 "Tiếp theo" → `setup/review`; S07 "← Đội vận hành" → `setup/team`; after publishing the screen stays on S07 in the PUBLISHED state with "Về danh sách" (INTENTIONAL-DEMO until S08); S07 "Tiếp theo" disabled with its reason; no link to `/demo/programmes/:id` or `setup/basic` (**post-publish destination and "Tiếp theo" superseded by [DEC-WF04-S08-D3](#dec-wf04-s08-d3)**) |

## DEC-WF04-S08 — Programme detail / manage implementation decisions

**Status:** IMPLEMENTATION DECISIONS under WF04-S08 (2026-09-27), inside DEC-WF04-H1–H5 and the SOT §6 lifecycle; no field, state, transition or public route added. Report: [WF04-S08](../implementation/reports/WF04-S08_programme-detail.md).

| ID | Decision |
|---|---|
| <a id="dec-wf04-s08-d1"></a>DEC-WF04-S08-D1 | **Detail content.** `/demo/programmes/:id` shows, from the actor's session copy or the fixture (same resolution and guard as S03–S07): a status band (DRAFT "Chưa công khai…" / PUBLISHED "Đang công khai trong bản demo."), an overview (type, owning organization, time, summary) and summary cards for the journey (stages with dates), CHALLENGE problem statements, this programme's events (time, status), registration (applicant types, question count) and the operating team (display name, label). Lifecycle is shown, never changed here: publishing stays on S07; no unpublish, close, archive or reopen. No metric, application count, funnel, analytics or public URL (no `/programmes/:slug`, which the WF04 audit keeps FUTURE / OMITTED) |
| <a id="dec-wf04-s08-d2"></a>DEC-WF04-S08-D2 | **Basic information edit.** `/demo/programmes/:id/setup/basic` (step 1 of the stepper) edits name, summary and dates of an existing programme with the S02 validation, as one atomic session edit (`updateBasicInfo`). Type (chosen once, S02-D3) and owning organization are read-only: a change of owner would be an ownership transfer no source defines; planted form fields change nothing. Back → the detail; "Tiếp theo" → the journey |
| <a id="dec-wf04-s08-d3"></a>DEC-WF04-S08-D3 | **Navigation.** S01 rows link to the detail (the name cell is the link, the row is its hit area; supersedes S01-D1). S07 "Tiếp theo" and a successful publish open the detail with a one-off "Đã xuất bản “…”." (supersedes the S07-D3 stay-on-S07 destination); S07 "Sửa" for basic information and a missing date item open `setup/basic`. The detail links only to the list, `setup/review` ("Rà soát & xuất bản" for DRAFT, "Rà soát" for PUBLISHED) and the built steps (basic, journey — also for problem statements —, events, registration, team); no inert or dead control. S03 "←" still goes to the list (unchanged) |

## OPEN-WF05 — Founder / Project / Startup demo pre-implementation (human decision required)

**Status:** CLOSED 2026-09-27 by [DEC-WF05-G1..G5](#dec-wf05-g1) (history kept). Found by the WF05 pre-implementation audit. **Audit:** [WF05_PREIMPLEMENTATION_AUDIT.md](../implementation/WF05_PREIMPLEMENTATION_AUDIT.md).
**Already frozen (not asked):** WF05 = DEMO (CLAUDE.md §2); it reuses the one canonical WF02 venture (`projects`, `project_members`, `owner_profile_id`, fixed `type`; MS §4, M5; DEC-WF02-S05-G4/G5, S06-G1); routes `/demo/projects*` and `GET /api/v1/demo/projects/*` (04 A2); no table, migration or production application API (API §15; 01 §7); Application shape and lifecycle (SOT §12, §6); Solution / Participation / Outcome FUTURE (no fields or lifecycle); Founder = the owner relation (SOT §1.2); relation-only venture read (Matrix §E); WF01–WF04 not reopened.

| ID | Question | Why this matters | Evidence | Recommended | Alternative | Impact | Blocks |
|---|---|---|---|---|---|---|---|
| <a id="open-wf05-g1"></a>WF05-G1 | Which design source do WF05 screens follow? | No WF05 contract, bitmap, manifest entry or external reference exists | `docs/workflows`; manifest (WF01–WF03 only); Pixel SOT §9; zip = mirror | Compose from approved primitives (WF02-S01 cards, PRO1 editor header, PRO3 table, WF04 DemoPage / notice / cards / S05 form / S07 checklist); primitives pixel-compared; no pixel-equivalence claim; PO reviews layout (precedent DEC-WF04-H1) | Provide and promote a WF05 design to `design-reference/final/WF05` first | UI fidelity, pixel gate | All |
| <a id="open-wf05-g2"></a>WF05-G2 | Who opens `/demo/projects`, and where is the entry? | An entry changes the protected MemberShell; access defines the actor set | DEC-WF02-S05-G2; DEC-P0-SHELL-D2/D3/D6; MemberShell "Tổ chức của tôi" / "Challenge" inert | Any account with onboarding DONE (the WF02 member boundary; ops actors act as members); one MemberShell sidebar-foot link "Dự án & Startup · Demo"; approved items stay inert; `/me` and WF02 pages unchanged | Activate "Tổ chức của tôi" → `/demo/projects`; or no shell entry (link from `/me` only) | Guard, shell, P0-SHELL / WF02 pixel regression | T00 |
| <a id="open-wf05-g3"></a>WF05-G3 | May founders see WF04 demo programmes? | WF04 demo data is ops-only today; without it there is no application story | DEC-WF04-H2; `programme-demo/guard.ts`; F10 | Members see a read-only list of WF04 **fixture programmes with status PUBLISHED** (name, type, owning organization name, dates, summary, applicant types, questions); never DRAFT, counts, team or ops session drafts; served by a WF05 read model importing the fixture module read-only (WF04 code and guards unchanged) | No programme in WF05 (venture showcase only; application FUTURE) | Demo data exposure, scope | S01–S04 |
| <a id="open-wf05-g4"></a>WF05-G4 | Which applicant type does a venture apply as? | SOT: Individual / Team / Startup; WF04 config: INDIVIDUAL / TEAM / STARTUP; WF02: PROJECT / STARTUP; no Team entity | SOT §12, §2B; `programme-demo/types.ts`; DEC-WF02-S05-G4 | STARTUP ↔ venture `STARTUP`; TEAM ↔ venture `PROJECT` (team = owner + ACTIVE `project_members`); INDIVIDUAL is not a venture journey → FUTURE in WF05. Eligible = mapped type ∈ the programme's applicant types | (b) Only STARTUP applies; TEAM FUTURE until a Team entity exists. (c) Any venture may apply as TEAM | Eligibility, canonical semantics | S02–S04 |
| <a id="open-wf05-g5"></a>WF05-G5 | What may a demo application do? | Shape and lifecycle are frozen; actor, duplicates, archived, completeness and storage are not | SOT §12, §6; API §15; DEC-WF04-T00-D3; Matrix §E | (1) Owner only creates / submits; ACTIVE members read the venture only. (2) DRAFT → SUBMITTED only; no withdraw, edit after submit or review state. (3) One application per (venture, programme). (4) ARCHIVED venture cannot start one. (5) Submit needs every programme question answered; a DRAFT may be incomplete. (6) Stored only in the actor's browser session in the SOT §12 shape with the venture id — never venture fields; organizers and team members do not see it; reset clears it | Organizer-visible applications via an isolated demo table (migration; conflicts with 01 §7 / API §15); or Application FUTURE (WF05 = venture showcase) | Business behaviour, data, scope | S03, S04 |

## DEC-WF05 — Founder / Project / Startup demo decisions (INTERNAL ALPHA)

**Status:** HUMAN APPROVED 2026-09-27 (G1–G5, the WF05 decision freeze). Closes [OPEN-WF05 G1–G5](#open-wf05-g1); remaining human decisions: 0. WF05 stays DEMO: it reads the canonical WF02 venture and writes no table; no migration, production API, audit code or canonical entity (no Founder / StartupProfile / ProgrammeProject / second team model). "Founder" = the owner relation of the canonical Project / Startup.

| ID | Decision |
|---|---|
| <a id="dec-wf05-g1"></a>DEC-WF05-G1 | **Design source.** Screens are composed from approved primitives (MemberShell, the WF04 DemoPage frame, WF02 cards / editor header / team table, WF04 form and checklist), Be Vietnam Pro, 1hub design language; INTENTIONAL-DEMO where no reference exists; Structural / Major / Component must still be 0. No WF05 pixel-parity claim; no separate design system |
| <a id="dec-wf05-g2"></a>DEC-WF05-G2 | **Access + entry.** Any authenticated account with onboarding DONE may enter. MemberShell entry "Dự án & Startup · Demo" in the sidebar-footer / secondary demo area, following the existing conventions; it grants no capability (venture data stays server / resource authorized). The entry is never a dead link: it stays hidden until WF05-S01 makes `/demo/projects` a real screen |
| <a id="dec-wf05-g3"></a>DEC-WF05-G3 | **Programme visibility.** WF04 demo programmes, read-only, `status = PUBLISHED` only, from the existing WF04 fixture source; no copy into a WF05 store, no mutation, no DRAFT / CLOSED / ARCHIVED semantics, WF04 runtime unchanged |
| <a id="dec-wf05-g4"></a>DEC-WF05-G4 | **Applicant mapping.** Venture `PROJECT` → applicant `TEAM`; `STARTUP` → `STARTUP`; `INDIVIDUAL` is FUTURE (out of WF05 alpha). Derived when the application context is built; never stored on the venture; the venture type never changes |
| <a id="dec-wf05-g5"></a>DEC-WF05-G5 | **SUPERSEDED by [DEC-2809-D6](#dec-2809-d6) (server-side Application).** **Demo application** = browser-session state only. (1) Only the canonical owner creates / edits / submits. (2) DRAFT → SUBMITTED only. (3) At most one per (venture, programme) in the session. (4) An ARCHIVED venture cannot start one. (5) Submit needs every configured question answered. (6) SUBMITTED is final: no return to DRAFT, no edit. (7) ACTIVE team members read the venture as WF02 permits and never create / edit / submit. (8) Organizers / operators do not see these applications. (9) "Đặt lại demo" clears them. (10) It references the venture by id and never copies venture data. No production DB, audit, table or API |

## DEC-WF05-T00 — Demo foundation implementation decisions

**Status:** IMPLEMENTATION DECISIONS under WF05-T00 (2026-09-27), inside DEC-WF05-G1..G5; no rule, state, entity, route or capability added. Report: [WF05-T00](../implementation/reports/WF05-T00_demo-foundation.md).

| ID | Decision |
|---|---|
| <a id="dec-wf05-t00-d1"></a>DEC-WF05-T00-D1 | **SUPERSEDED by [DEC-2809-D6](#dec-2809-d6).** **Application store.** `sessionStorage` key `hub.wf05-demo.v1.<sha256("wf05-demo:" + account id), 16 hex>` (opaque, no PII); state `{version: 1, applications}` keyed by `<venture id>:<programme id>`; each entry in the SOT §12 names: `primary_applicant_type` (derived), `primary_applicant_id` (= the venture id), `programme_id`, `status` DRAFT / SUBMITTED, `programme_specific_answers` (one per question, in order), `created_at` / `updated_at` / `submitted_at`. Parsing keeps only these fields and drops malformed or mismatched entries, so no venture snapshot survives. Pure transitions `startApplication` / `saveAnswers` / `submitApplication` re-check eligibility each time. "Đặt lại demo" removes this key only; a reset counter lets later screens drop open editors |
| <a id="dec-wf05-t00-d2"></a>DEC-WF05-T00-D2 | **Read model + API.** `GET /api/v1/demo/projects` → `{ventures, programmes}`: the member's own relations (WF02 `getOwnNetwork`: id, type, name, status, relation, role label, derived applicant type) and the PUBLISHED WF04 fixtures (id, status, type, name, summary, dates, owning organization name, applicant types, questions — no counts, team, stages or drafts). `GET /api/v1/demo/projects/{id}` → the venture through WF02 `getVenture` / `getTeam` (owner or ACTIVE member; team = owner + ACTIVE rows with name and role label only), plus the programmes with this actor's eligibility (order: NOT_PUBLISHED, NOT_OWNER, ARCHIVED, TYPE_NOT_ACCEPTED). No session → 401; onboarding not DONE → 403 `SCOPE_FORBIDDEN`; malformed, unknown or unreadable → the same 404 (no admin or leader read). GET only (405). No email, slug, metadata, profile or account id |
| <a id="dec-wf05-t00-d3"></a>DEC-WF05-T00-D3 | **Frame, entry, harness.** The shared `DemoPage` frame takes its reset, one-off message and notice copy from `DemoFrameContext`; the WF04 provider supplies its store and copy unchanged, the WF05 provider its own ("Dự án và startup là hồ sơ thật của bạn…"). The MemberShell entry is registered as `PROJECT_DEMO_ENTRY` with `visible: false` and is not rendered; `/demo/projects*` has no page (404) until WF05-S01, which renders the entry in the sidebar footer and turns it on. A dev-only harness `/dev/project-demo` (ENABLE_DEV_ROUTES, never linked, 404 in production) mounts the real guard, read model, provider and store to prove the browser-session semantics before S01 |


## DEC-WF06 — Ecosystem Data Flywheel / Discovery & Matching: Internal Alpha scope

**Status:** HUMAN APPROVED 2026-09-27 (INTERNAL ALPHA — WF06 SCOPE DECISION). **Sources verified:** Master Spec v1.3 §4 ("WF06 — Ecosystem Data & Matching — Future: data/read-model vision, not a P0 transactional workflow") and M6 ("architecture/read-model only unless explicitly promoted"); CLAUDE.md §2 ("WF06 is future/read-model architecture only"); 01 System Architecture "Future: WF06 discovery/matching/intelligence, investor/dataroom flows"; 02 Domain Architecture (WF06 Data Flywheel = discovery / read models); Data SOT v1.1 §C (future entities out of P0); CLAUDE_MASTER_PROMPT M6; README roadmap (Future). No source requires WF06 runtime before Internal Alpha completion: **no conflict**.

| ID | Decision |
|---|---|
| <a id="dec-wf06-internal-alpha-scope"></a>DEC-WF06-INTERNAL-ALPHA-SCOPE | **WF06 runtime implementation is SKIPPED for Internal Alpha; WF06 stays FUTURE / VISION** (not promoted under M6). No WF06 screen, route, API, read-model service, matching engine, recommendation / ranking logic, discovery index, investor discovery or data-flywheel automation; no migration; no Data SOT §C entity. The Internal Alpha product is P0-LANDING, P0-SHELL, WF01, WF02, WF03, WF04 DEMO and WF05 DEMO. Next gate: INTERNAL ALPHA COMPLETION AUDIT |

**FUTURE boundary** — no Internal Alpha task implements any of these:

| Capability | Status |
|---|---|
| Ecosystem discovery; cross-network opportunity matching | FUTURE |
| Matching; recommendation / ranking | FUTURE |
| Mentor / advisor matching | FUTURE |
| Investor discovery; investor / VC / dataroom workflows (`InvestmentFundProfile`, `InvestorInterestRecord`, `AccessRequest`, `AccessGrant`, `DataRoom`, `DataRoomDocument`, `ConnectionRequest`) | FUTURE |
| Automated data flywheel; advanced ecosystem analytics | FUTURE |

**Existing references — kept, future-only, not executable:** P0-LANDING "Khám phá & kết nối" surface and "Tầm nhìn" flywheel, labelled "Tương lai" with "chưa phải tính năng đang vận hành", no link ([DEC-P0-LANDING-D2](#dec-p0-landing-d2)); the README roadmap row "Future"; code notes keeping investor intent / toggles and a profile directory out of P0 (onboarding intent and privacy forms, profile projection). No "coming soon" element, inert control or link is added.

## DEC-HD-12 — Corrected Design Revision typography

**Status:** CLOSED — PO / DESIGN APPROVED 2026-09-28 (Option A, scoped). **Reason:** the corrected design is authoritative for presentation and clearly uses Space Grotesk (glyph-mask evidence in [TASK-22.1_homepage-typography-stop.md](../implementation/reports/TASK-22.1_homepage-typography-stop.md)).

| ID | Decision |
|---|---|
| <a id="dec-hd-12"></a>DEC-HD-12 | **Corrected Design Revision screens may use Space Grotesk where present in the approved corrected reference.** Scope: Homepage and L1–L6, each from the task that implements its revised screen. Not global: legacy / protected screens keep Be Vietnam Pro / Archivo / IBM Plex Mono until their revised screen is implemented. The existing faces stay valid. Delivery: self-hosted from `@fontsource/space-grotesk` via `pnpm fonts:sync`; no Google Fonts, CDN or remote fetch. A typography mismatch against a corrected reference is a real defect, not Intentional. Recorded in the Design SOT §2.2 / §2.3 and CLAUDE.md §5 |

## DEC-H1 — Corrected public homepage implementation decisions (TASK 22.1)

**Status:** IMPLEMENTED 2026-09-28 under the TASK 22 Bucket A authorisation, the Task 21 v2 audit defaults (HD-01, [03 route matrix](../design-revision/03_ROUTE_DELTA_MATRIX.md)) and [DEC-HD-12](#dec-hd-12). Reference: `design-reference/final/revision/H1` ([report](../implementation/reports/TASK-22.1_public-homepage.md)).

| ID | Decision |
|---|---|
| <a id="dec-h1-d1"></a>DEC-H1-D1 | **Route and entry unchanged.** `/` stays public for every visitor with no redirect ([DEC-P0-LANDING-D1](#dec-p0-landing-d1)). The header pill and the all-in-one button are the entry CTA: guest "Tạo tài khoản" → `/auth`; signed-in "Vào tài khoản của tôi" / "Tiếp tục thiết lập tài khoản" → `routeFor`. "Đăng nhập" shows for guests only. No role, scope or ops shortcut |
| <a id="dec-h1-d2"></a>DEC-H1-D2 | **Content.** The approved revision copy is kept verbatim. Omitted as placeholder or unverified (HD-01): the problem catalogue (tabs, chips, cards, QĐ 1193 note), programme cards, iHUB Ventures / deck / data-room cards, event rows and "Xem tất cả sự kiện", the unfinished quote, community metrics and the "13 chapter" line, the partner wall and the "200+" line. For `/`, this supersedes the self-composed copy rule of [DEC-P0-LANDING-D2](#dec-p0-landing-d2); its no-metric / no-placeholder intent is kept by the omissions. The revision copy that names investment and recruitment is PO-approved presentation, flagged for PO review |
| <a id="dec-h1-d3"></a>DEC-H1-D3 | **SUPERSEDED in part by [DEC-2809-D1](#dec-2809-d1) (CTA map).** **Calls to action.** Active: "Tạo tài khoản", "Đăng nhập", "Tham gia mạng lưới" → entry; "Tạo hồ sơ startup của bạn" → `/projects/new` (guard → `/auth`); "Mạng lưới đổi mới sáng tạo", "Khám phá mạng lưới" (03/03, closing, footer), "Tìm hiểu về HUB Network" → the published HUB page; "Về HUB Network" → `#cong-dong`; "Khám phá cơ hội" → `#co-hoi`; legal links. Inert with the DEC-P0-SHELL-D2 reason: every other item, including search, VI \| EN, programmes, events, post a problem, create programme / event, door "Khám phá mạng lưới", "Kết nối nguồn lực", partnership, consultation, FAQ, social links and the contact email. No `href="#"`, no script URL |
| <a id="dec-h1-d4"></a>DEC-H1-D4 | **Typography.** Space Grotesk 400 / 500 / 600 / 700 per DEC-HD-12, calibrated per style against the reference. Mono labels use the approved IBM Plex Mono 500; the reference mono family is not provable from the PNG, and no further face is added without a decision |
| <a id="dec-h1-d5"></a>DEC-H1-D5 | **Pixel QA rule for H1.** Each of 22 kept blocks is compared at its own anchor, so omitted blocks do not shift the rest. Pass: diff outside text < 1.5 % and diff beyond a ±2 px shift < 2 % per block; anti-aliasing, 1.5 px strokes and dash phase are P3. Reference quirks are reproduced: first solution card and first door offset 4 px, shorter third progress rule. Intentional: the fourth pain item wraps instead of being clipped at 1362 px |
| <a id="dec-h1-d6"></a>DEC-H1-D6 | **Responsive.** The reference is 1440 only. Below 1280 px the hero, grids, cards and doors stack and the nav and journey strip wrap; below 768 px the inert language switch is hidden. No horizontal overflow and no covered control at 1024 / 768 / 390 |

## DEC-L1 — Corrected L1 auth / completion implementation decisions (TASK 22.2)

**Status:** IMPLEMENTED 2026-09-28 under the TASK 22 Bucket A authorisation, the Task 21 v2 defaults (HD-02, HD-03, HD-11) and [DEC-HD-12](#dec-hd-12). References: `design-reference/final/revision/L1` ([report](../implementation/reports/TASK-22.2_l1-auth-onboarding.md)). Routes, guards, APIs, schema, RBAC and the consent step are unchanged.

| ID | Decision |
|---|---|
| <a id="dec-l1-d1"></a>DEC-L1-D1 | **SUPERSEDED by [DEC-L1R-D7](#dec-l1r-d7): ACC-05 … ACC-09 are built; FP1-OWN follows with L2.** **SUPERSEDED in part by [DEC-2809-D2](#dec-2809-d2): L06b / L06c (AI) become Alpha.** **Scope.** AUTH1–AUTH4 and the ACC-10 subset only. ACC-05, ACC-06, L06b, L06c (AI), ACC-07, ACC-08 (roles), ACC-09 (consent removal) and FP1-OWN are Bucket B (HD-02 … HD-05) and are not built. Space Grotesk is scoped by re-pointing `--font-ui` on the `(auth)` route group and on the S08 card and exit (DEC-HD-12); the onboarding shell keeps its legacy type |
| <a id="dec-l1-d2"></a>DEC-L1-D2 | **SUPERSEDED by [DEC-L1R-D2](#dec-l1r-d2): AUTH1 as below.** **SUPERSEDED in part by [DEC-L1-D9](#dec-l1-d9): the Google control and divider are now drawn.** **AUTH1.** The brand panel shows the wordmark and headline only. Card: "Đăng nhập", "Email" (placeholder `ten@donvi.gov.vn`), "Gửi liên kết đăng nhập". The Google button and the "hoặc tiếp tục bằng email" divider are not rendered: no provider is configured (`GET /api/v1/auth/providers` returns `[]`), so they would be a dead option. Magic link only; no password path |
| <a id="dec-l1-d3"></a>DEC-L1-D3 | **SUPERSEDED by [DEC-L1R-D2](#dec-l1r-d2): the terms line is removed; acceptance is recorded in stage 4 (PO decision D-L1).** **Terms notice kept.** The revision drops the line under the button; it stays until HD-03 is decided. It is informational: acceptance is still recorded only at S07, and its legal wording is unchanged |
| <a id="dec-l1-d4"></a>DEC-L1-D4 | **AUTH2.** Title, lede, masked address, spam reminder, resend row and "Dùng email khác" follow the reference. "Mở Gmail" is not rendered (provider-specific, not a contract action). The spam reminder is plain text (underlined in the reference, but it leads nowhere). Resend reads "Gửi lại liên kết" after the `MAGIC_LINK_RESEND_AFTER_SECONDS` countdown ("Gửi lại sau m:ss") |
| <a id="dec-l1-d5"></a>DEC-L1-D5 | **AUTH3.** Copy per board. The success body names the real destination from the verify response (profile completion or "Tài khoản của tôi"). The expired minutes come from `MAGIC_LINK_EXPIRES_IN_SECONDS`. "Gửi liên kết mới" goes to `/auth` ([DEC-WF01-S03-D1](#dec-wf01-s03-d1)). Runtime keeps one centred card per state |
| <a id="dec-l1-d6"></a>DEC-L1-D6 | **AUTH4.** Titles per board, one centred card ([DEC-WF01-S04-D6](#dec-wf01-s04-d6)). Blocked keeps its true body and the neutral "Liên hệ ban điều hành HUB để được hỗ trợ." with no action, because no support contact exists (D5). Session expired reads "Vui lòng đăng nhập lại để tiếp tục.", without the board's "đã được lưu" claim (nothing saves unsent work) and without the days sentence. Generic is unchanged. Rate limiting stays inline on S01 / S02 with no numbers (D3). The audit's "PO confirms the dropped rate-limit / support text" is therefore a no-op: P0 never showed rate-limit numbers or a support email |
| <a id="dec-l1-d7"></a>DEC-L1-D7 | **SUPERSEDED by [DEC-L1R-D7](#dec-l1r-d7): the four-bar header, the HUB card and "Góp ý" are drawn.** **ACC-10 subset.** The onboarding shell and 3-step stepper stay (the revision's 4-step header belongs to the HD-02 flow). "Vào Tài khoản của tôi" → `/me` sits in the header action slot and appears only after the server confirms completion; it replaces the footer button and is still the single exit ([DEC-WF01-S08-D6](#dec-wf01-s08-d6)). Title "Hồ sơ của bạn đã sẵn sàng"; intent-neutral lede (S08-D5). One project card, numbered 01, with the DEC-P0-SHELL-D6 body; the Challenge card (D2) and the HUB-position card (HD-02) are not rendered. The info panel keeps neutral copy with the server percent (D7) and the reference's mono "i". No "Góp ý" (HD-11) |
| <a id="dec-l1-d8"></a>DEC-L1-D8 | **Pixel and responsive.** Same rule as [DEC-H1-D5](#dec-h1-d5): per segment, diff outside text < 1.5 % and diff beyond a ±2 px shift < 2 %, via the `auditRevision` helper. Components are compared at their own anchors where omissions move them. Below 1024 px the S08 card follows the viewport with a 16 px gutter. Below 768 px the shared onboarding header wraps (stepper on its own row, shorter connectors). That clears the pre-existing header overflow on S05–S07 at 390 px and leaves desktop untouched |
| <a id="dec-l1-d9"></a>DEC-L1-D9 | **SUPERSEDED by [DEC-L1R-D2](#dec-l1r-d2): the Google control is drawn without the "Sắp có" pill and explains itself when pressed.** **Login UI hotfix (TASK 22-PREVIEW-LOGIN-UI, PO choice 2026-09-28).** AUTH1 keeps its split layout (brand panel + card), as the frozen reference draws it. The card now shows the drawn "Tiếp tục với Google" control and the "hoặc tiếp tục bằng email" divider at AUTH1 geometry. No provider is configured (`GET /api/v1/auth/providers` = `[]`), so the control is a disabled button with a visible "Sắp có" pill and no handler: it starts no request and no provider flow ([DEC-2809-D1](#dec-2809-d1) no-dead-CTA rule). The terms notice stays (D3). Auth behaviour, magic link, callback, session and redirect are unchanged |

## DEC-L2 — Corrected L2 member / project implementation decisions (TASK 22.3)

**Status:** IMPLEMENTED 2026-09-28 under the TASK 22 Bucket A authorisation, the Task 21 v2 defaults (HD-05, HD-06, HD-08, HD-11) and [DEC-HD-12](#dec-hd-12). References: `design-reference/final/revision/L2` ([report](../implementation/reports/TASK-22.3_l2-member-project.md)). Routes, guards, APIs, schema, RBAC, audit and the venture / invitation lifecycles are unchanged.

| ID | Decision |
|---|---|
| <a id="dec-l2-d1"></a>DEC-L2-D1 | **SUPERSEDED by [DEC-L2R-D8](#dec-l2r-d8) for invitations: ME0 counts them.** **Scope and L11.** Bucket A only: L11 ME0 (`/me/settings`) and L13a–c PRJ1–3 (`/projects/new`). L10, L12, L13 ME7, L14, L16, L18 (Bucket B) and L15, L17 (Bucket C) are not built. `/me/settings` becomes the L11 overview of summary rows over existing behaviour. The rows are: login email; sessions (the list, revoke-one and revoke-all open in place); discovery visibility and Terms / Privacy status, both changed on the existing `/me/privacy`; and the account-deletion request with its confirmation. Not rendered: email change, Google link, HUB tags, public URL, "view as", purpose consents, viewer statistics, personal log, export, email preferences, invitations (no P0 screen, DEC-WF02-H10), organisations and ownership transfer. `/me/privacy` has no revision frame and stays WF02-S03; the pages are not merged (03 matrix). The member shell stays (HD-11) |
| <a id="dec-l2-d2"></a>DEC-L2-D2 | **SUPERSEDED by [DEC-L2R-D4…D6, D11](#dec-l2r-d4): stage, the creator's role and the AI block (inert) are drawn.** **L13a step 1.** Canonical fields only (DEC-WF02-S05-G1): type cards ("Dự án / ý tưởng", "Startup"), name (required, "*"), domains (controlled vocabulary), one-line summary, region. The type is still fixed once created (G4), so the reference's "change later" note and extra startup fields are not shown. Domain and summary stay optional; no asterisk is added. Not rendered (Bucket B): stage, pitch-deck AI, the creator's own team role (no owner role persists), and the SUB0 box. "Tiếp tục" and "Lưu nháp" call the existing `POST /ventures` (a venture starts DRAFT); every later save PATCHes the same id. "Lưu nháp và thoát" saves, then goes to `/me`; "Huỷ" leaves without saving |
| <a id="dec-l2-d3"></a>DEC-L2-D3 | **SUPERSEDED by [DEC-L2R-D7/D8](#dec-l2r-d7): "Gửi lời mời" e-mails; levels shown; link row inert.** **L13b step 2.** Invites go through the existing email invitation API. The S06 rules hold ([DEC-WF02-S06-G2](#dec-wf02-s06-g2) / G3): the button is "Tạo lời mời", the copy says no email is sent, and role labels are free text that grants nothing. The team list shows only the DTO (owner name, member names, pending emails). Not rendered: permission levels, link invitations, the three-levels box, and member emails. "Bỏ qua, mời sau" shows while nothing is pending; "Hoàn tất" replaces "Tạo hồ sơ", because the venture already exists |
| <a id="dec-l2-d4"></a>DEC-L2-D4 | **SUPERSEDED by [DEC-L2R-D1](#dec-l2r-d1) for the header link: "Về Dự án & startup" → `/projects`.** **L13c step 3.** Chips come from the server: type, status ("Nháp · chỉ đội thấy", true under the read rule owner or ACTIVE member) and pending invitations. The lede keeps only its first sentence. One next action: "Hoàn thiện hồ sơ" → `/projects/:id/edit`, with a body naming only the editable fields. Not rendered: the completeness count, review-to-public (B), the problem library and public profile cards (C). "Về Tài khoản của tôi" → `/me` replaces "Về Dự án & startup" (ME7 is B) |
| <a id="dec-l2-d5"></a>DEC-L2-D5 | **One record, safe URL, responsive.** The steps stay on `/projects/new` (03 matrix: KEEP); after creation the URL carries `?venture=<id>&step=…`, so a refresh or a back navigation resumes the same record. The page reads it with the GET /ventures and GET /ventures/{id}/team rules, and only the owner of an editable venture gets the wizard; anyone else, a malformed id or a spoofed header gets the same 404. The wizard (outside the shell) adapts below 768 px. `/me/settings` opts into the member shell's existing below-desktop variant (as `/demo/projects`); the other member pages stay desktop-first ([DEC-P0-SHELL-D7](#dec-p0-shell-d7)) until HD-11 / 22.8. Pixel rule as [DEC-H1-D5](#dec-h1-d5) |

## DEC-L3 — Corrected L3 chapter / WF03 implementation decisions (TASK 22.4)

**Status:** IMPLEMENTED 2026-09-28 under the TASK 22 Bucket A authorisation, the Task 21 v2 defaults (HD-08, HD-09, HD-10, HD-11) and [DEC-HD-12](#dec-hd-12). References: `design-reference/final/revision/L3` ([report](../implementation/reports/TASK-22.4_l3-chapter-wf03.md)). Routes, guards, APIs, schema, RBAC, audit and the membership / event lifecycles are unchanged; the WF03 closing decisions stay in force.

| ID | Decision |
|---|---|
| <a id="dec-l3-d1"></a>DEC-L3-D1 | **Scope and L19.** Bucket A only: L19 CHP0, L20 CHP1, L23 CHP4 and L26 CHP7 as subsets. L27 CHP8 (Bucket B, HD-10) and L21, L22, L24, L25 (Bucket C) are not built. `/organizations/:slug` becomes the full-bleed L19 page over the unchanged public projection ([DEC-WF03-S09-D1](#dec-wf03-s09-d1)): bar, hero with the three canonical counts, direct children, upcoming published events, join band, footer. Not rendered (HD-08, no P0 source): leadership, partner strip, "Bài toán" nav, summit button, founding date, region line, QĐ-13 chip, province chips, registration chips and capacity, footer links, contact email. The CLB banners, initials and event tiles are decoration, not data |
| <a id="dec-l3-d2"></a>DEC-L3-D2 | **L20 dashboard.** Restyle only; [DEC-WF03-S02-D1](#dec-wf03-s02-d1) holds: the four canonical KPI cards and the one work item. Not rendered: scope notice, landing / registration / qualifying KPIs, conversion funnel, "Tạo summit mới", the actor line. The header "Tạo sự kiện" appears for `event:manage` holders and opens `/ops/org/:id/events?create=1`. The work chip reads "Chờ {unit}" ("Chờ chapter"), as L20 writes it; the work card spans the content width |
| <a id="dec-l3-d3"></a>DEC-L3-D3 | **L23 events.** Chips group the existing statuses: "Sắp diễn ra" (PUBLISHED / LIVE, not yet ended, the public upcoming rule), "Đã kết thúc", "Bản nháp", and "Đã huỷ" only when some exist. Pressing a chip filters; pressing it again shows everything; the page opens with none pressed. Rows keep name, time and place with "Quản lý"; the create / detail panel opens on demand ("Tạo sự kiện", "Quản lý", `?create=1`) and closes with "Đóng". Create, edit, publish and cancel are unchanged. Not rendered (HD-09): type, registration, owner and capacity columns, the owner warning, rule notes and the actor line |
| <a id="dec-l3-d4"></a>DEC-L3-D4 | **L26 members.** Tabs "Đơn chờ duyệt" (default), "Đang hoạt động", "Tất cả" over the contracted filters; "Đã rời" becomes "Tất cả" because P0 has no "left" grouping and every row must stay reachable. A pending row carries "Duyệt" / "Từ chối": it reads the member detail and sends the S04 call unchanged ([DEC-WF03-S04-D1](#dec-wf03-s04-d1)), so the server decides; a refusal shows a neutral notice and reloads. The buttons follow a display flag: `membership:confirm` joins the page-context capability list (display only, same matrix). "Ban điều hành" lists ACTIVE leadership titles (display text, [G6](#dec-wf03-g6)) with "Xem cả N thành viên →". Not rendered: email ([G4](#dec-wf03-g4) / S03-D1), join reason, "Mời qua email", "Xuất danh sách", "Chuyển giao" / "Gỡ quyền" (HD-10), the rule notes, the reference sidebar (HD-11). Rows keep the S03-D1 alphabetical order |
| <a id="dec-l3-d5"></a>DEC-L3-D5 | **Typography, pixel, responsive.** Space Grotesk on the four screens through a re-pointed `--font-ui` on each screen root ([DEC-HD-12](#dec-hd-12)); OpsShell keeps its legacy faces (HD-11). Pixel rule as [DEC-H1-D5](#dec-h1-d5), with components at their own anchors (L20 / L23 are drawn without a sidebar, L26 at 1600 px). Below 1280 px the event and member tables scroll inside their card; below 768 px the KPI cards stack and the member tabs wrap. OpsShell itself has no narrow layout yet (pre-existing, HD-11 / 22.8) |
| <a id="dec-l3-d6"></a>DEC-L3-D6 | **29/09 board re-check** (TASK 24.2). On `Luông 3 - CLB Operations.png` (PO, 29/09) L19, L20, L23 and L26 are pixel-identical to the baselines, so D1–D5 hold unchanged. L21, L22, L24, L25 and L27 stay FUTURE ([DEC-2809](#dec-2809)): appearing on the board is not a promotion; each needs its own PO decision (registration, scoring and advancement, an email provider, the handover workflow). Inventory: [l3-clb-inventory.md](../implementation/task-24/l3-clb-inventory.md) |


## DEC-2809 — Internal Alpha scope refreeze (PO decisions of 2026-09-28)

<a id="dec-2809"></a>**Status:** FROZEN 2026-09-28 from `Update 28_9.docx` (sha256 `92f62747…eb14`; the task names it `Update 28_9(1).docx`). The corrected design stays the UI source; these decisions are the source for Internal Alpha scope and behaviour. Full ingest, matrix, deltas and sequence: [scope-refreeze/](../design-revision/scope-refreeze/overview.md). Docs only; nothing implemented.

| ID | Decision |
|---|---|
| <a id="dec-2809-d1"></a>DEC-2809-D1 | **Homepage.** `/` public; discovery CTAs public; create / register / submit / admin CTAs need login and return to the intended action; hero search over public data only; no dead link (hidden or visible "Coming soon"). Targets: `/login?redirect=/onboarding?intent=create-startup`, `/login?mode=signup` (same magic-link flow), `/programmes/create` with a no-permission state, `https://ihub.ventures` (new tab), `/about`, `/events`, `/programmes`, public directories per the [CTA map](../design-revision/scope-refreeze/homepage-cta-map.md) (PO review, HD-A14) |
| <a id="dec-2809-d2"></a>DEC-2809-D2 | **L1 AI suggestion is live Internal Alpha.** Never publishes a profile, never creates a Venture, never replaces validation; manual onboarding always completes; AI failure or quota never blocks. Provider, privacy and placement: HD-A1 |
| <a id="dec-2809-d3"></a>DEC-2809-D3 | **L3.** Executable Alpha capability: dashboard (L20), chapter information management (WF03-S06, no L3 frame), member approval (L26). L19 / L23 stay only as independently approved WF03-S09 / S07 (HD-A2). L21, L22, L24, L25, L27 Future |
| <a id="dec-2809-d4"></a>DEC-2809-D4 | **L4.** Directory screens only; challenge / problem detail (expanded), Q&A, Updates, Submitted Teams, Chapter Summit, Summit Registration Future and never Bucket A. The L4 group has no directory frame: 0 screens (HD-A7) |
| <a id="dec-2809-d5"></a>DEC-2809-D5 | **L5 canonical Venture.** Project and Startup are one Venture (`type` PROJECT \| STARTUP); no duplicate aggregate. The applicant selects an existing Venture or quick-creates a minimal canonical one (SUB0, options A + C; option B temporary team rejected). Detailed Startup Profile and team management Future |
| <a id="dec-2809-d6"></a>DEC-2809-D6 | **L5 Application persists server-side.** DRAFT → SUBMITTED; save, exit, resume; one active Application per (Venture, Programme / Challenge); submit stores an answer snapshot and a Venture / team snapshot that later edits never change. Foundation (batch 22.5) before the L5 UI (22.7): [application-persistence.md](../design-revision/scope-refreeze/application-persistence.md) |
| <a id="dec-2809-d7"></a>DEC-2809-D7 | **L6.** Only Directory / Form screens present in the corrected design; none of L46–L54 qualifies, so 0 screens. Workspace, booking, standalone Event Detail, Startup tabs, admin Chapter / CLB approval, account list and System Status (L54) Future; a future Event Detail reuses the canonical Event |

Superseded records (traceable conflicts C-01…C-14 in [conflict-audit.md](../design-revision/scope-refreeze/conflict-audit.md)):

| Record | Superseded | By |
|---|---|---|
| [DEC-WF05-G5](#dec-wf05-g5) session-only demo application | fully | D6 |
| [DEC-WF05-T00-D1](#dec-wf05-t00-d1) session application store, no snapshot | fully | D6 |
| HC-WF05-07 / 09 / 12 (no DB row, live rename, reset) in `WF05_HAPPY_PATH_PLAN.md` | fully | D6 |
| API contract §15 "programme application submission out of P0" | submission only (review stays out) | D6 |
| HD-04 default (no AI) · DEC-L1-D1 (L06b / L06c Bucket B) | fully · in part | D2 |
| HD-06 default (SUB0 not built, option C only) | fully | D5 |
| HD-07 default (keep the WF05 session demo, no L5 in Task 22) | fully (residual questions: HD-A8, HD-A10) | D6 |
| HD-01 default · [DEC-H1-D3](#dec-h1-d3) CTA list · 03 homepage CTA table | where the CTA map differs | D1 |
| [DEC-P0-SHELL-D2](#dec-p0-shell-d2) hidden inert reason | on `/` only | D1 |
| [DEC-WF01-S05-D4](#dec-wf01-s05-d4) no preselection | on the create-startup entry only, once HD-A3 maps the code | D1 |
| [DEC-WF01-S08-D6](#dec-wf01-s08-d6) single exit `/me` | when a return path exists | D1 |
| `src/lib/routes.ts` "/login deliberately absent" | fully (alias) | D1 |
| HD-09 default (calendar / detail B) | L16 becomes the `/events` directory; L18 / L47 Future | D1, D7 |
| HD-10 default (L27, L28, L52, L53 pending) | resolved as Future | D3, D4, D7 |
| 06 Bucket A row L54 and batch 22.7; batches 22.5 / 22.6 / 22.8 of 07 | fully | D7; [task-sequence.md](../design-revision/scope-refreeze/task-sequence.md) |


## DEC-AUTH-EMAIL — Real e-mail magic link, invite-only (TASK 22-PREVIEW-AUTH)

<a id="dec-auth-email"></a>**Status:** IMPLEMENTED 2026-09-28 on the PO instruction for the Internal Alpha preview ("invite / pre-provisioned account only", Resend as provider). Token, hash, expiry, single use, callback, session, cookie and redirects are unchanged.

| ID | Decision |
|---|---|
| <a id="dec-auth-email-d1"></a>DEC-AUTH-EMAIL-D1 | **SUPERSEDED by [DEC-L1R-D1](#dec-l1r-d1): sign-up is open; D2 … D4 stay in force.** **Invite-only request.** `POST /auth/magic-link` issues a link only to a provisioned address: an existing account (any status; a blocked account still reaches the AUTH4 blocked state) or an unconsumed launch-roster row (`membership_bootstrap`). Anything else answers 403 `AUTH_ACCOUNT_NOT_PROVISIONED`, creates no token and no account; the form shows "Email này chưa được cấp quyền truy cập Internal Alpha.". This supersedes, for this endpoint, the contract rules "same flow handles first-time account creation" and "do not disclose whether an account exists" (API 05 §4.1). Accounts are still created at the callback only for roster addresses and for operator / dev links, which are explicit provisioning. Test seam: with dev routes on (local / CI, never a server) `@example.test` personas count as provisioned |
| <a id="dec-auth-email-d2"></a>DEC-AUTH-EMAIL-D2 | **Rate limit.** At most 10 links per address per 15 minutes (counted in `auth_magic_link_requests`, request and resend) and 30 requests per client IP per 15 minutes (process memory, one review container; requests without a trusted IP skip it). Over the limit: 429 `AUTH_RATE_LIMITED`. Neither limit applies with dev routes on (local / CI): the dev sign-in route issues many links per persona and `next start` gives every local request one loopback address |
| <a id="dec-auth-email-d3"></a>DEC-AUTH-EMAIL-D3 | **Delivery.** Resend over HTTPS (no SDK), server-only env `RESEND_API_KEY` (secret, server env file only), `EMAIL_FROM` (`1Hub Network <no-reply@1hubnetwork.io.vn>`), `APP_PUBLIC_BASE_URL` (HTTPS; the link is `<base>/auth/callback?token=…`). E-mail "Đăng nhập 1hub.network": one CTA, the 15-minute single-use note, an ignore line. A failed send rolls the token back (request) or retires it (resend) and answers 500 `AUTH_EMAIL_DELIVERY_FAILED`; no success is reported for an unsent e-mail. Logs carry the provider id and the masked address only. Without a key and with dev routes on, the message goes to the local `/dev/outbox`; with neither, delivery fails closed |
| <a id="dec-auth-email-d4"></a>DEC-AUTH-EMAIL-D4 | **Unchanged operator path.** `issue-login-link.sh` keeps issuing one-time links for `@example.test` review personas through `requestMagicLink`, outside the public endpoint |

## DEC-2909 — PO freeze of the TASK 24 open questions

<a id="dec-2909"></a>**Status:** FROZEN 2026-09-29 on the PO message "PAUSE TASK 24.4 — PO DECISION FREEZE BEFORE CONTINUING". Closes the open questions of the TASK 24.1–24.3 reports; supersedes them where they differ.

| ID | Decision |
|---|---|
| <a id="dec-2909-l2h1"></a>DEC-2909-L2H1 | **Programme history stays out.** `chuong_trinh_tung_tham_gia` is not read into the Library UI or filters in Alpha (as [DEC-L15-D7](#dec-l15-d7) / D11). No change |
| <a id="dec-2909-l2h2"></a>DEC-2909-L2H2 | **Startup stages on the Alpha vocabulary.** IDEA "Ý tưởng", MVP, PILOT "Pilot / Thử nghiệm", SELLING "Đang bán", GROWTH "Tăng trưởng" (VENTURE_STAGE labels). `startup.json` values map only where deterministic: Ideation / Idea → IDEA, MVP → MVP, Pilot → PILOT, Selling / Revenue / Commercial → SELLING, Scale-up / Growth → GROWTH. Anything else (e.g. Prototype) stays unmapped: no stage is invented, the record counts under no stage and sits under "Chưa xác định". The source JSON is not modified. Supersedes the stage part of D7 / D11 / D13 |
| <a id="dec-2909-l2h3"></a>DEC-2909-L2H3 | **No second source.** The startup spreadsheet is not an approved Library source: no location, "Đang cần" or "Đang mở cho", nothing inferred. No change |
| <a id="dec-2909-l2h4"></a>DEC-2909-L2H4 | **Founder filters.** Only filters backed by real data render (today: Lĩnh vực); no empty filter is drawn to match the frame. No change |
| <a id="dec-2909-l2h5"></a>DEC-2909-L2H5 | **Founder CTAs.** "Xem hồ sơ", "Theo dõi", "Kết nối" become interactive only for a person mapped to a real internal account / profile with an approved route or action; external founders keep the disabled (inert) state. No fake profile, follow or connection state. No change |
| <a id="dec-2909-l3h1"></a>DEC-2909-L3H1 | **L21, L22, L24, L25** stay FUTURE (entity, workflow or provider contract not approved) |
| <a id="dec-2909-l3h2"></a>DEC-2909-L3H2 | **L27** stays FUTURE until its business role and navigation contract are approved |
| <a id="dec-2909-l4h1"></a>DEC-2909-L4H1 | **L28–L36** stay FUTURE, a participant-side design reference only; L5 may refer to them only where the approved Startup Journey needs Programme / Challenge context. No new L4 lifecycle |
| <a id="dec-2909-l4h2"></a>DEC-2909-L4H2 | **No real operator-side Challenge product in Alpha.** The WF04 operator demo stays as is; a real operator workflow needs its own approved design and business contract (no inferred dashboard, configuration or judging) |

## DEC-L4 — 29/09 L4 board re-check (TASK 24.3)

<a id="dec-l4"></a>**Status:** RECORDED 2026-09-29. Inventory: [l4-challenge-inventory.md](../implementation/task-24/l4-challenge-inventory.md).

| ID | Decision |
|---|---|
| <a id="dec-l4-d1"></a>DEC-L4-D1 | **No L4 delta.** `Luồng 4 - Challenge Operations.png` (PO, 29/09) draws L28 CH1, the six L29–L34 problem tabs and L35 / L36 — public and participant screens, no operator frame. They stay FUTURE ([DEC-2809](#dec-2809), D4: ALPHA 0 · FUTURE 9); the board is not a promotion. The WF04 operator demo ([DEC-WF04-H1](#dec-wf04-h1)…H5) is unchanged; no scoring, judging, winner or matching logic is added |

## DEC-L5 — Server-side application, L5 Startup Journey (TASK 24.4)

<a id="dec-l5"></a>**Status:** FROZEN 2026-09-29 on the PO answers of 29/09 (TASK 24.4) and [DEC-2909](#dec-2909). Inventory: [l5-startup-inventory.md](../implementation/task-24/l5-startup-inventory.md); contract: [l5-startup-contract.md](../implementation/task-24/l5-startup-contract.md).

| ID | Decision |
|---|---|
| <a id="dec-l5-d1"></a>DEC-L5-D1 | **PO answers.** HD-A8: the application answers the Programme's configured questions laid across the four drawn steps; text only; no uploads, milestone table, support checklist, application code or e-mail. Migration 013 approved. HD-A10: member routes, redirects from the `/demo/projects` application paths, no "Demo" label on applications, "Đặt lại demo" leaves applications alone. HD-A11: the venture type is derived when the programme accepts one applicant type, asked when it accepts both. HD-A12 (seed the approved PUBLISHED programme as a read-only server row) and HD-A13 (owner only) take their defaults |
| <a id="dec-l5-d2"></a>DEC-L5-D2 | **Data.** Migration 013 as the contract's report: `programme_application_forms`, `applications`, enums, the one-active-pair index, the SUBMITTED check and the no-update-after-submit trigger. The snapshot is written once at submit; answers are never copied into the venture and the venture is never copied into an application-owned startup |
| <a id="dec-l5-d3"></a>DEC-L5-D3 | **API.** `GET /me/applications`, `POST /applications`, `GET` / `PATCH /applications/{id}`, `POST /applications/{id}/submit`, owner only, onboarding DONE, 404 for anyone else; idempotent create and submit (`application.create`, `application.submit`); audit `APPLICATION_DRAFT_CREATED` / `APPLICATION_SUBMITTED` without answers. Error codes: `APPLICATION_VALIDATION_FAILED` 422, `APPLICATION_NOT_ELIGIBLE` 409 (archived, type not accepted, programme closed), `APPLICATION_EXISTS` 409 (with the existing id), `APPLICATION_SUBMITTED` 409, `APPLICATION_INCOMPLETE` 422 (each missing question id). API contract amendment A4 (05 §21) |
| <a id="dec-l5-d4"></a>DEC-L5-D4 | **Screens.** SUB0 `/programmes/:programmeId/apply` (quick team only without an eligible venture; with one, straight to its application; with several, a choice), SUB1 `/projects/:id/applications/:programmeId?buoc=`, SUB2 `…/review`, SUB3 `…/submitted`. The WF05 S01 / S02 demo list and detail read application status from the server and link to these routes; the WF05 demo notice no longer calls the application a browser-session demo (it says applications are real and the reset keeps them). The WF05-S03 / S04 screens, the browser-session store, its dev harness and their specs are removed; the S03 / S04 paths redirect |
| <a id="dec-l5-d5"></a>DEC-L5-D5 | **SUB0 fields.** The frame's name, domain and one-line summary, plus stage (the canonical venture requires it, [DEC-L2R-D4](#dec-l2r-d4)) and the type choice when asked (D1); domain from the DOMAIN vocabulary, not free text |
| <a id="dec-l5-d6"></a>DEC-L5-D6 | **Not rendered** (no approved data or rule): the Problem target and its brief, S1–S6 word limits, uploads, the milestone table, the support checklist, the countdown and timeline dates, the commitment checkboxes, profile completion, the application code and e-mail, "editable until the deadline". The frames stay the layout baseline |

## DEC-L6 — 29/09 L6 board re-check (TASK 24.5)

<a id="dec-l6"></a>**Status:** RECORDED 2026-09-30. Inventory: [l6-ecosystem-inventory.md](../implementation/task-24/l6-ecosystem-inventory.md), features: [l6-ecosystem-features.md](../implementation/task-24/l6-ecosystem-features.md).

| ID | Decision |
|---|---|
| <a id="dec-l6-d1"></a>DEC-L6-D1 | **No L6 screen; matching deferred.** `Luồng 6 · Ecosystem Data & Matching.png` (PO, 29/09) is pixel-identical to the corrected 28/09 L46–L54 (WS1 workroom, EV1 event detail, SP1-T2/T3/T4/T6 startup tabs, ADM15 organisation approval, ADM17 account list, SYS1 system status). None is a public directory, search or form, so [DEC-2809-D7](#dec-2809-d7) holds: ALPHA 0 · FUTURE 9; the board is not a promotion. No discovery page, filter, preview or CTA is added without a frame, and the existing discovery layer (`/library`, `/organizations/:slug`) is unchanged. **MATCHING ENGINE: DEFERRED** — no approved algorithm, ranking, weighting, fit score, recommendation or verification contract; jury scores (L46), the distance hint (L52) and the HUB approval badge (L48–L51) are not rendered anywhere. PUBLIC ventures still grant no read ([DEC-PDF-D1](#dec-pdf-d1)); a future public venture page or directory needs its own frame and decision |

## DEC-L15 — Public Library, static demo (TASK 22-PREVIEW-LIBRARY)

<a id="dec-l15"></a>**Status:** IMPLEMENTED 2026-09-28 on the PO instruction "Homepage → public L2 Thư viện" (`L2-15 Thu vien.zip`) and the PO answers of 28/09; revised the same day by TASK 22-PREVIEW-LIBRARY-FIX (real `startup.json` data, D7; remap to the full "L15 · DIR1 · Thư viện" frame, D8). Reopens [DEC-L2-D1](#dec-l2-d1) for L15 only; HD-A7 (real problem directory) and HD-08 (public ventures and profiles in our database) stay open.

| ID | Decision |
|---|---|
| <a id="dec-l15-d1"></a>DEC-L15-D1 | **Scope and route.** `/library` is a public page: no guard, no API or database of ours read beyond the visitor's own entry point for the login button (the startup directory is the external source of D7). Header, hero, search, tabs, directory and floating feedback are rebuilt as HTML / CSS from the full "L15 · DIR1 · Thư viện" frame (1440 × 2470), `design-reference/final/revision/L2/L15__library__SOURCE.png`; it supersedes the four `L15__library-*` fragments of the first pass. No alias or other route |
| <a id="dec-l15-d2"></a>DEC-L15-D2 | **Bài toán data.** A static fixture of the pack's six distinct problems, shown with a visible "Dữ liệu minh hoạ" label. The pack's company names are replaced by neutral sector labels; one time chip reads "Còn 24 ngày" (pack: "Còn 4 ngày") so the "Sắp hết hạn" order is the drawn order. Search (accent-insensitive), quick filters, facets (multi-select, counts, zero kept), chips, "Xoá tất cả", sort and the empty state run in the browser on this fixture only. Its domains, stages and areas are fixture labels, not controlled vocabulary; no taxonomy is added. **Superseded by [DEC-L15-D9](#dec-l15-d9)** (the supplied problem dataset, no label) |
| <a id="dec-l15-d3"></a>DEC-L15-D3 | **Counts.** The hero and tab counts come from the data: open problems of the D2 fixture (4) and all of them (6); startups and founders from D7 (72 and 84 on 28/09). The caption reads "Bài toán: dữ liệu minh hoạ · Startup, nhà sáng lập: startup.1hub.cloud". Never the pack's 28 / 142 / 310. (The first pass showed "Sắp có" for Startup and Nhà sáng lập; superseded by D7.) No venture or profile of our database is read: ventures are private and PROFILE_DISCOVERY is never public ([DEC-WF01-S07-D2](#dec-wf01-s07-d2)). **Open-problem count and caption superseded by [DEC-L15-D9](#dec-l15-d9)** (count from the dataset; no caption) |
| <a id="dec-l15-d4"></a>DEC-L15-D4 | **Homepage link.** The homepage header item "Mạng lưới đổi mới sáng tạo" (`data-cta="network-bar"`) opens `/library`. The other network CTAs keep the published HUB page, and the About page's header is unchanged. Supersedes that row of the [CTA map](../design-revision/scope-refreeze/homepage-cta-map.md) |
| <a id="dec-l15-d5"></a>DEC-L15-D5 | **Inert destinations.** Chương trình, Sự kiện, Tin tức, VN · EN, the card calls to action ("Xem bài toán", "Theo dõi bài toán": no public problem detail exists) and the floating "Góp ý" (no feedback endpoint; HD-11 open) are inert with the existing reason. "Đăng nhập" goes to the visitor's entry point |
| <a id="dec-l15-d6"></a>DEC-L15-D6 | **Visual deviations.** Superseded by D8 for the body (the first pass drew it dark from a background-less fragment). Remaining: the checked boxes show a tick (the frame draws active chips over unchecked boxes); "Xem thêm N …" shows only beyond nine results; metric and tab digits are the data |
| <a id="dec-l15-d7"></a>DEC-L15-D7 | **Startup source.** "Startup" and "Nhà sáng lập" read the public directory `https://startup.1hub.cloud/data/startup.json` (PO, 28/09) on the server through a read-only adapter (`src/lib/library/startup-adapter.ts`); nothing is imported into PostgreSQL and no Venture or Profile model changes. Mapping: `ten_startup` → name, `mo_ta_ngan` → tagline, `linh_vuc[]` → domains (as written) and filter categories (Logistics, Tài chính số, Y tế, Nông nghiệp, Giáo dục, AI, Môi trường & năng lượng, CNTT & dữ liệu, Khác), `giai_doan_phat_trien` → stage (Ideation … Scale-up, else "Chưa cập nhật"), `website` → the card link (http / https only, new tab, `noopener noreferrer nofollow`), `thanh_vien[]` → member count and, for founder roles, a founder list deduplicated by name (name, role, startups only). Not shown: `mo_ta_chi_tiet`, programmes, members' affiliation and experience. Strings are capped and stripped of e-mail addresses and phone numbers; a member whose name holds contact data is left out. Fetch: 5 s timeout, 10-minute in-process cache, last good copy for up to a day, otherwise an error state with "Thử lại" (never invented data, never a 5xx). `LIBRARY_STARTUP_SOURCE_URL` overrides the URL. Startup facets are Lĩnh vực and Giai đoạn (no location in the source); Nhà sáng lập facets are Lĩnh vực |
| <a id="dec-l15-d8"></a>DEC-L15-D8 | **Remap to the full frame.** Directory body on the canvas `#efefef` with ink labels, muted counts and zero rows, bordered white checkboxes, the designer's note under the facets, "Sắp xếp: … ▾" in ink, an outlined "Xem thêm" pill 43 px under the grid, the page ending 81 px below it; dark cards keep their text white. Startup and founder cards reuse the card anatomy (round mark with initials, context label, stage or role pill, name, tagline, chips, "Xem startup"). Below 900 px the facets fold behind a "Bộ lọc" button |
| <a id="dec-l15-d9"></a>DEC-L15-D9 | **Problem dataset, no source labels** (PO, 29/09, LIBRARY DATA UPDATE). "Bài toán" reads the supplied `dir-bai-toan.json` (`problems`, 47 on 29/09), shipped byte-identical in `src/lib/library/` and mapped on the server by `problem-adapter.ts`: `ten` → title, `mo_ta_ngan` → summary, `owner_org.ten` → organisation, `giai_doan_hien_thi` → stage chip, `thoi_gian_hien_thi` → time chip (no countdown computed), `bia_dai_mau_id` 1–6 → the card colour bands in the pack order, `tags.linh_vuc` / `giai_doan` / `tags.dia_ban` → the Lĩnh vực / Giai đoạn / Địa bàn facets with counts from the records (Giai đoạn keeps the four canonical values with the current labels). Search covers `ten`, `ten_ngan`, `mo_ta_ngan`, `owner_org.ten` and `tags.linh_vuc`. Nothing is invented: the prize chip needs `giai_thuong` and a display value other than "—"; the team chip needs `so_doi_du_kien`; `owner_org.logo_url` is not drawn (the blank mark stays). "Sắp hết hạn" orders by stage then `han_nop`, "Giải thưởng cao nhất" by `giai_thuong`; ties keep the dataset order. The hero "Tìm nhanh" chips are unchanged and match problem tags by label. No tab shows where its data comes from: the hero caption, the results-bar tag and the provider name in the error state are removed; source URLs stay in code |
| <a id="dec-l15-d10"></a>DEC-L15-D10 | **Startup / Nhà sáng lập baseline** (TASK 24.1, L2 board of 29/09). The board frames at x 9120, y 2901 and x 10760, y 2901 are the baselines of the Startup and Nhà sáng lập tabs (`L15b__library-startup__SOURCE.png`, `L15c__library-founder__SOURCE.png`); the Bài toán frame is pixel-identical to L15, which stays its baseline. Delta matrix: [l2-library-delta.md](../implementation/task-24/l2-library-delta.md) |
| <a id="dec-l15-d11"></a>DEC-L15-D11 | **Startup card.** (Stage labels: [DEC-2909-L2H2](#dec-2909-l2h2).) White card: square mark with initials, name, stage pill (the source value; no pill without one), "N thành viên", tagline, domain chips as written, "Xem hồ sơ" (the D7 card link: the website, new tab, `noopener noreferrer nofollow`; inert without one) and "Theo dõi" (inert: no follow contract). Not drawn, no data: the ✓ verified mark, the city, "Đang cần" chips; the programme line stays out as D7 excludes `chuong_trinh_tung_tham_gia`; the "…do hệ thống ghi nhận…" note is not rendered (untrue for this source) |
| <a id="dec-l15-d12"></a>DEC-L15-D12 | **Nhà sáng lập card.** White card: round mark, name, "short role · first startup", the startup row (mark, name, stage; links to the startup website when set), "Xem hồ sơ" and "Kết nối" inert (no person profile; founders are not accounts, so no connection can be requested). Not drawn, no data: location, badges, expertise chips, "Đang mở cho"; the contact / "Đề nghị kết nối" note is not rendered |
| <a id="dec-l15-d13"></a>DEC-L15-D13 | **Facets, hero, sort.** Startup keeps Lĩnh vực and Giai đoạn (D7); Đang cần, Địa bàn and Nguồn hồ sơ are hidden (no data). None of the five designed founder groups has data, so the founder tab keeps Lĩnh vực. The Startup search placeholder follows the frame and search now also covers the main product and founder names; the founder placeholder is unchanged (no expertise data). "Tìm nhanh" chips and the sorts are unchanged: need, openness, place and activity have no data. Open: H1–H5 of the delta matrix |

## DEC-LEGAL — Production legal content (FINAL RELEASE BLOCKER CLOSURE)

<a id="dec-legal"></a>**Status:** IMPLEMENTED 2026-09-28 on the PO answers of 28/09. Closes the content part of `PRODUCTION_LEGAL_CONTENT_REQUIRED`; the mechanism (`LEGAL_CONTENT_DIR`, `legal_documents` rows, consent versions) is unchanged.

| ID | Decision |
|---|---|
| <a id="dec-legal-d1"></a>DEC-LEGAL-D1 | **Source and split.** The approved text is "Điều khoản sử dụng và Chính sách quyền riêng tư", Phiên bản 1.5 (24/09/2026, 1Hub Holding), copied verbatim into `content/legal/`: the opening block and Phần A for `TERMS_ACCEPTANCE`, Phần B for `PRIVACY_DATA_PROCESSING`, under the current version `p0-2026-09` (no DB change). Production sets `LEGAL_CONTENT_DIR=content/legal`; dev / test servers keep the fixtures. Source hash and conversion rules: [content/legal/README.md](../../content/legal/README.md) |
| <a id="dec-legal-d2"></a>DEC-LEGAL-D2 | **Address without a version.** `/legal/<kind>` (e.g. `/legal/terms`, `/legal/privacy`) answers 307 to the current document's `content_url`; 404 when no current document matches. The login notice on `/auth` stays plain text (approved AUTH1) |

## DEC-LEGAL-V1 — Legal documents v1.0 (iHub)

<a id="dec-legal-v1"></a>**Status:** IMPLEMENTED 2026-10-01 on the PO decisions of 01/10 (local commit; not deployed). Supersedes the *content* of DEC-LEGAL-D1 from the v1.0 effective date; DEC-LEGAL-D2 (version-less `/legal/<kind>`) and the mechanism are unchanged.

| ID | Decision |
|---|---|
| <a id="dec-legal-v1-d1"></a>DEC-LEGAL-V1-D1 | **Source.** "Điều khoản sử dụng 1hub.network" and "Chính sách quyền riêng tư 1hub.network", Bản dự thảo v1.0, Ngày soạn 29/09/2026 (`…_du_thao_v1.0 (1).docx`), operated by CÔNG TY TNHH VƯỜN ƯƠM KHỞI NGHIỆP SÁNG TẠO QUỐC GIA IHUB. Two separate documents, copied verbatim to `content/legal/<TYPE>.v1.0.md` |
| <a id="dec-legal-v1-d2"></a>DEC-LEGAL-V1-D2 | **Only approved edits.** "Ngày hiệu lực [CẦN XÁC NHẬN]" → "Ngày hiệu lực 01/10/2026" (both); "[EMAIL HỖ TRỢ]" → "global@1hub.network" (terms §13). No other wording changes |
| <a id="dec-legal-v1-d3"></a>DEC-LEGAL-V1-D3 | **New version, option (a).** Migration `014_p0_legal_v1_0.sql` adds `v1.0` rows effective 2026-10-01 00:00 Asia/Ho_Chi_Minh and marks the existing `p0-2026-09` rows retired at that time (history; their pages read "không còn hiệu lực"). Accounts that accepted `p0-2026-09` see "có phiên bản mới cần đồng ý" and accept again; onboarding of completed accounts is not reopened |
| <a id="dec-legal-v1-d4"></a>DEC-LEGAL-V1-D4 | **Presentation.** Release files may mark the title (`# `), metadata line (`> `) and section headings (`## `); the reader renders them as h1, meta and anchored h2 (`#muc-N`). Plain files render as before. Link labels stay the document row titles, except at acceptance points (D5) |
| <a id="dec-legal-v1-d5"></a>DEC-LEGAL-V1-D5 | **One combined acceptance link (PO, 01/10).** Where the member accepts the documents (onboarding stage 4; the `/me/privacy` re-acceptance when both are due) the statement carries one link, "Điều khoản sử dụng & Chính sách quyền riêng tư", to `/legal/terms` (current version, DEC-LEGAL-D2). The documents stay separate: the reader shows a two-item switcher (`/legal/terms`, `/legal/privacy`). When only one document is due, `/me/privacy` names that document alone. Footers, the per-document "Đọc" links and `/auth` (no notice, DEC-L1R-D2) are unchanged. The versions being accepted stay on the statement as data (`data-legal-versions`) |
| <a id="dec-legal-v1-d6"></a>DEC-LEGAL-V1-D6 | **Re-consent (PO, 01/10).** `p0-2026-09` is retired. A `p0-2026-09` acceptance is kept as history and never migrated or copied to `v1.0`; the member is asked again by the existing flow, the acceptance writes one new `v1.0` record (repeat = 200, no new row), and the prompt does not return |

## DEC-H1-R2 — Homepage aligned to the latest export (TASK 22-HOMEPAGE-FINAL-ALIGN)

<a id="dec-h1-r2"></a>**Status:** IMPLEMENTED 2026-09-28 on the PO task and the PO answers of 28/09. Reference: `design-reference/final/revision/H1/H1__homepage-r2__SOURCE.png` (1440 × 12853). Supersedes [DEC-H1-D2](#dec-h1-d2) (HD-01 omissions) and the CTA map of [DEC-H1-D3](#dec-h1-d3) for `/`; D1, D4 and D6 of DEC-H1 stay.

| ID | Decision |
|---|---|
| <a id="dec-h1-r2-d1"></a>DEC-H1-R2-D1 | **Content and order.** Hero, journey strip, Điểm nghẽn, Giải pháp, Giá trị đa tầng, Sự kiện, Chương trình, Pipeline đầu tư, One profile, Mạng lưới, HUB Network (numbers, card, partner matrix), closing, footer. PO removals, which override the reference: the "được phát triển bởi HUB Network" lines, the solution slogan, every organiser block ("Dành cho đơn vị tổ chức", "Dành cho các tổ chức, doanh nghiệp" with "Tạo chương trình", the event organiser box), "Từ dữ liệu đến những kết nối có ý nghĩa", the "HUB Network đóng góp …" paragraph, "Cùng kết nối nguồn lực với những tiềm năng mới". Also gone because the reference no longer has them: the hero "Đăng bài toán" line, the 01–03 bars, the network notes. Nothing is written in their place |
| <a id="dec-h1-r2-d2"></a>DEC-H1-R2-D2 | **Illustrative content is labelled.** Event, programme and pipeline cards show the reference copy verbatim, each rail under a visible "Dữ liệu minh hoạ" label (PO). The partner matrix shows the reference's placeholder names under the same label, with no logo and no link; the repeated names the reference draws at the row end are decorative and hidden from assistive technology. One word is completed where the frame clips it: "mọi lượt xem được ghi nhật ký". The third event's tag is outside the frame and is not drawn |
| <a id="dec-h1-r2-d3"></a>DEC-H1-R2-D3 | **Numbers.** 10.000+ thành viên, 13 mạng lưới khu vực, ~60 cộng đồng và câu lạc bộ, 200+ đối tác hệ sinh thái, 2.000+ startup, and the card line "13 chapter · 9 quốc gia và vùng lãnh thổ · gần 60 câu lạc bộ" are PO-approved presentation values (28/09) |
| <a id="dec-h1-r2-d4"></a>DEC-H1-R2-D4 | **Calls to action.** "Tìm hiểu về HUB Network" → `/about`. Card actions ("Chi tiết", "Xem deck", "Yêu cầu truy cập") and "Truy cập ihub.ventures" are inert with a reason (no destination; external link not approved, PO). Unchanged: header and footer destinations, "Tạo hồ sơ startup của bạn", "Khám phá cơ hội" → `#co-hoi`, entry CTAs, closing columns, legal links |
| <a id="dec-h1-r2-d5"></a>DEC-H1-R2-D5 | **Pixel QA.** 16 segments for 14 sections, each at its own anchor; thresholds of [DEC-H1-D5](#dec-h1-d5) unchanged. The programme segment ends above the removed organiser block; the labels of D2 are masked. Reference quirks reproduced: the programme and matrix rules sit half a pixel lower, chip widths follow the reference. Card gradients are one ramp (coral, red, door, ink) fitted per card |
| <a id="dec-h1-r2-d6"></a>DEC-H1-R2-D6 | **Responsive.** Rails and matrix rows scroll sideways inside the page, by drag, swipe, keyboard or the two buttons; numbers fall to three and two columns; cards narrow below 768 px. No page overflow at 1024 / 768 / 390 |

## DEC-L1R — Four-stage onboarding and open sign-up (TASK 22-L1-L2-SOT-REALIGN)

<a id="dec-l1r"></a>**Status:** IMPLEMENTED 2026-09-29 on the PO task and the PO answers of the same day ([open-decisions](../implementation/l1-l2-realign/open-decisions.md)). Sources: BA workbook sheet "2. Actor" WF-01 (sha256 `f3be3e1a…1d03`) for behaviour, the L1 flow board (sha256 `6587ddb2…05a8`) for screens. Conflict record: [l1-conflict-record.md](../implementation/l1-l2-realign/l1-conflict-record.md). Screens: [l1-screen-contracts.md](../implementation/l1-l2-realign/l1-screen-contracts.md). Not deployed, not pushed.

| ID | Decision |
|---|---|
| <a id="dec-l1r-d1"></a>DEC-L1R-D1 | **Open sign-up.** `POST /auth/magic-link` answers 202 for every plausible address and no longer tells whether an account exists; `AUTH_ACCOUNT_NOT_PROVISIONED` is removed. The request creates nothing: the account row is written when the link is consumed, which is the e-mail verification. Token hash, 15-minute expiry, single use, rate limits (10 per address, 30 per IP per 15 minutes), session and cookie (HttpOnly, Secure, SameSite) are unchanged. Roster addresses still get their confirmed relationships at sign-in |
| <a id="dec-l1r-d2"></a>DEC-L1R-D2 | **AUTH1.** "Tiếp tục với Google" is drawn as the board draws it. No OAuth client exists (`GET /auth/providers` = `[]`), so pressing it starts no request, creates no session and shows "Đăng nhập bằng Google chưa được bật. Vui lòng tiếp tục bằng email." (**GOOGLE OAUTH CONFIG BLOCKER**, external). The terms line under the button is removed: the approved legal text (A2.2–A2.3) says that entering an address is not acceptance |
| <a id="dec-l1r-d3"></a>DEC-L1R-D3 | **Flow and resolver.** ACC-05 intro → stage 1 ACC-06 → stage 2 ACC-07 → stage 3 ACC-08 → stage 4 ACC-09 → ACC-10 → `/me`. Resolver steps `INTRO`, `BASIC`, `CAPABILITY`, `ROLE`, `REVIEW`. Stage 1 is complete by its data; stages 2 and 3 have no required field, so passing them is recorded by `PUT /me/onboarding/stage` (server time, once, in order). A stage page opens only when the stages before it are passed; earlier stages stay open for edits. Routes: `/onboarding` and `/onboarding/capability` are new; `/onboarding/profile`, `/onboarding/purpose`, `/onboarding/privacy`, `/onboarding/complete` are reused for ACC-06, ACC-08, ACC-09, ACC-10. "Để sau" and "Lưu và hoàn tất sau" save and leave to `/`; member pages bring an unfinished account back to its step. A stage refreshes before it is left and completion is a document load, so the browser's Back never shows a stage with values older than the stored ones. Accounts completed before this change are untouched |
| <a id="dec-l1r-d4"></a>DEC-L1R-D4 | **Stage 1 and 2 data (migration 010, additive).** Required in stage 1: full name, display name (defaults to the full name), country, province. Optional: current role (`headline`), short introduction (`bio`), avatar, phone. Phone and full name are returned only by the owner's own profile. E-mail is the account's and read only. Country is the controlled type `COUNTRY` with Việt Nam only (D-N1); provinces are `REGION`. Stage 2: fields (`DOMAIN`, multi-select), specialisations (new type `SPECIALIZATION`, at most five), skills (`SKILL`, picked, never free text), experience with month period and description, LinkedIn and website links. The eight specialisation rows are the ones the board draws; the list is the PO's to confirm before any deploy (D-S1) |
| <a id="dec-l1r-d5"></a>DEC-L1R-D5 | **SUPERSEDED in part by [DEC-PDF-D6B](#dec-pdf-d6b): only a Platform Admin decides a declared membership.** **Stage 3 declaration grants nothing.** Six self-declared roles (`profile_declared_roles`), multi-select, none required: a profile attribute for personalisation, never read by authorization. With "Thành viên HUB Network" the member may name HUB units with a position and a period. While onboarding is open these are a draft on the profile; no membership exists. One claim per unit. No leadership, RoleAssignment, capability or managed scope is ever created from a declaration |
| <a id="dec-l1r-d6"></a>DEC-L1R-D6 | **Stage 4, consent and completion.** ACC-09 shows what the stages stored, the server's completion (frozen ten groups, D-C1), and the network card as another member sees it. Visibility and consent are two controls: the switch is `PROFILE_DISCOVERY` (on = NETWORK_ONLY, off = PRIVATE); the dark confirmation is the one required acknowledgement that records two acceptances (PO decision D-L1), in the place of the board's AI confirmation. "Hoàn tất hồ sơ" sends `POST /me/onboarding/complete`, which needs the stage 1 fields, both stages passed and both current acceptances; it activates the profile once and files each named unit as an ordinary membership request (`PENDING_APPROVAL`, `SELF_DECLARED`, audited). A unit where a membership already stands is skipped. ACC-10 completes nothing and is shown only to a completed account |
| <a id="dec-l1r-d7"></a>DEC-L1R-D7 | **Screens.** Shared shell: 64 px band, wordmark, mono caption over four 72 px bars, one action; Space Grotesk ([DEC-HD-12](#dec-hd-12)). AI blocks (ACC-05, ACC-06) are drawn and inert, and no AI banner, "AI đề xuất" mark or suggested value is ever shown: no provider exists (**AI PROVIDER LIMITATION**, D-A1). "Góp ý" is drawn and inert (D-F1). ACC-09's preview draws the board's card: name, current role and province, the declared roles as plain text chips (the HUB one reads "Chờ xác minh" once a unit is named, "Tự khai" before) and the fields. A chip is descriptive text taken from the member's own declaration: no link, no permission, never full name, phone or e-mail. Chips follow the order of ACC-08, as the board's own review row does. The hint omits the screen code "(ME0)". ACC-10 draws next actions only for routes that exist: "Lập hồ sơ đội" and, when a request is pending, "Theo dõi xác minh chức vụ HUB" → `/me/roles`; it promises no notification. Pixel rule as [DEC-L1-D8](#dec-l1-d8); below 768 px the header wraps and forms stack |
| <a id="dec-l1r-d8"></a>DEC-L1R-D8 | **QA vocabulary.** `tests/visual/fixtures/wf01-acc07-qa-vocabulary.sql`: 34 ACTIVE `DOMAIN` items (with the seed's two: the board's eight chips and "+ 28 lĩnh vực khác"), six `SKILL` items and one ARCHIVED item, deterministic ids, applied only by specs. It archives the rows of the WF01-S06 fixture it replaces. Never a production seed |

Open after this task, none of them blocking the e-mail path:

| ID | Item | Kind | Contained by |
|---|---|---|---|
| D-G1 | Google OAuth client | external configuration | control drawn, signs nobody in |
| D-A1 | AI provider and data-processing terms | external, optional capability | manual flow complete, nothing suggested |
| D-H1 | Who verifies a HUB position, and how | human business decision | request stays `PENDING_APPROVAL` / `SELF_DECLARED`; approving the membership in WF03 confirms membership only, never the stated position |
| D-S1 | Final specialisation list | human business decision | eight board items, local database only |

Superseded records (history kept in place, each row marked):

| Record | Superseded | By |
|---|---|---|
| [DEC-AUTH-EMAIL-D1](#dec-auth-email-d1) invite-only request | fully | D1 |
| [DEC-L1-D2](#dec-l1-d2), [DEC-L1-D9](#dec-l1-d9) Google control disabled "Sắp có" · [DEC-L1-D3](#dec-l1-d3) terms line | fully | D2 |
| [DEC-WF01-RESUME-D1](#dec-wf01-resume-d1) step order · [DEC-WF01-S05-D2 … D6](#dec-wf01-s05-d2) purpose step · [DEC-WF01-S06-D2](#dec-wf01-s06-d2) progression rule | order and screens (the resolver principle stays) | D3 |
| [DEC-WF01-S05-D1](#dec-wf01-s05-d1) intent allowlist | the screen only | D3 |
| [DEC-WF01-S06-D1](#dec-wf01-s06-d1), [D4](#dec-wf01-s06-d4) one picker, five items together | fully | D4 |
| [DEC-WF01-S08-D1](#dec-wf01-s08-d1) completion on entry · [DEC-WF01-S08-D4](#dec-wf01-s08-d4) no chapter card · [DEC-WF01-S07-D1](#dec-wf01-s07-d1) acknowledgement on S07 | trigger and placement | D6 |
| [DEC-WF01-S06-D5](#dec-wf01-s06-d5), [DEC-WF01-S07-D6](#dec-wf01-s07-d6) no header action · [DEC-WF01-S07-D7](#dec-wf01-s07-d7) · [DEC-L1-D1](#dec-l1-d1) scope · [DEC-L1-D7](#dec-l1-d7) three-step stepper | fully | D7 |
| [DEC-WF01-S06-D6](#dec-wf01-s06-d6) S06 QA fixture | fully | D8 |
| HD-02 (four-stage onboarding), HD-03 (consent placement), HD-04 default for L1 (no AI blocks drawn) | resolved for L1 | D3, D6, D7 |
| Freeze D3 activation minimum "display name, region, consents" | extended by full name, country and the two stages | D6 |


## DEC-L2R — Personal workspace, venture lifecycle and team (TASK 22-L1-L2-SOT-REALIGN, L2)

<a id="dec-l2r"></a>**Status:** IMPLEMENTED 2026-09-29 on the PO task. Sources: BA workbook sheet "2. Actor" WF-02 rows 77–107 and sheet "3. Biz Rules" (sha256 `f3be3e1a…1d03`) for behaviour; the L2 flow board (sha256 `305d75ea…b7d1`) and FP1-OWN of the L1 board for screens. Audit before the code: [l2-delta-matrix.md](../implementation/l1-l2-realign/l2-delta-matrix.md), [l2-delta-team.md](../implementation/l1-l2-realign/l2-delta-team.md), [l2-screen-contracts.md](../implementation/l1-l2-realign/l2-screen-contracts.md).

| ID | Decision |
|---|---|
| <a id="dec-l2r-d1"></a>DEC-L2R-D1 | **Two entries.** `/me` is "Hồ sơ của tôi" (FP1-OWN, WF02-S01). `/projects` is "Dự án & startup của tôi" (ME7, new WF02-S08). The other member routes keep their address. Each page draws the header of its own frame with destinations that exist; items without a screen are inert with a reason. `/me/settings`, `/me/privacy` and `/me/roles` keep the member shell of TASK 22.3: its first item reads "Hồ sơ của tôi", and "Lời mời" is now a link to `/projects` |
| <a id="dec-l2r-d2"></a>DEC-L2R-D2 | **FP1-OWN draws what has a source** (PO answer D-P1): identity, introduction, experience, education, specialisation and skills, the server's completion, the member's ventures. Not drawn: member badges, activity counts, "Hồ sơ đã duyệt", "Ai đang xem hồ sơ", "Dự án trên HUB", "Tiến trình phát triển", certificates, public URL, "Xem như Guest", "Mở với", "Tài nguyên". The banner keeps the sentences that are true: no page for other viewers exists (FP1 is not built) |
| <a id="dec-l2r-d3"></a>DEC-L2R-D3 | **Profile management on the canonical IndividualProfile.** FP1-OWN edits in place, one `PATCH /me/profile` per save: experience in the L12 dialog the L1 stage already uses; education, now writable (`education`: institution, programme, months), in a dialog on the L12 pattern (the board draws "+" and the pencil and no frame of its own); basic and contact information (full name, display name, current role, country, province, private phone) from the identity pencil and "Thông tin liên hệ"; specialisation (at most five) and skills from "Chuyên môn". Introduction, avatar, links, field, goal and need stay on the existing editor `/me/profile/edit`, unchanged. No second profile model |
| <a id="dec-l2r-d4"></a>DEC-L2R-D4 | **Venture create data.** One canonical record, `type` PROJECT or STARTUP, fixed at creation. Required on create, on the server: name, at least one field, description, stage. The creator's role is optional. Region leaves PRJ1, which does not draw it, and stays in the venture editor. A required value cannot be cleared by a later update; ventures created before this rule keep what they have |
| <a id="dec-l2r-d5"></a>DEC-L2R-D5 | **SUPERSEDED by [DEC-PDF-D5](#dec-pdf-d5): the frozen stages are IDEA, MVP, PILOT, SELLING, GROWTH.** **Stage** is the controlled vocabulary type `VENTURE_STAGE` with the five items of PRJ1 in its order: Ý tưởng, Prototype, Pilot, Đang bán, Đã mở rộng (migration 011, fixed ids). `projects.stage_id` refers to one item. The list waits for PO approval before any deploy |
| <a id="dec-l2r-d6"></a>DEC-L2R-D6 | **Creator role and ownership.** The owner is the session's profile, never a value from the client, and still has no team row ([DEC-WF02-S05-G5](#dec-wf02-s05-g5)). The role the creator states (Founder, Co-founder, Thành viên on PRJ1) is `projects.owner_role_label`, display text like every `role_label`. It grants nothing in the venture and nothing on the platform; the creator's permission is always Chủ sở hữu |
| <a id="dec-l2r-d7"></a>DEC-L2R-D7 | **Three permission levels**, the ones PRJ2 defines. Chủ sở hữu is derived from ownership. Biên tập and Xem are `project_members.permission` (`EDIT`, `VIEW`), set by the owner on the invitation and on the member. Biên tập may update the venture; only the owner invites, changes and removes members. Rows that existed before are `VIEW`, which is what they could do. An invitation sent without a level is `VIEW`. The clauses of the board about submissions and ownership transfer are not shown: neither exists (L5, [DEC-WF02-H8](#dec-wf02-h8)) |
| <a id="dec-l2r-d8"></a>DEC-L2R-D8 | **SUPERSEDED in part by [DEC-PDF-D4](#dec-pdf-d4): the message is the approved copy.** **Invitations.** Sending creates the PENDING_CONFIRMATION row and sends one e-mail through the existing provider; a send that fails creates nothing and says so. The message names the venture, the role and the level and leads to `/projects`; it carries no token. A send that fails answers `500 INVITATION_EMAIL_DELIVERY_FAILED` (a decision code like DEC-AUTH-EMAIL-D3's). The invitee sees their own pending invitations on ME7 and their number in ME0 (`GET /me/venture-invitations`), and joins only by accepting. A pending row shows the address only: inviting never tells whether an address has an account. Invitation by link is drawn and inert (PO answer D-T1). Technical bound: 20 pending invitations per venture |
| <a id="dec-l2r-d9"></a>DEC-L2R-D9 | **Draft and duplicates.** Every venture starts DRAFT and nothing publishes it. `POST /ventures` honours `Idempotency-Key`: the wizard sends one key per visit, so a double submit or a repeated request returns the same venture. Venture create and update write an audit event (BR-ENT-06, BR-GOV-01) |
| <a id="dec-l2r-d10"></a>DEC-L2R-D10 | **SUPERSEDED by [DEC-PDF-D1](#dec-pdf-d1): the owner publishes a complete venture.** **Public eligibility is not decided.** The workbook says "hoàn thiện thông tin tối thiểu / xuất bản" (B4) and "khi đủ điều kiện" (row 92); the board says "gửi duyệt" through an admin screen of L5. Neither names the conditions, and the API contract keeps `submit-for-review` absent until a review is configured. Every venture stays DRAFT and visible to its team only; no screen promises publication. **HUMAN BUSINESS DECISION REQUIRED: PUBLIC ELIGIBILITY RULE** (D-V1) |
| <a id="dec-l2r-d11"></a>DEC-L2R-D11 | **SUPERSEDED in part by [DEC-PDF-D3](#dec-pdf-d3): no field count exists.** **Screens.** PRJ1–PRJ3, ME7 and FP1-OWN use Space Grotesk ([DEC-HD-12](#dec-hd-12)). The AI block of PRJ1 is drawn and inert (D-A1); "Góp ý" is drawn and inert (D-F1). Frame codes and flow notes of the board (SUB0, PRO1, ADM6, SP1, NOTI1, `startup_member.quyen`) are design annotations and are not shown. "Hồ sơ n/48 trường" is not shown (D-V2). PRJ2 keeps "Hoàn tất" and PRJ1 keeps "Chọn một lần khi tạo" because the record exists from step 1 and the type cannot change ([DEC-L2-D2](#dec-l2-d2), [D3](#dec-l2-d3)) |
| <a id="dec-l2r-d12"></a>DEC-L2R-D12 | **The shared experience dialog (L1 compatibility defect).** The L12 dialog of ACC-07 opened at the top-left corner: the global reset removes the margin that centres a modal `<dialog>`. It is centred now, its head is as tall as its title, the period fields sit 14 px apart, "Đến" reads "Hiện tại" as a filled field and the "Tôi đang làm ở đây" box is drawn as L12 draws it. ACC-07 and FP1-OWN use the same dialog. On FP1-OWN, which saves at once, the dialog stays open until the server stored the record and shows its refusal (pre-commit review); ACC-07, whose stage saves later, closes it at once as before. No other L1 behaviour changes |
| <a id="dec-l2r-d13"></a>DEC-L2R-D13 | **Invitation send limits (security, pre-commit review).** Open sign-up lets anyone own a venture, and each invitation sends an e-mail from the HUB sender with a name the inviter chose. Sends of the last 24 hours are counted over every state, so cancelling gives none back: at most 3 to one address of one venture and 50 by one inviting profile. Beyond that the answer is `429 INVITATION_RATE_LIMITED` (a decision code like DEC-AUTH-EMAIL-D2's limit) and nothing is created or sent. The invitation takes a lock on its venture, so concurrent sends cannot pass the 20 pending. No new table: the counts read `project_members`. The numbers are a security default the PO may change |

Open after L2, none of them blocking create, edit or team:

| ID | Item | Kind | Contained by |
|---|---|---|---|
| D-V1 | When a venture is public | human business decision | **CLOSED by [DEC-PDF-D1](#dec-pdf-d1)** |
| D-T1 | Invitation by link: who joins, role, expiry, revocation | human business decision | **CLOSED by [DEC-PDF-D2](#dec-pdf-d2): deferred** |
| D-V2 | The 48 fields of the completion count | human business decision | **CLOSED by [DEC-PDF-D3](#dec-pdf-d3)** |
| D-E1 | Text of the invitation e-mail | PO copy review | **CLOSED by [DEC-PDF-D4](#dec-pdf-d4)** |
| D-A1 | AI provider | external, optional capability | manual create complete |

Superseded records (history kept in place, each row marked):

| Record | Superseded | By |
|---|---|---|
| [DEC-WF02-H6](#dec-wf02-h6) write model without stage · [DEC-L2-D2](#dec-l2-d2) no stage, no creator role, no AI block | the field list | D4, D5, D6 |
| [DEC-WF02-H7](#dec-wf02-h7) members read only, no Editor / Viewer · [DEC-WF02-S06-G4](#dec-wf02-s06-g4) "Quyền" of two values | the permission model (one owner stays) | D7 |
| [DEC-WF02-S06-G2](#dec-wf02-s06-g2) no e-mail · [DEC-L2-D3](#dec-l2-d3) "Tạo lời mời", no permission levels | sending and levels (explicit accept stays) | D7, D8 |
| [DEC-WF02-H10](#dec-wf02-h10) "Đang chờ bạn" omitted · [DEC-L2-D1](#dec-l2-d1) invitations not in settings | fully | D8 |
| [DEC-WF02-S01-D1…D6](#dec-wf02-s01-d1) account home | the screen | D1, D2 |
| [DEC-L2-D4](#dec-l2-d4) "Về Tài khoản của tôi" | the destination | D1 |
| Session-only quick project: a project or team kept in the browser session only ([DEC-WF05-G5](#dec-wf05-g5), option B of [DEC-2809-D5](#dec-2809-d5)) | fully; already closed by DEC-2809-D5 / D6, confirmed here for WF02: the wizard writes the canonical DRAFT on its first step and refresh or back reads it again | D9 |


## DEC-PDF — Alpha PO decision freeze (TASK 22-L1-L2-PO-DECISION-FREEZE)

<a id="dec-pdf"></a>**Status:** IMPLEMENTED 2026-09-29 on the PO's decisions of the same day for Internal Alpha. Closes the open L1 / L2 items D-V1, D-T1, D-V2, D-E1, VENTURE_STAGE, D-S1 and D-H1 ([open-decisions](../implementation/l1-l2-realign/open-decisions.md)). Migration 012. Evidence: [po-decision-freeze.md](../implementation/l1-l2-realign/po-decision-freeze.md).

| ID | Decision |
|---|---|
| <a id="dec-pdf-d1"></a>DEC-PDF-D1 | **Venture publication (closes D-V1).** A new venture is DRAFT and PRIVATE (`projects.visibility`). It becomes PUBLIC only when its owner chooses "Công khai" in the editor and the stored record holds name, at least one field, description, stage and the creator's role; the server checks all of it (`POST /ventures/{id}/publish`), refuses with the missing fields named, and never publishes on its own or from completion. Publishing makes a DRAFT ACTIVE and the venture PUBLIC in one step; a DRAFT can never be PUBLIC (database check). Members get 403, anyone else 404. No admin approval or moderation in Alpha. A public venture keeps its creator role. PUBLIC grants no read: no public venture path exists in P0, so the public page or directory that will honour it is future work |
| <a id="dec-pdf-d2"></a>DEC-PDF-D2 | **Team invitation (closes D-T1).** Alpha invites by e-mail only: invite → PENDING_CONFIRMATION → the recipient accepts → ACTIVE member; nothing else changes (no expiry exists; the owner can cancel). The owner is the one who invites ([DEC-L2R-D7](#dec-l2r-d7)); no level grants it to a member, so "owner/editor with permission" reads as the owner alone. Invitation by link is DEFERRED: PRJ2's row stays drawn and inert, now with the reason "Tính năng giai đoạn sau" |
| <a id="dec-pdf-d3"></a>DEC-PDF-D3 | **No field count (closes D-V2).** "48 fields" is not a rule. Required profile data is what the approved onboarding requires; everything else stays optional. Completion stays server-derived from the frozen groups (D-C1), never a raw field count; no "n/48" is shown anywhere. No model field is removed |
| <a id="dec-pdf-d4"></a>DEC-PDF-D4 | **Invitation e-mail copy (closes D-E1).** Subject "Bạn được mời tham gia {venture} trên 1hub.network"; body "{inviter} mời bạn tham gia {venture} với vai trò {role}."; call to action "Xem lời mời" to `/projects`. The inviter is the display name. Without a role the sentence ends at the venture. Nothing else: no level, no marketing, no token or id. The safe link handling is unchanged |
| <a id="dec-pdf-d5"></a>DEC-PDF-D5 | **Stages (closes VENTURE_STAGE).** IDEA "Ý tưởng", MVP "MVP", PILOT "Pilot / Thử nghiệm", SELLING "Đang bán", GROWTH "Tăng trưởng". The codes are the vocabulary slugs and `stage.code` in the DTO; records keep the stable ids of migration 011 (Prototype → MVP and Đã mở rộng → GROWTH on the same ids). No label is an identifier. Only the venture create and edit consume stage; the Library's startup stages are external data and unchanged |
| <a id="dec-pdf-d6a"></a>DEC-PDF-D6A | **Specialisation (closes D-S1).** The eight items of migration 010 are frozen for Alpha: Vận hành, Công nghệ, Tài chính, Luật, Design, Marketing, Product, Business Development. Controlled ids only; no free text; no new item |
| <a id="dec-pdf-d6b"></a>DEC-PDF-D6B | **HUB verification authority (closes D-H1).** Only a Platform Admin verifies a self-declared HUB membership or position. The P0 catalogue has no separate "HUB internal ops" role and none is invented: HUB internal ops act through a Platform Admin assignment. A membership filed from the ACC-08 declaration carries `hub_declaration`; deciding it needs `membership:confirm` held platform-wide, so a Chapter or CLB leader can neither approve nor reject it, sees it with a note, and gets 403 from the API. Until verified it stays PENDING_APPROVAL / SELF_DECLARED. A declaration never grants leadership, admin, organization management or any capability. No verification screen was built: the Platform Admin uses the existing ops member review. Ordinary join requests (`/me/roles`) stay the unit's to decide ([DEC-WF03-G5](#dec-wf03-g5)) |

Deferred, not in this task: invitation by link (D2); Google OAuth (D-G1); the AI provider (D-A1); a HUB verification screen or queue beyond the ops member review (D6B); a public venture page or directory (D1); making a public venture private again (D1).

Superseded records (history kept in place, each row marked):

| Record | Superseded | By |
|---|---|---|
| [DEC-L2R-D5](#dec-l2r-d5) five PRJ1 stages | the list and its labels | D5 |
| [DEC-L2R-D8](#dec-l2r-d8) invitation message | the text (sending, no token and explicit accept stay) | D4 |
| [DEC-L2R-D10](#dec-l2r-d10) public eligibility undecided | fully | D1 |
| [DEC-L2R-D11](#dec-l2r-d11) "Hồ sơ n/48 trường" not shown | the reason: it is no rule | D3 |
| [DEC-L1R-D5](#dec-l1r-d5) the unit decides a declared membership | who decides | D6B |

## DEC-AIG — Alpha interaction gap fix (PO decision freeze, 30/09)

<a id="dec-aig"></a>**Status:** IMPLEMENTED 2026-09-30 on the PO's decisions of the same day, closing the P1 / P2 gaps of the [interaction contract audit](../uat/INTERACTION_CONTRACT_AUDIT.md). Outcome per item: [INTERACTION_GAP_REGISTER.csv](../uat/INTERACTION_GAP_REGISTER.csv) ("Alpha fix" columns). Test: `tests/visual/specs/alpha-interaction-gaps.spec.ts`.

| ID | Decision |
|---|---|
| <a id="dec-aig-d1"></a>DEC-AIG-D1 | **Public nav without a destination.** "Chương trình", "Sự kiện" (and "Tin tức" in the Library header) on `/`, `/about`, `/library` are plain text labels: no link, no disabled control, no "coming soon" tooltip, no invented route. |
| <a id="dec-aig-d2"></a>DEC-AIG-D2 | **"Tạo hồ sơ startup của bạn".** A member goes to `/projects/new`; a guest to `/auth?redirect=/projects/new`, and after the e-mailed link back to `/projects/new` (onboarding first; ACC-10's exit then continues there). BD-02 return-to rule, browser side: a safe same-origin path kept in localStorage for an hour; not stored with the magic-link request, so another browser or device lands on the usual destination. |
| <a id="dec-aig-d3"></a>DEC-AIG-D3 | **"Hồ sơ đăng ký"** (ME7 sidebar) → `/demo/projects`, the L5 entry listing the member's ventures and applications. No new dashboard. |
| <a id="dec-aig-d4"></a>DEC-AIG-D4 | **"Mạng lưới"** (ME7 header) → `/library`. |
| <a id="dec-aig-d5"></a>DEC-AIG-D5 | **Homepage search** → `/library?q=<keyword>`, applied by the Library's own search (DEC-L15); empty keyword navigates nowhere. No global, AI or matching search, no new endpoint. |
| <a id="dec-aig-d6"></a>DEC-AIG-D6 | **About phone number:** plain text; no `tel:` action. |
| <a id="dec-aig-d7"></a>DEC-AIG-D7 | **"Góp ý":** hidden for Alpha on every screen; no feedback form, API or e-mail workaround. |
| <a id="dec-aig-d8"></a>DEC-AIG-D8 | **Library card actions:** only a real destination is drawn (the record's own website, new tab). "Theo dõi", "Kết nối", "Xem bài toán" / "Theo dõi bài toán" and a "Xem hồ sơ" without a website are not drawn; a founder's startup row without a website is plain content. The homepage's illustrative "Chi tiết" actions follow the same rule (hidden; the event card keeps the line's space so its picture keeps the approved size). |
| <a id="dec-aig-d9"></a>DEC-AIG-D9 | **Account menus:** "Thư viện" → `/library`, "Tổ chức của tôi" → `/me/roles` (as ME7 already did). "Truy cập ihub.ventures" opens `https://ihub.ventures` in a new tab (28/09 CTA map). |
| <a id="dec-aig-d10"></a>DEC-AIG-D10 | **Homepage search copy (PO, final).** The hero placeholder and accessible name read "Tìm kiếm trong Thư viện", the scope the search really has (`/library?q=`). Behaviour unchanged; no global search. |

Superseded in part: [DEC-P0-SHELL-D2](#dec-p0-shell-d2) for the items above (inert with a reason); D-F1 ("Góp ý" drawn and inert, DEC-L2R-D11); DEC-WF01-S08-D6 (single exit `/me`) when a return path exists. The other inert items of the register (P3, D) are unchanged.

## DEC-P3UX — P3 interaction UX cleanup (PO, 01/10)

<a id="dec-p3ux"></a>**Status:** IMPLEMENTED 2026-10-01 (D5 on the PO's final BD-01 decision of the same day), on the PO's decisions after the [interaction action registry](../implementation/reports/INTERACTION_ACTION_REGISTRY.md). No new route, destination or behaviour.

| ID | Decision |
|---|---|
| <a id="dec-p3ux-d1"></a>DEC-P3UX-D1 | **Member / workspace header inert items** stay non-clickable and are drawn dimmed (the disabled pattern of the UI primitives, opacity 0.55, cursor default), so they no longer read like the working "Thư viện" / "Mạng lưới". Labels kept. |
| <a id="dec-p3ux-d2"></a>DEC-P3UX-D2 | **Homepage out-of-scope CTAs** are drawn disabled; a planned capability that stays visible carries a visible "Sắp có" ("Xem deck", "Yêu cầu truy cập", "Khám phá mạng lưới" in the two doors, "Triển khai chương trình" in the closing section). The contact e-mail is plain text. No href, `#`, dummy route or toast. |
| <a id="dec-p3ux-d3"></a>DEC-P3UX-D3 | **About** follows D2: inert items disabled; "Kết nối hợp tác" and "Khám phá các câu lạc bộ" carry "Sắp có"; the e-mail is plain text. |
| <a id="dec-p3ux-d4"></a>DEC-P3UX-D4 | **Library keyword chip** ("Đang lọc") is display only: no pointer, no click. A remove-keyword action is deferred. |
| <a id="dec-p3ux-d5"></a>DEC-P3UX-D5 | **BD-01, final (PO):** one auth surface, canonical `/auth`, for both sign-in and first-time sign-up; its heading reads "Đăng nhập & đăng ký". "Tạo tài khoản" and "Đăng nhập" both open `/auth`. No `/signup`, no `/login` alias, no mode parameter, no separate flow or backend; magic link, callback, session and onboarding unchanged. Supersedes BD-01's `/login` alias and `mode=signup`, and the CTA map's `/login?mode=signup` row. |
| <a id="dec-p3ux-d6"></a>DEC-P3UX-D6 | **404** offers "Về trang chủ" → `/` with the existing button primitive; Back unchanged. |
| <a id="dec-p3ux-d7"></a>DEC-P3UX-D7 | **Closing section:** "Khám phá cơ hội" keeps `#co-hoi`; "Triển khai chương trình" has no destination, is drawn disabled with "Sắp có", and stays a missing business decision. |

Superseded in part: [DEC-P0-SHELL-D2](#dec-p0-shell-d2) and the About report's "inert with a reason" for the items above (they now also look unavailable); M0-T03's "no navigation" on the 404 page.

## DEC-W4P — WF04 production contract (WF04-PROD-01, PO, 01/10)

<a id="dec-w4p"></a>**Status:** FROZEN 2026-10-01 for implementation after PO approval of the [WF04 production contract](../implementation/reports/WF04_PRODUCTION_CONTRACT.md) (input: [gap matrix](../implementation/reports/WF04_PRODUCTION_GAP_MATRIX.md)). Supersessions are listed in the contract §18; earlier records stay as written.

| ID | Decision |
|---|---|
| <a id="dec-w4p-d01"></a>DEC-W4P-D01 | **Scope.** WF04 is production-hardened, limited to the approved current WF04 behaviour; future boards are not promoted (contract §1–§2). |
| <a id="dec-w4p-d02"></a>DEC-W4P-D02 | **No new role.** Create, edit, publish, close (when decided) and Challenge management use existing roles: `HUB_COMMUNITY_LEADER` with an ACTIVE assignment for the owning organization (exact, no inheritance) and `PLATFORM_ADMIN`, through a new capability `programme:manage` of the matrix's existing shape. `PROGRAMME_ORGANIZER` stays inactive (A03 §4); SOT:161 is not contradicted. |
| <a id="dec-w4p-d03"></a>DEC-W4P-D03 | **One owning organization** (`programmes.organization_id`, NOT NULL, HUB / CHAPTER / CLB, immutable). No multi-organization authorization; co-host names are content only. |
| <a id="dec-w4p-d04"></a>DEC-W4P-D04 | **Reuse canonical entities**: one Programme aggregate; no V2 or duplicate Programme, Challenge, Problem, Application or Event model. |
| <a id="dec-w4p-d05"></a>DEC-W4P-D05 | **Application**: WF04 writes only the canonical registration form `programme_application_forms`; applications stay the L5 model (API §21). Demo / canonical conflicts go to the PO (contract Q3, Q5). |
| <a id="dec-w4p-d06"></a>DEC-W4P-D06 | **Challenge "Bài toán" = option A**: problem statements are child content of the Programme aggregate (FRZ D1), stored in `programmes.metadata.challenge`; not related to the Library's static problem file (DEC-L15-D9); no new table. |
| <a id="dec-w4p-d07"></a>DEC-W4P-D07 | **Event boundary**: WF04 reads events through `events.programme_id` only; no event writes, lifecycle copy or WF03 change (writes: contract Q1). |
| <a id="dec-w4p-d08"></a>DEC-W4P-D08 | **UI**: the approved WF04 screens are the baseline; only loading, empty, validation, API error (including 409), permission denied and disabled states may be added. |
| <a id="dec-w4p-d09"></a>DEC-W4P-D09 | **Fixtures**: zero production dependency; fixtures and the deterministic seed stay for tests and local demo. |
| <a id="dec-w4p-d10"></a>DEC-W4P-D10 | **Public surface**: v1 adds no public programme list, detail or CTA; members reach PUBLISHED programmes only through the existing L5 apply flow. |
| <a id="dec-w4p-d11"></a>DEC-W4P-D11 | **Lifecycle (PO, 02/10, WF04-PROD-02).** CLOSED is an approved P0 programme state. ARCHIVED is not approved for this release: **DEFERRED**, with no archive action, transition, API, UI or filtering. The `programmes.status` column has accepted ARCHIVED since M001 through the shared `publication_status`, independently of WF04, so migration 015 carries it over unchanged for compatibility and adds only CLOSED. |
| <a id="dec-w4p-d12"></a>DEC-W4P-D12 | **API / RBAC (PO task WF04-PROD-03, 02/10).** API amendment A5 (`/api/v1/programmes*`, 05 §22) and `programme:manage` in the matrix (code, doc, test). Close is approved: PUBLISHED → CLOSED by `programme:manage` (task §4, §7, §15; D11), no reopen, no ARCHIVED (Q2 closed for close; archive DEFERRED). Publish rules are contract §8 REQUIRED and TECHNICALLY REQUIRED only, no demo or invented rule (task §8; Q7 answered: none). Events stay read only (task: no invented Event behaviour; Q1 writes stay open). Registration: canonical TEAM / STARTUP and per-question `required` / `step` with no default; once an application exists the form is refused with 409 until Q3 decides. Errors follow the ops convention (task §11): 422 `PROFILE_VALIDATION_FAILED` with field reasons (`not_accepted`, `immutable`, …) and 409 `MEMBERSHIP_INVALID_TRANSITION`; this replaces the contract §12 wording "400 `not_accepted`". Idempotency-Key honoured for `programme.create`, `programme.publish`, `programme.close` (missing key processed, I5). Audit adds `PROGRAMME_CLOSED`. The demo API and fixtures stay until PROD-04. |
| <a id="dec-w4p-d13"></a>DEC-W4P-D13 | **Frontend on the API (PO task WF04-PROD-04, 02/10).** (1) No programme is created, edited, published or closed for an ARCHIVED owning organization: 409 on the server, no enabled write flow on screen; existing programmes stay readable. (2) WF04 writes no Event; linked events are shown read only (S04). (3) Once an application exists the form is not edited (server 409; S05 read only). (4) INDIVIDUAL is not a canonical applicant type, so S05 offers TEAM / STARTUP only. (5) No publish rule beyond the frozen contract. (6) ARCHIVED programmes are compatibility only. (7) Q4–Q6 and Q8–Q10 deferred: S06 shows its empty state (no team source), no application counts, routes stay `/demo/programmes/*`. Implementation: the detail carries server-computed `actions` and `owner_archived`; the demo notice, reset, session store, demo API and demo read model leave the runtime; adding a registration question stays unavailable because a new question needs `required` and `step` and Q3(b) has no approved default. |
| <a id="dec-w4p-t"></a>DEC-W4P-T1…T11 | **Technical** (no PO decision needed): server-side authorization on every write; canonical DB persistence; refresh / relogin / restart keep state; duplicate state changes handled (Idempotency-Key `programme.create`, `programme.publish`); invalid transitions rejected server-side (409); IDOR, role spoofing and cross-organization writes rejected; zero production fixture dependency; migrations support fresh DB, upgrade and a rollback / recovery note; audit with the existing convention (`PROGRAMME_CREATED`, `PROGRAMME_UPDATED`, `PROGRAMME_REGISTRATION_UPDATED`, `PROGRAMME_PUBLISHED`); malformed ids return the canonical 404, never 500; regression for fresh DB, migration, restart, authorization, malformed ids, console / hydration / 5xx. |
| <a id="dec-w4p-c"></a>DEC-W4P-C1…C6 | **Contract choices**: C1 `programme_status` enum DRAFT / PUBLISHED / CLOSED aligns the DB with SOT:209-210 for the approved states (closes gap D1); ARCHIVED = DEFERRED ([D11](#dec-w4p-d11)), present only as the pre-existing compatibility value; the transition to CLOSED stays open (Q2); C2 stages in `programmes.metadata.journey`; C3 canonical API `/api/v1/programmes` (A04:234) as API Amendment A5, the demo API leaves production; C4 publish = SOT + technical rules only, the CHALLENGE problem rule is demo-only (Q7); C5 content edits allowed in DRAFT and PUBLISHED as in the demo, type and owner never, no unpublish; C6 the production row `d4…0001` becomes an ordinary Chapter 01 programme pending Q8. |

Open (contract §19): BLOCKING none; NON_BLOCKING Q3(b) (`required` / `step` of a new operator question), Q4–Q6, Q8–Q10 (deferred by D13); Q1 (no event writes), Q3(a)(c) closed by D13; Q2 (close) and Q7 closed by D12; DEFERRED as listed in contract §2.

## Related
- [WF02_HUMAN_DECISION_PACKET.md](../implementation/WF02_HUMAN_DECISION_PACKET.md) — WF02 H1–H13 packet (frozen above)

- [p0-status.md](../implementation/P0_STATUS.md) — overall P0 state
- [wf01-s03-state-board-mapping.md](../implementation/WF01_S03_STATE_BOARD_MAPPING.md) — S03 mapping
- [wf01-s04-state-board-mapping.md](../implementation/WF01_S04_STATE_BOARD_MAPPING.md) — S04 mapping (frozen)
- [wf01-s05-intent-contract-gap.md](../implementation/WF01_S05_INTENT_CONTRACT_GAP.md) — S05 intent contract (approved)
- [wf01-s06-profile-field-contract.md](../implementation/WF01_S06_PROFILE_FIELD_CONTRACT.md) — S06 field contract (approved)
- [wf01-s07-privacy-consent-contract.md](../implementation/WF01_S07_PRIVACY_CONSENT_CONTRACT.md) — S07 consent contract (approved)
- [wf01-s08-completion-contract.md](../implementation/WF01_S08_COMPLETION_CONTRACT.md) — S08 completion contract (approved)
