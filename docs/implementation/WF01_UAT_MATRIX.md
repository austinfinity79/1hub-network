# WF01 UAT Matrix

Automated in `tests/visual/specs/wf01-uat-journey.spec.ts` (Playwright, 1440×900, UI-driven, production build). Rewritten on 2026-09-29 for the four-stage onboarding ([DEC-L1R](../decisions/DECISION_LOG.md#dec-l1r)); the matrix of 2026-09-26 for purpose → profile → privacy is superseded and kept in git history. The "mail" step reads the newest link the way the inbox receives it.

## L1 closure matrix
| ID | Preconditions | Steps | Expected | Result |
|---|---|---|---|---|
| A New valid e-mail | address never seen | AUTH1 → AUTH2 → link → ACC-05 → ACC-06 → ACC-07 → ACC-08 → ACC-09 → ACC-10 → `/me` | HttpOnly, Secure, SameSite cookie; token stripped from the URL and stored only as a hash; no profile until stage 1 saves; DRAFT until "Hoàn tất hồ sơ", then ACTIVE; 1 account, 1 profile, 2 consents, 1 `PROFILE_ACTIVATED`, 1 `onboarding_completed` | PASS |
| B Existing incomplete member | account at each state | sign out and in again after each stage; completion fails once | resumes at `/onboarding`, `/onboarding/profile`, `/onboarding/capability`, `/onboarding/purpose`, `/onboarding/privacy`, then `/me`; a failed completion leaves DRAFT; acceptance already given stands | PASS |
| C Existing completed member | onboarding complete; seeded member | sign in again; open every onboarding route | `/me`; every stage route leads to `/me`; nothing rewritten | PASS |
| D Refresh and resume | account in the flow | reload on every stage; go back through the stages; edit stage 1 late; browser Back after a save (`wf01-s05`, `wf01-s06`, `wf01-s10`) | route, saved values and the current bar are kept; later stages are not thrown away; Back shows the stored values and a later save loses nothing | PASS |
| E One account, one profile | same mailbox written three ways, two browsers | concurrent first writes and completions; sign in again | 1 account, 1 profile, 1 activation, 1 completion event | PASS |
| F Role declaration | HUB role with a unit, position, period | complete; call ops pages and APIs, plain and with spoofed headers | before completion no membership; after it one `PENDING_APPROVAL` / `SELF_DECLARED` request; 0 leadership, 0 role assignments, no capability, no managed scope; ops 403 / 404 | PASS |
| G Visibility | avatar uploaded; switch off at the review | complete; sign in again; another member and a guest read the avatar | PRIVATE persists; other member 404, then 200 after NETWORK_ONLY; guest 404; consents unaffected | PASS |
| H Link rejection | expired, used and malformed links | open each | `status=expired`, `status=used`, `/auth/error`; no session; an unused link creates no account | PASS |

## Frozen P0 requirements
| ID | Expected | Result |
|---|---|---|
| UAT-05 Required fields | stage 1 without a name shows the message, saves nothing; later stages and ACC-10 cannot be opened around it | PASS |
| UAT-06 Legal version mid-journey | the stale acceptance is refused; the new version is the one recorded | PASS |
| UAT-08 Below 80 % | completes; `NETWORK_CONTEXT` is not a group | PASS |
| UAT-11 Launch roster | roster member keeps the ACTIVE membership; naming the same unit files no second request; leader gets leadership and no capability | PASS |
| UAT-12 `account_created` | exactly once across a retried link and a second sign-in | PASS |
| UAT-13 Funnel | `account_created` → `profile_completion_changed` … → `onboarding_completed`; no personal or secret content | PASS |

## Not automated
| Item | Why |
|---|---|
| Google sign-in | no OAuth client (external configuration blocker); the control signs nobody in, which is tested in `wf01-s01-auth-entry.spec.ts` |
| AI suggestion | no provider; the blocks are inert, which is tested per screen |
| Real inbox delivery | covered by the domain smoke of the deployment tasks, not by this suite |

## Related
- [l1-l2-realign/l1-closure.md](l1-l2-realign/l1-closure.md) — L1 closure evidence
- [WF01_COMPLETION_AUDIT.md](WF01_COMPLETION_AUDIT.md) — the audit of the earlier flow
