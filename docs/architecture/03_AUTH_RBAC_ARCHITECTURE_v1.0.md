# 1HUB.NETWORK — AUTH / RBAC ARCHITECTURE v1.0

**Status:** FROZEN FOR P0 IMPLEMENTATION  
**Principle:** Identity, profile, role, membership, verification, consent and visibility are different dimensions.

---

## 1. Authentication model

### P0
Use the current/local account mechanism behind an `AuthProvider` abstraction.

```text
UserAccount
  ├── LocalCredential / current auth provider   [P0]
  └── ExternalIdentity                          [later]
          └── provider = 1HUB / VNeID
```

The web session should use a secure HTTP-only cookie. Browser code must not be the source of truth for authentication state.

### Future 1Hub/VNeID
Future identity verification attaches to the existing `UserAccount` / `IndividualProfile`; it does not create a second profile.

`IdentityVerificationRecord` stores only the minimum status/reference needed by 1hub.network. Sensitive identity documents remain outside 1hub.network unless explicitly required later.

---

## 2. Authorization model

Use **RBAC + scope + relationship/policy predicates**.

A permission decision is:

```text
ALLOW = authenticated
        AND role permits action
        AND scope contains resource
        AND resource relationship is valid
        AND visibility/consent policy allows data access
        AND role assignment is active
```

Do not implement authorization as a single global role string on `UserAccount`.

---

## 3. Canonical role assignment

```text
RoleAssignment
- id
- individual_profile_id
- role_code
- scope_type
- scope_id
- valid_from
- valid_to
- status
- assigned_by
```

### Scope types

```text
PLATFORM
ORGANIZATION
PROGRAMME
EVENT          [only when event-specific role is required]
TEAM
STARTUP
SOLUTION
```

---

## 4. Role catalogue

### P0 relevant
- `INDIVIDUAL_USER`
- `HUB_MEMBER`
- `HUB_COMMUNITY_LEADER`
- `PLATFORM_ADMIN`

### Designed now, activated later
- `ORGANIZATION_REPRESENTATIVE`
- `STARTUP_MEMBER`
- `PROGRAMME_ORGANIZER`
- `CHALLENGE_OWNER_REPRESENTATIVE`
- `JUDGE`
- `MENTOR`
- `ADVISOR`
- `INVESTMENT_FUND_REPRESENTATIVE`

Role badges displayed in profile UI do not themselves grant permission.

---

## 5. P0 authorization matrix

| Resource / Action | Individual | HUB Member | Community Leader | Platform Admin |
|---|---:|---:|---:|---:|
| View own profile | ✓ | ✓ | ✓ | ✓ by admin policy |
| Edit own profile | ✓ | ✓ | ✓ | admin support only |
| Edit own visibility | ✓ | ✓ | ✓ | support/audit only |
| Submit feedback | ✓ | ✓ | ✓ | ✓ |
| View own membership/history | ✓ | ✓ | ✓ | ✓ |
| View organization member list | — | — | scoped org only | ✓ |
| View member detail for ops | — | — | scoped org only | ✓ |
| Confirm membership | — | — | scoped org only | ✓ |
| Manage leadership records | — | — | only if parent/authorized policy allows | ✓ |
| View P0 aggregate metrics | — | — | optional scoped metrics | ✓ |
| Manage controlled vocab | — | — | — | ✓ |

The exact button visibility in the frontend may be derived from permissions, but API permission checks are authoritative.

---

## 6. Policy evaluation examples

### Example A — edit own profile

```text
actor.profile_id == resource.profile_id
AND profile.status != DEACTIVATED
```

### Example B — Leader views Chapter member

```text
hasRole(HUB_COMMUNITY_LEADER, ORGANIZATION, chapter_id)
AND target has membership in chapter_id
AND role assignment is ACTIVE
```

### Example C — Programme Organizer views applications — later

```text
hasRole(PROGRAMME_ORGANIZER, PROGRAMME, programme_id)
AND application.programme_id == programme_id
```

### Example D — Investor views restricted startup data — future

```text
hasRole(INVESTMENT_FUND_REPRESENTATIVE, ORGANIZATION, fund_id)
AND AccessGrant recipient == fund_id
AND AccessGrant.status == ACTIVE
AND requested data group in grant scope
AND grant not expired/revoked
```

---

## 7. Membership bootstrap and role activation

P0 soft launch:

```text
MembershipInvite(email, organization, intended_role)
    ↓ verified account email match
CommunityMembership = ACTIVE
    ↓ when intended leadership exists
LeadershipRecord = ACTIVE
    ↓ only if management permission required
RoleAssignment(HUB_COMMUNITY_LEADER, ORGANIZATION, org_id)
```

Membership and leadership records remain business/history records. RoleAssignment is the permission-bearing record.

---

## 8. Consent / visibility authorization order

For data reads:

```text
1. Is resource discoverable at all?
2. What profile data group is requested?
3. What is the owner's visibility setting?
4. Does actor have network/programme/scoped relationship?
5. Is explicit grant/consent required?
6. Is role assignment active?
7. Return only allowed fields.
```

Do not fetch a full private object to the client and hide fields in React.

Prefer server DTO/projection filtering:

```text
GET /profiles/{id}
→ returns representation appropriate for requester context
```

---

## 9. Session & security baseline

- HTTP-only, Secure, SameSite session cookie.
- CSRF protection for state-changing browser requests when applicable.
- password hashing with current strong algorithm from selected auth library.
- email verification token is one-time and expires.
- brute-force/rate-limit auth endpoints.
- session revocation on password/security changes.
- no sensitive role/scope claims trusted solely from client-side storage.
- correlation/request ID in logs.
- audit changes to role, membership, leadership, visibility and consent.

---

## 10. Frontend guard pattern

Frontend guards are UX helpers only:

```text
route metadata → required capability
      ↓
GET /me/capabilities or session bootstrap
      ↓
show/hide navigation
```

Every protected API endpoint independently authorizes the request.

---

## 11. Recommended authorization API inside backend

```text
authorize(actor, action, resourceContext)
can(actor, action, resourceContext) -> bool
require(actor, action, resourceContext) -> throws Forbidden
```

Centralize policies in Governance/Auth, not scattered `if role == ...` checks throughout controllers.

