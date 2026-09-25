# 1HUB.NETWORK — IMPLEMENTATION MASTER SPEC v1.3

**Date:** 25/09/2026  
**Status:** READY FOR M0 + API-CONTRACTED WF01–WF03 IMPLEMENTATION  
**Design Pixel SOT:** FROZEN for WF01–WF03  
**WF04:** business flow frozen; demo design tracked separately.

---

# 0. Source-of-Truth hierarchy

```text
1. Business SOT       → WHAT / WHY / workflow / business rules
2. Data SOT           → canonical entities / relationships / lifecycle / provenance
3. Design Pixel SOT   → LOOK / layout / approved presentation
4. SA Master Spec     → HOW
5. Code               → implementation only; never silently overrides SOT
```

Raw exports are not automatically implementation scope.

---

# 1. Product architecture statement

1hub.network is a shared ecosystem identity/data and operating layer:

```text
Community / Programme / Event activity
                ↓
       canonical structured records
                ↓
Individual / Project / Startup / Solution profiles
                ↓
      continuously enriched history
                ↓
      future Discovery / Matching
```

No programme-specific identity/data silo may replace canonical profiles.

---

# 2. Design freeze

Canonical design files:

```text
docs/design/00_DESIGN_PIXEL_SOT_FINAL_v1.0.md
docs/design/01_SCREEN_MAP_WF01_WF03_FINAL_v1.0.md
docs/design/DESIGN_TOKENS_v1.0.css
design-reference/final/manifest.yaml
```

Typography:

```text
UI:      Be Vietnam Pro
Display: Archivo Bold only where explicitly approved
Meta:    IBM Plex Mono Medium only where explicitly approved
```

Visual identity remains 1hub red/burgundy; APEC blue is not imported.

Pixel target: `1440×900`, DPR1.

---

# 3. Closed workflow scope

## WF01 — Identity & Onboarding — Production

```text
Auth Entry
→ Check Email
→ Callback success/error states
→ Purpose / Role Intent
→ Basic Profile
→ Privacy & Visibility
→ Complete
→ WF02 Account Home
```

Future architecture insertion: external 1Hub verified identity / CCCD verification. Not P0 coupling.

Detailed contract:
`docs/workflows/WF01_IDENTITY_ONBOARDING_FINAL_v1.0.md`

## WF02 — Member Profile & Network Management — Production

```text
Account Home
├→ Edit Individual Profile
├→ Privacy & Visibility
├→ Roles & Network Links
├→ Create/Edit Project or Startup Profile
│    └→ Manage Team
└→ Account Settings
```

**Frozen Thảo change:** WF02 includes create/edit Project Profile and reuses it in WF05. No duplicate project per programme.

Detailed contract:
`docs/workflows/WF02_MEMBER_PROFILE_NETWORK_FINAL_v1.0.md`

## WF03 — HUB / Chapter / CLB Operations — Production/Internal

```text
Select / Manage HUB-Chapter-CLB
→ Unit Dashboard
→ Member/Account List
→ Member Detail
→ Unit Programme/Challenge List
→ Unit Content/Profile Management
→ Event Management
→ Unit Settings / Organization Relationships
→ Public Unit Page
```

**Frozen Thảo change:** `Quản lý hoạt động` is replaced by `Quản lý sự kiện` using canonical `Event`.

Detailed contract:
`docs/workflows/WF03_HUB_CHAPTER_CLB_OPERATIONS_FINAL_v1.0.md`

---

# 4. WF04–WF06 status

## WF04 — Programme / Challenge Operations — Demo

Business happy case is frozen:

```text
List
→ Create
→ Basic Information
→ Structure & Participation Journey
→ Events/Activities
→ Registration/Eligibility/Participation permissions
→ Operating Team/RBAC
→ Review + Draft/Publish
→ Manage/Monitor
→ Programme/Challenge Detail
```

External demo/design reference is recorded at:
`docs/design/WF04_EXTERNAL_REFERENCE.md`

## WF05 — Project / Startup Journey — Demo

Uses the same Project/Startup entity maintained in WF02.

## WF06 — Ecosystem Data & Matching — Future

Data/read-model vision, not a P0 transactional workflow.

---

# 5. Data freeze

