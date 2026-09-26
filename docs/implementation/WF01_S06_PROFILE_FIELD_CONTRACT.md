# WF01 S06 Profile Field Contract

**Status: HUMAN DECISION REQUIRED** (audit only, 2026-09-26). No DB, API or runtime code was changed.

Sources:
- Freeze = `00_DATA_DECISIONS_FREEZE_v1.1.md`
- SOT = `1HUB_DATA_SOT_v1.1.md`
- API = `05_API_CONTRACT_P0_v1.0.md`
- DB = `001_p0_init.sql`
- WF01 = WF01 workflow contract
- Ref = `WF01-S06__onboarding-profile__1440x900.png`

## Field mapping

The reference shows six editable fields; its lede reads "Sáu trường".

| UI field | Canonical field | API | Storage | Required S06 | Completion group | Validation | Decision |
|---|---|---|---|---|---|---|---|
| Ảnh đại diện · "Tải ảnh" | avatar | `POST /me/profile/avatar` (multipart) → `asset_id`; profile read `avatar{asset_id,url}` | `individual_profiles.avatar_asset_id` (text); **no `file_assets` table** | No (lede: "Ảnh … để trống được") | 2 AVATAR | type/size limits not frozen (technical config) | Mapped; **blocked by DB/infra gap G2** |
| Họ và tên | display_name | `display_name` | `individual_profiles.display_name` | See H2 | 1 DISPLAY_NAME | non-empty after trim; max length not frozen | Mapped |
| Chức danh hiện tại | headline | `headline` (G1) | `individual_profiles.headline` | See H2 | 3 HEADLINE | free text, non-empty after trim; no taxonomy | Mapped (D2 approved) |
| Tỉnh / thành phố (select) | region | write `region_id`; read `region{id,label}` | `individual_profiles.region_vocab_id` → `vocabulary_items` | See H2 | 4 REGION | an ACTIVE `REGION` item ID only | Mapped (D3) |
| Giới thiệu ngắn (textarea) | bio | `bio` | `individual_profiles.bio` | No (lede: "giới thiệu để trống được") | 5 BIO | max length not frozen | Mapped |
| Chuyên môn · chọn tối đa 5 (chips, "+ 42 nhóm khác") | **domains or skills?** | `domain_ids[]` or `skill_ids[]` | `profile_domains` or `profile_skills` | See H2 | 6 DOMAIN or 7 SKILLS | ACTIVE item IDs of ONE type; max 5 (H4) | **Ambiguous: H1** |

**Controls that are not fields:**
- "Quay lại" goes back to S05.
- "Tiếp tục" saves and moves to S07.
- The header "Bỏ qua, làm sau" needs a decision (H5).
- "Bước 2 trong 3" is static.

**Canonical fields not visible, so not implemented in S06:** experience, `no_experience_yet`, development_goal, current_need, education, links.

## 1. Completion rules

**Groups.** Freeze D3 defines 10 groups × 10%:

| # | Group | Evidence in DB |
|---|---|---|
| 1 | DISPLAY_NAME | `display_name` |
| 2 | AVATAR | `avatar_asset_id`, validity not checkable (G2) |
| 3 | HEADLINE | `headline` |
| 4 | REGION | `region_vocab_id` |
| 5 | BIO | `bio` |
| 6 | DOMAIN | `profile_domains` |
| 7 | SKILLS | `profile_skills` |
| 8 | EXPERIENCE | `profile_experience` ≥1 OR `no_experience_yet` |
| 9 | DEVELOPMENT_GOAL | `development_goal` |
| 10 | CURRENT_NEED | `current_need` |

**Precedence.** `NETWORK_CONTEXT` (API:348) is **RESOLVED_BY_PRECEDENCE**. It is not a P0 group, because the Freeze (priority 4) outranks the API example (priority 6). Group 3 is HEADLINE (Freeze:100). This is not a new decision.

**Schema.** The schema holds a column or relation for every group. **Missing service logic:**
- no completion calculator exists;
- `/session` returns a placeholder `completion_percent: 0` (`session/route.ts:81`);
- `GET/PATCH /me/profile` and `GET /me/profile/completion` are not built.

The server computes the score; the client never submits a percent (API:329-331). An ARCHIVED region, domain or skill already linked still counts (Freeze:209).

## 2. Vocabulary rules

