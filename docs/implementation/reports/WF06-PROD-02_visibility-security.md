# WF06-PROD-02_visibility-security

**Founder visibility, visibility predicate, application-data exclusion, canonical identity and read-path security** (evidence 4, 10, 11, 15, 16). Parent: [WF06-PROD-02_data-foundation.md](WF06-PROD-02_data-foundation.md). Tests: `src/lib/library/canonical-source.db-test.ts`.

## Founder visibility result (evidence 4)
| Case (fixture) | Venture listed | Founder shown | Test |
|---|---|---|---|
| founder visible: owner NETWORK_ONLY, no settings row ("Lan") or explicit row ("Hải"), member viewer | yes | yes, name + listed ventures only | `a member sees NETWORK_ONLY owners…` |
| founder hidden: PROFILE_DISCOVERY PRIVATE ("Ngân Hà" owner) | yes | no | `omits a hidden … owner` |
| venture visible + founder hidden: same, plus profile DEACTIVATED, account BLOCKED, null display name | yes | no, never an initial or placeholder | same |
| venture hidden: owner whose only venture is PRIVATE | no | no | same |
| guest viewer | yes | no; service returns `restricted: true`, `items: []` | `a guest gets…` |
`owner_profile_id` is read for grouping only; it is not in any item, and nothing is inferred from team or membership relations.

## Visibility predicate (evidence 10)
| State | Exists canonically | Enforced where |
|---|---|---|
| PUBLIC venture | `projects.visibility` | SQL `WHERE p.type = 'STARTUP' AND p.status = 'ACTIVE' AND p.visibility = 'PUBLIC'` (one constant, `PUBLIC_STARTUP`) |
| MEMBER (NETWORK) profile discovery | PROFILE_DISCOVERY NETWORK_ONLY | `listVisibleFounders` returns `[]` for GUEST before any read; `projectDiscovery(…, 'NETWORK')` |
| PRIVATE | venture PRIVATE / DRAFT; PROFILE_DISCOVERY PRIVATE | not selected (venture); projection returns null (profile) |
| ORG-SCOPED | organization `status PUBLISHED` only | existing `getPublicOrganization`; no org-scoped venture visibility exists, none invented |
Hidden ventures are never loaded: the predicate is in the SQL `WHERE`, not applied after a broad read.

## Application-data exclusion proof (evidence 11)
Static check of the four new modules: tables read = `projects`, `project_domains`, `vocabulary_items`, `individual_profiles`, `user_accounts` (+ `profile_visibility_settings` through `discoveryLevelsOf`). No `applications`, programme, challenge, draft, answer or audit table; no `INSERT`, `UPDATE` or `DELETE`. Item keys are whitelisted in the db-test (`Object.keys` equality). Result: zero application data.

## Canonical identity (evidence 15)
| Record | Identity used | Same as |
|---|---|---|
| venture | `projects.id` (key derived from it) | WF02 / WF05 venture id; fixture row ids asserted against keys |
| founder | `individual_profiles.id` (key derived from it) | WF01 / WF02 profile id |
| organization | `organizations.slug` / id via the WF03 read | WF03, unchanged |
No discovery-specific id table, no copied UUID; the key is stable for a record (`keys a venture by its canonical id, stably`) and unique per list.

## Read-path security (evidence 16)
| Check | Result |
|---|---|
| bypass by raw id | no function takes an id; every read applies the predicate; unknown ids in filters match nothing |
| private fields before serialisation | `full_name`, `phone`, `headline`, `bio`, e-mail never selected; db-test asserts their absence |
| internal owner ids | not in items; db-test asserts no venture / profile UUID, slug or e-mail in the JSON |
| unrestricted bulk read | canonical read capped at 1000 rows (warning logged at the cap); pages ≤ 50; keyword ≤ 120 |
| forged cursor | rejected (`LibraryQueryError`), unit + db-test |
API-layer checks (session → viewer, 422 envelope, rate limits) are PROD-03.

## Related
- [WF06-PROD-02_source-matrix.md](WF06-PROD-02_source-matrix.md) · [WF06-PROD-02_fixtures-tests.md](WF06-PROD-02_fixtures-tests.md) · [WF06-PROD-02_prod03-handoff.md](WF06-PROD-02_prod03-handoff.md)
