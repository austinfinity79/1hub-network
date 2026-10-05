# S1-UAT-05 profile

Sprint 1 WF02 profile consistency: FB-09 free text with suggestions, FB-10 no skills, experience "Loại hình" / "Địa điểm", one twelve-item completion. Decisions [DEC-S1P](../../decisions/DECISION_LOG.md#dec-s1p); contract [05 amendment A14](../../architecture/05_API_CONTRACT_P0_v1.0.md). Tests and git: [S1-UAT-05-evidence](S1-UAT-05-evidence.md).

## Preflight
| Check | Result |
|---|---|
| DB safety | `e84308f` (DB-SAFETY-01) fast-forwarded into `feat/s1-uat-05-profile`: DB_SAFETY_COMMIT_PRESENT = YES (fail-closed runner, shared-DB flag, test-DB guard, CLAUDE.md §15) |
| Base | `29b25ad` → `e84308f`; worktree `../1hub-network-s1-profile`; only task file: draft `019` (kept after audit) |
| Isolated DB | `hubnetwork_s1profile`, every reset with exported `DATABASE_URL`, `TARGET_DATABASE hubnetwork_s1profile` printed; shared `hubnetwork_p0` stays 017 |
| Remote | origin/main `edd3d24`, production `78f21f2` — untouched |

## Current profile audit
| Item | Before |
|---|---|
| CURRENT_PROFILE_MODEL | `individual_profiles` + `profile_domains` / `profile_specializations` / `profile_skills` (vocabulary ids) + experience / education / links / declared roles |
| CURRENT_TAXONOMY_BEHAVIOR | closed lists: domain and specialisation chips, skills picked from a datalist; free text refused |
| CURRENT_EXPERIENCE_FIELDS | title, organisation, from / to, current, description; no type / place (D-P1) |
| CURRENT_COMPLETENESS_FORMULA | one `computeCompletion`, ten groups × 10 (display name, avatar, headline, region, bio, domain, skills, experience, goal, need) |
| CURRENT_VISIBILITY_RULES | experience owner-only (`/me` DTO); projection whitelist without experience; no other-member profile route (FP1 not built) |

## Twelve-item completion
Ảnh hồ sơ · Họ và tên · Vai trò hiện tại · Giới thiệu ngắn · Vị trí · Lĩnh vực quan tâm · Chuyên môn · Vai trò trong hệ sinh thái · Kinh nghiệm · LinkedIn · Website/Portfolio · Số điện thoại = round(n × 100 / 12). Duplicate audit: none — `/session`, `/me/profile`, `/me/profile/completion`, onboarding complete, avatar route, step 4, `/onboarding/complete`, `/me` all call the one function; step 4 labels and `/me` cards map its codes. Education adds nothing.

## Behaviour
| Area | Result |
|---|---|
| Taxonomy (FB-09) | one `TagInput` for stage 2, the /me dialog, the editor; 8 suggestions, canonical first; Enter adds text; 1–5 tags, 2–40 chars, no duplicate; free text → `UNNORMALIZED` vocabulary item (reused for equal text), canonical label → canonical item |
| Stage 2 minimum | one domain + one specialisation to continue (client and server) |
| Skills (FB-10) | gone from stage 2, step 4, AI topics, /me, dialog, editor, completion; stored links kept; `skill_ids` still accepted |
| Loại hình | free text ≤ 40 (no catalogue exists; PO 05/10); shown "Tổ chức · Loại hình" |
| Địa điểm | free text ≤ 200; shown after the period, as FP1-OWN draws |
| Copy | /me note now "Gợi ý lấy từ danh mục của HUB; giá trị bạn tự gõ được HUB gom về danh mục sau." (old one said free text was refused) — PO copy review |

## S1-UAT-03 dependency
| Item | Status |
|---|---|
| S1_UAT_03_BLOCKS_EXPERIENCE_LOCATION | NO (plain text, no catalogue) |
| "Vị trí" completion item | counts the linked tỉnh/thành; when S1-UAT-03 allows a typed city abroad, this item must count it too — follow-up, no rule invented here |

## API / data / migration
| Change | Detail |
|---|---|
| PATCH `/me/profile` | `domains` / `specializations` (text), experience `employment_type` / `location`; A14 |
| Migration 019 | REQUIRED: `vocab_status` + `UNNORMALIZED`; `profile_experience.employment_type`, `location`; additive, documented lossless rollback |
| Admin | categories list / edit / order leave `UNNORMALIZED` out (unchanged screen) |
| Not created | no profile table, no ExperienceV2, no new suggestion engine elsewhere |

## Related
- [S1-UAT-05-evidence](S1-UAT-05-evidence.md)
- [DECISION_LOG DEC-S1P](../../decisions/DECISION_LOG.md#dec-s1p)
- [DB-SAFETY-01-incident](DB-SAFETY-01-incident.md)
- [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
