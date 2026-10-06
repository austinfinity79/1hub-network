# AI Ingestion Contract v1 — CV / Pitch Deck / Web

**Task:** AI-CONTRACT-01 · **Status:** PROPOSED FREEZE (docs only; nothing implemented) · **Date:** 2026-10-02
**Base:** `cdcf17e` (branch `docs/ai-ingestion-contract`)

> **IMPLEMENTATION BLOCKED UNTIL LEGAL-AI-01 IS RESOLVED** for every path that sends user content
> (CV, pitch deck, pasted profile, web page text) to an external AI provider. The interface below is
> complete; only the deterministic stub provider (§9.4) may run before LEGAL-AI-01 closes.

## 1. Purpose

One shared ingestion pipeline serves two product features, so file parsing, URL fetching, the model
client, retries, cleanup, security checks and suggestion records exist once:

| Consumer | Task label | Business source | Repo story |
|---|---|---|---|
| AI Profile Helper | S1-UAT-04 | FB-05 | US-01.06, US-01.08 (also US-01.09 step 2, US-01.10 step 3, US-01.12 step 4, US-01.14 save-later) |
| AI Project/Startup Import | S1-UAT-06 | FB-15 | US-02.10 (PRJ1) |

Business sources are the Sprint 1 feedback and UAT files supplied by the PO
(`1hubnetwork_feedback_sprint1.md`, `1hubnetwork_uat_sprint1_wf01_wf02.md`); they are **not yet in the
repo** and the labels S1-UAT-04 / S1-UAT-06 do not appear in them. Repo decisions in force:
[DEC-2809-D2](../decisions/DECISION_LOG.md#dec-2809-d2) (AI is live Alpha, never publishes, never
creates a Venture, never replaces validation, failure or quota never blocks),
[DEC-L1R-D7](../decisions/DECISION_LOG.md#dec-l1r-d7) / D-A1 (AI blocks drawn and inert until a
provider exists), HD-A1 and BD-12 in `docs/design-revision/scope-refreeze/`.

## 2. Scope

| In | Out |
|---|---|
| Source intake, validation, extraction, normalization, model call, suggestion validation, presentation contract, confirmation, persistence boundary, cleanup, audit | Implementing any of it; legal/consent text (LEGAL-AI-01); new Venture fields (website, business code); taxonomy curation (FB-09 / FB-17); OCR; crawling; AI for avatar/photo |

## 3. Business constraints (preserved, not reinterpreted)

| # | Rule | Source |
|---|---|---|
| B1 | Profile sources: CV PDF/DOCX ≤ 10 MB, pasted text, public LinkedIn/Portfolio URL | FB-05, US-01.08 |
| B2 | Project sources: pitch deck PDF ≤ 20 MB, website URL | FB-15, US-02.10 |
| B3 | Four UI states: Chờ nhập (idle) · Đang phân tích (analyzing, with Hủy) · Thành công (success, "Đã gợi ý N thông tin từ [tên tệp]") · Lỗi (error, Thử lại / Nhập thông tin) | US-01.08 |
| B4 | AI only suggests; nothing is saved or made public until the user confirms; "Tiếp tục" confirms the fields of that step | US-01.08 |
| B5 | An AI-filled field carries "AI đề xuất" (✦ AI); editing the field removes the label | US-01.08, US-01.12 |
| B6 | "Tải tệp khác" re-analyses and replaces all unconfirmed suggestions; "Bỏ tất cả gợi ý" clears all unconfirmed AI fields | US-01.08 |
| B7 | AI never fills phone, date of birth, identity-document number; AI never suggests a photo | US-01.08, US-01.07 |
| B8 | File and content are used once, only to suggest for this profile, for no other purpose | US-01.08 |
| B9 | Cancel while analyzing → back to idle, nothing filled | US-01.08 |
| B10 | Wrong type or over the size limit is blocked **before** analysis | US-01.08, US-02.10 |
| B11 | Unreadable link → clear error; manual entry and onboarding completion always remain possible | US-01.08, DEC-2809-D2 |
| B12 | Closing the browser before "Tiếp tục" → those fields are not in the profile; unconfirmed suggestions are gone on return, and "Lưu và hoàn tất sau" never saves them | US-01.08, US-01.14 |
| B13 | Step 3: an AI-suggested role card is labelled and is not selected until the user ticks it | US-01.10 |
| B14 | Step 4: if AI content exists, "Tôi đã kiểm tra N nội dung do AI đề xuất" must be ticked before completion | US-01.12 |
| B15 | Project AI suggests only Name, Sector, One-line description, Stage; same confirmation rule as onboarding; uses the canonical Venture model | FB-15, US-02.10 |
| B16 | A suggestion passes when it fills the right field with content present in the source (no invention); wording quality is not a pass/fail criterion | US-01.08 |

## 4. Shared architecture

