# 1HUB.NETWORK — FRONTEND / API / DATA ARCHITECTURE v1.0

**Status:** READY FOR IMPLEMENTATION PLANNING  
**Scope:** Production P0 + stable extension seams for WF04/WF05.

---

# A. Frontend Architecture

## A1. Application shape

Use one web application with route groups, shared design system and server-authoritative permissions.

```text
/public
/auth
/onboarding
/me
/ops
/demo/programmes
/demo/projects
```

Do not create separate frontend applications for Member vs Admin unless deployment requirements later demand it. Route/UI separation is not a security boundary.

## A2. Suggested route map

### Public / WF01

```text
/                         Landing
/login                    Login
/register                 Register
/verify-email             Email/account verification result
```

### Onboarding / WF01

```text
/onboarding/purpose       intent/role context from approved design
/onboarding/profile       basic profile + controlled taxonomy
/onboarding/privacy       terms/privacy/visibility
/onboarding/complete      success / next step
```

If final Business SOT/Design SOT maps network context into a different screen, preserve the same route contract or use a nested step while keeping the domain write separate.

### Member / WF02

```text
/me                       member home/account entry
/me/profile               canonical profile view
/me/profile/edit          profile editor; sections/tabs, not one route per field group
/me/network               memberships/leadership/network relationships
/me/privacy               visibility and consent history/settings
/me/feedback              co-creation feedback
```

### Internal Ops / minimal WF03

```text
/ops/members              account/profile list
/ops/members/:id          member/profile detail
/ops/network              membership/leadership/bootstrap mapping
/ops/feedback             feedback list/detail
/ops/metrics              P0 funnel/coverage metrics
```

### Demo WF04/WF05

```text
/demo/programmes
/demo/programmes/:id
/demo/programmes/:id/setup/*
/demo/projects
/demo/projects/:id
```

Demo routes are isolated and may use deterministic fixture-backed endpoints.

---

## A3. Frontend layers

```text
routes/pages
   ↓
feature modules
   ↓
shared UI components
   ↓
API client / query layer
   ↓
backend API
```

Recommended folders:

```text
src/
  app/ or routes/
  features/
    auth/
    onboarding/
    profile/
    network/
    feedback/
    ops/
    programme-demo/
    project-demo/
  components/
    ui/
    layout/
    profile/
    forms/
  lib/
    api/
    auth/
    validation/
    analytics/
  styles/
    tokens/
```

## A4. State management

Rules:
- server data belongs in a query/cache layer, not a global client store;
- form state is local to form/feature;
- session bootstrap contains identity + capabilities, not full private profile payload;
- avoid storing duplicate canonical profile copies in multiple frontend stores;
- URL is source of truth for list filters/pagination where useful.

## A5. Form architecture

Each form uses:
- schema validation shared with API contract where practical;
- explicit dirty/saving/saved/error states;
- server field errors mapped inline;
- controlled vocabulary IDs, never raw values for canonical taxonomy;
- idempotent submit protection.

---

# B. API Architecture

## B1. Style

Use versioned REST API for v1:

```text
/api/v1/*
```

Why REST now:
- clear resource boundaries;
- easy integration with future mobile app;
- easy Playwright/testing and debugging;
- no need for GraphQL complexity at P0.

## B2. Endpoint groups

