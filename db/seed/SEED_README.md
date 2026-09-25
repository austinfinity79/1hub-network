# P0 Seed Strategy

- `seed_dev.sql` is deterministic **development/QA data**, not real HUB launch data.
- Production must import the approved HUB/Chapter/CLB roster through `production_roster_template.csv` (or an equivalent importer) using normalized email + organization slug.
- Unknown/missing real Chapter/CLB names are intentionally not invented in this pack.
- Fixed UUIDs in dev seed exist so Playwright/pixel QA gets stable URLs and states.
- Production secrets/tokens must never be committed to seed files.
