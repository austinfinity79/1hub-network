# 1HUB.NETWORK — API CONTRACT P0 v1.0

**Date:** 25/09/2026  
**Status:** FROZEN FOR P0 IMPLEMENTATION  
**Scope:** WF01 + WF02 + WF03 Production/Internal, plus required P0 support APIs (feedback, analytics, vocabulary).  
**Basis:** Business SOT, Data SOT v1, WF01–WF03 final contracts, Auth/RBAC architecture, Design Pixel SOT.

> This contract turns the frozen SOT into an executable HTTP boundary. It does **not** add new product scope. Any endpoint marked `FUTURE/DEMO` is non-production for P0.

---

# 1. Contract principles

1. Base path: `/api/v1`.
2. Browser auth uses an HTTP-only secure session cookie; the frontend must not trust role/scope from local storage.
3. Every mutation is authorized server-side using `actor + capability + resource scope + lifecycle rule`.
4. API never returns ORM/database rows directly; it returns purpose-specific DTOs.
5. Sensitive reads are filtered server-side according to visibility, relationship, consent and role scope.
6. Canonical taxonomy values are referenced by IDs, not arbitrary text.
7. Historical business relations are closed/archived, not hard-deleted after activity exists.
8. All sensitive mutations generate an audit event.
9. Timestamps use ISO-8601 UTC strings.
10. IDs are opaque strings (UUID/ULID implementation choice belongs to DB schema).

---

# 2. Common HTTP conventions

## 2.1 Content type

```http
Content-Type: application/json
Accept: application/json
```

File upload endpoints may use `multipart/form-data`.

## 2.2 Request correlation

Client may send:

```http
X-Request-ID: <opaque-id>
```

Server always returns a request ID in headers and in error payloads.

## 2.3 Idempotency

For mutations where duplicate submission is unsafe, client sends:

```http
Idempotency-Key: <opaque-key>
```

Required for:
- auth magic-link request;
- consent acceptance/revocation;
- membership request;
- feedback submit;
- project/team invite mutations;
- event create/publish;
- organization relationship create/close.

## 2.4 Success envelope

Single-resource endpoints return the resource directly unless metadata is required.

List endpoints return:

```json
{
  "items": [],
  "page": {
    "next_cursor": null,
    "limit": 50
  }
}
```

## 2.5 Error envelope

```json
{
  "error": {
    "code": "PROFILE_VALIDATION_FAILED",
    "message": "Profile data is invalid.",
    "fields": {
      "region_id": "A valid region is required."
    },
    "request_id": "req_..."
  }
}
```

Canonical HTTP mapping:

| HTTP | Meaning |
|---|---|
| 400 | malformed request / validation |
| 401 | unauthenticated / expired session |
| 403 | authenticated but not authorized |
| 404 | resource not found or intentionally hidden |
| 409 | lifecycle/state conflict / duplicate relation |
| 422 | semantically valid JSON but business validation failed |
| 429 | rate limited |
| 500 | unexpected server error |

---

# 3. Session bootstrap & capability model

## GET `/session`

**Purpose:** Bootstrap authenticated UI after auth callback and on reload.

**Response `200`**

```json
{
  "authenticated": true,
  "account": {
    "id": "acc_...",
    "email": "member@example.com",
    "email_verified": true,
    "status": "ACTIVE"
  },
  "profile": {
    "id": "prf_...",
    "status": "ACTIVE",
    "onboarding_completed": true,
    "completion_percent": 80
  },
  "capabilities": [
    "profile:read:self",
    "profile:update:self",
    "network:read:self"
  ],
  "managed_scopes": [
    {
      "scope_type": "ORGANIZATION",
      "scope_id": "org_chapter_hanoi",
      "role_code": "HUB_COMMUNITY_LEADER"
    }
  ]
}
```

Unauthenticated response may return `200 {"authenticated": false}` or `401`; implementation must choose one consistently. **Recommended:** `200 authenticated=false` for simple app bootstrap.

---

# 4. WF01 — Identity & Onboarding APIs

## 4.1 Magic-link auth

### POST `/auth/magic-link`

Maps: **WF01-S01**.

```json
{
  "email": "member@example.com",
  "return_to": "/auth/callback"
}
```

Response `202`:

```json
{
  "request_id": "authreq_...",
  "email_masked": "m***@example.com",
  "resend_after_seconds": 60,
  "expires_in_seconds": 900
}
```

Rules:
- same flow handles first-time account creation and returning user login;
- no password is required by the frozen P0 design;
- rate-limit by email + IP/device signals;
- do not disclose whether an account already exists.

Errors: `AUTH_RATE_LIMITED`, `AUTH_EMAIL_INVALID`.

### POST `/auth/magic-link/resend`

Maps: **WF01-S02**.

```json
{
  "auth_request_id": "authreq_..."
}
```

Response `202` with refreshed resend/expiry metadata.

### POST `/auth/magic-link/consume`

Maps: **WF01-S03** callback processing.

```json
{
  "token": "opaque-one-time-token"
}
```

Response `200`:

```json
{
  "result": "SUCCESS",
  "account_created": true,
  "onboarding": {
    "completed": false,
    "next_step": "PURPOSE"
  }
}
```

Server also sets the secure HTTP-only session cookie.

Known business error codes:
- `AUTH_LINK_EXPIRED`
- `AUTH_LINK_ALREADY_USED`
- `AUTH_LINK_INVALID`
- `AUTH_ACCOUNT_BLOCKED`

### POST `/auth/logout`

Response `204` and revokes current session.

### GET `/auth/providers`

Optional config endpoint. Returns configured provider entries only. P0 must work when it returns an empty list.

```json
{
  "providers": []
}
```

Future 1Hub identity/CCCD integration must attach behind this/provider boundary without creating a second IndividualProfile.

---

## 4.2 Onboarding intent

### GET `/me/onboarding`

Returns current onboarding state.

```json
{
  "completed": false,
  "current_step": "PURPOSE",
  "intent": null
}
```

### PUT `/me/onboarding/intent`

Maps: **WF01-S05**.

```json
{
  "primary_intent": "EXPLORE_NETWORK"
}
```

`primary_intent` is config-backed/product-config data. The API contract intentionally does not freeze a permanent enum beyond values approved in launch configuration.

Response `200` returns onboarding state with next step.

---

## 4.3 Own profile

### GET `/me/profile`

Used by WF01-S06 and WF02.

```json
{
  "id": "prf_...",
  "status": "DRAFT",
  "display_name": "Nguyễn Minh Anh",
  "avatar": {
    "asset_id": "asset_...",
    "url": "/media/..."
  },
  "region": {"id": "region_hanoi", "label": "Hà Nội"},
  "bio": null,
  "domains": [],
  "skills": [],
  "education": [],
  "experience": [],
  "development_goal": null,
  "current_need": null,
  "links": [],
  "completion": {
    "percent": 30,
    "completed_groups": 3,
    "total_groups": 10
  }
}
```

### PATCH `/me/profile`

Maps: **WF01-S06** and **WF02-S02**.

Request is partial. Example:

```json
{
  "display_name": "Nguyễn Minh Anh",
  "region_id": "region_hanoi",
  "bio": "Founder working on...",
  "domain_ids": ["domain_ai"],
  "skill_ids": ["skill_product"],
  "development_goal": "Build my venture",
  "current_need": "Find mentors"
}
```

Rules:
- canonical taxonomy fields accept IDs only;
- profile completion is calculated server-side;
- client cannot submit `completion_percent`;
- `>=80%` is KPI, not general access gate;
- audit profile fields only where required by governance, not every keystroke.

Response `200`: updated `OwnProfileDTO`.

Errors: `PROFILE_VALIDATION_FAILED`, `VOCABULARY_ITEM_INACTIVE`, `PROFILE_DEACTIVATED`.

### GET `/me/profile/completion`