Use:

```text
docs/product/00_DATA_DECISIONS_FREEZE_v1.1.md
docs/product/1HUB_DATA_SOT_v1.1.md
```

Key rules:

1. `Programme` aggregate with type `PROGRAMME | CHALLENGE`.
2. P0 network relationships use pre-seeded confirmed roster + pending fallback.
3. Profile completion = 10 canonical groups × 10%; >=80% is KPI, not generic gate.
4. Required legal consent is versioned; visibility is separate.
5. Region/Domain/Skill are controlled vocabularies.
6. Project/Startup is canonical and reusable across programmes.
7. Event is canonical; it can be linked to Programme/Challenge and may support standalone use.

---

# 6. Architecture

Architecture docs:

```text
docs/architecture/01_SYSTEM_ARCHITECTURE_v1.0.md
docs/architecture/02_DOMAIN_ARCHITECTURE_v1.0.md
docs/architecture/03_AUTH_RBAC_ARCHITECTURE_v1.0.md
docs/architecture/04_FRONTEND_API_DATA_ARCHITECTURE_v1.0.md
docs/architecture/05_API_CONTRACT_P0_v1.0.md
docs/architecture/05_API_CONTRACT_P0_v1.0.yaml
```

Backend style: modular monolith with explicit domain boundaries.  
Primary DB: PostgreSQL.  
API: versioned REST `/api/v1/*`.  
Frontend: one web app with public/auth/onboarding/member/ops/demo route groups.

---

# 7. Auth & RBAC implementation rule

```text
UserAccount ≠ IndividualProfile ≠ IdentityVerification
Membership ≠ Leadership ≠ RoleAssignment
Frontend route ≠ security boundary
```

Every server mutation checks:

```text
actor identity + role/capability + resource scope + lifecycle rule
```

Future 1Hub SSO/CCCD verification is implemented behind an identity-provider boundary.

---

# 8. Pixel QA

Use:

`docs/qa/05_PIXEL_QA_ARCHITECTURE_v1.1.md`

Final screen gate:

```text
Functional → Typography → Pixel/Geometry → Workflow → Regression → Commit → STOP
```

Typography migration from old Thảo bitmap to APEC font is intentional and checked by DOM style assertions.

---

# 9. Implementation milestones

## M0 — Foundation

- repo/bootstrap;
- design tokens/font loading;
- app shell primitives;
- API client/error envelope;
- DB/migration foundation;
- auth abstraction;
- RBAC framework;
- deterministic seed system;
- Playwright visual harness;
- lint/typecheck/test/build gates.

## M1 — WF01
Implement screen-by-screen from manifest, no scope jump.

## M2 — WF02
Implement canonical profile/network/project profile management.

## M3 — WF03
Implement scoped organization operations including **Event Management**.

## M4 — WF04 Demo
Fixture-backed where acceptable; do not accidentally build the whole long-term operating platform.

## M5 — WF05 Demo
Reuse canonical Project/Startup data from WF02.

## M6 — WF06 Future
Architecture/read-model only unless explicitly promoted.

---

# 10. Claude hard rules

1. Read SOT before code.
2. Never invent business rules to fill UI gaps.
3. Never change canonical data semantics to match a screenshot.
4. Never redesign approved screens opportunistically.
5. Use Be Vietnam Pro as the default UI font.
6. Keep 1hub red visual identity; do not copy APEC blue.
7. Implement one requested screen/task at a time.
8. Run functional + visual + workflow gates before commit.
9. Do not overwrite baselines to hide mismatches.
10. Stop at the requested scope.

---

# 11. Readiness

```text
Business SOT          READY
Data SOT              READY
Design Structural SOT READY
Design Pixel SOT      READY for WF01–WF03
System Architecture   READY
Domain Architecture   READY
Auth/RBAC              READY
Frontend/API/Data      READY
Pixel QA               READY
```

Pre-code packaging status:

- route/API contracts at endpoint payload level: **READY**;
- physical DB schema + migrations: **READY**;
- deterministic seed fixtures: **READY**;
- repository `CLAUDE.md`: **READY**;
- milestone prompt pack: **NEXT STEP**.

**Phase 0 is architecture/SOT-ready for Claude Code prompt authoring.**
