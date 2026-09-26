# P0-SHELL — Integrated Product Shell + Navigation Audit

**Status:** GREEN — LOCAL REVIEW (2026-09-27). Decisions: [DEC-P0-SHELL-D1..D7](../decisions/DECISION_LOG.md#dec-p0-shell-d1). WF04 not started.

## Route inventory (28 pages + not-found)

| Surface | Routes | Guard | Shell |
|---|---|---|---|
| Landing | `/` | public (entry via resolver) | Landing |
| Auth | `/auth`, `/auth/check-email`, `/auth/callback`, `/auth/error` | public | AuthSplitLayout / auth card |
| Onboarding | `/onboarding/{purpose,profile,privacy,complete}` | session + resolver | OnboardingShell |
| Member | `/me`, `/me/{profile/edit,roles,privacy,settings}` | session + onboarded | MemberShell |
| Project / Startup | `/projects/new`, `/projects/:id/edit`, `/projects/:id/team` | session + onboarded; owner-only (404 otherwise) | EditorHeader |
| Ops | `/ops/network`, `/ops/org/:id{,/members,/members/:profileId,/profile,/events,/settings}` | `/ops` guard + org scope | OpsShell |
| Ops FUTURE | `/ops/org/:id/programmes` | `/ops` guard | RoutePlaceholder (WF03-S05 = WF04) |
| Public | `/organizations/:slug`, `/legal/:kind/:version` | public, PUBLISHED only | Public |
| Dev | `/dev/{pixel-qa,primitives,typography}` | `ENABLE_DEV_ROUTES` only | — |
| 404 | any unknown path / foreign resource | — | `not-found.tsx` (`data-shell="not-found"`) |

## Defects found and fixed

| # | Defect | Class | Fix |
|---|---|---|---|
| 1 | Shell wordmarks were plain text: no way back to `/` from auth, onboarding, member, ops, public | Shell integration | Wordmark → `/` everywhere (D1) |
| 2 | Inert MemberShell items / bell had no user-facing reason | Unclear disabled | `title` + accessible name with the reason (D2) |
| 3 | No path between member area and ops area for an ops actor | Missing navigation | "Vận hành tổ chức" (server-derived access) and "← Tài khoản của tôi" (D3) |
| 4 | Project editor pages were dead ends (no way back) | Dead end | "← Tài khoản của tôi" in EditorHeader (D4) |
| 5 | Venture editor ↔ team page not linked | Missing navigation | "Đội ngũ" / "Hồ sơ dự án" links (D5) |
| 6 | `/projects/new` unreachable from the product | Orphan route | S08 card 02 + S01 "+ Tạo dự án / startup" (D6) |
| 7 | `/auth` overflowed 232px at 768 and more at 390 (landing CTA target) | Responsive | Brand panel stacks below 1024px; card width `min(27.5rem, 100%)`; 1440 unchanged (D7) |

## Navigation matrix

`tests/visual/specs/p0-shell-navigation.spec.ts` → `tests/visual/reports/pixel-qa/P0-SHELL.navigation-matrix.json` (SOURCE / LABEL / TARGET / PERSONA / status / result).

| Persona | Working | In-page | Disabled (reason stated) |
|---|---|---|---|
| guest | 21 | 11 | 0 |
| incomplete | 10 | 3 | 0 |
| member | 49 | 3 | 24 |
| operator | 121 | 0 | 6 |
| admin | 26 | 0 | 0 |

274 rows · 22 source pages · 86 distinct targets. 0 `#`/empty href, 0 external, 0 ≥ 400, 0 placeholder reached, 0 authorized bounce to `/auth`. Disabled items: Challenge, Sự kiện (FUTURE); Thư viện, Lời mời, Tổ chức của tôi, Thông báo (no P0 screen) — `aria-disabled`, not focusable, reason in `title`.

## Journeys, session, errors, security

| Check | Result |
|---|---|
| Landing → auth → magic link → onboarding → complete → card 02 → editor → back to `/me` | PASS |
| Venture editor ↔ team; foreign venture → 404 | PASS |
| Member ↔ ops entry; ops nav active + reload + breadcrumb; account entry; wordmark → `/` | PASS |
| Admin HUB → Chapter switch | PASS |
| Logout (settings, "every device") → `/auth`; protected routes → `/auth`; back + reload shows no member shell | PASS |
| Revoked session → `/auth`; landing treats it as guest | PASS |
| Unknown route / foreign ids → not-found shell, no API envelope | PASS |
| Direct-URL authorization (guest → member/ops → `/auth`; member → ops → 404; leader → foreign org / `?orgId` tamper → 404) | PASS |
| 768 / 390: `/`, `/auth` no overflow, CTA reachable | PASS |

## Placeholder audit

Only `/ops/org/:id/programmes` (WF03-S05 = FUTURE / WF04) renders `RoutePlaceholder`. It is not listed in OpsShell (DEC-WF03-G12/G15) and not linked anywhere; it is reachable only by direct URL for an ops actor. Accepted and documented; no other placeholder, `href="#"` or dead CTA exists.

## PO items (not defects)

- MemberShell / OpsShell / onboarding are desktop-first; responsive for app shells is not certified (landing, auth certified at 768 / 390).
- The approved settings screen has no "sign out this device only"; logout is "Đăng xuất khỏi mọi thiết bị" or revoking another session.
- S08 card 03 (Chapter) stays omitted (no region → chapter mapping); S01 "Đang chờ bạn" still omitted (DEC-WF02-H10 "MAY").
- New shell copy ("Vận hành tổ chức", "← Tài khoản của tôi", reasons) awaits PO copy review.

## Related

- [P0_STATUS.md](P0_STATUS.md) — overall status
- [CLAUDE_LATEST_REPORT.md](CLAUDE_LATEST_REPORT.md) — task report
- [P0_LANDING_IMPLEMENTATION_REPORT.md](P0_LANDING_IMPLEMENTATION_REPORT.md) — landing
