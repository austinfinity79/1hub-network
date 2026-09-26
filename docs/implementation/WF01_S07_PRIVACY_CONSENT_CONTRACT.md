# WF01 S07 Privacy Consent Contract

**Status: HUMAN DECISION REQUIRED** (audit only, 2026-09-26). No DB, API or runtime code was changed.

Sources:
- Freeze = `00_DATA_DECISIONS_FREEZE_v1.1.md`
- SOT = `1HUB_DATA_SOT_v1.1.md`
- API = `05_API_CONTRACT_P0_v1.0.md`
- ARCH04 = `04_FRONTEND_API_DATA_ARCHITECTURE`
- SCR = Screen Contracts
- Ref = `WF01-S07__onboarding-privacy__1440x900.png`

**What the reference shows:**
- a header skip link;
- the lede;
- four purpose toggles;
- a read-only preview of the public card;
- the controls "Quay lại", "Bước 3 trong 3 · đổi lại bất cứ lúc nào ở Quyền riêng tư" and "Xong, vào HUB".

**No Terms or Privacy checkbox, link or acknowledgement is visible.**

## A. Legal controls

| UI control | Consent type | Required | API | Storage | Version source |
|---|---|---|---|---|---|
| **None in the reference** (SCR requires `accept_required_legal`) | TERMS_ACCEPTANCE | Yes, activation (Freeze:116; API:469-490) | `POST /me/consents/accept` + `Idempotency-Key` (API:48-63, 411-422) | `consent_records` row → `legal_documents` | `GET /legal/current`: `legal_documents` with `effective_at ≤ now`, not retired (seed `p0-2026-09`) |
| **None in the reference** | PRIVACY_DATA_PROCESSING | Yes | same, a separate call | a separate row | same |

## B. Visibility / purpose controls

| UI control (bitmap state) | Group code | Fields | Allowed levels | Default | Storage |
|---|---|---|---|---|---|
| "Hiện thẻ của tôi trong Thư viện" (ON); copy: name, photo, headline, province, expertise; "Google tìm thấy"; "Tắt thì không ai tìm ra bạn" | **not frozen** (closest example: `BASIC_PUBLIC`) | the copy lists avatar, display_name, headline, region, expertise; the preview shows domain chips only | ON → PUBLIC is implied; **OFF level not frozen** | not frozen (SOT baseline: name/bio/headline/field PUBLIC) | `profile_visibility_settings.group_overrides` (jsonb) |
| "Cho quỹ đầu tư liên hệ" (ON) | none: investor purpose | full profile + connection proposals | — | — | none. **Future scope** (Freeze D4 excludes investor grants; WF02 non-goal; DEC-WF01-S05-D1) |
| "Cho đơn vị đặt bài toán liên hệ" (ON) | none: purpose consent with a recipient class | contact by challenge owners | — | — | no purpose code; `consent_type` has only the 2 legal types (DB gap P7) |
| "Cho mục đích tuyển dụng" (OFF); "email … 'ẩn'" | none (`CONTACT` example?) | email for recruitment | — | — | no purpose code (P7); email is PRIVATE per SOT |
| Card preview (read-only) | — | avatar, name, headline · region, domain chips | — | — | read model only |

**Group codes.** `BASIC_PUBLIC`, `SKILLS_EXPERIENCE` and `CONTACT` (API:436-457) are **examples, not frozen codes**. ARCH04 C4 names `profile_group_code` without a list, and DB gap P8 records that "group code list never frozen". This is a **VISIBILITY GROUP CONTRACT GAP**. No group may be invented.

## 1. Consent rules

- **Two records, never a boolean.** Terms and Privacy are separate `consent_records` rows (UNIQUE `account_id, consent_type, legal_document_id`). One UI acknowledgement would still make two accept calls. A partial failure is retry-safe through the idempotency store and the UNIQUE constraint.
- **Version is server-authoritative.** The client echoes `policy_version` from `/legal/current`; the server resolves the current document. A stale or unknown version must be refused, **but no error code is frozen for it** (API gap G3).
- **Duplicate accept.** Replay through `runIdempotent`; the missing-header policy is lenient (IDEMPOTENCY I5). The UNIQUE constraint still prevents a second row.
- **Audit.** `audit_events` exists (actor, action, resource, before/after, request_id), but no audit writer exists in code yet. S07 adds one, with no schema change.
- **Revocation.** S07 exposes none. Terms cannot be revoked while the service is used (API:424). Privacy revocation is WF02-S03.
- **DTO.** `ConsentRecordDTO` returns `status` (derived from `withdrawn_at`) and `policy_version`; raw `metadata` and internal ids never leave the server.
- **Reading the document.** No "must open/scroll" rule is frozen, so none is added. `content_url` (`/legal/terms/<v>`) has no route yet (G4).

## 2. Visibility rules

