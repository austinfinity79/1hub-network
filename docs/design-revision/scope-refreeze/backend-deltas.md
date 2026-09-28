# Backend Deltas

Every backend change the 28/09 decisions require. Nothing here is implemented; migration numbers are assigned when the batch starts (next free today: `010`). "UI" rows are listed only where they need a server rule.

| ID | Delta | Why (decision) | Migration | API / server | Batch | Blocked by |
|---|---|---|---|---|---|---|
| BD-01 | `/login` alias of the magic-link entry `/auth`, keeping `redirect` and `mode` | D1 names `/login?redirect=…` and `/login?mode=signup`; `src/lib/routes.ts` records `/login` as deliberately absent (superseded) | none | 308 redirect route; `mode=signup` changes copy only (one flow) | 22.6 | — |
| BD-02 | Return to the intended action after login | D1: mutation / participation / form / admin CTAs return to the action. Today the form hardcodes `return_to: '/auth/callback'`, the API reads only `email`, the callback strips the query and guards send a bare `/auth` | small, additive: nullable return path stored with the magic-link request (so the link works on another device) | request accepts a validated same-origin relative path; consume returns it; guards pass `?redirect=<current path>`; onboarding finishes first, then S08 exits to the path instead of `/me` | 22.6 | — |
| BD-03 | Onboarding entry with a preselected intent | D1: `intent=create-startup` preselected. No such code in the allowlist (`intent.ts`: SUBMIT_SOLUTION, POST_CHALLENGE, ORGANIZE_COMMUNITY, EXPLORE_NETWORK); DEC-WF01-S05-D4 forbids a default | none | purpose page reads a mapped intent from the return context; nothing saved until the user confirms | 22.8 | HD-A3 |
| BD-04 | Quick-create Venture inside the application flow (SUB0) | D5: select an existing Venture or quick-create a minimal canonical one; no temporary team | none | reuse `POST /ventures` (DRAFT, owner = session); SUB0 requires name, domain, one-line summary; add Idempotency-Key and a `VENTURE_CREATED` audit (today none) | 22.7 | HD-A11 (type choice) |
| BD-06 | `/programmes/create` with permission enforcement | D1: guest → login → back; signed in without permission → no-permission state with contact-admin, never free creation. Today: no route, no `programme:create` capability, the demo returns the generic 404 | none | guard + no-permission view; authorized users continue to the WF04 creation (demo) — see HD-A4 | 22.8 | HD-A4 |
| BD-07 | Public cross-organisation event list for `/events` (L16) | D1 / D4 directory. Today only per-organisation upcoming events inside `GET /organizations/by-slug/:slug` and `GET /api/v1/events/{id}` | none | `GET /api/v1/events?…` over PUBLISHED standalone events of public organisations (same rule as S09); no registration, type or capacity fields | 22.8 | — |
| BD-08 | Public programme list for `/programmes` | D1 directory | shares BD-10 | `GET /api/v1/programmes` over PUBLISHED server-side programmes | 22.8 | HD-A6 |
| BD-09 | Hero search over existing public data | D1: no universal engine | none | public read over organisations, published events and published programmes; results target per CTA-map review | 22.8 | CTA-map review |
| BD-10 | Server-side programme catalogue + versioned registration config | D6 dependency: an Application needs a persisted programme and question set; today the programme is a TypeScript fixture and `programmes` has no question columns | yes (additive) | read model for PUBLISHED programmes, applicant types, questions, version | 22.5 | HD-A12 (default exists) |
| BD-11 | Application persistence (entity, snapshot, uniqueness, lifecycle, API, audit) | D6 | yes (additive) | [application-persistence.md](application-persistence.md) | 22.5 | — |
| BD-12 | AI onboarding suggestion | D2: live Alpha, never publishes, never creates a Venture, never replaces validation; failure or quota never blocks | only if requests / quota are persisted (HD-A1) | `POST /api/v1/me/onboarding/suggestions` (input: pasted text; CV upload and LinkedIn per HD-A1) → suggested field values the user must confirm; provider adapter, timeout, per-account quota, no raw CV retention by default; existing profile validation unchanged | 22.9 | HD-A1 |

UI-only items with no server rule: visible "Sắp có" or hidden out-of-scope CTAs (supersedes DEC-P0-SHELL-D2 on `/`), the external iHub Ventures link, the `/about` page (content HD-A5), the L16 subset layout.

RBAC: no new role. BD-06 may need a creation capability if the PO wants one distinct from today's WF04 demo scope (HD-A4); until then no matrix change.

## Related
- [homepage-cta-map.md](homepage-cta-map.md) · [application-persistence.md](application-persistence.md) · [task-sequence.md](task-sequence.md)
