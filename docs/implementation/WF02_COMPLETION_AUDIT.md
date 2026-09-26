# WF02 Completion Audit

**Verdict: GREEN — WF02 CLOSED** (2026-09-26, HEAD `0b4095f` + this audit). 7/7 screens; P0/P1/P2 = 0. UAT: [WF02_UAT_MATRIX.md](WF02_UAT_MATRIX.md). External release inputs, carried from M0/WF01, are listed below. They are not WF02 defects.

**Method:** found defects first, fixed nothing speculative. Evidence came from a new UI journey spec (`tests/visual/specs/wf02-uat-journey.spec.ts`), a fresh PostgreSQL install, restarts, SQL invariant probes, race stress runs and the full regression.

## Audits
| # | Area | Result | Evidence |
|---|---|---|---|
| 1 | Canonical member happy path (22 steps) | PASS | UAT-WF02-J1: magic link → S05–S08 → /me → S02 → S03 → S04 → S05 ×2 → S06 invite / accept / role / remove → S07 revoke other session → deletion request; data checked after every step |
| 2 | Entity invariants | PASS | Global SQL probes on the fresh DB before and after UAT: 0 duplicate profiles; 0 owner `project_members` rows; 0 duplicate ACTIVE team or pending invites; 0 pending rows with a profile; 0 duplicate open memberships; `role_assignments` unchanged (6 = seed); programmes + events unchanged (3); venture REGION/DOMAIN only from the right vocabulary type. IdentityVerification is not stored in P0 (Data SOT :186) |
| 3 | Profile completion | PASS | `/session`, `/me/profile`, `/me/profile/completion` agree at every step; profile edit +, avatar +10; visibility, venture create, invite, accept, remove and deletion request change nothing |
| 4 | Visibility / consent | PASS | PRIVATE persists across reload and restart; consent rows unchanged by the visibility change; the other member cannot fetch the PRIVATE avatar; versioned / duplicate / stale acceptance covered by WF01 UAT-06 and the S03 spec |
| 5 | Network / organisation | PASS | Request → PENDING_APPROVAL only; no leadership, no RoleAssignment, session `capabilities` = []; S01 and S04 show the pending row; roster paths by WF01 UAT-11 |
| 6 | Project / Startup | PASS | Both types → DRAFT in one `projects` table; edit saves; PATCH `type` → 422; ARCHIVED read-only on page, API and team (ALT-05); vocabulary IDs only |
| 7 | Venture team | PASS | Pending → ACTIVE only on explicit accept (a second sign-in leaves it pending); REJECTED / REMOVED keep rows; member view hides pending data; no RoleAssignment; race stress below |
| 8 | Settings / session | PASS | Other session revoked → its page goes to /auth and the API returns 401 at once; the list carries no token or hash; foreign session 404 (ALT-04); deletion REQUEST changes no account, profile, avatar, membership, leadership, venture, team, consent or session state; duplicate → 200, 1 row |
| 9 | Security | PASS | ALT-01 guest → /auth on 8 routes; ALT-02 incomplete onboarding cannot enter any WF02 page, and POST /ventures → 403; ALT-03 used link never signs in; ALT-04 session / venture / team / accept IDOR → 404 and profile spoofing → 422; S06 spec: enumeration, forged role_label, cross-project; SEC-OBS-01 spec PASS (still CLOSED); server logs: 0 email / token / cookie lines |
| 10 | Migration / fresh install | PASS | New PostgreSQL 17.6: 001→008 in order; rerun skipped 8/8; ledger sha256 = file sha256 for all 8; 001–007 unchanged since commit; seed rerun → 16 fixture tables identical (count + md5); 6 CHECK + 2 partial unique indexes present; the unsupported-state guard is proven by the S06 migration QA |
| 10b | Restart | PASS | App + PostgreSQL restarted: 9 journey tables identical (count + md5); UAT 7/7 again on the same DB; invariants still hold |
| 11 | Cross-screen consistency | PASS | S02 → S01 name and %; S03 → avatar hidden to others; S04 → S01 pending organisation; S05 → `/me/network` and S04 venture rows; S06 → the member's network gains and loses the venture; S07 revoke → protected routes enforce at once |
| 12 | Pixel | PASS | See below |

## Race re-test (review note 4)
The single earlier failure is **not a product defect**. A two-session proof shows that `audit_events.created_at` (transaction start time) can order events opposite to commit order. The pre-fix assertion relied on that order; it now compares sets. Stress: 49 runs (25 sequential + 24 in 3 parallel processes), about 200 concurrent scenarios including 147 accept-vs-cancel races: **0 failures**. No code change.

## Pixel (1440×900 DPR1; outside-text drift, worst segment)
| Screen | Result | Notes |
|---|---|---|
| WF02-S01 | 0 | H12: 0 below reference |
| WF02-S02 | 0 | Below the reference: H1 addendum only (INTENTIONAL-CONTRACT, asserted inside the form column) |
| WF02-S03 | 0 | |
| WF02-S04 | 58 px (6e-5) | Raster |
| WF02-S05 | 0 | H12: 0 below reference |
| WF02-S06 | 16 px (2.5e-5) | Raster; H12: 0 below reference |
| WF02-S07 | 31 px (2.3e-4) | Raster |
| WF01 ×8 | PASS | Every WF01 screen spec incl. its pixel test |

Structural 0 · Major 0 · Component 0 · Raster 3 screens · Intentional classes are unchanged and recorded per screen in the segment reports. `design-reference/final` is untouched.

## Defects
| Class | Count | Items |
|---|---|---|
| P0 / P1 / P2 | 0 | — |
| P3 | 2 | WF02-P3-01 S05/S06 added copy awaits PO review (list in [UAT matrix](WF02_UAT_MATRIX.md#po-review)); WF02-P3-02 `audit_events.created_at` is transaction-start time, so readers must not treat it as commit order (existing M0 audit table; recorded, not changed) |

## External / release inputs (not WF02 defects)
1. Outbound email provider: magic-link and team-invitation delivery (M0 §16; DEC-WF02-S06-G2/G3).
2. Invitees reach their invitation through the shared `/projects/:id/team` link only (release/UX note; no notification centre in P0, H9/H10).
3. `PRODUCTION_LEGAL_CONTENT_REQUIRED`, real roster data, production REGION/DOMAIN/SKILL vocabulary (WF01 release inputs).
4. Manual real-mailbox UAT (UAT-M3 of WF01) once delivery exists.

## Related
- [WF02_UAT_MATRIX.md](WF02_UAT_MATRIX.md) — UAT cases
- [WF02_SCREEN_IMPLEMENTATION_PLAN.md](WF02_SCREEN_IMPLEMENTATION_PLAN.md) — plan
- [P0_STATUS.md](P0_STATUS.md) — status
- [WF01_COMPLETION_AUDIT.md](WF01_COMPLETION_AUDIT.md) — WF01 precedent