```
Source Intake ─► Source Validation ─► Transient Source ─► Extraction ─► Normalization
      ─► Suggestion Generation (model) ─► Suggestion Validation (+ taxonomy mapping)
      ─► Suggestion Presentation ─► User Confirmation / Rejection ─► Domain Persistence
      ─► Source Cleanup (immediate) ─► Audit / Metrics
```

**Processing model (frozen): synchronous, one request.** The repo has no job queue or worker
(reuse audit §13), inputs are bounded (≤ 20 MB, ≤ 30 000 normalized characters) and the UI already
models a single "analyzing" wait. One `POST` performs intake → validation of suggestions and returns
the suggestions in the response. Total server budget **45 s**, below the Nginx `proxy_read_timeout`
of 60 s. A queue is not introduced unless measured latency breaks the budget.

| # | Stage | Input | Output | Owner (layer) | Failure → | Retry | Privacy / security | Persists? |
|---|---|---|---|---|---|---|---|---|
| 1 | Source Intake | multipart `file`, or JSON `{text}` / `{url}`, plus `target_type`, `target_id?` | `RawSource` (bytes or string, declared name/type) | API route (`withApi`) | 4xx envelope | client may resend | session required; owner of target checked | no |
| 2 | Source Validation | `RawSource` | accepted source or error | shared `ingest/validate` | `AI_SOURCE_TOO_LARGE`, `AI_SOURCE_UNSUPPORTED_TYPE`, `AI_SOURCE_INVALID_URL` (422) | no (user must change input) | size checked from `content-length` before body read and again on bytes; magic bytes over extension | no |
| 3 | Transient Source | accepted source | in-memory buffer | shared | — | — | never written to disk/object storage; never logged | no (memory only, released at end of request) |
| 4 | Extraction | buffer / URL | `ExtractedText` (plain text + page/section count) | shared source adapters (§5) | `AI_SOURCE_UNREADABLE` (parser fail, auth wall, blocked), `AI_SOURCE_EMPTY` (no text) | user "Thử lại" | parser sandboxed with time/size caps; URL fetch through SSRF guard | no |
| 5 | Normalization | `ExtractedText` | `NormalizedSource` (NFC, whitespace collapsed, control chars removed, truncated to 30 000 chars, `fingerprint`) | shared | `AI_SOURCE_EMPTY` if < 40 chars remain | — | phone/DOB/ID patterns are **not** stripped (the model needs context) but can never reach a field (§8) | no |
| 6 | Suggestion Generation | `NormalizedSource`, `TargetSchema`, constraints | `ModelResult` (JSON) | shared model boundary (§9) | `AI_PROVIDER_UNAVAILABLE` (503), `AI_TIMEOUT` (504) | 1 automatic retry on transport error or malformed JSON | content sent only to the configured provider (LEGAL-AI-01) | no |
| 7 | Suggestion Validation | `ModelResult` | `ValidatedSuggestion[]` | shared validator + target adapter | invalid items dropped; all dropped → success with N = 0 | none | allowlist, denylist, domain validator, taxonomy mapping (§8) | no |
| 8 | Suggestion Presentation | `ValidatedSuggestion[]` | response + `AISuggestionRecord` rows `SUGGESTED` | shared service, one DB transaction | DB error → 500, nothing written | client retry with same Idempotency-Key | response carries values for this user only | **yes** (records, §7) |
| 9 | Confirmation / Rejection | user action | record status `CONFIRMED` / `DISCARDED` | target adapter inside the domain write | value mismatch → `DISCARDED` (edited) | idempotent transitions | owner only | yes (status) |
| 10 | Domain Persistence | confirmed values | profile / venture rows | **existing** domain services (`profile.ts`, `venture.ts`) | existing domain errors | existing | existing validation unchanged (DEC-2809-D2) | yes (domain) |
| 11 | Source Cleanup | end of request (success, error, abort) | buffers released; nothing to delete on disk | shared (`finally`) | — | — | no temp files exist to leak | no |
| 12 | Audit / Metrics | stage outcomes | `audit_events` rows; counters | shared via `writeAudit` | audit failure fails the transaction (existing rule) | — | ids, types, counts, field keys only — no values, text, file names or URLs | yes (audit) |

## 5. Source adapters

All adapters implement `extract(source, limits, signal) → ExtractedText` and honour the request's
`AbortSignal` (Cancel).

