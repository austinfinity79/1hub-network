# TASK-24-FINAL Release Freeze

**TASK 24 FINAL — COMBINED RELEASE CHECK: GREEN. INTERNAL ALPHA RC frozen at `ff052d70fe418cb092bd5e33fcc03ee712c76d14`; rollback `c02cdd9ba4ab6b84bf87a569c02c608cc62804a0`.** Verify and freeze only: no feature, no FUTURE scope, not pushed, not deployed. Deployment waits for one PO data decision ([DEP-1](../INTERNAL_ALPHA_RELEASE_MANIFEST.md#dep-1)). Manifest: [INTERNAL_ALPHA_RELEASE_MANIFEST.md](../INTERNAL_ALPHA_RELEASE_MANIFEST.md).

## Precheck
| Check | Result |
|---|---|
| Commits | 24.1 `0931d3d`, 24.2 `075cf98`, 24.3 `15982b1`, PO freeze `731061a` / `88a241a`, 24.4 `14dade5`, 24.5 `db25d95`, RC smoke `ff052d7` |
| Concurrency | HEAD `db25d95` at start and before the commit; other worktrees are separate branches |
| Working tree | clean except `AGENTS.md` (untracked, unchanged since 26/09) |
| Migrations | `001`→`013` in order; `013_p0_applications.sql` once |

## Combined smoke (local production build, port 3972)
| Area | Evidence | Result |
|---|---|---|
| Auth | REL-AUTH: magic link, one-time link, session, logout, revoked session | PASS |
| L1 | UAT UC01–UC03: new email, onboarding resume, completion, `/me` | PASS |
| L2 | UAT UC04–UC10: profile, create / edit project and startup, invite, accept, visibility (UC05, UC09 B: DRAFT stays private), authorization | PASS |
| Library | `public-library` 18: Bài toán / Startup / Nhà sáng lập, search, filters | PASS |
| L3 | `wf03-uat-journey` 3 (request → approve → leadership → public page; SEC-WF03-01; invariants) + `wf03-s04-membership-review` 8 (reject keeps history, own chapter only, unauthorized 403 / 404) | PASS |
| L4 | `wf04-uat-journey` 15: approved WF04 surfaces only | PASS |
| L5 | `l5-startup-journey` 13 + `wf05-uat-journey` 10: open programme, create, save DRAFT, reload / resume, review, submit, SUBMITTED final, foreign venture / application refused | PASS |
| L6 | `l6-discovery-privacy` 4: private profile, DRAFT venture, sensitive fields absent; no matching | PASS |
| Homepage · About | `p0-landing` 10; REL-NAV crawl (123 pages, 39 routes, 0 findings); runtime probe | PASS |
| Totals | UAT 19 / 19 · visual 84 / 84 + WF03-S04 8 / 8 | PASS |

## Security
| Case | Evidence | Result |
|---|---|---|
| IDOR | REL-SEC (9 identities × 22 pages + 9 APIs), L6 IDOR matrix, L5-S | 0 unauthorized read |
| Role spoof | spoofed headers / queries equal plain in REL-SEC, SEC-WF05-01, L6 | rejected |
| Cross-org mutation | SEC-WF03-01, WF03-S04 3–6 (foreign organisations and records) | refused |
| Cross-Venture / cross-Application | UAT UC10, L5-S, NEG-WF05 (foreign venture 404, foreign application 404, id swap 422) | refused |
| Privacy / DRAFT / contact leak | L6 privacy scan 33 checks | 0 |
| Privilege escalation | REL-SEC scope checks; team member cannot apply (403) | 0 |

## Database
| Path | Result |
|---|---|
| Fresh | 13 applied; rerun 13 skip; second seed changes no table |
| Upgrade | `c02cdd9` schema + seed + live-like rows → HEAD migrate: `013` only; 0 existing tables changed; ledger `001`–`012` checksums unchanged and equal to the fresh ledger |
| Relations | 0 duplicate root profiles, 0 ownerless ventures, 0 DRAFT-and-PUBLIC ventures, 0 orphan / duplicate applications, SUBMITTED always with a snapshot, creator = owner, final-state trigger present |
| Seed | never run on production; the only `DELETE` removes one fixture row by id |

## Build · runtime · responsive
| Gate | Result |
|---|---|
| format, lint, typecheck, production build | PASS |
| Unit · impacted DB / API | 252 / 252 · 214 / 214 |
| Runtime (13 loads + every spec's console watch) | #418 0 · 5xx 0 · broken assets 0 · console 0 |
| Responsive (`release-rc-responsive` 4, REL-RESP, L5-R) | homepage, Library, L2 workspace, L3 public / members, L5 application at 1440 / 1024 / 768 / 390: no overflow, controls reachable |
| Pixel | not rerun; the 24.1–24.5 closures stay authoritative (same code) |

## DEP-1 (before deploy)
Production has no PUBLISHED programme with an application form (read-only query, 30/09). The RC reads open programmes from the server, so without data the live list goes from the fixture programme to empty and L5 has no entry. A PO decision picks the manifest's option A (apply the seed's L5 block once) or B (deploy with L5 dark). No code change is needed.

## Related
- [TASK-24.5_l6-ecosystem-closure.md](TASK-24.5_l6-ecosystem-closure.md) · [TASK-24.4_l5-startup-closure.md](TASK-24.4_l5-startup-closure.md) · [INTERNAL-ALPHA_release-freeze.md](INTERNAL-ALPHA_release-freeze.md)
