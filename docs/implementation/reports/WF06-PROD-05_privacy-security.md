# WF06-PROD-05_privacy-security

**Guest / member privacy, private-data exclusion, direct-id bypass, founder and organization visibility, session transition, external-data security and security logging** (evidence 5 – 7, 12 – 15, 22). Parent: [WF06-PROD-05_qa-summary.md](WF06-PROD-05_qa-summary.md). Cases: `tests/visual/specs/wf06-prod-qa.spec.ts` (matrix `WF06-PROD-05.qa-matrix.json`), with `wf06-prod-library`, `wf06-prod-api`, `l6-discovery-privacy` and the Library db-tests.

## Guest / member privacy (evidence 5)
| Actor | Startup | Founders | Private fields |
|---|---|---|---|
| guest | public canonical + external, same answer as a member | `items: []`, `restricted: true`, count "–", sign-in state | none in API or page |
| member (owns nothing) | same as guest | visible owners only (fixture: Hải, Lan, Minh) | none |
| logout | — | sign-in state on reload; no founder name in the page | — |

## Private-data exclusion (evidence 6)
Five API answers (startups, startups `q`, founders, founders `q`, problems), as guest and as member, and the `/library` page HTML (Startup and founder tabs opened) contain none of: every fixture venture, profile and account UUID; the private profile values (full name, phone, headline, bio); the excluded ventures (PRIVATE, DRAFT, ARCHIVED, PROJECT, private-only); the hidden / deactivated / blocked / private-only owners; **an application answer written for a listed venture in this run** and every application answer ≥ 12 characters stored in the database (17 applications); fixture slugs; e-mails; the external source URL; and no key named `owner*`, `account*`, `profile_id`, `venture_id`, `slug`, `metadata`, `answers`, `application*`, `snapshot`, `challenge*`, `full_name`, `phone`, `email`, `headline`, `bio`, `thanh_vien`, `ho_ten`, `vai_tro`.

## Direct-id and query bypass (evidence 7)
| Attempt | Answer |
|---|---|
| hidden venture / profile / account id as `domain_id` or `stage_id` | 422 (`unknown` / `invalid`), nothing resolved |
| `/library/startups/{id}`, `/library/founders/{id}`, `/profiles/{id}` | 404 |
| `/ventures/{hidden id}` | 404 (member), 401 (guest) |
| organization by a DRAFT slug, by a UUID, ARCHIVED page | 404 |
| `owner_profile_id`, `visibility`, `organization_id`, `category`, `__proto__` | 422 `not_accepted` |
| forged cursor, `o:-1`, `o:09` | 422 `invalid` |
| well-formed edited cursor `o:5` | the visible list from position 5, nothing else |

## Founder visibility (evidence 12)
| Case | Member | Guest |
|---|---|---|
| venture visible + founder visible | named | restricted |
| venture visible + founder PRIVATE | venture listed, no owner | restricted |
| venture visible + owner deactivated | venture listed, no owner | restricted |
| venture hidden (owner of a PRIVATE venture only) | no owner | restricted |
No name, id, slug, initial or relation of a hidden founder in any answer or page.

## Organization visibility (evidence 13)
PUBLISHED CLB 200; DRAFT, ARCHIVED and a PUBLISHED COMPANY (not a network organization) the same 404; ops organization list: guest 401, plain member refused. Organization search / filter: NOT_APPLICABLE (no public organization search in P0; `organization_id` refused).

## Session transition (evidence 14)
Guest load (sign-in state) → real magic-link sign-in (`/dev/login`, new account) → `/library` lists the visible founders → `POST /auth/logout` → reload: sign-in state, no founder name in the page. Also in PROD-04: sign-out then Back restores no member content. No client cache exists to go stale.

## External-data security (evidence 15)
Server started on a crafted feed (14 rows): `<script>` in a name, `<img onerror>` in a summary, `<b>` in a domain, `javascript:`, `data:`, protocol-relative and user-info URLs, a duplicate (case only), a row without fields, a name with an e-mail, a 240-character name, `null`, a number, `{}`, an empty name. Result: unsafe URLs become `null` (only `https://host…` links drawn); markup is shown as text (no element created, no dialog, `window.__xss` unset); the e-mail row and unusable rows dropped; the duplicate kept once; the long name cut at 80; the canonical twin wins; no member name or source field in the answer; no error text in the page. Feed unreachable: canonical rows with `degraded: true`, no error state.

## Security logging (evidence 22)
Server logs of every run in this task (normal server through the full regression, crafted feed, unreachable feed) inspected for session tokens, cookie values, e-mails, private profile values, hidden founder names, raw external payload and application content: **0 hits**. The only non-startup lines are `library startup source unavailable TypeError` (error class only) on the unreachable-feed server.

## Related
- [WF06-PROD-05_functional-quality.md](WF06-PROD-05_functional-quality.md) · [WF06-PROD-03_visibility-privacy.md](WF06-PROD-03_visibility-privacy.md)
