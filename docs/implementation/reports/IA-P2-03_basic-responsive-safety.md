# Claude Task Report

## Task
INTERNAL ALPHA — CLOSURE DEFECT IA-P2-03 BASIC RESPONSIVE SAFETY. Process: PROCESS-P0-ACCELERATED-SAFE-V2. Authorized scope: the minimum responsive CSS on the affected protected WF02 / WF03 screens; no business, API, data, route or design-contract change.

## Verdict
**IA-P2-03 CLOSED.** P0 0 · P1 0 · P2 0. Internal Alpha: **READY FOR FINAL RELEASE RECHECK** (release SHA not frozen; manifest stays NOT READY until that recheck). Nothing deployed or pushed.

## Precheck (reproduced before the fix, user means only: page / container scroll + hit test)
| Route (screen) | Wrapper / rule | Width | Unreachable or hidden |
|---|---|---|---|
| `/ops/org/:id/members` (WF03-S03) | `members.module.css` `.table { overflow: hidden }`; rows 969 px | 1024 / 768 / 390 | "Mở →" on every row (only entry to member detail); right columns hidden |
| `/projects/:id/team` (WF02-S06) | `team.module.css` `.table { overflow: hidden }`; rows 1138 px | 1024 / 768 / 390 | "Huỷ lời mời" |
| `/ops/network` (WF03-S01) | `network.module.css` `.table { overflow: hidden }`; rows 918 px | 1024 / 768 / 390 | data columns hidden (found by the precheck sweep) |
| `/ops/org/:id/events` (WF03-S07) | `events.module.css` `.page`: fixed 21.375rem side column, no breakpoint; `.row` grid about 552 px, overflow visible | 1024: row "Mở" under the side form's date input (a real click is blocked); 768: rows widen the page (+48 px); 390: "+ Tạo sự kiện" under the side panel head | as listed |

Probe baseline: 64 / 61 / 69 unreachable or covered controls at 1024 / 768 / 390 (at 390, 5 of them are the wordmark artifact described below), and 5 clipping containers per width. At 1440: 0. The "HUB NETWORK" wordmark at 390 was a probe artifact (an inline link wrapping onto two lines; a real click works), and the probe now hit-tests the first line box. Layout / CSS only, so no business or design-contract change was needed.

## Fix (CSS only)
| File | Change |
|---|---|
| `members.module.css`, `team.module.css`, `network.module.css` | `.table`: `overflow: hidden` → `overflow-x: auto; overflow-y: hidden`. The table scrolls sideways inside its frame and keeps its rounded clip |
| `events.module.css` | `@media (max-width: 1279px) { .table { overflow-x: auto } }`: the list scrolls inside its card instead of running under the side column. `@media (max-width: 1023px) { .page { grid-template-columns: minmax(0, 1fr) } }`: the side column stacks under the list (same 1023 px breakpoint as the shells) |

The shells are unchanged. There is no new component, content removal, navigation pattern, route, API, schema or permission.

## Responsive (after; 28 routes and states: landing, auth, onboarding, WF02, WF03 incl. the event form open / create, WF04, WF05)
| Width | Controls | Unreachable / covered | Clipping containers | Local scroll containers in use | Page wider than viewport |
|---|---|---|---|---|---|
| 1440 | 433 | 0 | 0 | 0 | 0 routes |
| 1024 | 443 | 0 | 0 | 9 | 1 (WF02 profile editor +353 px) |
| 768 | 453 | 0 | 0 | 9 | 4 (profile editor +609, roles +37, venture create / edit +156) |
| 390 | 454 | 0 | 0 | 9 | 19 (desktop-first MemberShell / OpsShell / onboarding shell, DEC-P0-SHELL-D7) |

Every control is reachable and uncovered. Direct refresh returns 200 on every route. Console: 0 errors.

Where the page itself scrolls sideways, this is existing desktop-first layout, not caused by this fix, and nothing is hidden: recorded as IA-P3-08 (mobile polish later). The event row "Mở" and "+ Tạo sự kiện" accept real clicks at every width, and a member row opens by keyboard (focus + Enter).

## Visual
1440 before / after, same data, full-page:
- members, team, events and event form: **0 px** difference;
- network: **1 px**, the anti-aliased corner of the rounded clip (1 / 255 in one channel): raster noise.

Structural 0 · Major 0 · Component 0. The pixel, segment and typography specs of WF02-S06 and WF03-S01 / S03 / S07 pass. 768 / 390 are **INTENTIONAL-RESPONSIVE**: local table scroll and stacked event panel; no mobile pixel parity is claimed (no approved mobile bitmap).

## Regression
| Gate | Result |
|---|---|
| New REL-RESP test "IA-P2-03 pointer reachability" (15 WF02 / WF03 screens × 4 widths; real clicks; keyboard) | PASS. **Negative control:** it fails on the pre-fix CSS (team 1024: `team_table hides 244px`, "Huỷ lời mời clipped") |
| Protected: WF02 94, WF03 66, P0-SHELL 14 + shell routes 33, release spec 7, console health 4 | **218 passed**, 0 failed |
| Smoke: WF01 / WF04 / WF05 UAT journeys | 39 passed |
| Console / #418 / server log | 0 JS or page errors, 0 #418; only the negative tests' intended 4xx and the 500 stubs; server log clean |
| format / lint / typecheck / unit / DB / build | PASS / PASS / PASS / 237 / 349 / PASS (0 warnings) |

## Data / security
CSS and a test only. Migration none; DB writes by the fix 0 (the test creates its own accounts and venture and removes the venture rows); API, auth, RBAC and audit behaviour unchanged.

## Files changed
- `src/app/(ops)/ops/org/[orgId]/members/members.module.css`, `src/app/(member)/projects/team.module.css`, `src/app/(ops)/ops/network/network.module.css`, `src/app/(ops)/ops/org/[orgId]/events/events.module.css`
- `tests/visual/specs/internal-alpha-release.spec.ts` (new REL-RESP test + `pointerProblems`)
- Docs: this report, `INTERNAL_ALPHA_COMPLETION_AUDIT.md`, `INTERNAL_ALPHA_UAT_MATRIX.md`, `INTERNAL_ALPHA_RELEASE_MANIFEST.md`, `P0_STATUS.md`, `CLAUDE_LATEST_REPORT.md`

## Deployment note (unchanged)
Deployment build MUST copy patches/ before pnpm install --frozen-lockfile (`deploy/Dockerfile`, deploy task / release freeze).

## Git
Branch `main`; start HEAD `a98e211`; implementation `9c61458`; report: the docs commit after it. Push NOT RUN (LOCAL REVIEW MODE).

## Related
- [INTERNAL-ALPHA_final-recheck.md](INTERNAL-ALPHA_final-recheck.md) — recheck that opened IA-P2-03
- [INTERNAL_ALPHA_COMPLETION_AUDIT.md](../INTERNAL_ALPHA_COMPLETION_AUDIT.md) — audit