| Adapter | Accepts | Validation | Extraction boundary | Limits | Failure codes |
|---|---|---|---|---|---|
| `FILE_PDF` | `application/pdf`; magic `%PDF-` | extension `.pdf` **and** magic bytes; declared MIME ignored when bytes disagree | text layer only (no OCR, no images, no JavaScript, no embedded files, no forms) | profile 10 MB / project 20 MB; ≤ 60 pages read; parse ≤ 10 s in a worker thread | `UNSUPPORTED_TYPE`, `TOO_LARGE`, `UNREADABLE` (encrypted, corrupt, timeout), `EMPTY` (scanned deck without text) |
| `FILE_DOCX` | OOXML; magic `PK\x03\x04` + `[Content_Types].xml` + `word/document.xml` | `.docx` only (`.doc`, `.docm`, `.rtf` rejected) | text of `word/document.xml` only; no macros, external relationships, embedded objects | 10 MB; uncompressed total ≤ 30 MB, ≤ 1 000 zip entries, ratio guard (zip bomb) | `UNSUPPORTED_TYPE`, `TOO_LARGE`, `UNREADABLE`, `EMPTY` |
| `PASTED_TEXT` | JSON string | 40 – 30 000 characters after normalization | as given | — | `EMPTY`, `TOO_LARGE` |
| `PUBLIC_WEB_URL` | `http(s)` URL | §10.2 SSRF guard | one GET of that page; HTML → visible text (scripts, styles, `noscript`, comments, hidden elements dropped); `text/plain` as is | 10 s total, ≤ 3 redirects, ≤ 2 MB body, `text/html` or `text/plain` only | `INVALID_URL`, `UNREADABLE` (blocked, auth wall, 4xx/5xx, timeout, wrong type), `EMPTY` |

**URL roles reuse one adapter.** `LINKEDIN_URL`, `PORTFOLIO_URL` and `WEBSITE_URL` are labels on
`PUBLIC_WEB_URL` (stored as `source_type`); none gets special scraping:

| Label | Special handling |
|---|---|
| `LINKEDIN_URL` | Host `linkedin.com` / `*.linkedin.com`. LinkedIn usually answers anonymous requests with a login wall, HTTP 999 or a redirect to `/authwall`; all are `AI_SOURCE_UNREADABLE` with the manual path. **Success is not promised.** No login, cookies, API keys or third-party scrapers |
| `PORTFOLIO_URL` | none |
| `WEBSITE_URL` | none (project) |

**Access restrictions.** One user-initiated GET of the address the user typed, no crawling, no
following of in-page links, no JavaScript rendering. 401, 403, 407, 429, 451, 999, a login form as the
main content, or a captcha page → `AI_SOURCE_UNREADABLE`. The fetcher never retries around a block and
never sends credentials. Whether robots.txt must also be honoured for a single user-requested page is
recorded for LEGAL-AI-01 (Q5); the technical default is to not crawl and not bypass anything.

**Error UX (business fallback B11).** Every failure maps to state 04 Lỗi: "Chưa đọc được hồ sơ" +
Thử lại / Nhập thông tin; the form is untouched.

## 6. Temporary data and retention

| Question | Frozen answer |
|---|---|
| Are uploads written to disk or object storage? | **No.** Bytes are read into memory from `request.formData()`, processed and released in the same request. The avatar store (`MEDIA_STORAGE_DIR`) is not used |
| Can processing be fully transient? | Yes — synchronous design (§4) needs no hand-off between processes |
| Maximum retention of raw source | **0** beyond the request (≤ 45 s in memory) |
| After successful extraction | buffer and text discarded at end of request; only validated suggestion values persist (§7) |
| After cancel | request aborted; no records written (§11); buffers released |
| After failure | nothing persists except an audit row with the error code |
| Raw CV / deck kept? | **Never** |
| Full web page kept? | **Never** |
| `source_fingerprint` | SHA-256 of the normalized text, kept for idempotency (§11); not reversible to content |
| `source_label` (file name or URL host) | kept only while `SUGGESTED`; cleared on `DISCARDED`; kept on `CONFIRMED` for the "từ [tên tệp]" provenance line. Stored as file name (≤ 100 chars) or URL **host only** (never path or query) |
| Unconfirmed suggestion values | `SUGGESTED` rows expire after **24 h** → `DISCARDED`, `suggested_value` and `source_label` nulled. Any new ingestion for the same target discards earlier `SUGGESTED` rows immediately (B6, B12) |
| Confirmed values | kept: they equal what the user saved in their own profile/venture; needed for the AI label (B5) |
| Logs — allowed | request id, account id, target type, source type, byte size bucket, page count, durations, error code, provider status class |
| Logs — never | source text, file name, file bytes, full URL (path/query), prompt, model response, suggested values, phone/DOB/ID matches, provider API key |

Cleanup needs no scheduler: expiry is applied lazily (on each ingestion for the account and on every
read of suggestions) plus a bounded purge helper callable from ops, in the same style as
`purgeExpiredIdempotencyKeys`.

## 7. AISuggestionRecord

