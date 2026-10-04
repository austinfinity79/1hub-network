# ADMIN-PROD-04-venture-review

**ADMIN-PROD-04 — Venture review + organization delegation APIs (IMPLEMENT, no frontend).** Evidence 1 – 12, 23 (venture side). Contract: [05 §27, A10](../../architecture/05_API_CONTRACT_P0_v1.0.md) · rules [DEC-ADM-R7…R11](../../decisions/DECISION_LOG.md#dec-adm-r7). Companions: [delegation](ADMIN-PROD-04-delegation.md) · [QA](ADMIN-PROD-04-qa.md) · [PROD-05 handoff](ADMIN-PROD-04-prod05-handoff.md).

## 1. Preflight
`feat/admin-portal` at `ad4f47d` (ADMIN-PROD-03), migration 017 present, tree clean except `AGENTS.md`, HEAD unchanged until the commit; origin/main and production `78f21f2`; no other branch holds venture review code (the only matches elsewhere are `organizations.logo_asset_id` of 001); S1-UAT-06 has no code.

## 2. Lifecycle (PD-2)
| From | To | By |
|---|---|---|
| DRAFT (complete) | PENDING_REVIEW (FIRST_PUBLISH review) | owner, `submitVentureForReview` ("Gửi duyệt") |
| PENDING_REVIEW | PUBLIC (ACTIVE / PUBLIC, same row) | PLATFORM_ADMIN approve |
| PENDING_REVIEW | REJECTED (reason optional) | PLATFORM_ADMIN reject |
| REJECTED | PENDING_REVIEW (a new review, `…_RESUBMITTED`) | owner edits and resubmits |
| PUBLIC + core change | PUBLIC with a pending CORE_CHANGE review | owner / EDIT member, `saveVentureCore` |
States are derived (`ventureReviewState`) from the row and its latest review; no investment / quality scoring.

## 3. Queue — `GET /ops/venture-reviews`
PLATFORM_ADMIN only (C1; no leader scope invented); others 403. Filters `status` (default PENDING), `kind`, `venture_id`, keyset `cursor`, `limit` 1 – 50; bad values 422. Item: review id, kind, status, version, live venture (id, type, name, status, visibility), proposed name, `changed_fields`, owner (discovery name), submitted / reviewed times, `can_act`; `counts.pending`.

## 4. Detail — `GET …/{reviewId}`
`public_version` (null before the first publication), `proposed`, `diff [{field, before, after}]`, vocabulary labels, `logo {public, proposed}` (asset id, URL, type, size), owner identity through PROFILE_DISCOVERY (name, headline; no e-mail, phone, full name, account id), reject reason, reviewer, history (by OWNER / TEAM / REVIEWER / SYSTEM), previous reviews of the venture. Non-reviewers and unknown ids 404.

## 5. Public-version behaviour
`projects` is the approved version and the only thing the Library reads. A core save on a PUBLIC venture opens a CORE_CHANGE review with the candidate in `venture_reviews.proposed`; the public row, its listing and its search text stay unchanged (test: the Library shows the approved name, never the candidate); approval replaces the values on the same row. The profile never disappears during re-review.

## 6. Approve — `POST …/approve` `{ version }`
Before any transaction: a reviewer who owns or is an ACTIVE member of the venture → 403, audited. Then: venture row locked, review row locked (order venture → review, as every owner save), PENDING + version (409), reviewer grant re-read FOR SHARE, venture not ARCHIVED, candidate readable, proposed logo still stored (409) → candidate written onto the same id (core fields, sectors replaced); FIRST_PUBLISH → ACTIVE / PUBLIC (+ `VENTURE_PUBLISHED` on the venture) → review APPROVED, reviewer, time, version + 1 → `VENTURE_REVIEW_APPROVED` → owner notice. No new venture row.

## 7. Reject — `POST …/reject` `{ version, reason? }`
Same checks; reason optional (trimmed, ≤ 500); live row untouched; review REJECTED, kept; `VENTURE_REVIEW_REJECTED` with the reason; owner notice.

## 8. Edit while pending (R8)
One PENDING review per venture (`uq_venture_reviews_pending`). A save while pending rewrites its candidate and bumps `version` (`VENTURE_REVIEW_UPDATED`); for a first publication the private draft row follows too, so a rejection loses no edit (a public row never changes before approval); the reviewer always decides the latest one — a decision with an older version is 409, so an earlier snapshot is never published. Race (tested both ways): edit first → the approval with version 1 is refused, nothing goes live; approval first → the next save opens a new review on the new live values.

## 9. Core-field detection
Frozen set (ADMIN-PROD-01 C2): name, summary (one-line description), domain_ids (sector), stage_id, region_id, website, logo_asset_id, owner_role_label. Team membership is private, not core. Comparison on normalised values (trim, id case, domain order): `UNCHANGED` for no real change; a private draft is written directly (`APPLIED`).

## 10. Website (PD-3)
http / https only, ≤ 500 before **and after** normalisation (percent-encoding can lengthen it), host with a dot, no credentials, normalised by the URL parser (`https://Startup.Example/a b` → `https://startup.example/a%20b`); `javascript:`, `data:`, `file:`, `ftp:`, `localhost` refused (422). Stored and displayed only: no fetch, no SSRF surface.

## 11. Logo (PD-3, R9)
`logo_asset_id` of the existing media store (as avatars): the asset exists, was uploaded by the editor or the owner, is not anyone's current avatar (the avatar flow deletes a replaced avatar's file), is PNG / JPEG / WebP (store policy; the UAT's SVG is not accepted by the store), ≤ 2 MB, bytes present; a URL or a foreign / oversize / unknown asset → 422; a logo removed before approval → 409. Reviewers may fetch a referenced logo at `/media/assets/{id}` (checked only after the unchanged avatar rule refuses); nobody else gains access. Logo upload itself is S1-UAT-06's (a logo-specific upload, not the avatar one).

## 12. No business registration
No tax code / registration column in `projects` or `venture_reviews`; `tax_code`, `business_registration`, `registration_number`, `ma_so_doanh_nghiep` refused by the parser (422 `not_accepted`); the candidate snapshot has exactly the core keys + `schema_version` (tests).

## 23. S1-UAT-06 boundary
S1-UAT-06 owns the owner UI and wiring: `POST /ventures/{id}/publish` → `submitVentureForReview`; `PATCH /ventures/{id}` core fields → `saveVentureCore`; logo upload into the media store; withdraw (PENDING → WITHDRAWN); the owner's pending view. ADMIN-PROD-04 owns processing. One table, one writer pair, no second review model. **Gap today:** WF02 `publishVenture` / `updateVenture` (`src/lib/venture/venture.ts`) still self-publish and edit the live row (DEC-PDF-D1) until that cut-over.

## Related
- [ADMIN-PROD-04-delegation.md](ADMIN-PROD-04-delegation.md) · [ADMIN-PROD-04-qa.md](ADMIN-PROD-04-qa.md) · [ADMIN-PROD-04-prod05-handoff.md](ADMIN-PROD-04-prod05-handoff.md) · [ADMIN-PROD-03-prod04-handoff.md](ADMIN-PROD-03-prod04-handoff.md)
