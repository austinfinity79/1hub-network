# WF06-PROD-03_visibility-privacy

**Visibility matrix, founder privacy, cross-actor matrix, data and state exclusion, direct-id attempts, logging and cache** (evidence 3, 4, 13 – 17). Parent: [WF06-PROD-03_api-hardening.md](WF06-PROD-03_api-hardening.md). Tests: `src/lib/library/library-routes.db-test.ts` (route handlers, real sessions) and `tests/visual/specs/wf06-prod-api.spec.ts` (HTTP).

## Visibility matrix (evidence 3)
| State | Canonical source | Enforced | Result |
|---|---|---|---|
| PUBLIC | `projects.visibility` + `status ACTIVE` + `type STARTUP` | SQL `WHERE` (PROD-02) | listed for every caller |
| MEMBER / NETWORK_ONLY | PROFILE_DISCOVERY | viewer from the session cookie only (`libraryViewer`), then `projectDiscovery(…, 'NETWORK')` | founders for members only |
| PRIVATE | venture PRIVATE / DRAFT; PROFILE_DISCOVERY PRIVATE | not selected; projection null | never listed, never named |
| ORG-SCOPED | organization `PUBLISHED`, type HUB / CHAPTER / CLB | SQL in `getPublicOrganization` | DRAFT / ARCHIVED / COMPANY → same 404 |
| OWNER-ONLY | a PRIVATE or DRAFT venture, readable by its team in WF02 | not in the Library, even for its owner | tested |
Nothing hidden is loaded and filtered later; the founders route reads no data for a guest (0 SQL statements).

## Founder privacy (evidence 4)
| Case | Guest | Member |
|---|---|---|
| NETWORK_ONLY owner of a listed venture | not shown (`restricted: true`) | name, avatar, listed ventures, role label |
| PRIVATE owner (venture listed) | not shown | omitted; the venture is listed without any owner field |
| deactivated / blocked / nameless owner | not shown | omitted |
| owner of a PRIVATE venture only | not shown | omitted; the venture is not listed |
No `owner_profile_id`, account id, slug or team member in any answer; nothing inferred from relations.

## Cross-actor matrix (evidence 16)
| Actor | Data | Action | Expected = observed |
|---|---|---|---|
| guest | public startup | `GET startups` | listed |
| guest | NETWORK_ONLY founder | `GET founders` | `items: []`, `restricted: true` |
| revoked session / BLOCKED account | founders | `GET founders` | restricted (treated as guest) |
| member | NETWORK_ONLY founder | `GET founders` | shown |
| member | another member's PRIVATE venture | `GET startups?q=…` | absent |
| owner | own PRIVATE venture | `GET startups`, `GET founders` | absent |
| other member | hidden owner's PUBLIC venture | `GET startups` / `GET founders` | venture listed / owner absent |
| founder | self | `GET founders` | shown like any member sees them |
| guest vs member | startups | same request | identical body |
| spoofed `x-role`, `x-account-id`, `x-visibility` | founders | guest request | identical to guest body |

## Data and state exclusion (evidence 13, 14)
- Every UUID in every answer (startups, founders, problems, as a member) is a vocabulary id; no record UUID. No `email`, `phone`, `full_name`, `headline`, `bio`, `owner*`, `account*`, `profile_id`, `slug`, `metadata`, `answer(s)`, `application*` or `challenge*` key; no fixture private value; no e-mail.
- Sources read: `projects`, `project_domains`, `vocabulary_items`, `individual_profiles`, `user_accounts`, `profile_visibility_settings`, `user_sessions` (viewer), the feed, the problem file. No application, programme or audit table.
- Excluded states never served: PRIVATE, DRAFT, ARCHIVED ventures, PROJECT type; organizations DRAFT, ARCHIVED, non-network type.

## Direct-id attempts (evidence 15)
| Attempt | Answer |
|---|---|
| a venture, profile or account id as `domain_id` / `stage_id` | 422 `unknown`, nothing resolved |
| `owner_profile_id`, `visibility`, `include_private`, any unlisted parameter | 422 `not_accepted` |
| forged or edited cursor | 422 `invalid`, or an offset of the same visible list (past the end: empty page) |
| `/api/v1/library/startups/{id}`, `/founders/{id}` | 404 (no such route) |
| `/api/v1/ventures/{id}` of a PUBLIC venture as a non-owner | 404 (unchanged, L6) |
`key` is a derived hash; no endpoint accepts it.

## Logging and cache (evidence 17)
| Item | Finding |
|---|---|
| audit | none added (reads) |
| logs | feed failure logs the error class only (asserted: no payload); unexpected faults keep `withApi`'s log (request id, class, message, stack, never the request); no profile field, founder identity, token or session value logged; server log clean after the regression |
| cache | the feed cache is global and viewer-independent (same public data for everyone); every Library answer `Cache-Control: private, no-store`, `Vary: Cookie`; no new cache |

## Related
- [WF06-PROD-03_query-behaviour.md](WF06-PROD-03_query-behaviour.md) · [WF06-PROD-02_visibility-security.md](WF06-PROD-02_visibility-security.md)