One row per suggested field value. New table (migration number assigned at implementation; `015` is
taken by WF04).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK `user_accounts` | owner; every read/write filtered by it |
| `ingestion_id` | uuid | groups the rows of one analysis (for "replace" and "discard all") |
| `target_type` | enum `PROFILE` · `VENTURE` | |
| `target_id` | uuid null | profile id; venture id, or **null** while creating a venture (PRJ1 before the draft exists) |
| `source_type` | enum `FILE_PDF` · `FILE_DOCX` · `PASTED_TEXT` · `LINKEDIN_URL` · `PORTFOLIO_URL` · `WEBSITE_URL` | |
| `source_label` | text null | §6 |
| `source_fingerprint` | text | §6, §11 |
| `field_key` | text | from the target allowlist (§8) only; CHECK constraint |
| `suggested_value` | jsonb null | canonical shape of that field (string, vocab id, array of ids, experience item, link). Null after discard/expiry |
| `match_status` | enum `MATCHED` · `UNMATCHED` | taxonomy fields only (§8.3); `UNMATCHED` rows carry a label and cannot be confirmed as-is |
| `status` | enum `SUGGESTED` · `CONFIRMED` · `DISCARDED` | the three states named by US-01.08 |
| `created_at`, `confirmed_at`, `discarded_at` | timestamptz | |

**Not stored:** raw text, excerpts, prompts, model output, confidence. **Confidence** is not part of
the contract: the business rule (B16) judges presence in the source, and no screen shows a score.

**Lifecycle.**

```
SUGGESTED ──confirm (value saved unchanged)──► CONFIRMED
    │  └─saved with a different value (user edited) ─► DISCARDED
    ├─"Bỏ tất cả gợi ý" / "Tải tệp khác" / new ingestion / 24 h expiry / step left without saving ─► DISCARDED
```

**AI label rule (B5).** A field shows "AI đề xuất" when a `CONFIRMED` record exists for that target and
field **and its value equals the current domain value**. Editing the field later changes the domain
value, so the label disappears without another status. For multi-value fields (domains,
specializations, roles) the rule applies per item.

## 8. Field allowlists and validation

### 8.1 Profile (target `PROFILE`)

Only fields the SOT lists as AI-supported **and** that exist in `PATCH /api/v1/me/profile` /
`PUT /api/v1/me/onboarding/roles`:

| `field_key` | Domain field | Step | SOT basis | Kind |
|---|---|---|---|---|
| `full_name` | `full_name` | 1 | US-01.08 acceptance (họ tên) | text |
| `headline` | `headline` (Vai trò hiện tại) | 1 | US-01.06, US-01.08 | text |
| `location` | `country_id` + `region_id` (Vị trí) | 1 | US-01.08 acceptance | vocab COUNTRY / REGION |
| `bio` | `bio` (Giới thiệu ngắn) | 1 | US-01.06 | text |
| `domain_ids` | `domain_ids` (Lĩnh vực) | 2 | US-01.06, US-01.09 | vocab DOMAIN, multi |
| `specialization_ids` | `specialization_ids` (Chuyên môn) | 2 | US-01.06, US-01.09 | vocab SPECIALIZATION, multi (≤ 5) |
| `experience` | `experience` (Kinh nghiệm nổi bật) | 2 | US-01.06, US-01.09 | list of items |
| `links` | `links` (LinkedIn, Website/Portfolio) | 2 | US-01.06, US-01.09 | list of `{label,url}` |
| `declared_roles` | `roles` of `PUT /me/onboarding/roles` | 3 | US-01.10 | enum of the six role codes |

**Denylist (rejected even if the model returns them):** `phone`, date of birth, any identity-document
field, `avatar` / photo, `email`, `display_name`, `skill_ids` (removed by FB-10), `education`,
`development_goal`, `current_need`, `no_experience_yet`, `hub_claims` (HUB unit/position claims
create membership requests), visibility, consent, onboarding state, any unknown key.

### 8.2 Venture (target `VENTURE`)

| `field_key` | Domain field | SOT basis | Kind |
|---|---|---|---|
| `name` | `name` | FB-15 Tên | text |
| `domain_ids` | `domain_ids` (Lĩnh vực, 1–3 tags) | FB-15, FB-17 | vocab DOMAIN, multi, ≤ 3 |
| `summary` | `summary` (Một dòng mô tả) | FB-15 | text, < 20 words (validated by the AI layer even though the server only hints it today) |
| `stage_id` | `stage_id` (Giai đoạn) | FB-15 | vocab VENTURE_STAGE (IDEA · MVP · PILOT · SELLING · GROWTH) |

**Denylist:** `type` (user picks Dự án / Startup), `region_id`, `owner_role_label`, website, business
code (no such fields), team, status, visibility, any unknown key.

### 8.3 Validation order (every item)

1. JSON schema of the target (strict; unknown keys dropped and counted as `rejected_unknown_field`).
2. Allowlist ∩ not denylist.
3. **Domain validator reuse:** text limits, list limits, URL rules exactly as `profile.ts` /
   `venture.ts` enforce them, so AI limits follow the domain automatically.
4. **Taxonomy mapping** for vocab fields:
   - the prompt carries the selectable items of the needed vocabularies as `{id, label}` lists, and the
     model must answer with ids;
   - the server re-checks every id with `assertSelectable` (exists, active, right type);
   - an id that fails, or an answer given as a label, goes through a deterministic matcher: NFC,
     case-fold, diacritics-insensitive exact match on label or slug among selectable items;
   - one match → `MATCHED` with that id;
   - none or several → `UNMATCHED` with the label only: shown as a hint the user must resolve by
     picking a vocabulary item, never confirmable as free text.
