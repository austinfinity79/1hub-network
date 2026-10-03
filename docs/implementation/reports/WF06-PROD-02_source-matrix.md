# WF06-PROD-02_source-matrix

**Canonical source matrix, Library item classification and external adapter boundary** (evidence 2, 3, 12). Parent: [WF06-PROD-02_data-foundation.md](WF06-PROD-02_data-foundation.md).

## Startup item — canonical (`LibraryStartupItem`, provenance CANONICAL)
| Field | Source table.column | Visibility rule | Null / fallback |
|---|---|---|---|
| `key` | `projects.id` → sha256 key | row passes the venture predicate | never null |
| `name` | `projects.name` | `type STARTUP AND status ACTIVE AND visibility PUBLIC` (SQL) | NOT NULL column |
| `summary` | `projects.summary` | same | null |
| `stage` {code, label} | `projects.stage_id` → `vocabulary_items` (VENTURE_STAGE) `.slug`, `.label` | same | null when unset or not a VENTURE_STAGE item |
| `domains`, `domainLabels` | `project_domains` → `vocabulary_items` (DOMAIN) `.id`, `.label`, ordered `sort_order, label` | same | `[]` |
| `region` | `projects.region_id` → `vocabulary_items` (REGION) `.label` | same | null (shown nowhere else) |
| `website`, `memberCount` | none (no canonical column) | — | null |

## Founder item (`LibraryFounderItem`)
| Field | Source | Visibility rule | Null / fallback |
|---|---|---|---|
| `key` | `individual_profiles.id` → sha256 key | all of: viewer NETWORK; owner of ≥ 1 listed venture; `individual_profiles.status ACTIVE`; `user_accounts.status ACTIVE`; PROFILE_DISCOVERY = NETWORK_ONLY (`group_overrides` → `default_level` → NETWORK_ONLY), via `discoveryLevelsOf` + `projectDiscovery(…, 'NETWORK')` | founder omitted |
| `displayName` | `individual_profiles.display_name` | same | founder omitted when null |
| `avatarUrl` | `individual_profiles.avatar_asset_id` → `/media/assets/{id}` (`isAssetId`) | same; the media route authorises again | null |
| `ventures[].name`, `.stage` | `projects` listed above | venture predicate | stage null |
| `ventures[].roleLabel` | `projects.owner_role_label` | same | null |
| `domainIds` | `project_domains` of the listed ventures | same | `[]` |
Never read: `full_name`, `phone`, `headline`, `bio`, e-mail, profile domains / region, team members.

## Other surfaces (unchanged reads)
| Surface | Source | Rule |
|---|---|---|
| `/organizations/:slug` | `organizations`, `organization_relationships`, `community_memberships` (count), `events` | PUBLISHED HUB / CHAPTER / CLB only; uniform 404 otherwise (WF03-S09) |
| taxonomy | `vocabulary_items` DOMAIN / VENTURE_STAGE, `status ACTIVE` | external mapping only |
| location | `vocabulary_items` REGION (canonical rows); `areas` of the problem file | display; problem `area` facet |
| programmes / challenges / applications | not read | DEC-W6P-D01 – D03 |

## Library item classification (evidence 3)
| Item / type | Class | Read from |
|---|---|---|
| Startup with a PUBLIC ACTIVE STARTUP venture | CANONICAL_NOW | `listPublicStartups` |
| Startup in the external feed without a canonical twin (folded name) | TEMPORARY_EXTERNAL | `loadStartupDirectory` → `mergeStartups` |
| Founder = owner of a listed venture | CANONICAL_NOW | `listVisibleFounders` |
| Founder / member names of the external feed | UNSUPPORTED_IN_P0 (never shown or searchable, D03) | dropped |
| "Bài toán" (problem file) | TEMPORARY_EXTERNAL | `LIBRARY_PROBLEMS` (unchanged) |
| Programme / challenge cards, member directory | UNSUPPORTED_IN_P0 (D1, D3) | — |
No canonical record was fabricated to replace external data.

## External adapter boundary (evidence 12)
| Rule | How |
|---|---|
| isolated source | only `startup-source.ts` fetches; only `startup-adapter.ts` parses (contact stripping, `safeUrl`, 2 MB / 1000 cap) |
| no mixing into canonical entities | external records become `LibraryStartupItem` with `provenance: 'TEMPORARY_EXTERNAL'`; canonical rows are never modified or enriched |
| provenance mark | every item; canonical first on equal sort keys |
| current behaviour kept | `/library` unchanged until PROD-04, except founder names leaving search (D03) |
| easy removal | delete the `loadStartupDirectory` call in `listLibraryStartups` and `external-domain-map.ts` |
| no new dependency | none |
DOMAIN map: LOGISTICS→`logistics`, FINTECH→`fintech`, HEALTH→`healthtech`, AGRI→`agritech`, EDU→`edtech`, AI→`ai`, ENV→`climate-tech`; IT, OTHER unmapped. Applies only when an ACTIVE DOMAIN with that exact slug exists; inert otherwise. Open item: HUB / PO review of the slugs against the production DOMAIN list before PROD-04.

## Related
- [WF06-PROD-02_visibility-security.md](WF06-PROD-02_visibility-security.md) · [WF06-PROD-01_api-data-contract.md](WF06-PROD-01_api-data-contract.md)