```json
{
  "percent": 80,
  "groups": [
    {"code": "DISPLAY_NAME", "complete": true, "weight": 10},
    {"code": "AVATAR", "complete": true, "weight": 10},
    {"code": "REGION", "complete": true, "weight": 10},
    {"code": "NETWORK_CONTEXT", "complete": true, "weight": 10},
    {"code": "BIO", "complete": false, "weight": 10},
    {"code": "DOMAIN", "complete": true, "weight": 10},
    {"code": "SKILLS", "complete": true, "weight": 10},
    {"code": "EXPERIENCE", "complete": true, "weight": 10},
    {"code": "DEVELOPMENT_GOAL", "complete": true, "weight": 10},
    {"code": "CURRENT_NEED", "complete": true, "weight": 10}
  ]
}
```

---

## 4.4 Avatar / media

### POST `/me/profile/avatar`

`multipart/form-data` upload.

Response:

```json
{
  "asset_id": "asset_...",
  "url": "/media/assets/asset_..."
}
```

Private assets must not be returned as permanent public storage URLs.

---

## 4.5 Consent & visibility

### GET `/legal/current`

Returns currently required legal documents.

```json
{
  "documents": [
    {
      "type": "TERMS_ACCEPTANCE",
      "version": "2026-09-29",
      "required": true,
      "content_url": "/legal/terms/2026-09-29"
    },
    {
      "type": "PRIVACY_DATA_PROCESSING",
      "version": "2026-09-29",
      "required": true,
      "content_url": "/legal/privacy/2026-09-29"
    }
  ]
}
```

Literal production version/date is release configuration, not hard-coded product logic.

### GET `/me/consents`

Returns consent/acceptance history.

### POST `/me/consents/accept`

Maps: **WF01-S07**, WF02-S03.

```json
{
  "consent_type": "TERMS_ACCEPTANCE",
  "policy_version": "2026-09-29"
}
```

Response `201` returns `ConsentRecordDTO`.

### POST `/me/consents/revoke`

Only for revocable consent types. Required Terms acceptance is not revocable while continuing to use the service; account closure is handled separately.

```json
{
  "consent_record_id": "con_..."
}
```

Errors: `CONSENT_NOT_REVOCABLE`, `CONSENT_ALREADY_REVOKED`.

### GET `/me/visibility`

```json
{
  "groups": [
    {"group_code": "BASIC_PUBLIC", "level": "PUBLIC"},
    {"group_code": "SKILLS_EXPERIENCE", "level": "NETWORK_ONLY"},
    {"group_code": "CONTACT", "level": "PRIVATE"}
  ]
}
```

### PUT `/me/visibility`

```json
{
  "groups": [
    {"group_code": "BASIC_PUBLIC", "level": "PUBLIC"},
    {"group_code": "SKILLS_EXPERIENCE", "level": "NETWORK_ONLY"}
  ]
}
```

Canonical levels:

`PUBLIC | NETWORK_ONLY | PROGRAMME_ACCESS | GRANTED_ACCESS | PRIVATE`

Server validates which group/level combinations are allowed in P0 UI.

---

## 4.6 Complete onboarding

### POST `/me/onboarding/complete`

Maps: **WF01-S08**.

Server validates minimum activation requirements:
- valid authenticated account;
- full/display name;
- region;
- required Terms/Privacy acceptance.

Response:

```json
{
  "completed": true,
  "profile_status": "ACTIVE",
  "completion_percent": 70,
  "next": "/me"
}
```

Errors: `ONBOARDING_REQUIREMENTS_MISSING` with field/group details.

---

# 5. WF02 — Member Profile & Network APIs

## 5.1 Own network read model

### GET `/me/network`

Maps: **WF02-S04**.

```json
{
  "memberships": [
    {
      "id": "mem_...",
      "organization": {"id": "org_...", "name": "HUB Hà Nội", "type": "CHAPTER"},
      "status": "ACTIVE",
      "source": "ORGANIZATION_VERIFIED"
    }
  ],
  "leadership": [
    {
      "id": "lead_...",
      "organization": {"id": "org_...", "name": "HUB Hà Nội", "type": "CHAPTER"},
      "title": "Leader",
      "status": "ACTIVE"
    }
  ],
  "roles": [],
  "activity_summary": []
}
```

### POST `/me/membership-requests`

Fallback path only when no pre-seeded confirmed roster match exists.

```json
{
  "organization_id": "org_..."
}
```

Response `201` status `PENDING_APPROVAL`.

Must **never** auto-create ACTIVE membership from self-selection.

---

## 5.2 Public/network profile projection

### GET `/profiles/{profileId}`

Server returns the representation appropriate to the requester context.

Optional query:

```text
?view=auto|public|network
```

`view=auto` is default. Client cannot force access to data it is not entitled to.

The DTO excludes registration email, phone and other private fields unless an explicit policy allows them.

---

## 5.3 Project / Startup profile resource

WF02 uses one canonical venture record that WF05 reuses. The API calls this resource **Venture** while preserving business type `PROJECT | STARTUP`; physical DB naming is deferred to DB Schema v1.

### GET `/me/ventures`

Returns ventures the current user may manage or is a team member of.

### POST `/ventures`

Maps: **WF02-S05**.

```json
{
  "type": "PROJECT",
  "name": "GreenTech Solution",
  "summary": "...",
  "domain_ids": ["domain_green"],
  "region_id": "region_hanoi"
}
```

Response `201`:

```json
{
  "id": "ven_...",
  "type": "PROJECT",
  "status": "DRAFT",
  "name": "GreenTech Solution"
}
```

Creator becomes an authorized management relation/team membership according to DB/RBAC schema; no organization shared-login is created.

### GET `/ventures/{ventureId}`

Permission-filtered detail.

### PATCH `/ventures/{ventureId}`

Updates canonical Project/Startup profile. No programme-specific copy is created.

### POST `/ventures/{ventureId}/submit-for-review`

**Conditional endpoint:** only enabled if launch business configuration requires project/startup profile review. If not configured, endpoint returns `404`/capability absent. This prevents inventing a mandatory review workflow.

---

## 5.4 Venture team

### GET `/ventures/{ventureId}/team`

Maps: **WF02-S06**.

### POST `/ventures/{ventureId}/team/invitations`

```json
{
  "email": "member@example.com",
  "role_label": "Co-founder"
}
```

Creates an invitation/pending relationship; never silently activates membership from email alone.

### PATCH `/ventures/{ventureId}/team/{membershipId}`

```json
{
  "role_label": "Founder"
}
```

### DELETE `/ventures/{ventureId}/team/{membershipId}`

Closes/removes membership only when lifecycle policy permits; historical relation is preserved where required.

---

## 5.5 Account settings & sessions

### GET `/me/settings`

Returns account-safe settings and notification preferences.

### PATCH `/me/settings`

Only fields explicitly supported by current auth provider are mutable.

### GET `/me/sessions`

Returns active sessions/device metadata suitable for user display.

### DELETE `/me/sessions/{sessionId}`

Revokes one session.

### GET `/me/notification-preferences`

### PUT `/me/notification-preferences`

Notification channel details remain config-driven; API must not assume unsupported channels.

### POST `/me/account-deletion-request`

Creates a controlled deletion/deactivation request; it does not synchronously hard-delete historical ecosystem records.

---

# 6. P0 Feedback APIs

Feedback remains a Business/Data SOT P0 requirement even though no dedicated final pixel screen is frozen in WF01–WF03.

### POST `/feedback`

```json
{
  "content": "Tôi muốn...",
  "context": {
    "route": "/me",
    "workflow": "WF02"
  }
}
```

Response `201`:

```json
{
  "id": "fb_...",
  "status": "RECEIVED",
  "submitted_at": "2026-09-25T06:00:00Z"
}
```

P0 must not invent ticket statuses/categories beyond what product explicitly adopts later.

### GET `/me/feedback`

Optional readback. If UI does not expose it in P0, endpoint may be deferred without affecting feedback submission metric.

---

# 7. Controlled Vocabulary APIs

### GET `/vocabularies/{type}`

`type` P0:
- `REGION`
- `DOMAIN`
- `SKILL`

Query:

```text
?q=product&status=ACTIVE&cursor=...&limit=50
```