5. Grounding (B16): text values must appear in the source after normalization (token overlap
   threshold for summaries/bios); a value with no support is dropped. Names and URLs need an exact
   substring match.
6. Denylisted patterns inside allowed text (phone numbers, ID numbers, dates of birth) → the value is
   dropped, not redacted-and-kept.

## 9. Model boundary

### 9.1 Interface (provider-neutral)

```ts
interface SuggestionModel {
  generateSuggestions(
    source: NormalizedSource,          // text ≤ 30 000 chars, source_type, language hint
    target: TargetSchema,              // PROFILE | VENTURE JSON schema + vocab id lists
    constraints: { timeoutMs: number; maxOutputTokens: number; signal: AbortSignal },
  ): Promise<ModelResult>              // { fields: Record<field_key, unknown> } — JSON only
}
```

Domain code depends on this interface only; a provider adapter implements it. Selection by env, in the
style of `resendConfigured()`: `AI_PROVIDER` + `AI_PROVIDER_API_KEY` (+ model id). Not configured in
production → the AI block shows state 04 with the manual path (DEC-2809-D2: never blocks).

### 9.2 Output handling

| Case | Behaviour |
|---|---|
| Valid JSON matching schema | §8.3 |
| Malformed / non-JSON / schema mismatch | one retry with the same input; second failure → `AI_SUGGESTION_FAILED` (state 04) |
| Hallucinated field key | dropped (counted) |
| Free text where an id is required | matcher (§8.3 step 4) |
| Empty result | success with N = 0 ("không tìm thấy thông tin phù hợp" copy is a UI decision, Q3) |
| Prompt injection inside the source | the source is passed as data, never instructions; output is still bounded by schema + allowlist + grounding, so injection cannot write outside the allowlist |

### 9.3 Limits

Timeout 25 s per call; ≤ 2 calls per ingestion (1 retry); input capped by the 30 000-character
normalization cap; `maxOutputTokens` bounded per target. Per-account daily quota counted in the DB
(HD-A1 proposes one; size is Q2).

### 9.4 Deterministic stub

`StubSuggestionModel`, active only when dev routes are enabled (`devRoutesEnabled()`), like the dev
email outbox: returns fixture JSON keyed by `source_fingerprint`, plus scripted failure fingerprints
(timeout, malformed JSON, unknown field, invalid stage). Production never selects it.

## 10. Security and privacy

### 10.1 Files

| Control | Rule |
|---|---|
| Size | `content-length` pre-check (as the avatar route) and byte check; 10 MB profile, 20 MB project |
| Type | extension allowlist **and** magic bytes; mismatch → `AI_SOURCE_UNSUPPORTED_TYPE` |
| Malicious content | text extraction only; no rendering, no macro/script execution, no external references; parser in a worker thread with CPU/time caps; zip-bomb guard for DOCX |
| Encrypted PDF | `AI_SOURCE_UNREADABLE` |

### 10.2 URL ingestion — SSRF guard (NEW)

| Control | Rule |
|---|---|
| Scheme / port | `http`, `https`; port 80 / 443 only; no userinfo in URL; ≤ 500 chars (as `linkUrl`) |
| DNS | resolve all A/AAAA; reject if **any** address is loopback, private (RFC 1918), CGNAT `100.64/10`, link-local `169.254/16` (incl. cloud metadata), `0.0.0.0/8`, multicast, broadcast, IPv6 ULA `fc00::/7`, link-local `fe80::/10`, `::1`, IPv4-mapped private |
| Rebinding | connect to the validated IP (pinned) with SNI/Host of the original name |
| Redirects | manual, ≤ 3, each hop re-validated (scheme, port, DNS, IP) |
| Response | ≤ 2 MB streamed with cut-off; `text/html` / `text/plain` only; no cookies stored or sent; fixed User-Agent naming 1hub.network |
| Literal IP hosts | rejected (no reason for a profile or company site to be a bare IP) |
| HTML | parsed to text; nothing rendered or executed; output never echoed as HTML |

### 10.3 Access and data minimisation

| Control | Rule |
|---|---|
| Ownership | every ingestion and suggestion call resolves the session (`resolveSession`) and checks the target belongs to the actor (own profile; venture where actor is owner/editor per existing venture authz) |
| Record access | `AISuggestionRecord` readable/writable only by `account_id`; never in public or team DTOs |
| PII | denylist (§8.1) + pattern drop (§8.3.6); raw text never stored or logged |
| Purpose limitation (B8) | source text is used for one generation and discarded; never reused for another target or for training. The provider must be configured with no-retention / no-training terms — **LEGAL-AI-01** |
| Audit | `AI_SUGGESTION_GENERATED` (target, source type, counts), `AI_SUGGESTION_CONFIRMED`, `AI_SUGGESTION_DISCARDED` (field keys only), `AI_INGESTION_FAILED` (error code) — via `writeAudit`, no values |
| Deletion | account deletion cascades the records (`ON DELETE CASCADE`) |

