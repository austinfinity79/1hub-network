# Task Sequence

Task 22 recalculated from the 28/09 decisions and their dependencies. The old 22.5 (L4 / L28), 22.6 (L5, empty), 22.7 (L54 404 / 500) and 22.8 (consolidation) are **SUPERSEDED**; consolidation becomes 22.10. Protected-workflow rules still apply: targeted regression per batch, full regression when a workflow is reopened or a shared primitive changes, one writer, stop for review after each batch.

## Done
| Batch | Scope |
|---|---|
| 22.1 | H1 homepage restyle (`a05917a`) |
| 22.2 | AUTH1–AUTH4, ACC-10 subset (`5735d78`) |
| 22.3 | L11 settings, L13a–c project wizard (`2a57fe9`) |
| 22.4 | L19, L20, L23, L26 (`cc6ca28`); stays valid under DEC-2809-D3 (HD-A2 confirms L19 / L23) |

## Ordered batches
| # | Batch | Scope | Backend / migration | Depends on | Blocked by | Regression |
|---|---|---|---|---|---|---|
| 1 | **22.5 Application persistence foundation** (no UI) | Server-side programme catalogue + registration config for the approved PUBLISHED programme; `applications` with snapshot, uniqueness, lifecycle, trigger; the five API calls; audit actions; release / WF04 / WF05 invariant specs rewritten | BD-10, BD-11; additive migration(s) from `010`; deterministic fixture rows only | — | nothing (HD-A12 default) | DB tests, API contract, authz / spoof / IDOR, idempotency and concurrency, release invariants, WF04 / WF05 smoke |
| 2 | **22.6 Auth return-to foundation** | `/login` alias; validated return path through the magic link (cross-device); guards pass the current path; S08 exits to the return path | BD-01, BD-02; small additive migration | — | nothing | WF01 full (reopened on C-03 / C-04), auth-session, SEC-OBS referrer, P0-SHELL |
| 3 | **22.7 L5 Application UI** | L37 SUB0 quick Venture (select or quick-create), L38–L41 SUB1 steps, L42 SUB2 review / submit, L43 SUB3; WF05-S01–S04 retrofitted onto the API; session store removed | BD-04 (venture create audit + idempotency) | 22.5, 22.6 | HD-A8, HD-A10, HD-A11 | WF05 full + closing gate again (reopened on C-05), WF02 ventures, WF04 smoke, release |
| 4 | **22.8 Homepage CTA refreeze + public directories** | CTA map, visible "Sắp có", iHub Ventures link, `/events` (L16 subset), `/programmes`, `/about`, hero search, `/programmes/create` + no-permission state, create-startup intent | BD-03, BD-06, BD-07, BD-08, BD-09; no migration | 22.5 (programme catalogue), 22.6 (return path) | HD-A14 (CTA review); HD-A3 / A4 / A5 / A6 per item | P0-LANDING, P0-SHELL, WF01 intent, WF04 smoke, release, pixel (H1, L16) |
| 5 | **22.9 L1 AI onboarding suggestion** | L06b / L06c states over the existing profile step; manual path always complete | BD-12; migration only if requests are logged | none in code | HD-A1 (provider, privacy, placement) | WF01 full, failure / quota / timeout paths |
| 6 | **22.10 Consolidation** (was 22.8) | Shared primitives, shell model (HD-11), full suite, pixel audit, protected regression, release freeze, redeploy of the approved SHA | — | 22.5–22.9 | HD-11 for the shell | Full suite |

22.9 depends on nothing in 22.5–22.8 and may run earlier as soon as HD-A1 closes. The L5 UI (22.7) cannot be complete before 22.5 lands. Nothing from L4 or L6 is scheduled: both contribute 0 executable screens until HD-A7 / HD-A9 say otherwise.

## First implementation task
**TASK 22.5 — APPLICATION PERSISTENCE BACKEND FOUNDATION.** It is unblocked (the programme-source default applies), it is the longest dependency chain and it removes the largest conflict (C-05). Preflight inside it: confirm the migration shape against Data SOT §12 and the DB schema doc; no UI.

## Related
- [overview.md](overview.md) · [backend-deltas.md](backend-deltas.md) · [human-decisions.md](human-decisions.md)
- [../07_TASK22_IMPLEMENTATION_ORDER.md](../07_TASK22_IMPLEMENTATION_ORDER.md) — earlier order (superseded)
