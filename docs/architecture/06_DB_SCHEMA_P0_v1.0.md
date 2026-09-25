# 1HUB.NETWORK — PHYSICAL DB SCHEMA P0 v1.0

**Status:** FROZEN FOR P0 IMPLEMENTATION  
**DB:** PostgreSQL  
**Scope:** WF01–WF03 Production/Internal only. WF04+ tables are schema-ready only where needed by current P0 references.

## Principles

- UUID primary keys generated server-side/database-side.
- All timestamps are UTC `timestamptz`.
- Business history is closed/archived; do not hard-delete canonical relationships after activity exists.
- `UserAccount`, `IndividualProfile`, and future `IdentityVerification` remain separate concerns.
- `CommunityMembership`, `LeadershipRecord`, and `RoleAssignment` are separate records.
- Canonical taxonomy uses IDs (`REGION`, `DOMAIN`, `SKILL`), never raw free-text as searchable taxonomy.
- Terms/privacy acceptance is versioned and separate from profile visibility.
- Project/Startup is canonical and reusable across programmes.
- Event is canonical and may optionally belong to a Programme.

## P0 tables

### Identity / profile
- `user_accounts`
- `auth_magic_link_requests`
- `user_sessions`
- `individual_profiles`
- `profile_domains`
- `profile_skills`
- `profile_experience`
- `profile_education`
- `profile_links`
- `profile_visibility_settings`
- `legal_documents`
- `consent_records`

### Network / organizations
- `organizations`
- `organization_relationships`
- `community_memberships`
- `leadership_records`
- `role_assignments`
- `membership_bootstrap`

### Project / startup
- `projects`
- `project_members`

### Programme / Event foundation
- `programmes`
- `events`

### Co-create / ops
- `feedback_submissions`
- `audit_events`
- `analytics_events`

### Controlled vocabulary
- `vocabulary_types`
- `vocabulary_items`

## Key constraints

1. `individual_profiles.account_id` is unique: one account has one root profile.
2. `community_memberships` has at most one open membership per `(profile_id, organization_id)`.
3. A self-selected organization never creates `ACTIVE` membership automatically; P0 fallback state is `PENDING_APPROVAL`.
4. `projects.owner_profile_id` identifies the canonical creator/owner; team membership lives in `project_members`.
5. `events.programme_id` is nullable to support standalone events.
6. Consent record uniqueness is by `(account_id, consent_type, document_version)`; acceptance is append-only/audited.
7. Visibility is mutable configuration and is not consent.
8. Taxonomy items are archived, not removed from historical references.

## Profile completion

Completion is derived in service/query logic from the frozen 10 groups. It is **not** accepted from the client and is **not** stored as the source of truth. A cached/read-model value may be added later only if performance requires it.

## Index policy

Required indexes cover:
- normalized email lookup;
- membership/bootstrap email lookup;
- organization type/status;
- membership/leadership open-state lookups;
- project owner/status;
- event organization/programme/time;
- feedback state/created time;
- analytics event name/time;
- vocabulary type/status/slug.

The executable schema is `db/migrations/001_p0_init.sql`.