Response:

```json
{
  "items": [
    {"id": "skill_product", "code": "PRODUCT", "label": "Product", "status": "ACTIVE"}
  ],
  "page": {"next_cursor": null, "limit": 50}
}
```

Frontend must not hard-code canonical vocabulary lists.

---

# 8. WF03 — HUB / Chapter / CLB Operations APIs

All `/ops/*` APIs require a server-verified capability and resource scope.

## 8.1 Managed organization/network selector

### GET `/ops/organizations`

Maps: **WF03-S01**.

Returns organizations the actor is allowed to manage.

Filters:

```text
?type=HUB|CHAPTER|CLB&q=...&cursor=...&limit=50
```

DTO includes counts/read-model summaries only as authorized.

---

## 8.2 Unit dashboard

### GET `/ops/organizations/{orgId}/dashboard`

Maps: **WF03-S02**.

Returns aggregate read model, not raw tables.

```json
{
  "organization": {"id": "org_...", "name": "HUB Hà Nội", "type": "CHAPTER"},
  "summary": {
    "active_members": 120,
    "active_leaders": 5,
    "published_events": 3,
    "linked_programmes": 2
  },
  "permissions": ["member:read", "event:manage"]
}
```

Metric availability may vary by scope; absent metrics must not be fabricated.

---

## 8.3 Member operations

### GET `/ops/organizations/{orgId}/members`

Maps: **WF03-S03**.

Filters:

```text
?q=...&membership_status=ACTIVE&leadership_status=ACTIVE&cursor=...&limit=50
```

Response items use `OpsMemberSummaryDTO`.

### GET `/ops/organizations/{orgId}/members/{profileId}`

Maps: **WF03-S04**.

Returns permission-filtered member detail, membership/leadership history and consent summary required for operations. It must not expose full private consent content or unrelated private fields.

### PATCH `/ops/organizations/{orgId}/memberships/{membershipId}`

Allowed transitions only.

```json
{
  "status": "ACTIVE"
}
```

Common transitions: pending approval → active/rejected; active → suspended/alumni/withdrawn where policy allows.

Errors: `MEMBERSHIP_INVALID_TRANSITION`, `SCOPE_FORBIDDEN`.

### POST `/ops/organizations/{orgId}/leadership`

```json
{
  "profile_id": "prf_...",
  "title": "Leader",
  "valid_from": "2026-09-01",
  "valid_to": null
}
```

Creates a leadership business record. Permission-bearing `RoleAssignment` is created/updated by backend policy only when required; client does not directly mint arbitrary roles.

### PATCH `/ops/organizations/{orgId}/leadership/{leadershipId}`

Closes/revokes leadership while preserving history.

---

## 8.4 Unit Programme/Challenge list — read bridge to WF04

### GET `/ops/organizations/{orgId}/programmes`

Maps: **WF03-S05**.

Returns programmes/challenges associated with the organization.

```json
{
  "items": [
    {
      "id": "pgm_...",
      "type": "CHALLENGE",
      "name": "HUB Challenge",
      "status": "PUBLISHED",
      "relationship": "LEAD_ORGANIZER"
    }
  ],
  "page": {"next_cursor": null, "limit": 50}
}
```

P0 WF03 does not require full create/manage Programme lifecycle; that belongs to WF04 Demo/next production phase.

---

## 8.5 Organization profile/content

### GET `/organizations/{orgId}`

Authenticated permission-filtered organization detail.

### PATCH `/ops/organizations/{orgId}/profile`

Maps: **WF03-S06**.

Updates organization public/profile fields the actor is authorized to manage.

### GET `/organizations/by-slug/{slug}`

Maps: **WF03-S09**, public/network projection.

Returns `OrganizationPublicDTO` and visible public events/links; no private admin fields.

---

## 8.6 Event management

Frozen terminology: **Event**, not generic editable Activity.

### GET `/ops/organizations/{orgId}/events`

Maps: **WF03-S07**.

### POST `/ops/organizations/{orgId}/events`

```json
{
  "name": "Chapter Summit",
  "programme_id": null,
  "starts_at": "2026-10-01T02:00:00Z",
  "ends_at": "2026-10-01T05:00:00Z",
  "timezone": "Asia/Ho_Chi_Minh",
  "registration_enabled": true
}
```

Rules:
- `programme_id` is nullable;
- standalone event is valid;
- if linked to Programme, actor must also have valid relationship/scope policy;
- event lifecycle: `DRAFT → PUBLISHED → LIVE → ENDED | CANCELLED → ARCHIVED`.

### GET `/events/{eventId}`

Permission-filtered detail.

### PATCH `/ops/events/{eventId}`

Updates event only in allowed lifecycle states.

### POST `/ops/events/{eventId}/publish`

Transitions `DRAFT → PUBLISHED` after required validation.

### POST `/ops/events/{eventId}/cancel`

Lifecycle-controlled cancellation.

### GET `/ops/events/{eventId}/registrations`

Returns operational registrations if registration is enabled.

P0 contract intentionally does not define advanced ticketing/check-in workflow beyond existing business scope.

---

## 8.7 Organization relationships/settings

### GET `/ops/organizations/{orgId}/relationships`

Maps: **WF03-S08**.

### POST `/ops/organizations/{orgId}/relationships`

```json
{
  "target_organization_id": "org_...",
  "relationship_type": "PARENT"
}
```

Relationship types are controlled configuration; do not hard-code unapproved categories in frontend.

### POST `/ops/organizations/{orgId}/relationships/{relationshipId}/close`

```json
{
  "ended_at": "2026-09-25T06:00:00Z",
  "reason": "Term ended"
}
```

Closes relationship while preserving history.

---

# 9. Internal Feedback & P0 Analytics

## GET `/ops/feedback`

Authorized Platform/Admin/Ops view of feedback.

Filters: `q`, `submitted_from`, `submitted_to`, cursor/limit.

P0 does not require a complex ticket workflow.

## GET `/ops/metrics/p0`

Returns metrics required by roadmap validation.

```json
{
  "registered_accounts": 92,
  "profiles_at_least_80_percent": 68,
  "profile_80_percent_rate": 0.739,
  "feedback_submissions": 42,
  "chapter_leader_coverage": {
    "covered": 13,
    "target": 13
  }
}
```

The backend/read model owns calculation. UI must not independently recalculate these from partial table data.

---

# 10. Analytics event contract

P0 minimum events:

```text
account_authenticated
account_created
onboarding_started
onboarding_completed
profile_saved
profile_completion_changed
consent_accepted
visibility_changed
feedback_submitted
membership_bootstrapped
membership_requested
```

Required common properties:

```json
{
  "event_name": "profile_saved",
  "occurred_at": "2026-09-25T06:00:00Z",
  "account_id": "acc_...",
  "profile_id": "prf_...",
  "workflow": "WF02",
  "screen_id": "WF02-S02"
}
```

Do not put private profile content into analytics payloads.

---

# 11. Core DTOs

## 11.1 OrganizationRefDTO

```json
{
  "id": "org_...",
  "slug": "hub-ha-noi",
  "name": "HUB Hà Nội",
  "type": "CHAPTER"
}
```

## 11.2 ConsentRecordDTO

```json
{
  "id": "con_...",
  "type": "PRIVACY_DATA_PROCESSING",
  "policy_version": "2026-09-29",
  "status": "ACCEPTED",
  "accepted_at": "2026-09-25T06:00:00Z",
  "revoked_at": null
}
```

## 11.3 MembershipDTO

```json
{
  "id": "mem_...",
  "organization": {"id": "org_...", "name": "HUB Hà Nội", "type": "CHAPTER"},
  "status": "ACTIVE",
  "source_type": "ORGANIZATION_VERIFIED",
  "valid_from": "2026-09-01",
  "valid_to": null
}
```

## 11.4 PublicProfileDTO

Contains only fields allowed by current visibility/policy. Private contact/account fields are absent, not null placeholders.

## 11.5 OwnProfileDTO

May include editable private fields required by the owner UI, but still excludes security/session secrets.

