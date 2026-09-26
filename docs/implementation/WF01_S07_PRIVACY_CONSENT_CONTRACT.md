# WF01 S07 Privacy Consent Contract

**Status: HUMAN APPROVED — P0** (2026-09-26). The audit's open questions H1–H8 were resolved as [DEC-WF01-S07-D1..D8](../decisions/DECISION_LOG.md#dec-wf01-s07-d1). This contract is implemented by WF01-S07.

**Release blocker `PRODUCTION_LEGAL_CONTENT_REQUIRED`:** real Terms and Privacy text and versions are release content. Locally, clearly marked non-production fixtures are served (`content/legal-fixtures`). No placeholder prose ships as policy.

## A. Legal controls

| UI control | Consent type | Required | API | Storage | Version source |
|---|---|---|---|---|---|
| "Tôi đồng ý với [Điều khoản sử dụng] và [Chính sách quyền riêng tư]." (one checkbox, [D1](../decisions/DECISION_LOG.md#dec-wf01-s07-d1)) | TERMS_ACCEPTANCE | Yes | `POST /me/consents/accept` + `Idempotency-Key` | own `consent_records` row | `GET /legal/current` |
| (same checkbox) | PRIVACY_DATA_PROCESSING | Yes | a separate call | own row | same |
| Links | — | — | `content_url` → `/legal/{kind}/{version}` | `legal_documents.content_uri`; text from `LEGAL_CONTENT_DIR` | server |

## B. Visibility controls

| UI control | Group code | Fields | Allowed levels | Default | Storage |
|---|---|---|---|---|---|
| "Hiện thẻ của tôi trong Thư viện" ([D2](../decisions/DECISION_LOG.md#dec-wf01-s07-d2)) | `PROFILE_DISCOVERY` | display_name, avatar, headline, bio, domain | ON = NETWORK_ONLY, OFF = PRIVATE | NETWORK_ONLY ([D4](../decisions/DECISION_LOG.md#dec-wf01-s07-d4)) | `profile_visibility_settings`: `default_level` + `group_overrides {"PROFILE_DISCOVERY":"PRIVATE"}` only when OFF |
| Investor, challenge-owner and recruitment toggles | — | — | — | — | not rendered ([D3](../decisions/DECISION_LOG.md#dec-wf01-s07-d3)) |
| Card preview | read-only | avatar, name, headline · region, domain chips | — | — | read model |

## 1. Consent rules

- **Two records.** One acknowledgement makes two accept calls, one per current document, each with its own `Idempotency-Key` that is reused on retry. Documents already accepted are skipped.
- **No duplicates.** UNIQUE (account, type, document); a repeat returns the existing record with 200. A new record returns 201 with a server timestamp and writes `CONSENT_ACCEPTED` (after: type and version only).
- **Stale version.** A version that is not current → `409 LEGAL_DOCUMENT_VERSION_STALE`. The client reloads the documents, clears the checkbox and asks again ([D8](../decisions/DECISION_LOG.md#dec-wf01-s07-d8)). An unknown type → 404.
- **Satisfied.** Satisfied means both CURRENT documents (matched by document id) have a live acceptance. History is never deleted. No revoke UI in S07.
- **DTO.** `{id, type, policy_version, status, accepted_at, revoked_at}`. No metadata, account or document ids.

## 2. Visibility rules

- `PUT /me/visibility` acts on the session's own profile only; a body `profile_id` is ignored.
- Only `PROFILE_DISCOVERY` with NETWORK_ONLY or PRIVATE is accepted. Anything else → `422 VISIBILITY_VALIDATION_FAILED`.
- Each real change writes `PROFILE_VISIBILITY_CHANGED` (before/after levels). A no-op writes nothing.
- Consent is never touched by visibility, and vice versa.

## 3. Defaults

- No settings row means NETWORK_ONLY.
- An override is stored only when it departs from the default.
- The bitmap's ON/OFF states were not treated as defaults.

## 4. Revisit / version change

- **Revisit.** A satisfied state shows the checkbox checked and disabled; nothing is re-sent.
- **Version race while on S07.** Handled by D8.
- **Version change after onboarding.** Handled by WF02-S03 (`/me/privacy`), not S07.

## 5. Avatar / media visibility

`/media/assets/:id` ([D5](../decisions/DECISION_LOG.md#dec-wf01-s07-d5)):

| Who | Access |
|---|---|
| Owner | Always |
| Another signed-in account | Only if the asset is the owner's current avatar and PROFILE_DISCOVERY is NETWORK_ONLY or wider |
| PRIVATE discovery, guests, unknown ids | The same 404 |

Headers are `private, no-store`.

## 6. Lifecycle

S07 writes consent and visibility only; the profile stays DRAFT and `onboarding_completed_at` stays NULL. Success → `/onboarding/complete`. S08 `POST /me/onboarding/complete` owns completion and activation.

## 7. API / DB gaps

| Item | Status |
|---|---|
| Group codes (G1) | Resolved by D2 (one P0 group) |
| Purpose codes (G2), P7 | Not needed in P0 (D3); P7 stays open |
| Error codes (G3) | Resolved by D8 (`DECISION_ERROR_CODES`) |
| Legal content route (G4) | Implemented; production text is a release blocker |
| Schema | **No migration.** P8's per-group-rows question remains open for later |

## 8. Open notes (not blocking)

1. **Region vs D2.** The approved card copy and preview include region ("tỉnh"), but D2's field list does not. The preview is owner-only and no projection exists yet; confirm before `/profiles/{id}`.
2. **Invented copy.** The acknowledgement, error and stale messages have no approved bitmap and need copy review.
3. **Re-accept after withdrawal.** UNIQUE (account, type, document) blocks re-accepting the same version after a withdrawal (P7). This is WF02-S03 scope.

## Related

- [DECISION_LOG.md](../decisions/DECISION_LOG.md) — decision records
- [WF01_S06_PROFILE_FIELD_CONTRACT.md](WF01_S06_PROFILE_FIELD_CONTRACT.md) — previous step contract
- [DB_SCHEMA_GAPS_P0.md](DB_SCHEMA_GAPS_P0.md) — P7, P8
- [P0_STATUS.md](P0_STATUS.md) — overall P0 state
