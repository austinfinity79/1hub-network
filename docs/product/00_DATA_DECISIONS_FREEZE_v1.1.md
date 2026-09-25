# 1HUB.NETWORK — DATA DECISIONS FREEZE v1.1

**Status:** FROZEN for SA v1.0  
**Date:** 25/09/2026  
**Basis:** `1hub.network _ BA (1).xlsx`, `1hub.network _ Overview.docx`, Business SOT/WF01–WF06, Design SOT structural audit.

This document closes D1–D5 from Data SOT v1.0 so System Architecture and physical schema/API design can proceed without reopening product fundamentals.

---

## D1 — Programme vs Challenge modelling

### Decision
Use **one canonical `Programme` aggregate** with:

```text
programme_type = PROGRAMME | CHALLENGE
```

`Challenge` is not a second root aggregate with duplicated lifecycle. Challenge-specific concepts become child objects of a `Programme` whose `programme_type = CHALLENGE`.

Examples of challenge-only children that may be added later:

- `ProblemStatement`
- `ChallengeTrack`
- `ChallengeOwnerRelationship`
- challenge-specific evaluation configuration

`Event` remains a separate canonical entity and may be standalone or belong to a Programme/Challenge.

```text
Programme / Challenge
   ├── Structure / Journey
   ├── Event / Activity
   ├── Registration/Application Configuration
   ├── Operating Team / Role Assignments
   ├── Applications / Participants
   └── Outcomes
```

### Why
BA/business rules treat Programme/Challenge as sharing lifecycle, organizer relations, publication, applications and outcomes. The latest WF04 also describes a shared flow: list → create → basic info → journey → activities/events → registration/access → operating roles → draft/publish → manage/monitor → detail.

### Consequence for code
- One module: `programme`.
- One root table/entity for Programme.
- Type-specific child records are allowed.
- Do **not** duplicate Programme and Challenge service layers.

**Freeze:** `ACCEPTED`.

---

## D2 — P0 HUB/Chapter/CLB linkage

### Decision
For the 29/09 soft-launch cohort use **pre-seeded confirmed network relationships as the primary path**.

The known roster is imported before go-live as invitation/bootstrap data. When a user creates an account with a matching normalized email, the system attaches the intended confirmed relationship(s).

```text
Known HUB roster
   ↓ import
MembershipInvite / Bootstrap record
   ↓ exact account match
IndividualProfile
   ├── CommunityMembership = ACTIVE
   └── LeadershipRecord = ACTIVE   [when applicable]
```

If there is no matching pre-seeded relationship, a user's self-selected HUB/Chapter/CLB **must not become ACTIVE automatically**. The fallback is:

```text
self-selection → CommunityMembership = PENDING_APPROVAL
```

This fallback must not block completion of the P0 profile.

### P0 UI rule
- If matched: show confirmed network context.
- If not matched: allow declaration/request, display pending state.
- No full membership approval workflow is required in the member-facing P0 happy path.

### Data rule
Do not create a permanent generic `Affiliation` object that bypasses Membership/Leadership.

**Freeze:** `PRESEED + PENDING FALLBACK`.

---

## D3 — P0 Profile Completion policy

### Decision
Profile completion is a **derived score from 10 canonical profile groups**, each worth 10 points. It is independent from profile lifecycle status.

| Group | Completion rule | Weight |
|---|---|---:|
| 1. Full name | non-empty | 10 |
| 2. Avatar | valid asset attached | 10 |
| 3. Current role/headline | non-empty | 10 |
| 4. Region | controlled value selected | 10 |
| 5. Short bio | non-empty | 10 |
| 6. Domain / area of interest | >= 1 controlled value | 10 |
| 7. Skills | >= 1 controlled value | 10 |
| 8. Experience | >= 1 experience item OR explicit `NO_EXPERIENCE_YET` | 10 |
| 9. Development goal | non-empty | 10 |
| 10. Current need | non-empty | 10 |