---

# 12. Authorization matrix by endpoint group

| Endpoint group | Required capability / policy |
|---|---|
| `/auth/*` | public + rate-limit/security policy |
| `/session` | public bootstrap / authenticated detail |
| `/me/*` | authenticated owner |
| `/profiles/:id` | visibility + relationship + role policy |
| `/ventures/*` | owner/team management relation |
| `/feedback` | authenticated individual |
| `/ops/organizations` | scoped organization/network read |
| `/ops/organizations/:id/members*` | `member:read` / mutation capability |
| `/ops/organizations/:id/profile` | `org:manage` |
| `/ops/organizations/:id/events*` | `event:manage` |
| `/ops/organizations/:id/relationships*` | `org:manage_relationship` |
| `/ops/feedback` | platform/authorized ops |
| `/ops/metrics/p0` | platform/authorized metrics role |

Frontend capability checks are UX only; every protected API call re-authorizes.

---

# 13. Lifecycle conflict rules

The API must return `409` rather than silently coercing invalid transitions.

Examples:

```text
Profile DEACTIVATED → edit                    DENY
Membership REJECTED → ACTIVE                  requires explicit reopen/new process
Event ENDED → PUBLISHED                       DENY
Consent REVOKED → mutate same record ACCEPTED DENY; create new acceptance record if policy permits
Closed organization relationship → edit      DENY; create a new relationship period
```

---

# 14. Endpoint → workflow/screen mapping

## WF01

| Screen | Endpoint(s) |
|---|---|
| WF01-S01 | `POST /auth/magic-link`, `GET /auth/providers` |
| WF01-S02 | `POST /auth/magic-link/resend` |
| WF01-S03 | `POST /auth/magic-link/consume`, `GET /session` |
| WF01-S04 | auth error codes; no unique resource endpoint |
| WF01-S05 | `GET /me/onboarding`, `PUT /me/onboarding/intent` |
| WF01-S06 | `GET/PATCH /me/profile`, avatar, vocabularies |
| WF01-S07 | `/legal/current`, `/me/consents*`, `/me/visibility` |
| WF01-S08 | `POST /me/onboarding/complete` |

## WF02

| Screen | Endpoint(s) |
|---|---|
| WF02-S01 | `/session`, `/me/profile`, `/me/network`, `/me/ventures` |
| WF02-S02 | `GET/PATCH /me/profile`, vocabularies |
| WF02-S03 | `/me/consents`, `/me/visibility` |
| WF02-S04 | `GET /me/network` |
| WF02-S05 | `/ventures` |
| WF02-S06 | `/ventures/:id/team*` |
| WF02-S07 | `/me/settings`, `/me/sessions`, `/me/notification-preferences`, deletion request |

## WF03

| Screen | Endpoint(s) |
|---|---|
| WF03-S01 | `GET /ops/organizations` |
| WF03-S02 | `GET /ops/organizations/:id/dashboard` |
| WF03-S03 | `GET /ops/organizations/:id/members` |
| WF03-S04 | member detail + membership/leadership mutations |
| WF03-S05 | `GET /ops/organizations/:id/programmes` |
| WF03-S06 | `PATCH /ops/organizations/:id/profile` |
| WF03-S07 | event CRUD/publish/registration ops |
| WF03-S08 | organization relationship endpoints |
| WF03-S09 | `GET /organizations/by-slug/:slug` |

---

# 15. Explicitly out of P0 API contract

Do **not** implement as production APIs for P0:

- full WF04 Programme creation/configuration/judging lifecycle;
- programme application submission/review workflow;
- mentor/judge/challenge-owner workflows;
- investor/fund/dataroom access;
- recommendation/matching engine;
- deep identity/CCCD document storage;
- generic editable `Activity` CRUD.

WF04/WF05 may use deterministic demo fixtures until promoted to production scope.

---

# 16. Definition of Done for API contract implementation

An endpoint is not complete until:

1. request/response schema implemented;
2. server-side authorization implemented;
3. lifecycle validation implemented;
4. structured errors implemented;
5. audit event added where required;
6. unit/integration test exists;
7. corresponding workflow E2E test passes;
8. frontend uses the contract without duplicating business rules.

---

# 17. Freeze notes for DB Schema v1

The following are intentionally deferred to the next task, **DB Schema v1**, and must not be guessed inconsistently by Claude:

- physical table names;
- UUID vs ULID choice;
- normalized profile section tables vs JSONB boundaries;
- venture physical model (`Project`/`Startup` table strategy);
- audit/outbox table implementation;
- session storage implementation;
- exact search indexes;
- literal launch taxonomy seed values;
- literal legal document version strings.

The API resource semantics above are frozen independently of those physical choices.

---

# 18. Amendment A1 — four-stage onboarding and open sign-up (2026-09-29)

Decision record: DEC-L1R in `docs/decisions/DECISION_LOG.md`. This section is appended so that the line references to the sections above stay valid; where it differs from §4, this section applies. No error code is added.

## 18.1 Sign-up

`POST /auth/magic-link` follows §4.1 as written: one flow for first-time creation and returning login, and no disclosure of whether an account exists. The invite-only overlay of DEC-AUTH-EMAIL-D1 (403 for an address that is not provisioned) is withdrawn. The account is created when the link is consumed, never by the request.

## 18.2 Onboarding state

`GET /me/onboarding` reports the first incomplete step of the four-stage flow:

```json
{
  "completed": false,
  "current_step": "BASIC",
  "intent": null
}
```

`current_step` is one of `INTRO`, `BASIC`, `CAPABILITY`, `ROLE`, `REVIEW`, or `null` once completed. `POST /auth/magic-link/consume` returns the same value as `onboarding.next_step`. `PUT /me/onboarding/intent` stays as in §4.2; no screen calls it and the state above does not depend on it.

### PUT `/me/onboarding/stage`

Maps: **WF01-S10** (ACC-07) and **WF01-S05** (ACC-08).

```json
{
  "completed": "CAPABILITY"
}
```

`completed` is `CAPABILITY` or `ROLE`. The server records the time once; a stage can be passed only when every stage before it is. Any other field is refused. Response `200` returns the onboarding state.

Errors: `PROFILE_VALIDATION_FAILED`, `ONBOARDING_REQUIREMENTS_MISSING`.

## 18.3 Own profile

`GET /me/profile` also returns `full_name`, `country`, `phone`, `specializations`, and for each experience record `started_on`, `ended_on` (months, `"YYYY-MM"`) and `description`. `PATCH /me/profile` also accepts `full_name`, `country_id`, `phone`, `specialization_ids` (at most five) and the three experience fields. `phone` and `full_name` are returned by this resource only, to the owner.

The limit of five items over `domain_ids` and `skill_ids` together is withdrawn.

Errors: `PROFILE_VALIDATION_FAILED`, `VOCABULARY_ITEM_INACTIVE`, `PROFILE_DEACTIVATED`.

`GET /vocabularies/{type}` also serves `COUNTRY` and `SPECIALIZATION`.

## 18.4 Declared roles

### GET `/me/onboarding/roles`

### PUT `/me/onboarding/roles`

Maps: **WF01-S05** (ACC-08).

```json
{
  "roles": ["HUB_MEMBER", "INNOVATOR"],
  "hub_claims": [
    {"organization_id": "org_...", "position": "Phó trưởng chapter", "period": "2024 – nay"}
  ]
}
```

Rules:
- `roles` is a subset of `HUB_MEMBER`, `INNOVATOR`, `STARTUP_FOUNDER`, `ORGANIZATION_REPRESENTATIVE`, `INVESTOR_REPRESENTATIVE`, `INNOVATION_ENTHUSIAST`;
- `hub_claims` needs `HUB_MEMBER`, names requestable organizations only, one claim per organization;
- the call replaces the declaration as a whole and works only while onboarding is open;
- a declaration creates no membership, leadership, RoleAssignment, capability or managed scope.

Response `200`: the stored declaration, each claim with its organization reference.

Errors: `PROFILE_VALIDATION_FAILED`, `PROFILE_DEACTIVATED`.