No compliance certification is claimed.

## 11. Cancel, retry, idempotency

| Event | Behaviour |
|---|---|
| Cancel (Hủy) | client aborts the request (`AbortController`); server observes `request.signal`, stops adapters/model, and checks the signal **before** the write transaction, so no records are written. If the abort races a finished transaction, the rows are `SUGGESTED` only and are discarded by the next ingestion or 24 h expiry — they never reach the domain |
| Retry (Thử lại) | new request, new Idempotency-Key; failures are never cached |
| Upload another source | new ingestion; earlier `SUGGESTED` rows of the same account+target → `DISCARDED` in the same transaction (B6) |
| Re-run same source | same `account + target + source_fingerprint` with live `SUGGESTED` rows (< 24 h) → returns those rows without a model call; explicit "Thử lại" after success forces a new call |
| Browser closed | nothing in the domain (B12); rows expire; on return the form shows no AI values |
| Network retry / duplicate submit | `Idempotency-Key` on the ingestion `POST` (new operation `ai.ingestion.create` in `IDEMPOTENT_OPERATIONS`, stored by `runIdempotent`); same key + same fingerprint → same response |
| Confirm twice | status transitions are idempotent (`CONFIRMED` stays `CONFIRMED`) |

**Confirmation is part of the domain write.** The existing endpoints gain an optional
`ai_suggestions: [{id, field_key}]` list (`PATCH /me/profile`, `PUT /me/onboarding/roles`,
`POST /ventures`, `PATCH /ventures/{id}`). In the same transaction the server saves the domain values
as today and, for each listed record (owned, `SUGGESTED`, same target or venture being created),
marks it `CONFIRMED` if the saved value equals the suggestion, otherwise `DISCARDED`. A
domain-validation failure rolls back both. Cancel therefore can never produce a partial confirmed
change. Step 4 (B14) counts `CONFIRMED` records still equal to current values;
`POST /me/onboarding/complete` requires `ai_reviewed: true` when that count is > 0.

## 12. Test fixtures (deterministic, stub model)

Fixture files live with the tests (synthetic people and companies only); expected model output is a
stub JSON keyed by fingerprint.

| ID | Input | Expected extraction | Expected suggestions | Expected persistence |
|---|---|---|---|---|
| P01 | 2-page text PDF CV (name, title, city, 2 jobs, LinkedIn) | text incl. name/title | full_name, headline, location (MATCHED), experience×2, links | 7 `SUGGESTED` rows; profile unchanged until save |
| P02 | Same CV as DOCX | same text | same as P01 | same |
| P03 | Pasted profile text (≥ 40 chars) | as given | headline, bio, domain_ids | `SUGGESTED` rows only |
| P04 | Local fixture server page (portfolio HTML) | visible text, scripts dropped | headline, links, specialization_ids | `SUGGESTED` |
| P05 | URL answering 999 / redirect to `/authwall`; and a URL resolving to `10.0.0.5` | none | none; `AI_SOURCE_UNREADABLE` / `AI_SOURCE_INVALID_URL` | audit failure row only |
| P06 | 12 MB PDF | blocked before read | none; `AI_SOURCE_TOO_LARGE` | nothing |
| P07 | `.png`, and `.pdf` with PNG bytes | blocked | `AI_SOURCE_UNSUPPORTED_TYPE` | nothing |
| P08 | CV containing phone, DOB, CCCD number; stub also returns `phone` | text | `phone` and pattern-bearing values dropped; others kept | no phone/DOB/ID anywhere |
| P09 | Stub with 5 s delay; client aborts at 1 s | — | none shown | zero rows; profile unchanged |
| P10 | Stub: malformed JSON twice, then success on user retry | — | first request `AI_SUGGESTION_FAILED`; retry returns suggestions | failure: audit only; retry: rows |
| P11 | Confirm `headline` unchanged; edit `bio` before save | — | — | headline `CONFIRMED` (label shown); bio `DISCARDED` (no label); later edit of headline removes label |
| P12 | Ingest, then reload without saving | — | form empty | rows stay `SUGGESTED` → expire; profile fields null |
| J01 | 12-page pitch deck PDF (synthetic startup) | text | name, domain_ids (≤ 3, MATCHED), summary (< 20 words), stage_id | 4 rows, `target_id` null before draft |
| J02 | Local fixture company site | visible text | name, summary, domain_ids | rows |
| J03 | Site answering 403 / captcha; site redirecting to `127.0.0.1` | none | `AI_SOURCE_UNREADABLE` / `AI_SOURCE_INVALID_URL` | nothing |
| J04 | 22 MB PDF | blocked | `AI_SOURCE_TOO_LARGE` | nothing |
| J05 | Truncated / corrupt PDF | parser error | `AI_SOURCE_UNREADABLE` | nothing |
| J06 | Stub returns `stage: "Series A"` | — | `stage_id` `UNMATCHED` (needs user pick) | row `UNMATCHED`, not confirmable as-is |
| J07 | Stub returns `website`, `business_code`, `team` | — | dropped, counted | no such rows |
| J08 | User keeps name + stage, edits summary, creates draft | — | — | name, stage `CONFIRMED`; summary `DISCARDED`; venture has the saved values |
| J09 | "Bỏ tất cả gợi ý" | — | form cleared | all rows `DISCARDED`; no venture created |
| J10 | Same deck twice within 24 h; then duplicate POST with same Idempotency-Key | same fingerprint | second call returns stored rows, no model call; duplicate POST same response | no duplicate rows |

