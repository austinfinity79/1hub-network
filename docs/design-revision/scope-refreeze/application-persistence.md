# Application Persistence

Audit for [DEC-2809-D6](overview.md#d6). **Proposal only:** no schema, migration or code is created by this task. It must be implemented, with its tests, before the L5 Application UI can count as complete.

## Current state (audited 2026-09-28)
| Area | Fact |
|---|---|
| Store | `src/lib/project-demo/application-store.ts`: `sessionStorage` key `hub.wf05-demo.v1.<actorKey>`; entries keyed `<venture>:<programme>`; statuses DRAFT / SUBMITTED; answers `string[]` by question index, ≤ 2000 chars; SUBMITTED final. `cleanApplication` drops unknown fields so **no snapshot can exist**; venture data is read live |
| Provider / pages | `demo-store.tsx` ("nothing is sent to the server"); S03 `…/applications/[programmeId]`, S04 `…/review`, both under `/demo/projects` |
| APIs | GET only: `/api/v1/demo/projects[/{id}]`; nothing accepts an application |
| Programme source | `programmes` table exists (001:269) but no runtime reads it; the WF04 PUBLISHED programme is a TypeScript fixture (`d4000000-…01`, TEAM + STARTUP, 2 questions); its id is not in the table |
| Venture | `projects` (type PROJECT \| STARTUP, status DRAFT / ACTIVE / ARCHIVED, owner, name, summary, region, domains); `POST /ventures` needs only type + name; no audit, no idempotency |
| Tables / migrations | No `applications` table; latest migration `009_p0_one_active_parent.sql` |
| Decisions | DEC-WF05-G5 and T00-D1 (session only, no snapshot, no table) — **SUPERSEDED**; API contract §15 listed application submission as out of P0 — **superseded for submission** (review stays out) |

## Dependency: server-side programme (BD-10)
An Application needs a persisted programme, its accepted applicant types and a versioned question set. Default (HD-A12): the approved PUBLISHED WF04 programme becomes a canonical `programmes` row as deterministic fixture data, with its registration config (`applicant_types`, `questions[{id, prompt, required}]`, `version`) stored server-side. WF04 operator editing stays a browser demo; the server copy is read-only in Alpha.

## Proposed entity `applications`
| Column | Type / rule |
|---|---|
| `id` | uuid PK |
| `programme_id` | uuid NOT NULL → `programmes` (PUBLISHED at create and submit) |
| `venture_id` | uuid NOT NULL → `projects` (= SOT §12 `primary_applicant_id`) |
| `primary_applicant_type` | enum TEAM \| STARTUP (derived from venture type, DEC-WF05-G4; INDIVIDUAL Future) |
| `status` | enum DRAFT \| SUBMITTED (the later SOT states are added additively) |
| `answers` | jsonb `[{question_id, value}]`, draft working copy |
| `question_set_version` | int, the version the draft was written against |
| `created_by_account_id` · `created_at` · `updated_at` | owner at creation, timestamps |
| `submitted_at` · `submitted_by_account_id` | set once on submit |
| `snapshot` | jsonb, set once on submit, never updated |

Constraints: unique active pair — partial unique index on `(venture_id, programme_id)` WHERE status IN (DRAFT, SUBMITTED); CHECK `status = 'SUBMITTED'` ⇔ `submitted_at` and `snapshot` NOT NULL; a trigger refuses any UPDATE of a SUBMITTED row (defence in depth on top of the service rule).

## Snapshot (JSON, `schema_version: 1`)
`programme {id, name, type, question_set_version}` · `questions [{id, prompt}]` · `answers [{question_id, value}]` · `venture {id, type, name, summary, status, region_id, domain_ids}` · `team {owner {profile_id, display_name}, members [{profile_id, display_name, role_label}]}` (ACTIVE members only; no email, no account id) · `submitted_at`. Later Venture / profile edits never touch it; the submitted view reads the snapshot, not live data.

## Proposed API (`/api/v1`, frozen envelope)
| Call | Rule |
|---|---|
| `GET /me/applications` | Own applications with status (drives S01 / S02 chips) |
| `POST /applications` `{venture_id, programme_id}` | Owner; eligibility (PUBLISHED, not ARCHIVED, type accepted); 201 DRAFT; Idempotency-Key; existing pair → 409 `APPLICATION_EXISTS` with its id |
| `GET /applications/{id}` | Owner only; anyone else → 404 (no existence leak) |
| `PATCH /applications/{id}` `{answers}` | Owner; DRAFT only (SUBMITTED → 409); bounds as today |
| `POST /applications/{id}/submit` | Owner; row locked; eligibility + every required answer; snapshot and SUBMITTED in one transaction; Idempotency-Key; second submit → 409 |

Authorization: session + onboarding DONE + venture owner (relation rule, outside the RBAC matrix, like `venture:manage`). Team members, organizers and operators have no application access in Alpha (review is Future). Audit: new `AuditAction`s `APPLICATION_DRAFT_CREATED`, `APPLICATION_SUBMITTED` (payload without answers).

## Migration (next free number, additive)
Enums, `applications`, its indexes / check / trigger, the programme registration source (BD-10), deterministic fixture rows in the dev and deterministic seeds only. No production roster data.

## Retrofit and regression
- S03 / S04: replace the session store and provider with the API; resume works across devices; the submitted view shows the snapshot; "Đặt lại demo" no longer touches applications (HD-A10).
- S01 / S02: chips from `GET /me/applications`; programme list from the server catalogue.
- Specs asserting session-only behaviour must change: `wf05-t00` (L108, L134, L287), `wf05-s01…s04` fingerprints (`to_regclass('public.applications')`), S03 L279, S04 L332 / L606, `wf05-uat-journey` (L193-205, L449-460, L681-690, L824, L912-916), `application-store.test.ts:194`, `read-model.db-test.ts:77`, `internal-alpha-release.spec.ts:745, 782-786` (no-application-table invariant), WF04 specs checking `public.applications`.
- WF05 is PROTECTED / CLOSED: reopened on the traceable conflict C-05 ([conflict-audit.md](conflict-audit.md)); its closing gate runs again after 22.7.

## Related
- [backend-deltas.md](backend-deltas.md) · [matrix-application.md](matrix-application.md) · [task-sequence.md](task-sequence.md)
- [../../product/1HUB_DATA_SOT_v1.1.md](../../product/1HUB_DATA_SOT_v1.1.md) — §12 Application principle, Application lifecycle
