# Roster Fixtures

Fictional, deterministic launch-roster files for GAP-ROSTER QA (Data Freeze D2). They are **not** HUB launch data: every address is `@example.test` and every organisation is a seed placeholder (`chapter-01`, `chapter-02`, `club-01`). The real roster is an operational input, imported with `pnpm roster:import`.

| File | Covers |
|---|---|
| `wf01-roster-fixture.csv` | A known member; B Chapter leader; C CLB leader; E duplicate row (case/space variant of A); H one person in two chapters; G seed `member` already ACTIVE; seed `pending` with a PENDING_APPROVAL membership (conflict, not overwritten) |
| `wf01-roster-invalid.csv` | Invalid email, unknown organisation, non-ACTIVE state, bad batch, missing column: the whole import is refused |

Case D (unknown user) and F (account existing before import) are exercised by the tests.

## Related

- [production_roster_template.csv](../../../../db/seed/production_roster_template.csv) — the frozen template