Harness: Vitest unit (adapters, SSRF guard, matcher, validators), Vitest DB (records, transitions,
expiry, ownership), Playwright with `ENABLE_DEV_ROUTES=1` + stub model + a local fixture HTTP server
for URL cases. No test calls a real provider.

## 13. Reuse map

| Area | Existing | Class |
|---|---|---|
| API error envelope `ApiError` | `src/lib/api/errors.ts` | REUSE |
| Error codes (closed list + drift test) | `src/lib/api/error-codes.ts` | EXTEND (`AI_*` codes with a DEC id) |
| Handler `withApi`, request id | `src/lib/api/handler.ts`, `request-id.ts` | REUSE |
| Session / actor / authorize | `src/lib/auth/sessions.ts`, `src/lib/authz/*` | REUSE |
| Idempotency store | `src/lib/api/idempotency.ts`, `src/lib/idempotency/store.ts` | EXTEND (`ai.ingestion.create`) |
| Audit `writeAudit` | `src/lib/audit/audit.ts` | EXTEND (`AI_*` actions) |
| Upload parsing + size pre-check | `src/app/api/v1/me/profile/avatar/route.ts` | REUSE (pattern) |
| Magic-byte sniffing | `src/lib/media/avatar-storage.ts` | EXTEND (PDF, DOCX) |
| Avatar asset store / media route | `avatar-storage.ts`, `src/app/media/assets/[id]` | DO_NOT_USE (ingestion is transient) |
| Outbound fetch pattern (timeout, byte cap) | `src/lib/email/resend.ts`, `src/lib/library/startup-source.ts` | REUSE (pattern) |
| Provider opt-in via env + presence check | `resendConfigured()` | REUSE (pattern) |
| Dev stub pattern | `src/lib/auth/magic-link-email.ts` (dev outbox) | REUSE (pattern for stub model) |
| Rate limit | `src/lib/auth/rate-limit.ts` | EXTEND (pattern; quota must be DB-counted) |
| Profile / venture validators and write paths | `src/lib/profile/profile.ts`, `src/lib/venture/venture.ts` | REUSE (apply target) |
| Vocabulary `assertSelectable` | `src/lib/vocabulary/vocabulary.ts` | REUSE |
| Inert AI blocks (ACC-05/06, PRJ1, labels) | `onboarding/page.tsx`, `profile/basic-form.tsx`, `project-wizard.tsx`, step forms | EXTEND (UI later) |
| Test harness (Vitest unit/DB, Playwright, dev routes) | `vitest*.config.ts`, `tests/visual` | REUSE |
| AI provider client | — | NEW |
| PDF / DOCX parsers | — (no dependency) | NEW (dependency approval) |
| SSRF-guarded fetcher | — | NEW |
| `ai_suggestion_records` table | — | NEW (migration) |
| Background jobs | — | not needed (sync design) |
| Logger with redaction | ad hoc `console.*` | EXTEND (convention: §6 log rules) |

## 14. Future implementation map

```
src/lib/ai-ingestion/
  adapters/      pdf.ts · docx.ts · pasted-text.ts · web-url.ts (+ ssrf-guard.ts)
  normalize.ts   fingerprint, caps
  model/         suggestion-model.ts (interface) · provider-<name>.ts · stub.ts
  targets/       profile-target.ts · venture-target.ts   (schemas, allowlists, apply hooks)
  validate.ts    schema → allowlist → domain validator → taxonomy matcher → grounding
  records.ts     AISuggestionRecord repository, lifecycle, expiry
  service.ts     ingest(): the 12 stages, one transaction for records
src/app/api/v1/ai/ingestions/route.ts      POST (multipart | JSON)
```

| Layer | Owns | Must not |
|---|---|---|
| Shared AI layer | adapters, SSRF guard, normalization, model client, retry, validation pipeline, records, cleanup, audit | know profile/venture field semantics beyond `TargetSchema` |
| Profile target | allowlist §8.1, schema, apply hook in profile PATCH / roles PUT, step-4 count | parse files, fetch URLs, call the model |
| Venture target | allowlist §8.2, schema, apply hook in venture POST/PATCH | same |