```text
completion_percent = completed_groups * 10
```

### Roadmap metric
`profile_completed_80 = completion_percent >= 80`

### Activation minimum
A Profile can become `ACTIVE` before reaching 80%. Minimum P0 activation is:

- valid account;
- full name;
- region;
- required Terms/Privacy acceptance.

The 80% threshold is a **product KPI**, not an authentication/access gate.

### Why
The BA describes core profile data as basic information, region, domain, skills, experience, goal and need, while the P0 roadmap explicitly measures the percentage of fields completed. Group-based scoring is stable when individual form fields evolve and prevents a long bio or many skills from artificially inflating completion.

**Freeze:** `10 GROUPS / EQUAL WEIGHT`.

---

## D4 — P0 Consent & Visibility configuration

### Decision
Separate **legal acceptance**, **privacy/processing consent**, and **profile visibility**. Do not represent them as one boolean.

### Required P0 records

1. `TERMS_ACCEPTANCE`
   - required to use the service;
   - versioned document identifier;
   - accepted timestamp;
   - actor/account reference.

2. `PRIVACY_DATA_PROCESSING`
   - required for the P0 profile/data-processing scope;
   - versioned policy identifier;
   - purpose/scope reference;
   - accepted timestamp;
   - revocation/withdrawal semantics where applicable.

### Visibility is not consent
P0 supports visibility configuration as a separate setting. Canonical levels remain:

```text
PUBLIC
NETWORK_ONLY
PROGRAMME_ACCESS
GRANTED_ACCESS
PRIVATE
```

P0 UI does **not** need to expose every future access scenario. It may expose only approved profile groups while backend stores the canonical level model.

### Explicitly excluded from P0 legal model
- investor-specific deep-data grants;
- dataroom grants;
- marketing consent;
- identity-document consent;
- one-off partner data sharing.

Those become separate future `ConsentRecord`/`AccessGrant` records.

### Governance
Any change to Terms/Privacy version, visibility or consent must create an audit event.

**Freeze:** `VERSIONED REQUIRED ACCEPTANCE + SEPARATE VISIBILITY`.

---

## D5 — Controlled Vocabulary seed

### Decision
Freeze the **taxonomy types, ownership and behaviour now**; literal item lists remain configurable launch data rather than code constants.

### P0 required vocabularies

```text
REGION
DOMAIN
SKILL
```

### Schema ready / later

```text
STARTUP_STAGE
ORGANIZATION_TYPE
TAG
PROGRAMME_TYPE
EVENT_TYPE
ROLE_HEADLINE_CATEGORY   [optional]
```

### Rules
- Platform Admin owns vocabulary lifecycle.
- Search/filter fields must reference vocabulary item IDs, not raw text.
- Items have `ACTIVE | ARCHIVED` state; historical relations remain valid after archive.
- UI may offer `OTHER` only as a staging value. Free-text suggestions are not immediately searchable canonical taxonomy until curated.
- Initial P0 values are imported from HUB's approved current taxonomy/design dataset before go-live.
- Region seed must use the launch-approved administrative list; do not hard-code it in frontend code.

### Why
BA requires centrally managed vocabularies for filtering/matching. Keeping the actual item set data-driven allows HUB to clean its taxonomy without schema/code changes.

**Freeze:** `SCHEMA + GOVERNANCE FROZEN; VALUES CONFIGURABLE`.

---

# Freeze summary

| Decision | Final |
|---|---|
| D1 | One Programme aggregate; `PROGRAMME` / `CHALLENGE` subtype |
| D2 | Pre-seeded confirmed membership/leadership + pending fallback |
| D3 | 10 profile groups × 10%; KPI at >=80% |
| D4 | Versioned Terms + Privacy/Data Processing; visibility separate |
| D5 | REGION/DOMAIN/SKILL required controlled vocab; values config-driven |

**Result:** Data SOT is no longer an architecture blocker. Physical DB/API design may proceed against these decisions.