### Auth

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/verify-email
POST   /api/v1/auth/resend-verification
GET    /api/v1/session
```

### Profile

```text
GET    /api/v1/me/profile
PATCH  /api/v1/me/profile
GET    /api/v1/me/profile/completion
GET    /api/v1/profiles/:id              # permission-filtered public/network representation
```

### Vocabulary

```text
GET    /api/v1/vocabularies/regions
GET    /api/v1/vocabularies/domains
GET    /api/v1/vocabularies/skills
```

### Privacy / Consent

```text
GET    /api/v1/me/visibility
PUT    /api/v1/me/visibility
GET    /api/v1/me/consents
POST   /api/v1/me/consents/accept
POST   /api/v1/me/consents/revoke        # when the consent type is revocable
```

### Network

```text
GET    /api/v1/me/memberships
POST   /api/v1/me/memberships/requests   # fallback path only
GET    /api/v1/organizations/:id
```

### Feedback

```text
POST   /api/v1/feedback
GET    /api/v1/me/feedback               # optional P0
```

### Ops

```text
GET    /api/v1/ops/members
GET    /api/v1/ops/members/:id
GET    /api/v1/ops/memberships
PATCH  /api/v1/ops/memberships/:id
GET    /api/v1/ops/feedback
GET    /api/v1/ops/metrics/p0
```

### Demo later

```text
GET    /api/v1/demo/programmes/*
GET    /api/v1/demo/projects/*
```

When WF04/WF05 become production, move them to canonical `/programmes`, `/events`, `/applications`, `/projects` endpoints without changing canonical entity IDs.

---

## B3. API contract rules

Every mutation:
- validates current state;
- authorizes actor server-side;
- records audit event when sensitive;
- emits domain/outbox event when needed;
- returns structured error code.

Error shape:

```json
{
  "error": {
    "code": "PROFILE_VALIDATION_FAILED",
    "message": "...",
    "fields": {"region_id": "..."},
    "request_id": "..."
  }
}
```

Pagination:

```text
?cursor=...&limit=...
```

Prefer cursor pagination for large/admin timelines; simple page pagination is acceptable for small P0 tables if documented consistently.

## B4. DTO principle

Do not expose ORM rows directly.

Examples:
- `OwnProfileDTO`
- `PublicProfileDTO`
- `NetworkProfileDTO`
- `OpsMemberDTO`

The backend filters fields based on access policy before serialization.

---

# C. Data Architecture

## C1. P0 physical schema — required

```text
user_accounts
local_credentials              [if selected auth implementation stores them]
email_verification_tokens
individual_profiles
profile_domain_links
profile_skill_links
profile_experiences
profile_visibility_settings
consent_records
organizations
community_memberships
leadership_records
membership_invites
role_assignments
feedback
controlled_vocabularies
controlled_vocabulary_items
file_assets
audit_logs
analytics_events
outbox_events
```

### Recommended common columns

```text
id UUID
created_at timestamptz
updated_at timestamptz
created_by nullable UUID
status code where applicable
archived_at nullable timestamptz
```

Do not add `deleted=true` to every table blindly; use lifecycle-appropriate archive/end fields.

---

## C2. Profile model

`individual_profiles` should hold stable scalar fields:

```text
id
user_account_id UNIQUE
full_name
avatar_asset_id nullable
current_headline nullable
region_vocab_id nullable
short_bio nullable
development_goal nullable
current_need nullable
status
activated_at nullable
deactivated_at nullable
```

Many-valued data:
- domains → link table;
- skills → link table;
- experiences → child table.

Completion is derived from the 10 frozen groups. It may be cached as a projection/column for analytics performance, but source completion rules remain code/config SOT.

---

## C3. Network model

```text
organizations
  id
  organization_type_vocab_id
  name
  slug
  parent relation is NOT embedded as a single parent column long-term

organization_relationships       [schema-ready]
community_memberships
leadership_records
membership_invites
organization_representations     [schema-ready]
```

`membership_invites` supports P0 pre-seed:

```text
id
normalized_email
organization_id
membership_type
intended_leadership_role nullable
status = PENDING | CLAIMED | EXPIRED | CANCELLED
claimed_by_profile_id nullable
```

On verified email match, claim transaction creates canonical relationship records.

---

## C4. Consent / visibility model

`consent_records`:

```text
id
individual_profile_id
consent_type
policy_key
policy_version
purpose_code
scope_json or normalized scope relation
status
accepted_at
revoked_at nullable
expires_at nullable
```

`profile_visibility_settings`:

```text
individual_profile_id
profile_group_code
visibility_level
updated_at
```

Visibility and consent are not combined.

---

## C5. Governance model

`role_assignments`:

```text
individual_profile_id
role_code
scope_type
scope_id
valid_from
valid_to
status
assigned_by_profile_id
```

`audit_logs` is append-only:

```text
actor_profile_id nullable
actor_role_assignment_id nullable
action_code
resource_type
resource_id
before_summary / after_summary or structured diff
request_id
created_at
```

Do not store secrets/raw passwords/private identity documents in audit payloads.

---

## C6. Programme/Venture schema-ready contracts

May be modelled/migrated later, but names and relationships are reserved:

```text
programmes
events
programme_organization_relationships
programme_role_assignments
applications
event_registrations
participations
outcomes
activity_records
achievement_records
teams
team_memberships
startups
startup_memberships
solutions
solution_contributor_relationships
startup_solution_relationships
```

`programmes.programme_type = PROGRAMME | CHALLENGE`.

`events.programme_id` is nullable.

---

## C7. Index baseline

P0 minimum indexes:
- normalized account email unique;
- user_account_id unique on IndividualProfile;
- membership `(individual_profile_id, organization_id, status)`;
- leadership `(individual_profile_id, organization_id, status)`;
- role assignment `(individual_profile_id, scope_type, scope_id, status)`;
- feedback created_at;
- audit `(resource_type, resource_id, created_at)`;
- analytics `(event_name, created_at)`;
- vocab `(vocabulary_type, code)` unique.

---

## C8. Data provenance

Any field/record used as evidence/trust later should support:

```text
source_type = SELF_DECLARED | SYSTEM_RECORDED | ORGANIZATION_VERIFIED | IDENTITY_VERIFIED
source_entity_type nullable
source_entity_id nullable
recorded_at
verification_status nullable
```

For P0 this may be implemented only where used; the domain model/API should not assume all displayed data is equally verified.

---

# D. Cross-layer rules

1. Design screen IDs map to frontend routes, but routes never define business entities.
2. API endpoints map to domain application services, not directly to SQL tables.
3. DB tables map to canonical entities, not screenshots/forms.
4. Demo WF04/WF05 fixtures use the same DTO shapes intended for future production APIs.
5. Controlled vocabulary values come from API/config data, never hard-coded in Figma-derived frontend arrays.
6. All dates stored timezone-aware; deadlines return timezone explicitly.
7. All IDs are opaque to the client.