Prerequisites outside code: Nginx `client_max_body_size` is **3 MB** today
(`deploy/nginx/1hubnetwork.io.vn.conf:28`) and must allow ~21 MB on the ingestion route; the
OneShield WAF upload limit must be checked; `proxy_read_timeout 60s` fits the 45 s budget.

## 15. Decision matrix

| Decision | Current evidence | Proposed freeze | Needs PO/Thảo? | Blocks implementation? |
|---|---|---|---|---|
| External AI processing allowed (provider, terms, consent) | Privacy v1.0 §5 lists only infrastructure recipients; HD-A1 open | — | **Yes (LEGAL-AI-01)** | **Yes** |
| Q1 Provider choice and credentials | HD-A1 | provider-neutral interface; choice after LEGAL-AI-01 | Yes (with LEGAL-AI-01) | Yes (real provider only) |
| Q2 Daily quota size per account | HD-A1 proposes a quota | DB-counted quota; default proposal 20 ingestions/day | Yes (number) | No |
| Q3 Copy for "0 suggestions" and per-error messages | US-01.08 gives "Chưa đọc được hồ sơ" only | reuse state 04 copy for all failures; 0 results → success with N = 0 | Yes (copy only) | No |
| Q4 Step 4 review: "Tiếp tục" confirms vs step-4 tick | US-01.08 (Tiếp tục = xác nhận) and US-01.12 (tick + "AISuggestionRecord → đã xác nhận") | records become `CONFIRMED` on step save; step-4 tick is a completion gate over those records | Yes (confirm reading) | No |
| Q5 robots.txt for single user-requested page | no SOT | no crawl, no bypass; robots question goes with LEGAL-AI-01 | Yes (legal) | No |
| Unreadable LinkedIn URL | US-01.08 "báo lỗi rõ nếu không đọc được" | `AI_SOURCE_UNREADABLE` → state 04 → manual entry; no scraping workaround | No | No |
| Source retention | B8 "dùng một lần"; HD-A1 "no CV retention" | raw source 0 s after request; unconfirmed values 24 h | No | No |
| Confidence score visibility | not in SOT | not computed, not stored, not shown | No | No |
| Cancellation semantics | B9 | abort before write; races only leave `SUGGESTED` rows | No | No |
| Sync vs async | no queue in repo | synchronous, 45 s budget | No | No |
| Free-text taxonomy (FB-09 / FB-17 "giá trị không có trong gợi ý vẫn thêm được") | server accepts vocab ids only | AI maps to ids; unmatched stays a hint; when free tags land, unmatched follows that feature's rule | No (owned by FB-09/FB-17) | No |
| Venture website / business code | no columns | not mapped by AI | No (separate task) | No |
| Text limits drift (UAT: name ≤ 100, headline ≤ 120, bio ≤ 500; server 200/200/2000) | `profile.ts` `TEXT_LIMITS` | AI validates with the domain validator, so it follows whichever limits the domain enforces | No (owned by FB tasks) | No |
| Stage labels (UAT: Ý tưởng · Prototype · Pilot · Đang bán · Đã mở rộng; repo: IDEA · MVP · PILOT · SELLING · GROWTH) | migration 012 | AI maps to `VENTURE_STAGE` ids; labels owned elsewhere | No | No |
| Parser libraries | none in repo | text-layer PDF parser + DOCX XML extraction, pure JS, run in worker | No (dependency approval at implementation) | Yes (approval) |
| Upload size at the edge | Nginx 3 MB | raise for the ingestion route only | No (deploy change) | Yes (deploy) |

## 16. Non-goals

- No implementation, migration, dependency, route, UI or config change in this task.
- No change to Privacy Policy or Terms; no consent wording (LEGAL-AI-01).
- No new Venture fields; no taxonomy curation; no free-text tags.
- No OCR, crawling, JavaScript rendering, login-wall bypass or third-party scraping service.
- No AI for photos, phone, date of birth, identity documents, HUB positions or memberships.
- No automatic save, publish, venture creation or onboarding completion by AI.
- No confidence scores, model fine-tuning or reuse of user content for training.
- No compliance certification claims.

## Related

- [DECISION_LOG — DEC-2809-D2](../decisions/DECISION_LOG.md#dec-2809-d2) · [DEC-L1R-D7](../decisions/DECISION_LOG.md#dec-l1r-d7) · [DEC-L2R-D11](../decisions/DECISION_LOG.md#dec-l2r-d11)
- [scope-refreeze/human-decisions.md](../design-revision/scope-refreeze/human-decisions.md) (HD-A1) · [backend-deltas.md](../design-revision/scope-refreeze/backend-deltas.md) (BD-12)
- [05_API_CONTRACT_P0_v1.0.md](../architecture/05_API_CONTRACT_P0_v1.0.md) — error envelope, idempotency
- Privacy Policy v1.0: `content/legal/PRIVACY_DATA_PROCESSING.v1.0.md`
