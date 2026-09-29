# L2 Regression Gate

Regression evidence and the pre-commit review behind the [L2 closure](l2-closure.md). Local run of 2026-09-29 on the final production build (port 3972).

## Regression gate
PO rule of 2026-09-29 for L2: WF02, the impacted security tests, venture and team DB / API tests, L2 pixel and responsive in full; WF01, P0-LANDING, P0-SHELL, WF03, WF04, WF05, About and Library by targeted smoke; a full global run only after a regression or a material change to shared auth, session or RBAC. Auth, session and RBAC code is unchanged by L2, so no full global run was required.

| Scope | Rule | Passed | Failed |
|---|---|---|---|
| WF02: 13 specs, UAT A–M, L2 pixel 6, responsive 29, runtime 1 | full | 170 | 0 |
| Database and API (venture, team, invitations, profile and the rest) | full | 436 | 0 |
| Security: release matrix (auth, actors, navigation, responsive), session, authorization, referrer | full, impacted | 31 | 0 |
| Shell routes | targeted | 36 | 0 |
| WF01: UAT, ACC-07 (shared dialog, D12), responsive, e-mailed link, ACC-10, runtime | targeted + L1 compatibility | 77 | 0 |
| P0-LANDING, P0-SHELL | targeted | 10, 14 | 0 |
| WF03, WF04 | representative (UAT) | 3, 15 | 0 |
| WF05 (reads the venture) | representative + impacted | 66 | 0 |
| About, Library, root entry, console | route, render, navigation | 21 | 0 |

443 browser tests on the final build, 0 failed. Before that, 13 tests failed on expectations L2 supersedes (table below; each spec updated and re-run) and 4 on trace files that two concurrent Playwright runs shared (environment; they pass alone). The regression found no product defect; the one found by the WF02 specs is fixed (below).

## Pre-commit review
Read-only review of the uncommitted L2 code before the commits: no critical finding. Each fix has a test.

| Finding | Severity | Fix | Test |
|---|---|---|---|
| Invitation e-mails could be sent without limit (invite, cancel, invite again) from the HUB sender with an inviter-chosen name | major | 3 sends a day per venture and address, 50 per inviter, counted over every state; `429 INVITATION_RATE_LIMITED` ([DEC-L2R-D13](../../decisions/DECISION_LOG.md#dec-l2r-d13)) | `invitations.db-test` D13 |
| Venture create read the onboarding state on a second pool connection inside its transaction | minor (major under load) | the check runs on the transaction's connection | `venture.db-test` create |
| Two concurrent invitations could pass the 20-pending cap | minor | the invitation locks its venture row | `invitations.db-test` concurrency |
| The team page offered an archived venture's invitation, which then failed | minor | not offered, as on ME7 | `invitations.db-test` archived |
| An empty PATCH wrote `updated_at` and a `VENTURE_UPDATED` event | minor | nothing named, nothing written | `venture.db-test` audit |
| Experience durations were one month short of the board and used the UTC month | minor | both months counted (06/2019 – 01/2024 = 4 năm 8 tháng); the month is Việt Nam's | `profile-model.test` |
| On FP1-OWN the experience dialog closed before the server answered, losing the entry on a refusal | minor | the dialog waits for the save and shows the refusal; ACC-07 unchanged | `wf02-s01`, `wf01-s10` |
| The e-mail is handed to the provider before COMMIT | note | kept: a failed send rolls the invitation back (DEC-L2R-D8) | `invitations.db-test` D8 |

Found by the spec work: on ME7 the message for an invitation cancelled meanwhile vanished with its banner; the page now holds it (`wf02-s08`, previously `fixme`).

## Specs that pinned superseded behaviour
| Spec | Old expectation | New expectation |
|---|---|---|
| `p0-shell-navigation` | a venture with a name only; the wizard's "Huỷ" returns to `/me` | the required fields; "Huỷ" returns to `/projects` |
| `p0-landing` | `/me` proves the legacy faces | `/me/profile/edit` does (`/me` is a revision screen, D11) |
| `internal-alpha-release` REL-RESP | the WF05 entry on `/me` | FP1-OWN's own action on `/me`; the entry on `/projects` |
| `wf03-uat-journey` | the audit code list without venture events | `VENTURE_CREATED`, `VENTURE_UPDATED` added (D9) |
| `wf05-s01`, `wf05-t00`, `wf05-uat-journey` | MemberShell entry on `/me`; create with a name; exit to `/me` | the entry on `/projects` and the MemberShell pages; required fields; exit to `/projects` |
| `wf05-s02` | "—" for description and field | the fixture's description and field (D4) |
| `wf05-t00` | no audit event while the venture is renamed | the rename's one `VENTURE_UPDATED` event (D9), nothing else |
| `wf02-s01` | a refused experience save closes the dialog | the dialog stays open with its values and the refusal (review fix) |

## Related
- [l2-closure.md](l2-closure.md) · [overview.md](overview.md) · [../PROCESS_P0_ACCELERATED_SAFE_V2.md](../PROCESS_P0_ACCELERATED_SAFE_V2.md)
