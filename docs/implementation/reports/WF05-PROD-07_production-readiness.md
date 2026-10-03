# WF05-PROD-07_production-readiness

**WF05-PROD-07 — production readiness closure.** 2026-10-03. **Verdict: WF05 PROD HARDENED / NOT YET DEPLOYED.** PROD-00 → PROD-06 all PASS_WITH_EVIDENCE; P0 blockers 0, SOT conflicts 0, PO decisions remaining 0. Docs only: no runtime, migration, push, merge or deploy. Matrix and QA: [WF05-PROD-07_closure-matrix.md](WF05-PROD-07_closure-matrix.md); combined WF04 + WF05 package: [WF04-WF05-combined-hardening-handoff.md](WF04-WF05-combined-hardening-handoff.md).

## Preflight
| Check | Result |
|---|---|
| branch, HEAD | `feat/wf05-prod-hardening`, `8c1fbd6cc5401a950b5e23b883e5128c94f072f0` (PROD-06); the contract quotes `8c1fb0b6`, which is not an object: same commit, digits mistyped |
| tree, writer | clean except `AGENTS.md`; no other writer |
| migrations | 001–016; `db/` changed since `f40f70c`: 016 added, local seed only |
| WF04 candidate | `f40f70c` (`feat/wf04-prod-hardening` tip), ancestor of HEAD |
| `origin/main`, production | `78f21f2`, `78f21f2` |
| evidence | PROD-00 (4), 01 (7), 02–04 (2 each), 05 (4), 06 (3) reports present |
| lanes | Claude B `fb2130f` and `fix/member-shell-mobile` `a957876` not in HEAD |
| runtime fixture / seed dependency | 0: no `programme-demo/fixtures`, `testing` or `d4…0001` reference in runtime `src` |

## Contract invariants (DEC-W5P-D01–D12)
| Invariant | Result |
|---|---|
| scope L5 + S01 + S02 | held |
| Venture = `projects`, owner = `owner_profile_id`, team = `project_members`, Programme = `programmes`, Form = `programme_application_forms`, Application = `applications` | held; migrations 013–016 create only `programme_application_forms` and `applications`; no ProjectV2 / StartupV2 / VentureV2 / ApplicationV2 / WF05Application in `src` or `db` |
| DRAFT → SUBMITTED; SUBMITTED terminal and immutable (016 guards) | held |
| CLOSED / ARCHIVED: no create, edit, submit; owner reads history | held (PROD-05 lifecycle matrix) |
| no reopen / amend / resubmit | held: no endpoint, DB guard |

## d4…0001, demo artifacts, cross-WF identity
- **d4…0001:** KEEP + CLOSE / HIDE (D08). No runtime dependency, no hard-coded id in a production path, no delete needed. The close through WF04 `POST /programmes/{id}/close` after 015 is live remains a **RELEASE_STEP** (runbook step 6), not a hardening blocker.
- **Demo artifacts:** no "Dữ liệu demo", "Đặt lại demo", actor / test control or "· Demo" label in WF05 runtime (grep; PROD-06: 0 markers / wording on 144 captures). `/demo/projects` and `/api/v1/demo/projects` keep their names (allowed).
- **Cross-WF:** WF02 ↔ WF05 same venture, owner and `project_members`; WF04 ↔ WF05 same programme, form version and application; no copy-on-enter, no second store (PROD-04 F, PROD-05 Q).

## Known limitations and debt
| Item | Class |
|---|---|
| SHELL-MOBILE-01 (shared shell small widths); WF05 screens: 0 overflow at 320–430 | P2_DEBT (separate cross-product lane) |
| `fix/member-shell-mobile` (`a957876`) touches `member-shell.tsx` and the `/demo/projects` layout, both changed by WF05: integration conflict to resolve (keep the WF05 layout, drop its `responsive` prop) | P1_PRE_PROMOTION |
| combined chain integrated to the release branch and regressed on the exact SHA | P1_PRE_PROMOTION |
| 014 → 015 → 016 rehearsal on a production-shaped copy; pre-deploy backup | P1_PRE_PROMOTION |
| owner documents: CLAUDE.md §2 WF05 wording, Data SOT venture note, superseded notes (PROD-01 runbook item 2) | P1_PRE_PROMOTION |
| `d4…0001` close / hide | RELEASE_STEP |
| S01 venture-name link without a visible focus ring (since WF05-S02) | P2_DEBT |
| G29 SUB0 / CHOOSE / SUB2 without an in-page back link | P2_DEBT (design) |
| API §2.5 generic "400 malformed" wording vs DEC-W5P-D11 | P2_DEBT (doc clarification) |
| WF03 UAT audit-code registry copy lacks WF04 `PROGRAMME_*` | P2_DEBT (test) |
| WF02 team page 9 px at 320; G08 / G13 team idempotency and e-mail | P2_DEBT (WF02) |
| G14 rate limit, CSRF beyond SameSite, framework 400 / 405 envelope | P2_DEBT (platform) |
| WF04 OpsShell demo entry; WF04 Q3(b) deferred | ACCEPTED_BASELINE (WF04 closure) |
| draft created on first input (PROD-04 flag) | accepted with the PROD-04 gate; no decision open |
| WF06, Sprint1 UAT implementation, Admin Portal | OUT_OF_SCOPE |

## Blocker check
| Count | Value |
|---|---|
| P0_BLOCKERS | 0 |
| P1_PRE_PROMOTION | 4 (integration with the shell lane, combined regression on the exact SHA, production-copy migration rehearsal + backup, owner documents) |
| P2_DEBT | 7 |
| SOT_CONFLICT | 0 (C1 / C2 resolved by DEC-W5P-D09) |
| PO_DECISIONS_REMAINING | 0 |

## Next workstream
WF05 is closed at this state. The next product runtime lane is **WF06-PROD-00 — not started**. Sprint1 UAT implementation is a separate existing workstream, not mixed into WF06; the Admin Portal follows WF06-PROD-06.

## Related
- [WF05-PROD-07_closure-matrix.md](WF05-PROD-07_closure-matrix.md) · [WF04-WF05-combined-hardening-handoff.md](WF04-WF05-combined-hardening-handoff.md) · [WF05-PROD-01_production-contract.md](WF05-PROD-01_production-contract.md) · [WF04-PROD-07_production-readiness.md](WF04-PROD-07_production-readiness.md)
