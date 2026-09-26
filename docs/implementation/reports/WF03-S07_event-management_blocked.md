# Claude Task Report

## Task
WF03-S07 — EVENT MANAGEMENT. Process: PROCESS-P0-ACCELERATED-SAFE-V2, focused full preflight → implement if safe.

## Status
**BLOCKED** at preflight, on the task's own stop rule: "If lifecycle is not fully defined: STOP. Do NOT guess."

- No runtime code, no migration, no seed change, no push.

## Preflight
| Area | Result |
|---|---|
| Business | Create / edit / publish / cancel are named by SCR S07, G10 and API §8.6. Registration and WF04 content are out (G2, G10) |
| Data | Canonical `events` table with `organization_id` NOT NULL, nullable `programme_id`, `event_status` = the SOT chain, unique `slug`. Fixture: one PUBLISHED standalone event and one DRAFT event linked to a programme (left as is, G10) |
| API | §8.6: `GET/POST /ops/organizations/{orgId}/events`, `GET /events/{id}`, `PATCH /ops/events/{id}`, `POST …/publish`, `POST …/cancel`. Idempotency on create / publish (§2.3) |
| RBAC | `event:manage` (HUB_COMMUNITY_LEADER exact org, PLATFORM_ADMIN) |
| Audit | EVENT_CREATED / _UPDATED / _PUBLISHED / _CANCELLED frozen (G14); none emitted yet |
| Design | S07 bitmap = WF04 collage, not authority (G2); build from WF03 primitives |
| **Lifecycle** | **Not fully defined → OPEN-WF03-S07-EVENT-LIFECYCLE** |

## Open gap (E1–E5)
Full record: [OPEN-WF03-S07-EVENT-LIFECYCLE](../../decisions/DECISION_LOG.md#open-wf03-s07-event-lifecycle).

| Gap | Question | Recommended |
|---|---|---|
| E1 | Cancel from which states? The literal chain allows it after LIVE only | PUBLISHED and LIVE → CANCELLED; DRAFT not cancellable |
| E2 | PATCH in which states / with which fields? | DRAFT and PUBLISHED, all editable fields; other states read-only |
| E3 | Publish required validation? | name + starts_at + ends_at, ends ≥ starts, start not in the past |
| E4 | Field set (`timezone` / `registration_enabled` in the example vs the `summary` / `location_text` columns) | name, summary, starts_at, ends_at, location_text; `programme_id` null only; `registration_enabled` rejected; `timezone` only `Asia/Ho_Chi_Minh`, not stored |
| E5 | LIVE / ENDED in P0? | Not in P0: no operation and no time derivation; show the stored status |

## Files changed
- `docs/decisions/DECISION_LOG.md` (OPEN-WF03-S07-EVENT-LIFECYCLE)
- `docs/implementation/WF03_SCREEN_IMPLEMENTATION_PLAN.md`, `P0_STATUS.md`, `CLAUDE_LATEST_REPORT.md`
- This report

## Tests
Not run: no code changed. The last full gates were green at `a9659a8` (WF03-S08).

## Blocking gaps
1: OPEN-WF03-S07-EVENT-LIFECYCLE (E1–E5). It blocks S07 only; S09 is independent.

## Git
- Branch: `main`; start HEAD `a9659a8` (checked again before the commit)
- Implementation commit: none (preflight only)
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `0b4095f`
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
Decide E1–E5 (RESOLVE OPEN-WF03-S07-EVENT-LIFECYCLE) → WF03-S07 fast path. WF03-S09 — PUBLIC ORGANIZATION PAGE may run first.