## 18.5 Complete onboarding

`POST /me/onboarding/complete` is sent by **WF01-S07** (ACC-09). The minimum of §4.6 is extended: full name, display name, country, region, stages `CAPABILITY` and `ROLE` passed, and acceptance of both current documents. On the first completion each `hub_claims` entry becomes a `CommunityMembership` in `PENDING_APPROVAL` with source `SELF_DECLARED`; an organization where a membership already stands is skipped.

Errors: `ONBOARDING_REQUIREMENTS_MISSING` with field/group details.

## 18.6 Endpoint → screen mapping

| Screen | Endpoint(s) |
|---|---|
| WF01-S09 (ACC-05) | `GET /me/onboarding` |
| WF01-S06 (ACC-06) | `GET/PATCH /me/profile`, avatar, vocabularies |
| WF01-S10 (ACC-07) | `GET/PATCH /me/profile`, vocabularies, `PUT /me/onboarding/stage` |
| WF01-S05 (ACC-08) | `GET/PUT /me/onboarding/roles`, `PUT /me/onboarding/stage` |
| WF01-S07 (ACC-09) | `/legal/current`, `/me/consents*`, `/me/visibility`, `POST /me/onboarding/complete` |
| WF01-S08 (ACC-10) | read only |

---

# 19. Amendment A2 — personal workspace, venture lifecycle and team (2026-09-29)

Decision record: DEC-L2R in `docs/decisions/DECISION_LOG.md`. Appended like §18 so that the line references above stay valid; where it differs from §5.3 and §5.4, this section applies.

## 19.1 Venture create and update

`POST /ventures` (WF02-S05, PRJ1):

```json
{
  "type": "PROJECT",
  "name": "Kho lạnh chia sẻ",
  "summary": "Chia sẻ kho lạnh theo giờ cho hộ kinh doanh nông sản nhỏ",
  "domain_ids": ["dom_..."],
  "stage_id": "stage_idea",
  "owner_role_label": "Founder",
  "region_id": null
}
```

Rules:
- `name`, `summary`, at least one `domain_ids` and `stage_id` are required; `stage_id` is an ACTIVE item of the controlled type `VENTURE_STAGE`;
- `owner_role_label` is display text (at most 100 characters) and grants nothing, in the venture or on the platform;
- the owner is the session's profile; owner, profile, status and permission keys are refused (`not_accepted`);
- every venture starts `DRAFT`; no endpoint publishes it (`submit-for-review` stays absent, §5.3);
- `Idempotency-Key` is honoured for the operation `venture.create`: the same key and body replay the first `201`; the same key with another body answers `409`.

`PATCH /ventures/{ventureId}` accepts `name`, `summary`, `domain_ids`, `stage_id`, `owner_role_label`, `region_id`. The owner and a member with `EDIT` may update; a member with `VIEW` gets `403 SCOPE_FORBIDDEN`; anyone else `404`. `owner_role_label` is the owner's alone. A required value that is stored cannot be cleared.

Venture DTO adds `stage`, `permission` (`OWNER | EDIT | VIEW`, the viewer's own) and `role_label` (the viewer's own role label). Create and update write audit events with ids, type, status and field names only.

## 19.2 Own ventures and invitations

`GET /me/ventures` (WF02-S08, ME7) returns `{ items, page }`: the ventures the session's profile owns or belongs to as an `ACTIVE` member, owned first, each a venture DTO with `members` and `pending_invitations` (the owner's only; `null` for a member). A pending invitation is not a relation.

`GET /me/venture-invitations` (WF02-S08) returns `{ items, page }`: the `PENDING_CONFIRMATION` invitations sent to the session account's own address, oldest first, each `{ venture: { id, name, type }, membership_id, role_label, permission, invited_at }`. Never another address's invitation, never one to a venture the account owns, never one to an archived venture.

## 19.3 Team

`POST /ventures/{ventureId}/team/invitations`:

```json
{ "email": "member@example.com", "role_label": "Co-founder", "permission": "EDIT" }
```

- `permission` is `EDIT` or `VIEW` (default `VIEW`); `OWNER` is ownership and is never given;
- the invitation is e-mailed inside the same transaction; when the e-mail cannot be sent nothing is created and the answer is `500 INVITATION_EMAIL_DELIVERY_FAILED` (decision code, DEC-L2R-D8);
- at most 20 pending invitations per venture (`422`, `email: too_many_pending`);
- sends in the last 24 hours, counted over every state: at most 3 to one address of one venture and 50 by one inviting profile; beyond that `429 INVITATION_RATE_LIMITED` (decision code, DEC-L2R-D13) and nothing is created or sent;
- nobody joins before accepting (§5.4 unchanged).

`PATCH /ventures/{ventureId}/team/{membershipId}` accepts `role_label` and/or `permission` on an `ACTIVE` member. Team rows carry `permission`; the owner row carries `OWNER` and the owner's role label. Invitation by link is not part of the contract (D-T1).

## 19.4 Profile

`PATCH /me/profile` accepts `education`: a list replaced as a whole, each `{ institution, programme, started_on, ended_on }` with months `YYYY-MM`; `institution` is required; an end needs a start and cannot precede it; at most 20 items. The DTO returns the months.

## 19.5 Endpoint → screen mapping

| Screen | Endpoint(s) |
|---|---|
| WF02-S01 (FP1-OWN) | `GET/PATCH /me/profile`, `/me/profile/completion`, `/me/network`, `/me/ventures` |
| WF02-S05 (PRJ1–PRJ3, editor) | `POST /ventures`, `GET/PATCH /ventures/{id}`, `POST /ventures/{id}/publish` (§20), `POST …/team/invitations`, vocabularies |
| WF02-S06 (team) | `/ventures/{id}/team*` |
| WF02-S07 (ME0) | as §14, plus `/me/venture-invitations` |
| WF02-S08 (ME7) | `GET /me/ventures`, `GET /me/venture-invitations`, `POST …/invitations/{id}/accept`, `…/decline` |

---

# 20. Amendment A3 — Alpha PO decision freeze (2026-09-29)

