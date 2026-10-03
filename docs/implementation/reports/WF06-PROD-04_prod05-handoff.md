# WF06-PROD-04_prod05-handoff

**QA handoff to WF06-PROD-05** (evidence 26). Parent: [WF06-PROD-04_frontend-integration.md](WF06-PROD-04_frontend-integration.md). PROD-05 not started.

## Routes
| Route | What to check |
|---|---|
| `/library`, `/library?q=…` | three tabs on the APIs; states; counts; quick chips; facets; sort; "Xem thêm" |
| `/organizations/:slug` | unchanged WF03 page; children ≤ 200 + total in the heading and stats |
| `GET /api/v1/library/{startups,founders,problems}` | API §25 (envelope, 422 reasons, headers) |
| homepage search → `/library?q=` | keyword carried, Back returns |

## Actors
guest · member owning nothing · member owning a PRIVATE venture only · founder viewing themself · revoked session · BLOCKED account · deactivated owner. Fixture: `seedLibraryFixture()` + `addVisibleFounder()` (`src/lib/library/testing.ts`), sessions with `createSession()`.

## Cases
| Area | Cases |
|---|---|
| API states | ready, loading (delayed answer), empty, error 500 (retry), refused next page 422 (retry), restricted (guest founders), degraded (feed down) |
| privacy | hidden / deactivated / blocked / nameless / private-only owners never named; guest founder tab has no name or count; rendered text and attributes hold no key, UUID, e-mail, private profile field or `/media` URL; page HTML of a guest holds no founder name |
| filters | DOMAIN / VENTURE_STAGE ids, several per group; problem text values incl. a quick chip absent from the file (empty result); "Xoá tất cả"; facet counts with keyword |
| pagination | 9 / next / last; no duplicate; refused cursor; stable order across reloads and server restarts |
| external failure | server with `LIBRARY_STARTUP_SOURCE_URL` unreachable (`WF06_FEED_DOWN=1` runs the spec case) |
| auth transition | guest → member (reload) → sign-out → Back: no stale founder |
| fixture-zero | `testing.ts` imported by tests only; no storage source; runtime data = problem file + external feed (both TEMPORARY_EXTERNAL) + canonical tables |
| cross-WF | card name / stage = `projects`, founder name = `individual_profiles.display_name`, organization = WF03 slug read; `l6-discovery-privacy`, `pdf-alpha-decisions` still green |

## Known visual risks (for PROD-06)
| # | Risk |
|---|---|
| V1 | facet lists are the DOMAIN / VENTURE_STAGE vocabulary (production DOMAIN list unknown here; the dev DB holds QA items) |
| V2 | Startup / founder quick chips depend on DOMAIN slugs matching the reviewed map; with none, the row is kept hidden |
| V3 | canonical startup cards have no member line and no website button: card heights differ from external ones |
| V4 | card mark tones derive from the opaque key, so colours differ from the startup.json era |
| V5 | the guest founder sign-in state is new on L15c (existing block style; copy needs PO / design review) |
| V6 | "Chưa xác định" stage facet value removed (PO / design call H1) |

## Related
- [WF06-PROD-04_qa-evidence.md](WF06-PROD-04_qa-evidence.md) · [WF06-PROD-03_prod04-handoff.md](WF06-PROD-03_prod04-handoff.md)