- Consent ≠ visibility: no single control may write both.
- `PUT /me/visibility` is owner-only (the session profile). The server validates group and level against a P0 allowlist, **which does not exist yet** (G1). Each change is audited.
- S07 exposes only what the approved design shows, and only once its group and levels are frozen (H2).

## 3. Defaults

- **Storage default.** DB `default_level = NETWORK_ONLY` and `group_overrides = {}`; no row exists until the first write.
- **Screenshot states are not defaults.** The bitmap's ON/ON/ON/OFF is example state, not source evidence.
- **SOT baseline.** Name, bio, headline and field are PUBLIC; detailed skills and experience are NETWORK_ONLY; email and phone are PRIVATE. It is not frozen as a per-group runtime default (H4).

## 4. Revisit / version change

- **Revisit before completion.** Read `/me/consents` and `/me/visibility`, show the accepted state, and create no duplicate row.
- **New legal version.** A new `legal_documents` row becomes current, so the stored acceptance no longer satisfies activation. The re-acceptance flow after onboarding is **not frozen**; it is outside S07 (H8).

## 5. Avatar / media visibility

| Question | Finding |
|---|---|
| Current behaviour | `/media/assets/:id` serves any signed-in session and returns 404 to guests; ids are 128-bit random |
| Group | Not frozen. The SOT baseline does not list avatar; the S07 card copy includes "ảnh" in the public card |
| Bypass risk | None today: no endpoint exposes another user's asset id. **Once `/profiles/{id}` exposes avatars**, a signed-in user holding the id could still fetch it after the owner restricts visibility, and guests could never see a PUBLIC card's photo |
| Enforceable? | Yes: the sidecar holds `owner_account_id`, so authorisation can derive owner → profile → group level |

**AVATAR VISIBILITY DECISION REQUIRED (H5).** This does not block S06. It must be resolved before public/network profile projection.

## 6. Lifecycle

S07 writes consents and visibility only. The profile stays DRAFT and no onboarding completion happens. S08 `POST /me/onboarding/complete` checks the account, name, region and both current acceptances, then sets ACTIVE; otherwise it returns `ONBOARDING_REQUIREMENTS_MISSING`.

The `current_step` code after S07 is an implementation detail (WF01 order), not a new status.

## 7. API / DB gaps

| ID | Type | Gap |
|---|---|---|
| G1 | API + DB P8 | Visibility group codes and allowed levels are not frozen; storage shape (jsonb vs per-group rows) undecided |
| G2 | API + DB P7 | "Privacy-by-purpose" (SCR `set_visibility_by_purpose`) has no purpose codes; `consent_type` has no purpose values; `consent_records` lacks purpose, recipient, scope, status and expiry |
| G3 | API | No error code for a stale or unknown `policy_version` on accept, or for an invalid visibility group/level |
| G4 | API/route | `content_url` legal pages have no route or content source |
| DB | — | Legal acceptance needs **no migration**. Purposes (P7) and per-group rows (P8) would |

## 8. Human decisions required

| ID | Decision |
|---|---|
| H1 | **Legal acceptance UI:** the reference has none. Choose separate checkboxes with links, one acknowledgement creating two records, or acceptance on the CTA. Each needs approved copy and placement. **Blocking** |
| H2 | "Thư viện" card toggle: group code, fields (avatar? skills?), and the ON/OFF levels |
| H3 | Investor, challenge-owner and recruitment toggles: not rendered in P0 (INTENTIONAL-P0-SCOPE), or define purpose codes plus a P7 migration |
| H4 | Default level per group for new profiles |
| H5 | Avatar visibility: its group, whether media authorisation derives from it, and guest access for a PUBLIC card |
| H6 | Header skip on S07: omit (as DEC-WF01-S06-D5; skip would bypass required legal) or not |
| H7 | Lede copy contains a literal `**mục đích**`: render bold or as literal text |
| H8 | Error codes for G3 (contract amendment vs `UNCONTRACTED_*`), and the post-onboarding re-acceptance flow |

## 9. Security / privacy test plan (for implementation)

| Area | Tests |
|---|---|
| Access | guest → `/auth` and 401 on the APIs |
| Legal documents | loaded server-side; stale or tampered version refused |
| Consent | two separate rows; duplicate is idempotent; S08 refuses when either is missing |
| Visibility | unknown group rejected; invalid group/level rejected; another profile cannot be changed (session only) |
| Audit | one event per consent accept and per visibility change |
| DTOs | no email, phone, raw consent metadata or internal ids |
| Avatar | covered by H5 tests once decided |

## Related

- [WF01_S06_PROFILE_FIELD_CONTRACT.md](WF01_S06_PROFILE_FIELD_CONTRACT.md) — previous step contract
- [DB_SCHEMA_GAPS_P0.md](DB_SCHEMA_GAPS_P0.md) — P7, P8
- [IDEMPOTENCY_STORE_P0.md](IDEMPOTENCY_STORE_P0.md) — idempotency policy
- [DECISION_LOG.md](../decisions/DECISION_LOG.md) — decision records