Source: [DEC-PDF](../decisions/DECISION_LOG.md#dec-pdf). Additive; nothing above changes except where named.

## 20.1 Venture publication

`POST /ventures/{ventureId}/publish` — no body. The owner only (`403 SCOPE_FORBIDDEN` for a member, the same `404` for anyone else, `401` for a guest). The venture must hold `name`, at least one of `domain_ids`, `summary`, `stage_id` and the creator's `owner_role_label`; otherwise `422 PROFILE_VALIDATION_FAILED` with each missing field as `required`, and nothing changes. `ARCHIVED` is `409`. Success is `200` with the venture: `status` `ACTIVE` (a `DRAFT` becomes `ACTIVE`), `visibility` `PUBLIC`; a public venture answers as it is. Audited as `VENTURE_PUBLISHED`. No review, approval or moderation step exists; `submit-for-review` stays absent (§5.3). `PATCH /ventures/{id}` refuses `visibility` and `status`, and a public venture keeps its `owner_role_label`.

The venture DTO gains `visibility` (`PRIVATE` | `PUBLIC`) and `stage.code`. PUBLIC is the owner's choice recorded on the record; no public venture read path exists in P0, so a PUBLIC venture is still read only by its team.

## 20.2 Stages

`stage_id` references one `VENTURE_STAGE` item; the stable codes are `IDEA`, `MVP`, `PILOT`, `SELLING`, `GROWTH` (labels Ý tưởng, MVP, Pilot / Thử nghiệm, Đang bán, Tăng trưởng). A code or a label is not accepted in place of the id.

## 20.3 Invitation e-mail

The approved copy: subject "Bạn được mời tham gia {venture} trên 1hub.network"; body "{inviter} mời bạn tham gia {venture} với vai trò {role}." (without a role the sentence ends at the venture); call to action "Xem lời mời" to `/projects`. No token, id or level in the message. Invitation by link is deferred and has no endpoint.

## 20.4 HUB declarations

A membership filed from the onboarding declaration carries `declaration: true` in the ops DTOs (§8.3). `PATCH /ops/organizations/{orgId}/memberships/{membershipId}` decides such a membership only with `membership:confirm` held platform-wide (Platform Admin); an organization-scoped holder gets `403 SCOPE_FORBIDDEN` and nothing changes. The member detail's `permissions` follow the same rule. Ordinary join requests are unchanged.

---

# 21. Amendment A4 — server-side application, L5 (2026-09-29)

Source: [DEC-L5](../decisions/DECISION_LOG.md#dec-l5). Additive; supersedes §15 for application submission only (review stays out of P0). Session required; onboarding DONE; the caller must own the venture (relation rule, outside the RBAC matrix). Anyone else, a malformed id or an unknown id gets the same `404`; a member who is not the owner gets `403 SCOPE_FORBIDDEN` on create.

## 21.1 Endpoints
| Call | Rule |
|---|---|
| `GET /me/applications` | the caller's applications: `id`, `status`, `programme {id, name}`, `venture {id, name, type}`, `updated_at`, `submitted_at` |
| `POST /applications` `{venture_id, programme_id}` | the programme is PUBLISHED with an application form (else `404`); the venture is not ARCHIVED and its applicant type is accepted (else `409 APPLICATION_NOT_ELIGIBLE` with `reason`); an active pair exists → `409 APPLICATION_EXISTS` with `application_id`; `201` with the DRAFT. Idempotent: `application.create` |
| `GET /applications/{id}` | the application: a DRAFT with the live venture, team and form; a SUBMITTED one from its snapshot only; `missing` lists unanswered required question ids |
| `PATCH /applications/{id}` `{answers: [{question_id, value}]}` | DRAFT only (`409 APPLICATION_SUBMITTED`); known question ids; `value` ≤ 2000 characters; an empty value clears the answer; `422 APPLICATION_VALIDATION_FAILED` otherwise |
| `POST /applications/{id}/submit` | no body; eligibility re-checked; every required answer present (else `422 APPLICATION_INCOMPLETE`, each missing id as `required`); SUBMITTED and the snapshot in one transaction; a second submit `409 APPLICATION_SUBMITTED`. Idempotent: `application.submit` |

## 21.2 Rules
The application references the venture and the programme and stores only its answers; the snapshot (`schema_version` 1: programme, questions, answers, venture, team without e-mails or account ids, `submitted_at`) is written once. Audit: `APPLICATION_DRAFT_CREATED`, `APPLICATION_SUBMITTED` (ids and statuses, never answers). No uploads, application code or e-mail.


---

# 22. Amendment A5 — WF04 programmes, production v1 (2026-10-02)

Source: [DEC-W4P](../decisions/DECISION_LOG.md#dec-w4p) (D02, D11, D12) and the [WF04 production contract](../implementation/reports/WF04_PRODUCTION_CONTRACT.md) §4–§14. Additive; supersedes §15 for WF04 creation, configuration, publication and closing only (judging, review and the WF03-S05 unit list stay out). Session required; onboarding DONE (else `403 SCOPE_FORBIDDEN`). Authority is `programme:read` / `programme:manage` on the programme's stored owning organization (`HUB_COMMUNITY_LEADER` of exactly that organization, or `PLATFORM_ADMIN`); nothing in a header, query or body names a role or a scope. An unknown, malformed or out-of-scope id gets the same `404`.

## 22.1 Endpoints
| Call | Rule |
|---|---|
| `GET /programmes` | the programmes of every organization the caller holds `programme:read` for; list envelope (`limit` 200, no cursor); none anywhere → `403 SCOPE_FORBIDDEN`. No public list in v1 |
| `POST /programmes` `{type, organization_id, name, summary?, starts_at?, ends_at?}` | `programme:manage` on `organization_id` (else `403 SCOPE_FORBIDDEN`; an unknown organization looks the same); owner HUB / CHAPTER / CLB; `201` with the DRAFT detail. Idempotent: `programme.create` |
| `GET /programmes/{id}` | `programme:read`; `{programme, organization, stages, problem_statements (CHALLENGE only), events (linked, read only), registration (form or null), owner_archived, actions {edit, registration, publish, close}}`; `actions` is computed by the server (amendment PROD-04) |
| `PATCH /programmes/{id}` `{name?, summary?, starts_at?, ends_at?, stages?, problem_statements?}` | `programme:manage`; DRAFT or PUBLISHED (else `409`); lists replace the stored list; `type` and `organization_id` are `immutable`, any other key `not_accepted`; `problem_statements` on a PROGRAMME → `not_challenge` |
| `PUT /programmes/{id}/registration` `{applicant_types, questions}` | `programme:manage`; DRAFT or PUBLISHED; applicant types TEAM / STARTUP (≥ 1); each question `{id?, prompt, required, step 1–4}`; a change bumps `version`; refused with `409` once an application exists |
| `POST /programmes/{id}/publish` | no body; DRAFT → PUBLISHED; rules: name, end ≥ start (all failing fields at once, `422`); not DRAFT → `409`. Idempotent: `programme.publish` |
| `POST /programmes/{id}/close` | no body; PUBLISHED → CLOSED; otherwise `409`. Idempotent: `programme.close` |

## 22.2 Rules
An owning organization that is ARCHIVED keeps its programmes readable; every write on them and a new programme for it get `409` (PO, DEC-W4P-D13). Errors use existing codes only: `422 PROFILE_VALIDATION_FAILED` with `fields` (reasons `required`, `invalid`, `too_long`, `too_many`, `duplicate`, `before_start`, `not_accepted`, `immutable`, `not_challenge`, `empty`), `409 MEMBERSHIP_INVALID_TRANSITION`, `403 SCOPE_FORBIDDEN`, and for 401, 404 and an idempotency conflict the existing gap codes of the implementation (no code is added). The Idempotency-Key is honoured when sent and a missing key is processed (provisional rule I5). Stages are `metadata.journey` and problem statements `metadata.challenge` (`schema_version` 1); no other metadata key is writable. A stage, problem or question sent without an `id` gets one derived from its position and content, so a retried replacement writes the same list; a client keeps an item's identity by sending its `id` back. ARCHIVED has no endpoint (DEFERRED, DEC-W4P-D11); events are never written here. Audit: `PROGRAMME_CREATED`, `PROGRAMME_UPDATED` (field names), `PROGRAMME_REGISTRATION_UPDATED` (versions), `PROGRAMME_PUBLISHED`, `PROGRAMME_CLOSED`, with ids, type and status only. Applications stay §21: a PUBLISHED programme with a form is open to them, a CLOSED one is not.


---

# 23. Amendment A6 — WF05 application hardening (2026-10-02)

Source: [DEC-W5P](../decisions/DECISION_LOG.md#dec-w5p) (D04–D07) and the [WF05 production contract](../implementation/reports/WF05-PROD-01_production-contract.md); implemented by WF05-PROD-03. Additive to §21: no new endpoint, error code or status.

## 23.1 Changes
| Call | Change |
|---|---|
| `GET /me/applications` | the §2.4 list envelope `{items}`; every own application in every programme state; each item's `programme` adds `status` (DRAFT \| PUBLISHED \| CLOSED \| ARCHIVED) |
| `GET /applications/{id}` | adds `editable` (boolean) and `reason` (`SUBMITTED` \| `NOT_PUBLISHED` \| `ARCHIVED` \| null); a DRAFT of a programme no longer PUBLISHED returns its questions and saved answers, read only |
| `PATCH /applications/{id}` | an ARCHIVED venture → `409 APPLICATION_NOT_ELIGIBLE` with `reason: ARCHIVED`; `answers` holds at most one entry per form question: more → `422` `too_many`, a repeated question → `422` `duplicate` |
| `POST /applications`, `PATCH`, `POST …/submit` | the programme and form rows are held `FOR SHARE` for the transaction: a concurrent `PUT /programmes/{id}/registration` or close waits, and a registration change then refuses with `409` because an application exists |
| `/ventures/{id}*`, `/demo/projects/{id}` | a malformed id (also a 36-character non-UUID) is the same `404` as an unknown one, never a `500` |

## 23.2 Rules
Authority is unchanged: the venture owner only (ACTIVE members `403` on create, `404` elsewhere; operators `404`). Audit stays `APPLICATION_DRAFT_CREATED` and `APPLICATION_SUBMITTED` with ids and statuses, never answers; draft saves are not audited (WF05 contract; superseded by A7, §24.2). An unexpected server error keeps the generic envelope and is logged server side with its `request_id`, never with the request body.

---

# 24. Amendment A7 — WF05 validation status and draft-save audit (2026-10-03)

Source: [DEC-W5P-D11 / D12](../decisions/DECISION_LOG.md#dec-w5p-d11) (WF05-PROD-05, PO carry-forward items A and B). No new endpoint, error code or status.

## 24.1 Validation status (WF05)
| Request | Answer |
|---|---|
| body not JSON, not an object; field missing, unknown, forbidden (`status`, owner, applicant), mistyped, too long, repeated or extra; an answer to an unknown question | `422 APPLICATION_VALIDATION_FAILED`, `fields` with the reason (`body: invalid` for an unreadable body) |
| submit with a required answer missing | `422 APPLICATION_INCOMPLETE`, each missing id `required` |
| malformed or unknown id | `404` (the hidden-resource answer) |
| lifecycle conflict, duplicate pair, submitted, not eligible | `409` |
| `400` | never from a WF05 handler; the router's `400` for an undecodable path (`%`) is global and outside the envelope (G14); WF01 auth keeps its own `400` codes (§4.1) |

## 24.2 Audit (WF05)
| Action | Written when | `after_data` |
|---|---|---|
| `APPLICATION_DRAFT_CREATED` | create | `programme_id`, `venture_id`, `status` |
| `APPLICATION_DRAFT_UPDATED` | a `PATCH` that changes at least one answer | `programme_id`, `venture_id`, `status: DRAFT`, `changed_questions` (ids) |
| `APPLICATION_SUBMITTED` | submit (`before`: `status: DRAFT`) | `programme_id`, `venture_id`, `status: SUBMITTED` |
Every row carries `actor_account_id`, the application id, `request_id` and `created_at`, in the mutation's transaction; never an answer value. A save that changes nothing and every refused call write nothing.

---

# 25. Amendment A8 — WF06 Library read API (2026-10-04)

Source: [DEC-W6P](../decisions/DECISION_LOG.md#dec-w6p) (D01–D05) and the [WF06 runtime contract](../implementation/reports/WF06-PROD-01_runtime-contract.md) / [API–data contract](../implementation/reports/WF06-PROD-01_api-data-contract.md); implemented by WF06-PROD-03. Additive: three read endpoints for the existing `/library` tabs and a bound on §8.5. No write endpoint, no new error code or status, no member directory, no venture, programme or challenge page or list beyond the Library tab, no matching, ranking or recommendation.

## 25.1 Endpoints
| Call | Rule |
|---|---|
| `GET /library/startups` | No session needed; the same answer for every caller. Canonical ventures `type STARTUP`, `status ACTIVE`, `visibility PUBLIC`, plus the external directory's records without a canonical twin (same case- and accent-folded name: the canonical one wins; a repeated external name keeps its first record). `?q=&domain_id=&stage_id=&sort=STAGE\|NAME&cursor=&limit=`. Item: `key`, `name`, `summary`, `stage {code, label}` or null, `domains [{id, label}]`, `domain_labels`, `region`, `website`, `member_count`. Beside the envelope: `total`, `facets {domain [{id, label, count}], stage [{id, code, label, count}]}`, `degraded` (true while the external directory is unavailable; canonical rows are still served) |
| `GET /library/founders` | Session optional. A member (live session of an ACTIVE account) gets the owners of listed startups whose PROFILE_DISCOVERY is NETWORK_ONLY and whose account and profile are ACTIVE; item `key`, `display_name`, `avatar_url`, `ventures [{name, role_label, stage}]`, `domain_ids`. Anyone else gets `items: []` with `restricted: true`. `?q=&domain_id=&sort=NAME&cursor=&limit=`; `total`, `facets {domain}`. External founders never appear |
| `GET /library/problems` | No session needed. The "Bài toán" file. `?q=&domain=&stage=&area=&sort=DEADLINE\|PRIZE&cursor=&limit=`; the facet values are the file's own text and a value it does not hold matches nothing. Item `key`, `title`, `summary`, `org`, `stage {code, label}`, `prize`, `time`, `teams`, `domains`, `areas`, `cover`; `total`, `facets {domain, stage, area: [{value, label, count}]}` |

## 25.2 Rules
| Topic | Rule |
|---|---|
| envelope | §2.4 `items`, `page {next_cursor, limit}`; `limit` 1–50, default 9; the cursor is opaque and stateless (it survives a restart) |
| keyword | NFC, whitespace collapsed, trimmed, ≤ 120 characters, no control character; blank means none; every word must appear, case- and accent-folded; `%` and `*` are plain characters; no fuzzy, semantic or scored search |
| filters | a repeated parameter means any of its values (≤ 10 per parameter); `domain_id` / `stage_id` are ACTIVE DOMAIN / VENTURE_STAGE ids; facet counts apply the keyword and the other filters, as the page does |
| order | startups `STAGE`: GROWTH, SELLING, PILOT, MVP, IDEA, none; then name (vi), canonical before external, then `key`. `NAME`: name, then the same ties. Founders: name, then `key`. Problems: the existing `DEADLINE` and `PRIZE`. The same request on the same data gives the same order |
| errors | `422 PROFILE_VALIDATION_FAILED` with `fields` (`invalid`, `unknown`, `too_long`, `too_many`, `duplicate`, `not_accepted`), every failing field at once; any other parameter is refused, never ignored; an unexpected fault keeps the generic envelope and is logged without the request. No `401` or `403` (a guest gets the restricted answer) and no `429` (no rate-limit layer; G14) |
| privacy | no record UUID, slug, owner or account id, e-mail or private profile field; `key` is derived per record and resolvable by no endpoint; `Cache-Control: private, no-store`; reads are not audited |
| §8.5 | `children` holds at most 200 organizations, by name; `stats.children` stays the total |

---

# 26. Amendment A9 — Role verification queue (2026-10-04)

Source: [DEC-ADM](../decisions/DECISION_LOG.md#dec-adm) (PD-1; ADMIN-PROD-03 rules R1–R6) and the frozen [Admin Portal P0 contract](../implementation/reports/ADMIN-PROD-01-runtime-contract.md) §A; implemented by ADMIN-PROD-03. Additive: the unit side of the RoleVerificationRequest (one declared HUB position = one request). The user side (create, edit, withdraw, resubmit) is Sprint1 S1-UAT-03B's on the same table. No new error code; one new idempotent operation, `verification.decide` (optional header, §2.3).

### GET `/ops/verification-requests`
The viewer's queue: requests whose receiving unit (`routed_to`, fixed at submission by the CLB → Chapter → HUB Tổng fallback) is a unit where the viewer holds `verification:review`; every request for PLATFORM_ADMIN. `?status=` (`PENDING` default, `APPROVED`, `REJECTED`, `WITHDRAWN`) `&organization_id=` (the position's unit) `&routed_to=&cursor=&limit=` (1–50, default 20; any other value `422`); order `submitted_at`, then id; the cursor is an opaque keyset on that order, so decisions between pages never make the next page skip a request. Item: `id`, `status`, `version`, `position {title, organization {id, name, type}, period_from, period_to, current}` (months `YYYY-MM`), `routed_to {id, name, type}`, `fallback`, `requester {profile_id, display_name}`, `submitted_at`, `handled_at`, `can_act` (display only). Beside the envelope: `counts {pending}` in the viewer's scope — how a submission reaches handlers (no per-handler notification).

### GET `/ops/verification-requests/{requestId}`
The item plus `requester {profile_id, display_name, headline?, avatar_url?}` through PROFILE_DISCOVERY for a network viewer (no ops bypass; hidden → `display_name: null`), `reject_reason`, `handler_profile_id`, `context {memberships [{state, source_type, declaration, started_at, ended_at}], leadership [{title, state, started_at, ended_at}]}` in the position's unit, and `history [{event, at, by: REQUESTER | HANDLER | SYSTEM, status, routed_to, reason}]`. No e-mail, phone, full name, account id or other profile field.

### POST `/ops/verification-requests/{requestId}/approve`
Body `{ version }`. Effects in one transaction (never a RoleAssignment): a current term (no `period_to`) → an ACTIVE LeadershipRecord for the title plus an ACTIVE membership of the position's unit; an ended term → an ALUMNI LeadershipRecord with the term's months, no membership. Existing records are reused, never duplicated (R2). Returns the request as in the detail.

### POST `/ops/verification-requests/{requestId}/reject`
Body `{ version, reason? }`; the reason is optional (trimmed, ≤ 500, blank = none) and shown to the requester. The request is kept, `REJECTED`; the requester may edit and resubmit (S1-UAT-03B).

## 26.1 Rules
| Topic | Rule |
|---|---|
| scope | from the session's grants on the server; a request outside it, an unknown id and a malformed id are the same `404`; a viewer with no grant gets `403 SCOPE_FORBIDDEN` on the list; a `routed_to` filter outside scope `403` |
| self | nobody decides their own request, PLATFORM_ADMIN included: `403 SCOPE_FORBIDDEN`, the attempt audited (`VERIFICATION_REQUEST_SELF_ACTION_REFUSED`) |
| lifecycle | only `PENDING`, only the `version` the handler saw; otherwise `409 MEMBERSHIP_INVALID_TRANSITION`; the handler's grant is re-read in the transaction (revoked → refused); the second of two racing decisions gets `409`; an approval over a SUSPENDED membership, or for a requester whose profile or account is not ACTIVE, or on an unpublished unit → `409`, the request stays `PENDING` |
| errors | `422 PROFILE_VALIDATION_FAILED` with `fields` (`invalid`, `not_accepted`, `duplicate`, `too_long`); any other parameter or body key is refused |
| idempotency | `Idempotency-Key` optional on approve / reject (`verification.decide`): a retry replays the stored answer; the same key with another body `409` |
| audit | `VERIFICATION_REQUEST_APPROVED` or `…_APPROVED_EXISTING_MEMBERSHIP` (membership / leadership outcomes and ids), `…_REJECTED` (reason), `…_SUBMITTED`, `…_MIGRATED` (system); ids, statuses, scope and the reason only |
| notifications | APPROVED / REJECTED → one in-system notice to the requester; none on submission or withdrawal; no e-mail |

---

# 27. Amendment A10 — Venture review and organization access (2026-10-04)

Source: [DEC-ADM](../decisions/DECISION_LOG.md#dec-adm) (PD-2, PD-3, PD-6; ADMIN-PROD-04 rules R7–R11) and the frozen [Admin Portal P0 contract](../implementation/reports/ADMIN-PROD-01-runtime-contract.md) §B, §C; implemented by ADMIN-PROD-04. Additive. The owner side of venture review ("Gửi duyệt", saving core fields) is Sprint1 S1-UAT-06's on the same `venture_reviews` rows, through the shared writers `submitVentureForReview` / `saveVentureCore`; until it ships, §20.1 self-publication stays as it is. No new error code; two idempotent operations, `venture.review` and `access.grant-or-revoke` (optional header, §2.3).

### GET `/ops/venture-reviews`
PLATFORM_ADMIN only (`venture:review`); anyone else `403 SCOPE_FORBIDDEN`. `?status=` (`PENDING` default, `APPROVED`, `REJECTED`, `WITHDRAWN`) `&kind=` (`FIRST_PUBLISH`, `CORE_CHANGE`) `&venture_id=&cursor=&limit=` (1–50, default 20; keyset on `submitted_at`, id); any other value `422`. Item: `id`, `kind`, `status`, `version`, `venture {id, type, name, status, visibility}` (the live row), `proposed_name`, `changed_fields` (core fields that would change publicly; every set one for a first publication), `owner {profile_id, display_name}`, `submitted_at`, `reviewed_at`, `can_act`; beside the envelope `counts {pending}`.

### GET `/ops/venture-reviews/{reviewId}`
The item plus `public_version` (the approved public core, null before the first publication), `proposed`, `diff [{field, before, after}]`, `vocabulary {id: label}`, `logo {public, proposed}` (`asset_id`, `url`, `content_type`, `byte_size`), `owner {profile_id, display_name, headline?}` through PROFILE_DISCOVERY, `reject_reason`, `reviewer_profile_id`, `history [{event, at, by: OWNER | TEAM | REVIEWER | SYSTEM, status, reason}]`, `previous_reviews`. Non-reviewers and unknown or malformed ids: the same `404`.

### POST `/ops/venture-reviews/{reviewId}/approve`
Body `{ version }`. The candidate is written onto the SAME `projects` row (core fields, sectors replaced); a first publication becomes ACTIVE / PUBLIC (`VENTURE_PUBLISHED` on the venture too). The owner is notified.

### POST `/ops/venture-reviews/{reviewId}/reject`
Body `{ version, reason? }` (optional, ≤ 500). The live row is untouched; the review is kept; the owner edits and resubmits (a new review, `VENTURE_REVIEW_RESUBMITTED`). The owner is notified.

### GET `/ops/organizations/{orgId}/access`
`?state=ACTIVE|CLOSED|ALL` (default ACTIVE). The unit's grantable-role assignments (HUB_COMMUNITY_LEADER, whole role or one capability): `id`, `role_code`, `capability`, `grantee {profile_id, display_name}`, `granted_by_profile_id`, `created_at`, `revoked_at`, `state`, `effective`, `can_revoke`. Readers = grantors: PLATFORM_ADMIN or `access:delegate` on the unit or its canonical parent; others, unknown and malformed units `403`.

### POST `/ops/organizations/{orgId}/access`
Body `{ grantee_profile_id, capability? }` (absent / null = the whole role) → `201`. PD-6 on the server: own unit or a direct child; a delegable capability the grantor holds there, the whole role only from its holder; never platform-scoped, never to oneself; ARCHIVED target or source `409`; grantee an ACTIVE profile and account (`422`); a live identical grant `409`.

### GET `/ops/organizations/{orgId}/access/history`
Every grant and revocation of the unit from the audit trail, oldest first: `event` (GRANTED / REVOKED), `at`, `grant_id`, `actor_profile_id`, `grantee_profile_id`, `role_code`, `capability`.

### POST `/ops/organizations/{orgId}/access/{grantId}/revoke`
ACTIVE → CLOSED now (`revoked_at`); the grantor, `access:delegate` on the unit or its parent, or PLATFORM_ADMIN. Effective on the grantee's next request. A grant of another unit `404`; not active `409`.

## 27.1 Rules
| Topic | Rule |
|---|---|
| public version | `projects` is the approved version and the only thing a public surface reads; a core change of a PUBLIC venture waits in its review; nothing unapproved is public |
| edit while pending | one PENDING review per venture; a save updates its candidate and `version`; a decision on an older `version` is `409`; an approval that lands first makes the next save open a new review |
| self | a reviewer never decides a venture they own or belong to (`403`, audited) |
| website / logo | `website` http / https only, ≤ 500, normalised; `logo_asset_id` an asset of the media store uploaded by the editor or owner, PNG / JPEG / WebP, ≤ 2 MB; a reviewer may fetch a referenced logo at `/media/assets/{id}`; no business registration or tax code field |
| audit | `VENTURE_REVIEW_SUBMITTED` / `_RESUBMITTED` / `_UPDATED` / `_APPROVED` / `_REJECTED` / `_SELF_ACTION_REFUSED`; `ACCESS_GRANTED` / `ACCESS_REVOKED`; ids, codes, versions and the optional reason only |
| notifications | venture approve / reject → the owner; grants and revocations → none (no such notice in the contract) |
