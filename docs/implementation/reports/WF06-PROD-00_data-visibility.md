# WF06-PROD-00_data-visibility

**WF06-PROD-00 — canonical data reuse, read models, visibility, search / filter, DB, cross-WF dependencies and test data.** Main report: [WF06-PROD-00_runtime-gap-audit.md](WF06-PROD-00_runtime-gap-audit.md).

## Canonical data reuse
| WF06 need | Canonical source | Availability | Gap |
|---|---|---|---|
| Profile card | `individual_profiles` (display_name, headline, bio, avatar), `profile_domains`, region | present; `projectDiscovery` projects the D2A fields | no member-facing read API (PO-A) |
| Profile visibility | `profile_visibility_settings` (`default_level`, `group_overrides`), PROFILE_DISCOVERY NETWORK_ONLY / PRIVATE | present, server-side | seed holds one PUBLIC row the P0 API never offers |
| Organization / Chapter / CLB | `organizations` (type, `publication_status`), `organization_relationships` | present; public projection exists | no list API (FUTURE) |
| Venture / Project / Startup | `projects` (type, status, `visibility`, region, stage), `project_domains`, `project_members` | present; PUBLIC set on publish | no read path for non-members (PO-B) |
| Programme / Challenge | `programmes` (type, status, dates), `metadata.challenge`, `programme_application_forms` | present | no public read (DEC-W4P-D10) |
| Application | `applications` | owner-only | must never be discoverable (D07) |
| Sector / taxonomy | `vocabulary_items` DOMAIN 44, SPECIALIZATION 14, SKILL 12, VENTURE_STAGE 5 | present + `GET /vocabularies/{type}` | Library facets use raw strings |
| Location | `vocabulary_items` REGION 6, COUNTRY 2 | present | — |
No ProfileSearchV2 / ProjectDiscoveryV2 / ProgrammeDiscoveryV2 or parallel store is needed or proposed (Arch 02 :201-234: discovery owns no data).

## Read models
| Option | Verdict |
|---|---|
| A. direct canonical reads (query-time projection, existing indexes) | **recommended** for every surface in PO-A / B / C: hundreds of rows, visibility applied in the query, no refresh problem |
| B. derived read model / materialized view | not justified: no ranking, no cross-entity aggregation, no scale signal; would duplicate visibility and add staleness. Revisit only with measured load |

## Visibility / privacy matrix
| Data | Guest | Member | Owner | Ops |
|---|---|---|---|---|
| Profile D2A fields | never (no PUBLIC in P0) | if NETWORK_ONLY (not PRIVATE) | all | via `projectDiscovery(NETWORK)` only |
| Profile phone, e-mail, CV, contacts | never | never | own | never |
| Venture DRAFT / PRIVATE | never | team only | all | — |
| Venture PUBLIC | PO-B (none today) | PO-B (none today) | all | — |
| Programme DRAFT / CLOSED / ARCHIVED | never | own application history only (WF05) | operator | scoped |
| Programme PUBLISHED | no public list (DEC-W4P-D10) | open list with a form (WF05) | operator | scoped |
| Application | never | owner only | owner | no read (D07) |
| Organization PUBLISHED HUB / CHAPTER / CLB | public page, no persons, no ids | same | — | scoped |
Every rule is enforced server-side today; any new surface must reuse `projectDiscovery` / the venture and programme status predicates, never client filtering.

## Search / filter
Canonical controlled vocabularies exist for domain, specialization, skill, stage, region, country and org type (enum); search / filter fields must use vocabulary ids (Freeze :206-212). Current search: Library keyword + facets in the browser over external strings; vocabulary `q` ILIKE; ops `q` over visible names. No server search API. Keyword search for a new directory can be `ILIKE` on name at this scale; no free-text field where an id exists.

## DB / index
| Need | Verdict |
|---|---|
| new table / materialized view | no — CAN EXISTING TABLES SOLVE IT: yes |
| indexes | optional, only for promoted surfaces: partial index `projects (visibility, status)` for PO-B; `pg_trgm` only if measured search load appears; existing `idx_org_type_status`, `idx_project_domains_item`, `idx_vocab_type_status` cover the rest |
| query only | yes for the existing layer |
No migration is needed for the IN_P0 scope.

## Cross-WF dependency map
| From | Data consumed | API consumed | Visibility assumption | Coupling risk |
|---|---|---|---|---|
| WF01 → WF06 | profile identity, D2A fields (consent is separate and not read) | `projectDiscovery` | PROFILE_DISCOVERY default NETWORK_ONLY | the privacy copy names the Library (S3) |
| WF02 → WF06 | ventures, team, publish state | none public | PUBLIC grants no read until PO-B | must not change venture lifecycle |
| WF03 → WF06 | organizations, relationships, events | `by-slug` | PUBLISHED only, no persons | org-page children unbounded |
| WF04 → WF06 | programmes, challenges | none public | PUBLISHED only | DEC-W4P-D10 boundary |
| WF05 → WF06 | applications | none | never discoverable | open list ignores org status (S4) |
WF06 mutates no upstream aggregate. Sprint1 dependencies: AI profile / venture import and feedback would only change canonical fields WF06 reads; documented, not absorbed.

## Test-data readiness
Seed: 9 accounts, visibility rows NETWORK_ONLY ×2 / PRIVATE ×2 / PUBLIC ×1, organizations (HUB, 2 chapters, CLB; all PUBLISHED), 1 venture, programme `d4…0001`, challenge `c0…0001`, events. Needed for runtime tests (deterministic helper, as WF05 `testing.ts`): members NETWORK_ONLY and PRIVATE with different domains / regions, ventures DRAFT / PRIVATE / PUBLIC × PROJECT / STARTUP, programmes DRAFT / PUBLISHED / CLOSED, a DRAFT and an ARCHIVED organization. No production demo content.

## Related
- [WF06-PROD-00_runtime-gap-audit.md](WF06-PROD-00_runtime-gap-audit.md) · [WF06-PROD-00_scope-matrix.md](WF06-PROD-00_scope-matrix.md) · [WF06-PROD-00_gap-matrix.md](WF06-PROD-00_gap-matrix.md)
