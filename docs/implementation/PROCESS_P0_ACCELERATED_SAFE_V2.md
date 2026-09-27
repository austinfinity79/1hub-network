# PROCESS-P0-ACCELERATED-SAFE-V2

**Installed 2026-09-26** for all remaining Phase 0 work. The process changes execution **frequency and order, never quality thresholds**. Product / business decisions changed by this process: **NONE**. CLAUDE.md §1–§13 remain in force; where this file and CLAUDE.md differ, the stricter rule applies.

## A. Contract freeze gate (before any runtime task)
| Area | Must be frozen |
|---|---|
| Business | actor, happy path, lifecycle, rules |
| Data | canonical entity, relationships, ownership, status |
| API | route, DTO, errors, authorization |
| Design | screen contract, approved reference, fields/actions, intentional omissions |
| Security | actor, capability, resource scope, lifecycle |

All applicable areas frozen → **fast path**. Otherwise → **full preflight → decision → STOP**.

## B. Fast path
Allowed only with: no new canonical model, lifecycle, migration or RBAC ambiguity; no OPEN decision; clear API and screen contracts; an approved reference or pattern; no Design/SOT conflict.

`PRECHECK → IMPLEMENT → TARGETED TEST → PIXEL → FIX → RECHECK → DEPENDENCY REGRESSION → COMMIT → REPORT → STOP`

## C. Full preflight
Mandatory for DB/schema, lifecycle, ownership, RBAC/capability, privacy/security, external integration, ambiguous historical data, or ambiguous Design/SOT mapping.

`AUDIT → DECISION FREEZE → IMPLEMENT → QA → PIXEL → SECURITY → REGRESSION → COMMIT → REPORT → STOP`

## D. Design lock
Production screens follow the Design Pixel SOT, the screen contract and `design-reference/final`. No approximated UI; never modify a baseline to make code pass. Business/Data SOT vs design conflict → STOP.

## E. Targeted testing
During a task: affected unit, affected DB/API, target Playwright, target pixel, direct dependencies. **Full** workflow/phase regression when a workflow closes, a migration has broad impact, the auth/security foundation changes, a shared global primitive changes, or for a release candidate.

## F. Targeted pixel
| Change | Pixel scope |
|---|---|
| Local CSS | target screen |
| Shared primitive | every dependent reference |
| Global token / typography | every affected screen |

Severity: P0 structural, P1 major, P2 component → **must fix**; P3 raster → may document.

## G. Decision freeze
CLOSED decisions are immutable implementation inputs. They are not re-audited. Reopen only on **new** contradictory evidence, with a traceable conflict record.

## H. Human stop policy
STOP only for business, data, migration, security/privacy or RBAC ambiguity, or a Design/SOT conflict. Do **not** stop for compiler/type fixes, obvious deterministic test fixes, internal implementation choices, P3 raster noise, or already-frozen decisions.

## I. Workflow closing gate
After the final executable screen, do not start the next workflow. Mandatory: completion audit → happy-path UAT → cross-screen data → business invariants → security → pixel regression → fresh DB / migration / restart → verdict. Only GREEN closes a workflow.

## J. Protected green workflows
WF01, WF02, WF03, WF04 (DEMO) and WF05 (DEMO) are **PROTECTED / CLOSED / GREEN**. Later work must not casually alter their frozen behaviour; WF04 and WF05 changes need an explicit task authorization. A shared change that affects them → targeted regression (WF04: `pnpm visual wf04`, which includes the closure spec `wf04-uat-journey`; WF05: `pnpm visual wf05`, which includes `wf05-uat-journey`); a change to their business contract → STOP.

## K. Deploy handoff
Claude A implements; Claude B deploys **only the exact approved SHA, never HEAD**. Record approved SHA, deployed SHA, previous SHA, rollback SHA, migration range and smoke result.

## L. Report format (normal task)
Task · Status · Scope completed · Files changed · Decision delta · Business/Data/API delta · Migration · Security · Tests · Pixel · Regression · Blocking gaps · Commit SHA · Recommended next task · STOP. Do not repeat the SOT. The CLAUDE.md §12 Git fields stay mandatory in `CLAUDE_LATEST_REPORT.md`.

## M. Golden rules
- Speed vs correctness → **correctness wins**.
- Design vs SOT → **STOP, do not guess**.
- Code vs frozen contract → fix the code.
- Test vs frozen contract → fix the test.
- Never change a correct product contract to make old code or tests pass.

## Related
- [../../CLAUDE.md](../../CLAUDE.md) — §14 installs this process
- [P0_STATUS.md](P0_STATUS.md) — status
- [DECISION_LOG](../decisions/DECISION_LOG.md#process-p0-accelerated-safe-v2) — process record
