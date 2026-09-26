# Claude Task Report

## 1. Task
- Task ID / name: WF01-S06-DECISION-FREEZE + WF01-S06 — Onboarding Profile (`/onboarding/profile`)
- Status: **DONE**
- Mode: LOCAL REVIEW. Committed locally, not pushed. WF01-S07 not started.

## 2. Decisions
- DEC-WF01-S06-D1..D6 are recorded in [DECISION_LOG.md](../decisions/DECISION_LOG.md), with Context, Decision, Why, Evidence and Impact.
- NETWORK_CONTEXT → HEADLINE is recorded as **RESOLVED_BY_PRECEDENCE**; the historical SOT is not edited.
- [WF01_S06_PROFILE_FIELD_CONTRACT.md](WF01_S06_PROFILE_FIELD_CONTRACT.md) is now **HUMAN APPROVED — P0**.

## 3. Scope implemented
| Item | Result |
|---|---|
| Fields | avatar, name, headline, region, bio, "Chuyên môn". Required: name, headline, region, ≥1 expertise. Optional: avatar, bio (D2) |
| Profile API | `GET /me/profile` returns a DTO (NOT_CREATED shape when there is no profile). `PATCH` is partial, atomic and own-profile only. It refuses `completion_percent`, `status` and non-S06 fields |
| Vocabulary | `GET /vocabularies/{type}` for REGION, DOMAIN and SKILL (q, status, cursor, limit). New selections must be ACTIVE and type-checked; archived links stay readable (D1) |
| Max 5 | DOMAIN + SKILL ≤ 5, counting kept relations. Enforced in the picker and by the server with 422 (D4) |
| Completion | One service (`src/lib/profile/completion.ts`) with 10 frozen groups. `/session` no longer returns the placeholder `0` |
| Avatar | Multipart upload stores bytes privately with a sidecar owner record under an opaque `asset_<hex>` id; the profile stores only that id. Served by `/media/assets/:id` to sessions only. No migration (D3) |
| Lifecycle | S06 keeps the profile DRAFT and never sets `onboarding_completed_at`. `current_step` becomes PRIVACY once the D2 fields are saved |
| Skip | None. The header action is omitted; the action column keeps its width (D5) |
| Shell | `OnboardingShell` gains a done-step disc (`#2a3b24`, SVG check) and a fixed action column. S05 is unchanged |

## 4. Files
- **API/domain:**
  - `src/lib/{profile,vocabulary,media}/*`
  - `src/app/api/v1/me/profile/{route,completion/route,avatar/route}.ts`
  - `src/app/api/v1/vocabularies/[type]/route.ts`
  - `src/app/media/assets/[id]/route.ts`
  - Edited: `session/route.ts`, `lib/onboarding/state.ts`, and `lib/api/client.ts` (FormData)
- **UI:**
  - `onboarding/profile/{page,profile-form}.tsx`, `profile.module.css`
  - `components/shell/onboarding-shell.*`
- **Tests:**
  - `profile.db-test.ts` (19), `avatar-storage.test.ts` (4), `wf01-s06-onboarding-profile.spec.ts` (23)
  - `shell-routes`: S06 marked as guarded
  - `api-contract`: `/me/profile` and `/vocabularies` removed from the not-implemented list
- **Config/fixtures:**
  - `.env.example` (`MEDIA_STORAGE_DIR`, `MEDIA_AVATAR_MAX_BYTES`)
  - `.gitignore` (`.data/`)
  - `tests/visual/fixtures/wf01-s06-qa-vocabulary.sql` (QA only, D6)
- **Migrations / production data:** **none**

## 5. Pixel QA (1440×900 DPR1)
The typography contract passes. Text colours asserted within ±3: title, lede, label, input, selected and unselected chips, caption, Back and CTA.

**Outside-text diff by segment:**
- header, discs, connectors and canvas: all 0;
- card-upper: 6 px (0.007%);
- card-lower: 503 px (0.081%).

**Control geometry** (upload button and the four inputs): every box sits exactly at the baseline position + dy.

**Classification:** Structural 0 / Major 0 / Component 0. The differences are all intentional or raster noise:

| Class | What differs |
|---|---|
| INTENTIONAL-CONTRACT | Skip link not rendered (D5) |
| INTENTIONAL-COMPOSITION | The baseline is a viewport scrolled 65px, with the card drawn over the header band. The runtime card sits under the header, so it is compared on a full-page capture at dy +65 |
| INTENTIONAL-TYPOGRAPHY-MIGRATION | The lede wraps to two lines (+28px below it); stepper discs 2–3 shift +6/+9px |
| INTENTIONAL-ICON-RENDERING | SVG check marks instead of a glyph |
| INTENTIONAL-DATA-FIXTURE | Chip labels come from the QA fixture (D6) |
| RASTER-NOISE | The baseline puts control edges on half pixels; only those edge rows are excluded, and the boxes are asserted within 1px instead |

**Screen-local values** (single-screen evidence): 13px labels, 14px input values, 48px inputs, chip geometry.

## 6. Validation
| Gate | Result |
|---|---|
| Format / Lint / Typecheck | PASS |
| Unit / DB | 114 / 155 |
| Build | PASS |
| S06 Playwright | 23 / 23 (22 functional + pixel) |
| S01–S05 regression | PASS. Segments unchanged: S01 0/0/0/0/1; S02 0/0/0/14/3; S03 71/247/97; S04 1, 1/3; S05 193/245 |
| Full Playwright | 215 passed (192 + 23); 24 screen runs skipped by design |
| Auth/RBAC suites | PASS (inside the full run) |
| `design-reference/**` | untouched |

## 7. Notes for review
1. The error and placeholder copy (validation, avatar, region placeholder) has no approved bitmap and needs design copy review.
2. The seeded demo avatar ids (`asset_demo_*`) point at no stored file, so those personas count AVATAR as incomplete (e.g. Demo Member scores 90%).
3. `/media/assets/:id` serves any signed-in session. Visibility rules for avatars belong to WF01-S07/WF02.
4. The QA vocabulary stays in the dev database after a run (deterministic ids, `qa_fixture` metadata).

## 8. Git
- Branch: `main`; start HEAD `8d31b7e`
- Implementation commit: `01f6573` feat(wf01-s06): onboarding profile, completion service, private avatars
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `2093836`
- Working tree: clean after commit, except the untracked `AGENTS.md`

## Related
- [DECISION_LOG.md](../decisions/DECISION_LOG.md) — decision records
- [WF01_S06_PROFILE_FIELD_CONTRACT.md](WF01_S06_PROFILE_FIELD_CONTRACT.md) — approved field contract
- [P0_STATUS.md](P0_STATUS.md) — overall P0 state
