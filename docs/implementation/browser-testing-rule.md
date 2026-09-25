# Browser Testing Rule

Permanent operating rule for 1hub.network Phase 0, added after M0-T02.
Playwright is the only authoritative browser automation tool.

## Authority

| Mechanism | Status |
|---|---|
| Playwright (Chromium) | Authoritative for all browser validation |
| Claude Chrome extension | NOT valid as test evidence |
| Manual clicking in Chrome | NOT valid as workflow validation |
| Browser state created outside Playwright | NOT valid |

## Playwright is required for

- workflow smoke tests, E2E tests, regression of completed flows
- deterministic navigation and authenticated scenarios
- form interaction, validation and error-state checks
- responsive/viewport verification
- screenshot capture and pixel-comparison preparation

## Deterministic configuration for production-screen visual QA

| Setting | Value |
|---|---|
| Browser | Chromium via Playwright |
| Viewport | 1440 x 900 |
| deviceScaleFactor | 1 |
| Data | deterministic seed/fixture |
| Session | deterministic authenticated session |
| Waits | document / fonts / network state as appropriate |
| Animation | disabled or reduced |
| Time and unstable data | frozen where necessary |
| External runtime assets | never depended on |

## Evidence required per UI task

Playwright must generate an actual screenshot, the reference/baseline path, a
diff image, and a comparison result.

```text
tests/visual/
├── actual/
├── diff/
├── reports/
└── specs/
```

`design-reference/final/` stays read-only. Never write there.

## PASS rule

Never report Workflow PASS, E2E PASS, Visual PASS or Pixel PASS unless the
Playwright command actually executed successfully.

If Playwright cannot run, report BLOCKED or NOT RUN with the exact reason.
Never substitute Chrome-extension observation as proof of a PASS.

## Scope rule

Add only the Playwright coverage relevant to the authorized task. Rerun
previously completed critical flows as regression. Grow the suite incrementally
across WF01 to WF03. Do not build a large generic E2E suite up front.

## Known impact on completed work

| Task | Impact |
|---|---|
| M0-T01 | None. Its smoke check was `curl`, not a browser. |
| M0-T02 | Its foundation QA used the Chrome extension and was withdrawn. Re-verified under Playwright in M0-T02b; FOUNDATION PASS now rests on a real Playwright run. |

## Commands

| Command | Purpose |
|---|---|
| `pnpm visual` | Run the Playwright visual/foundation suite |
| `pnpm visual:update` | Regenerate harness baselines, only when a change is intended |
| `pnpm visual:report` | Open the HTML report |
| `pnpm verify:visual` | Full code gates, then the visual suite |

## Related

- [claude-latest-report.md](CLAUDE_LATEST_REPORT.md) — latest task report
- [reports/](reports/) — archived per-task reports