| Rule | Status |
|---|---|
| Endpoint | `GET /api/v1/vocabularies/{type}` with type `REGION`, `DOMAIN` or `SKILL`, plus `?q&status=ACTIVE&cursor&limit`. Frozen (API:703-729, YAML public). **Not implemented yet. Not an API gap** |
| No hard-coded lists | Frontend loads items from the API (API:729, Freeze:212) |
| Selectable = ACTIVE | Request `status=ACTIVE`. The server rejects a non-ACTIVE new selection with `VOCABULARY_ITEM_INACTIVE` (API:337) |
| IDs only | API:329; the DB uses FKs to `vocabulary_items` |
| Type check | The FKs do not enforce `type_code`, so the service must reject a DOMAIN id sent as `region_id` |
| Archived existing link | Stays readable and valid (Freeze:209); it can be kept, but never newly added |
| OTHER | Staging only (Freeze:210). S06 offers none, and its caption reads "không gõ tự do" |
| "+ 42 nhóm khác" | The count comes from data, never a constant |

## 3. Avatar rules

| Rule | Status |
|---|---|
| Multipart upload returning `asset_id` and `url` | Frozen (API:361-376) |
| Canonical data | `avatar_asset_id`. A URL is never canonical; private assets get no permanent public URL (API:376, SYS §3.4) |
| File limits | Not frozen: technical config (SYS:246), not business policy |
| Storage | **G2**: no `file_assets` table (DB_SCHEMA_GAPS P9, M1) and no object storage configured (`.env.example`) |

## 4. Lifecycle rules

S06 save ≠ onboarding completion ≠ profile activation.

| Step | Effect |
|---|---|
| S05 / S06 saves | Profile stays `DRAFT` |
| S07 | Records Terms and Privacy acceptance |
| S08 | `POST /me/onboarding/complete` checks account, name, region and legal acceptance, then sets `ACTIVE` (API:469-490, Freeze:116) |

S06 never sets `status` or `onboarding_completed_at`.

**Proposed rules checked against sources:**
- **D2 (headline stays free text):** approved. ROLE_HEADLINE_CATEGORY is only optional (Freeze:203).
- **D3 (controlled vocab IDs):** approved.
- **D4 (avatar optional, counts 10%):** approved.
- **D5 (S06 never activates):** approved.
- **D1 (name + region required):** consistent with the activation minimum, but see H2.

## 5. Contract conflicts / gaps

| ID | Type | Gap |
|---|---|---|
| — | Resolved | NETWORK_CONTEXT → HEADLINE, RESOLVED_BY_PRECEDENCE |
| G1 | API (documentation) | `headline` is absent from the `/me/profile` GET/PATCH examples, and the YAML DTO is `additionalProperties: true`. The Freeze group and the DB column fix the name `headline` |
| G2 | DB + infra | `file_assets` is absent and object storage is not provisioned, so avatar upload and the "valid asset" check are impossible |
| C1 | Design vs D1 | The lede says only photo and bio may be blank, which implies name, headline, region and expertise are required. D1 requires name and region only |
| F1 | QA fixture | The deterministic seed has 2 DOMAIN and 2 SKILL items. The reference needs 49 chips with sample labels |

## 6. Human decisions required

| ID | Decision | Options |
|---|---|---|
| H1 | "Chuyên môn" maps to DOMAIN or SKILL. WF01:32 says "canonical expertise"; the chips mix both kinds (Logistics, Nông nghiệp / Phân tích dữ liệu, Thương lượng B2B) | DOMAIN (group 6) / SKILL (group 7) |
| H2 | Required fields to continue | D1: name + region / design copy: name + headline + region + expertise |
| H3 | Avatar in S06 | Additive `file_assets` migration + storage adapter inside S06 / defer upload and render the control disabled, as INTENTIONAL-DATA-ABSENCE |
| H4 | "chọn tối đa 5" | Enforce max 5 on the server too / UI-only |
| H5 | Header skip on S06 | Mirror S05-D3: no write, go to S07 / hide it |
| H6 | Pixel fixture | Add QA-only vocabulary items with the reference labels (test data, never production taxonomy) / accept a chip-row mismatch |

## Related

- [WF01_S05_INTENT_CONTRACT_GAP.md](WF01_S05_INTENT_CONTRACT_GAP.md) — previous step contract
- [DB_SCHEMA_GAPS_P0.md](DB_SCHEMA_GAPS_P0.md) — P9 `file_assets`
- [DECISION_LOG.md](../decisions/DECISION_LOG.md) — decision records
- [P0_STATUS.md](P0_STATUS.md) — overall P0 state
