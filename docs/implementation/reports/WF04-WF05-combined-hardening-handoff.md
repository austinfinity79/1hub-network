# WF04-WF05-combined-hardening-handoff

**Combined WF04 + WF05 hardening package** (prepared by WF05-PROD-07; nothing integrated, pushed or deployed). WF05 was built on the WF04 candidate, so the WF05 branch head already carries both. Closure reports: [WF04-PROD-07_production-readiness.md](WF04-PROD-07_production-readiness.md) · [WF05-PROD-07_production-readiness.md](WF05-PROD-07_production-readiness.md).

## Release boundary
| Reference | SHA |
|---|---|
| WF04 candidate (`feat/wf04-prod-hardening`) | `f40f70c` — WF04 PROD HARDENED / NOT YET DEPLOYED |
| WF05 candidate (`feat/wf05-prod-hardening`, runtime) | `8c1fbd6` (contains `f40f70c`); the WF05-PROD-07 commit on top adds docs only |
| `origin/main` | `78f21f2` |
| production | `78f21f2` |
| rollback (application) | `78f21f2` — runs unchanged on schemas 015 and 016 (COMPATIBILITY notes in both files) |
| rollback (data) | pre-deploy backup; manual 016 rollback always lossless; manual 015 rollback lossless only while no programme is CLOSED |

## Combined compatibility
| Check | Result |
|---|---|
| migrations | one chain 001 → 016: WF04 015 (programme production), then WF05 016 (application integrity); 016 adds no table, only guards on `applications`; 015 unchanged since `f40f70c` |
| canonical entities | one `programmes`, one `programme_application_forms`, one `applications`; ventures stay WF02 `projects`; no duplicated schema |
| APIs | WF04 §22 (A5) programmes; WF05 §21 / §23 (A6) / §24 (A7) applications; no shared route; WF05 locks programme then form `FOR SHARE` in WF04's order |
| lifecycles | programme DRAFT → PUBLISHED → CLOSED (ARCHIVED compatibility); applications only on PUBLISHED with a form; a registration change refuses once an application exists; no conflict |
| frontend | WF04 runtime unchanged since `f40f70c` (one comment line); WF05 uses the WF04 frame's `notice: false` variant; routes disjoint (`/demo/programmes*`, `/demo/projects*`, L5 member routes) |
| regression on the combined head | 68 specs / 981 incl. every WF04 suite (`wf04-prod-api`, `-qa`, `-visual`, S01–S08, UAT); UAT 19 / 19; unit 307; DB 569 |
| **COMBINED_COMPATIBILITY** | **PASS** |
| migration chain | fresh 001 → 016: PASS (runner 16 / 16 + seed; FRESH suites); upgrade 015 + data → 016: PASS (27); 014 → 015: PASS (5); no gap |

## Promotion runbook (conceptual — do not execute without the PO)
1. Integrate the exact approved chain (`f40f70c` → WF05 head) into the release branch; resolve `fix/member-shell-mobile` (`a957876`) per the PO's merge order: keep the WF05 `/demo/projects` layout, drop its `responsive` prop.
2. Verify the combined SHA (`git rev-parse`) equals the approved one; tree clean.
3. Run the combined protected regression on that SHA (fresh DB) + UAT.
4. Take the production DB backup; rehearse 014 → 015 → 016 on a production-shaped copy (pre-checks STOP on violation).
5. Apply 015, then 016 (one transaction each; the runner refuses re-runs and edits).
6. Close `d4…0001` through WF04 `POST /api/v1/programmes/{id}/close` as a `programme:manage` actor (KEEP the record; no delete); verify it leaves member discovery and its applications stay readable to their owners. Do this after step 8: a CLOSED row makes the manual 015 rollback lossy.
7. Deploy the exact SHA (never HEAD).
8. Health check (`/` 200, `/api/v1/session` envelope, server log free of 5xx).
9. Smoke WF01 → WF05: sign-in, onboarding resume, profile, venture create / edit, WF03 ops read, WF04 programme create → publish → close, WF05 apply → draft → submit → history.
10. Verify the production SHA (`/opt/1hub-network/shared/state/current`) equals the approved SHA.
11. Rollback criteria: any 5xx in smoke, migration pre-check STOP, SHA mismatch, or a WF01–WF05 smoke failure → redeploy `78f21f2`; restore the backup only if data must go back (015 / 016 need no DB rollback for the old release).
Owner (PROCESS V2): Claude B executes the deploy steps on the approved SHA; Claude A provides this package.

## Related
- [WF05-PROD-07_closure-matrix.md](WF05-PROD-07_closure-matrix.md) · [WF05-PROD-01_implementation-handoff.md](WF05-PROD-01_implementation-handoff.md) · [WF05-PROD-06_prod07-handoff.md](WF05-PROD-06_prod07-handoff.md)
