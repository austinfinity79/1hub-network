# WF03 Completion Audit

**Verdict: GREEN — WF03 CLOSED** (2026-09-26, base HEAD `5780870`).

- Screens: 8/8 executable; S05 remains FUTURE / WF04 as a guarded placeholder only.
- Defects: P0 / P1 / P2 = 0.
- UAT: [WF03_UAT_MATRIX.md](WF03_UAT_MATRIX.md).
- External release inputs are listed below; they are not WF03 defects.

## Audits
| # | Area | Result | Evidence |
|---|---|---|---|
| 1 | Inventory / routes | PASS | T00 + S01–S04, S06–S09 routed and implemented. No placeholder is left on an executable WF03 route. `/ops/*` guarded (guest → /auth, onboarding → resolver, out of scope → 404); S09 public; direct URL and reload proven per spec |
| 2 | Business invariants | PASS | Membership, Leadership, RoleAssignment and representation are separate (G7: no representation runtime). Organization context is UI only. RoleAssignments stay at the seed. Hierarchy comes only from `organization_relationships`, never written to `parent_id`. S07 events are standalone (`programme_id` NULL); WF04 events never reach S07 or S09 |
| 3 | Happy path (20 steps) | PASS | UAT-WF03-J1, with canonical DB checks after every mutation |
| 4 | Negative / alternate | PASS | SEC-WF03-01 matrix (4 actors × 18 calls, no data change), NEG-WF03 invariant probes, and the 66 screen specs |
| 5 | Security | PASS | AUTHN / capability / exact scope / state on every protected API. IDOR on organization, membership, leadership, relationship and event → 403 / 404. Server log of the full 431-test run: 0 email / token / cookie / session lines |
| 6 | Audit consistency | PASS | 11 WF03 codes (9 of G14 + the 2 relationship codes of DEC-WF03-S08-RELATIONSHIP-CONTRACT), each written once per success in the mutation's transaction; no synonyms (distinct codes ⊆ `AuditAction`); refused calls write nothing; payloads are ids + states / field names only |
| 7 | Public privacy | PASS | S09 DTO has no email, phone, pending data, provenance, roles, capabilities, audit, session ids, private profile fields, metadata or UUIDs. Guest, member, leader and admin get the identical DTO |
| 8 | Fresh DB | PASS | New database: 001→009 in order; rerun skipped 9/9; ledger sha256 = file sha256 for all 9; 001–008 unchanged since the WF02 close (`0b4095f`). Constraints: 42 FK, 31 PK, 14 UNIQUE, 10 CHECK; 72 indexes including `uq_active_parent_per_child`. Seed run twice → 12 fixture tables identical (count + md5) |
| 9 | Upgrade | PASS | 001–006 schema + representative canonical data (orgs incl. DRAFT / ARCHIVED, ACTIVE / CLOSED / PARTNER relationships, memberships, leadership history, standalone + programme events, a startup with an ACTIVE member, a scoped role) → runner applied 007, 008, 009. 10 canonical tables identical before / after. The 009 violation guard aborts without repair (proven at S08) |
| 10 | Restart | PASS | After the kept UAT journey on the fresh DB: app + PostgreSQL restarted → 14 tables identical (incl. audit_events, user_sessions), the same session cookie still resolves the leader, and the public page JSON is identical. UAT 3/3 twice more on the restarted DB |
| 11 | Cross-screen consistency | PASS | The S04 approval raises the S02 / S03 / S09 counts; the S06 description shows on S09; an S08 relationship shows on S06 and S09; an S07 publish shows on S09 and in the S02 published count |
| 12 | Pixel | PASS | See below |
| 13 | Cross-workflow | PASS | Full visual suite: 431 passed, 24 skipped (pre-existing opt-in skips), 0 failed, including every WF01 and WF02 spec, the WF02 UAT journey and the shell / console / API contract. Unit 157, DB 334. Format, lint, typecheck and build PASS |

## Pixel (1440×900 DPR1; worst segment, outside-text drift)
| Screen | Worst | Notes |
|---|---|---|
| S01 | 0 | |
| S02 | 0 | |
| S03 | table 948 px (0.11%) | Raster |
| S04 | history 583 px (0.09%) | Raster; history card compared as a component |
| S06 | 0 | Component segments (OpsShell vs drawn top bar) |
| S07 | header 32 px | Compared with the ADM21 primitives; the WF04 bitmap is INTENTIONAL-CONTRACT (G2) |
| S08 | 20 px | Raster |
| S09 | join band 713 px (0.17%) | Gradient raster |
| T00 shell | PASS | `shell-ops-placeholder.png` (WF03-S05) |

Structural 0 · Major 0 · Component 0 · Raster 5 screens. The intentional classes are recorded per screen in the segment reports. `design-reference/final` is untouched.

## Defects
| Class | Count | Items |
|---|---|---|
| P0 / P1 / P2 | 0 | — |
| P3 | 5 | See below |

- **WF03-P3-01** — Closure harness incident, test code only. The first SEC-WF03-01 draft also ran the foreign mutations as PLATFORM_ADMIN, who is authorized, and changed dev fixtures. They were restored (names, d000…03, test rows and their audits); the matrix now runs reads only for the admin, and fixed names became run-unique.
- **WF03-P3-02** — 409 conflicts on organization / relationship / event reuse `MEMBERSHIP_INVALID_TRANSITION`, the only frozen conflict code (contract gap).
- **WF03-P3-03** — Idempotency-Key is optional on the §2.3 operations (provisional leniency, IDEMPOTENCY_STORE_P0).
- **WF03-P3-04** — The seed's `organization_relationships` upsert does not reset `ended_at` / endpoints, so a test that closes a fixture relationship must restore it (fixture determinism; not changed).
- **WF03-P3-05** — S01–S09 added copy awaits PO review.

## External / release inputs (not WF03 defects)
1. Real roster data (Chapter / CLB names, leaders) and the production organization tree.
2. `PRODUCTION_LEGAL_CONTENT_REQUIRED`, production REGION / DOMAIN / SKILL vocabulary, outbound email provider (WF01 / WF02 inputs).
3. PO copy review for the WF03 screens.

## Related
- [WF03_UAT_MATRIX.md](WF03_UAT_MATRIX.md) — UAT cases
- [WF03_SCREEN_IMPLEMENTATION_PLAN.md](WF03_SCREEN_IMPLEMENTATION_PLAN.md) — plan
- [P0_STATUS.md](P0_STATUS.md) — status
- [WF02_COMPLETION_AUDIT.md](WF02_COMPLETION_AUDIT.md) — WF02 precedent
