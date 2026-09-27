# WF04 Demo Scope

**Status: FROZEN** by [DEC-WF04-H1..H5](../decisions/DECISION_LOG.md#dec-wf04-h1) (2026-09-27); foundation built by WF04-T00 ([DEC-WF04-T00-D1..D5](../decisions/DECISION_LOG.md#dec-wf04-t00-d1)). WF04 Programme / Challenge = **DEMO** for INTERNAL ALPHA. The demo explains the organizer journey; it is not the future programme platform. Audit: [WF04_PRE_IMPLEMENTATION_AUDIT.md](WF04_PRE_IMPLEMENTATION_AUDIT.md). **Closed:** WF04 PROTECTED / CLOSED / GREEN (2026-09-27, [completion audit](reports/WF04_COMPLETION_AUDIT.md)); the scope below is the protected baseline — changes need an explicit task.

## Screen inventory
Flow steps are the frozen Master Spec §4 sequence. "Ref" = design evidence; no approved WF04 bitmap exists (F1, F2).

| ID | Name | Route | Actor | Purpose | Ref | SOT | Data | Interaction | Depends | Class |
|---|---|---|---|---|---|---|---|---|---|---|
| WF04-S01 | Programme / Challenge list | `/demo/programmes` | Ops actor | Steps 1: see all, filter by type, start create | ADM5 (layout) | §4; D1 | Fixture + session drafts | Read, filter, "Tạo mới" | T00, H1, H2 | **A REQUIRED** |
| WF04-S02 | Create + Basic information | `/demo/programmes/new` → `…/:id/setup/basic` | Ops actor | Steps 2–3 merged: type, name, summary, owning org, dates | Primitives (WF02-S05 editor, S07 form) | `programmes` columns | Session | Form, validate, save draft | S01 | **A REQUIRED** |
| WF04-S03 | Structure & participation journey | `…/:id/setup/journey` | Ops actor | Step 4: ordered stages (H3); CHALLENGE problem statements (H4) | ADM5 "Giai đoạn" / "Bài toán" | D1 node only | Session | Ordered list edit | S02 | **A REQUIRED** |
| WF04-S04 | Events / activities | `…/:id/setup/events` | Ops actor | Step 5: events linked to the programme | S07 primitives | SOT §11 | `EventDTO` + `programme_id` | Add / edit / remove | S02 | **A REQUIRED** |
| WF04-S05 | Registration / eligibility / participation | `…/:id/setup/registration` | Ops actor | Step 6: who may apply, programme-specific questions, profile reuse | none | SOT §12 | Session | **CONFIG DEMO** | S02 | **B SUPPORTING** |
| WF04-S06 | Operating team | `…/:id/setup/team` | Ops actor | Step 7: who runs it (display) | none | 03 §3–4 | Fixture | Read-only list | S02 | **B SUPPORTING** |
| WF04-S07 | Review + draft / publish | `…/:id/setup/review` | Ops actor | Step 8: H5 checklist (`publishReadiness`), keep draft or publish | none | SOT §6; H5 | Session | Checklist, publish | S02–S06 | **A REQUIRED** |
| WF04-S08 | Detail / manage / monitor | `/demo/programmes/:id` | Ops actor | Steps 9–10 merged: status, current stage, events, team, application counts, edit entry | S02 / S04 card primitives | SOT §5–6 | Fixture + session | Read; "Chỉnh sửa" → setup | S01 | **A REQUIRED** |

Totals: **6 REQUIRED + 2 SUPPORTING = 8 executable demo screens.**

## Future / omitted (C)
| Surface | Evidence | Why |
|---|---|---|
| Participant Challenge library | WF01-S08 card 01; MemberShell "Challenge" | DEC-WF01-S08-D2, DEC-P0-SHELL-D2 (FUTURE) |
| Application submission | SOT §12 | WF05 / later; API §15 |
| Application review / judging rounds | ADM10 "Vòng chấm", ADM5 "Đang chấm" | API §15; SOT §14 |
| Startup review, summit review | ADM6, ADM7 | Not WF04 alpha |
| Investor review | ADM11 | Investor = FUTURE (SOT §14) |
| Log & vote, tag tree, translations, sender & pixel | ADM12, ADM1, ADM13, ADM14 | No SOT |
| Problem-statement bank (standalone admin) | ADM2 | FUTURE (inline list = H4) |
| Public programme page | none | No public route frozen |
| Close / archive actions | SOT §6 | Not in the frozen flow |
| Participation / outcomes | SOT §13 | FUTURE |
| Event registration | DEC-WF03-S07-EVENT-LIFECYCLE | Rejected in P0 |
| Unit programmes `/ops/org/:id/programmes` | DEC-WF03-G12 | Stays FUTURE placeholder; WF03 not reopened |

**12 future / omitted surfaces.** Conflicts resolved: design source = approved primitives (H1); phases = ordered stages (H3); "Bài toán" = CHALLENGE-only inline demo list (H4); Challenge publish rule = checklist item (H5); "Chapter hưởng ứng" removed.

## Production vs demo boundary
| Capability | Class |
|---|---|
| `programmes` table, `programme_type`, `events.programme_id` | PRODUCTION FOUNDATION (exists; not written by the demo) |
| DTO shapes (Programme = table columns; `EventDTO` + `programme_id`) | PRODUCTION FOUNDATION (04 D4) |
| `/demo/*` guard (session + onboarded + ops access + `programme:read`) | PRODUCTION FOUNDATION (reuses `requireOps` / `organizationScope`) — **built in T00** |
| Fixture repository, `GET /api/v1/demo/programmes*`, session store + reset, demo frame, OpsShell entry | DEMO — **built in T00** |
| Create / edit / publish, journey, events, registration config | DEMO — browser-session state only, "Đặt lại demo" resets |
| Operating team list, application counts | DEMO — fixture display, no permission effect |
| Programme write API, capability, audit codes, CLOSED status, relationship / role / application tables, eligibility engine, notifications, import / export, analytics | FUTURE |

**Guard rails:** the demo writes nothing to PostgreSQL, audit or analytics; every WF04 page shows "DỮ LIỆU DEMO"; no WF03 file under `src/lib/ops/events*` or `/ops/org/*` changes; no demo route is reachable by guests.

## Related
- [WF04_PRE_IMPLEMENTATION_AUDIT.md](WF04_PRE_IMPLEMENTATION_AUDIT.md) — evidence
- [WF04_SCREEN_IMPLEMENTATION_PLAN.md](WF04_SCREEN_IMPLEMENTATION_PLAN.md) — tasks
- [WF04_HAPPY_PATH_PLAN.md](WF04_HAPPY_PATH_PLAN.md) — journeys and data
