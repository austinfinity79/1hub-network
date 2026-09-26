# WF01 S06 Profile Field Contract

**Status: HUMAN APPROVED — P0** (2026-09-26). The audit's open questions H1–H6 were resolved as [DEC-WF01-S06-D1..D6](../decisions/DECISION_LOG.md#dec-wf01-s06-d1). This contract is implemented by WF01-S06.

Sources:
- Freeze = `00_DATA_DECISIONS_FREEZE_v1.1.md`
- API = `05_API_CONTRACT_P0_v1.0.md`
- DB = `001_p0_init.sql`
- Ref = `WF01-S06__onboarding-profile__1440x900.png`

## Field mapping

| UI field | Canonical field | API | Storage | Required S06 | Completion group | Validation | Decision |
|---|---|---|---|---|---|---|---|
| Ảnh đại diện · "Tải ảnh" | avatar | `POST /me/profile/avatar` (multipart part `file`) → `{asset_id, url}` | `avatar_asset_id` (opaque id); bytes in private media storage | No | 2 AVATAR | PNG/JPEG/WebP by content; ≤ 2 MiB (provisional technical config) | [D3](../decisions/DECISION_LOG.md#dec-wf01-s06-d3) |
| Họ và tên | display_name | `display_name` | `individual_profiles.display_name` | **Yes** | 1 DISPLAY_NAME | non-empty after trim; ≤ 200 (technical bound) | [D2](../decisions/DECISION_LOG.md#dec-wf01-s06-d2) |
| Chức danh hiện tại | headline | `headline` | `individual_profiles.headline` | **Yes** | 3 HEADLINE | free text; non-empty after trim; ≤ 200 | D2 |
| Tỉnh / thành phố | region | `region_id` (write); `region{id,label,status}` (read) | `region_vocab_id` | **Yes** | 4 REGION | ACTIVE `REGION` item for a new value | D2 |
| Giới thiệu ngắn | bio | `bio` | `individual_profiles.bio` | No | 5 BIO | ≤ 2000 (technical bound) | D2 |
| Chuyên môn · chọn tối đa 5 | domains + skills | `domain_ids[]`, `skill_ids[]` | `profile_domains`, `profile_skills` | **≥ 1** | 6 DOMAIN, 7 SKILLS | ACTIVE, right type; total ≤ 5 | [D1](../decisions/DECISION_LOG.md#dec-wf01-s06-d1), [D4](../decisions/DECISION_LOG.md#dec-wf01-s06-d4) |

**Controls:**
- "Quay lại" goes back to S05 and writes nothing.
- "Tiếp tục" saves with PATCH, then goes to S07.
- No skip action: [D5](../decisions/DECISION_LOG.md#dec-wf01-s06-d5).
- No other field is rendered.

## 1. Completion rules

**One service:** `src/lib/profile/completion.ts`, used by `/session`, `/me/profile` and `/me/profile/completion`. There are 10 groups at 10 points each, in the frozen order. HEADLINE is group 3; NETWORK_CONTEXT is **RESOLVED_BY_PRECEDENCE** and not a group.

| Group | Complete when |
|---|---|
| AVATAR | The stored asset exists and is owned by the account |
| REGION, DOMAIN, SKILLS | A linked item of the right type exists; archived items count |
| EXPERIENCE | ≥ 1 record OR `no_experience_yet` |
| Other groups | Non-empty after trim |

Intent, membership, leadership, consent and visibility never count. A client `completion_percent` is refused with 422.

## 2. Vocabulary rules

| Rule | Implementation |
|---|---|
| Endpoint | `GET /vocabularies/{REGION\|DOMAIN\|SKILL}` with `q`, `status` (default ACTIVE), `cursor` and `limit`. Unknown type → 404 |
| No hard-coded lists | The picker is rendered from the database; the "+ N" count is computed |
| New selection | ACTIVE only; otherwise 422 `VOCABULARY_ITEM_INACTIVE` |
| Wrong type, unknown or malformed id | 422 `PROFILE_VALIDATION_FAILED` |
| Archived link | Readable, shown selected, may be kept; never offered anew |
| OTHER | Not offered |

## 3. Avatar rules

| Rule | Implementation |
|---|---|
| Stored | Only `avatar_asset_id` on the profile. The URL `/media/assets/:id` is derived, never stored |
| Served | To signed-in sessions only, `private, no-store`, `nosniff`; guests get 404 |
| Config | `MEDIA_STORAGE_DIR`, `MEDIA_AVATAR_MAX_BYTES` (`.env.example`) |
| Schema | No table or migration. DB gap P9 (`file_assets`) stays open for later media needs |

## 4. Lifecycle rules

S06 save ≠ onboarding completion ≠ profile activation.

- After S06 the profile stays DRAFT and `onboarding_completed_at` stays NULL.
- `current_step` becomes PRIVACY once the D2 fields are saved.
- Activation (valid account, name, region, Terms/Privacy) stays at S08, `POST /me/onboarding/complete`.
- PATCH refuses `status` and every other non-S06 field.

## 5. Contract conflicts / gaps

| Item | Status |
|---|---|
| NETWORK_CONTEXT vs HEADLINE | RESOLVED_BY_PRECEDENCE |
| `headline` absent from the API examples | Implemented as `headline` (Freeze group 3, DB column) |
| Multipart part name not frozen | `file`, documented |
| `file_assets` (P9) | Not needed for S06 (D3); stays open |
| Text length limits not frozen | Provisional technical bounds only |

## 6. Human decisions

None open for S06. D1–D6 are frozen.

## Related

- [DECISION_LOG.md](../decisions/DECISION_LOG.md) — decision records
- [WF01_S05_INTENT_CONTRACT_GAP.md](WF01_S05_INTENT_CONTRACT_GAP.md) — previous step contract
- [DB_SCHEMA_GAPS_P0.md](DB_SCHEMA_GAPS_P0.md) — P9 `file_assets`
- [P0_STATUS.md](P0_STATUS.md) — overall P0 state
