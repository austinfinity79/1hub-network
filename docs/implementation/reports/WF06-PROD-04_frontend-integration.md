# WF06-PROD-04_frontend-integration

**WF06-PROD-04 — frontend integration of the existing discovery / read-only surfaces (IMPLEMENT)** on the PROD-03 API (`4fe1e36`), under the frozen [runtime contract](WF06-PROD-01_runtime-contract.md), [handoff](WF06-PROD-01_implementation-handoff.md) P4-1 … P4-3 and [API §25](../../architecture/05_API_CONTRACT_P0_v1.0.md). Verdict: **PASS_WITH_EVIDENCE**. `/library` now renders only the Library APIs' answers; no new route, surface, write or recommendation.

## Preflight (evidence 1)
| Check | Result |
|---|---|
| branch / HEAD | `feat/wf06-prod-hardening` at `4fe1e36` (PROD-03); unchanged until the commit. The task names `c4fe1e36`, which is no object in the repository; `4fe1e36` is the PROD-03 commit (taken as a typo, not a contract difference) |
| migrations | 001 → 016, none added |
| origin/main · production | `78f21f2` · `78f21f2` (read only) |
| Claude B / other lanes | `fb2130f`, `a957876`, `c1b60c3` not in HEAD |
| concurrent writer | none; untracked `AGENTS.md` left alone |

## Surface inventory (evidence 2)
| Surface | Before | After |
|---|---|---|
| `/library` › Bài toán | STATIC_CONTENT file (TEMPORARY_EXTERNAL), CLIENT_ONLY filter / sort / paging | REAL_API (`/library/problems`); the file stays TEMPORARY_EXTERNAL |
| `/library` › Startup | TEMPORARY_EXTERNAL startup.json, CLIENT_ONLY | REAL_API (`/library/startups`): CANONICAL_READY + TEMPORARY_EXTERNAL remainder |
| `/library` › Nhà sáng lập | TEMPORARY_EXTERNAL startup.json members, every visitor | REAL_API (`/library/founders`): canonical owners, members only |
| `/library` metrics, tab counts | CLIENT_ONLY (array lengths) | REAL_API totals (first read) |
| `/library` quick chips | STATIC_CONTENT categories | Bài toán: category labels as text filters; Startup / founders: DOMAIN items of the reviewed map |
| `/organizations/:slug` | server read = the WF03 API projection | unchanged; heading shows the children total |
| homepage search → `/library?q=` | STATIC navigation | unchanged |
No route added; no member directory, venture / programme / challenge page or list, feed, follow / save, Admin Portal.

## Real API integration and fixtures (evidence 3, 4)
- First render: `libraryInitial()` builds each tab's first page with the API's own body builders (`library-bodies.ts`, also used by the three routes), for the session's viewer; later states call `GET /api/v1/library/*` (`library-client.tsx`). Visibility is never decided in the browser.
- Fixture dependency: **zero at runtime**. `src/lib/library/testing.ts` is imported by tests only; no localStorage / sessionStorage; runtime sources are canonical tables, the problem file and the external feed (both approved TEMPORARY_EXTERNAL). Removed: the client-side dataset builders (`startupTab`, `founderTab`) and the adapter's external-founder extraction (no reader left; DEC-W6P-D03).

## Files changed (evidence 27)
- Runtime: `src/app/(public)/library/page.tsx`, `src/components/library/{library.tsx,library-client.tsx,library-model.ts,library.module.css}`, `src/lib/library/library-bodies.ts` (new), `library-api.ts` (`normalizeKeyword`), `startup-adapter.ts`, `src/app/api/v1/library/*/route.ts` (use the shared builders), `src/app/(public)/organizations/[slug]/page.tsx` (children total).
- Tests: `library-model.test.ts`, `startup-adapter.test.ts`, `src/lib/library/testing.ts` (`addVisibleFounder`); specs `wf06-prod-library` (new), `public-library`, `l6-discovery-privacy`, `alpha-interaction-gaps` (realigned).
- Docs: the five `WF06-PROD-04_*` reports, `CLAUDE_LATEST_REPORT.md`.

## Git and confirmation (evidence 28 – 32)
Local commit only (SHA in `CLAUDE_LATEST_REPORT.md` and the final chat report); working tree clean except `AGENTS.md`; origin/main `78f21f2`; production `78f21f2`. Confirmed: no new discovery surface, no matching / recommendation, no write action, no Admin Portal, no push, no merge, no deploy, PROD-05 not started.

## Self-audit (section 28)
All 21 items confirmed: existing surfaces only; real APIs; zero runtime fixture; founder privacy; canonical wins; external isolated; deterministic filters / sort; real pagination; safe guest / member transition; no stale privacy cache; specs realigned only where the contract requires ([matrix](WF06-PROD-04_spec-realignment.md)); no new page; no recommendation; no writes; cross-WF ids intact; no private field rendered; protected regression GREEN; no push / merge / deploy; PROD-05 not started.

## Related
- [WF06-PROD-04_library-behaviour.md](WF06-PROD-04_library-behaviour.md) · [WF06-PROD-04_spec-realignment.md](WF06-PROD-04_spec-realignment.md) · [WF06-PROD-04_qa-evidence.md](WF06-PROD-04_qa-evidence.md) · [WF06-PROD-04_prod05-handoff.md](WF06-PROD-04_prod05-handoff.md)
