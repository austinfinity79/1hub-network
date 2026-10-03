# WF06-PROD-04_spec-realignment

**Spec / test realignment matrix** (evidence 17): every changed expectation, with the old rule, the frozen rule that replaces it and why the change is valid. Parent: [WF06-PROD-04_frontend-integration.md](WF06-PROD-04_frontend-integration.md). No expectation was loosened to turn a test green; each one now asserts the frozen behaviour, usually more strictly.

## Visual specs
| Spec › test | OLD RULE | NEW FROZEN RULE | SOURCE | WHY VALID |
|---|---|---|---|---|
| `public-library` › Bài toán counts | a guest sees the founder count from startup.json | a guest sees "–" for founders (tab and metric); no total | DEC-W6P-D03 | founders are for signed-in members; the API gives guests no total |
| `public-library` › Bài toán "Xem thêm" loop | each click shows more cards at once | each click waits for the next API page (cursor) | WF06-PROD-01 P4-1 | paging is server side; the intent (every record, dataset order) is unchanged |
| `public-library` › no tab names a source | every tab draws cards for a guest | a guest's founder tab is the sign-in state; checked as guest and member | DEC-W6P-D03 | a guest gets no founder row |
| `public-library` › Startup | startup.json records; every card "N thành viên" | canonical + external remainder; only an external card has a member line; added: canonical twin wins, hidden ventures never show | DEC-W6P-D02, PROD-02 source matrix | canonical ventures have no member count or website field; nothing is invented |
| `public-library` › Nhà sáng lập (split in two) | founders deduplicated from startup.json, for everyone | guest: sign-in state, no name or count; member: visible canonical owners only (fixture: Hải, Lan, Minh, Quân), hidden / deactivated / blocked / private-only owners absent | DEC-W6P-D03, WF06-PROD-01 runtime contract | external founders are UNSUPPORTED_IN_P0 |
| `public-library` › search / quick / sort | run in the browser; `apiCalls == []` | each asks `/api/v1/library/{problems,startups}` with the page's parameters only | WF06-PROD-01 P4-1, API §25 | filtering, sorting and paging moved to the server by contract |
| `public-library` › gutter / columns | founder cards drawn for a guest | measured as a member | DEC-W6P-D03 | as above |
| `public-library` › G–K pixel | rows measured right after "Xoá tất cả" | measured after the API answer (9 cards, state settled) | P4-1 | the answer is asynchronous; geometry and pixels unchanged |
| `public-library` › FOUNDER L15c pixel | guest view | member view | DEC-W6P-D03 | L15c draws founder cards, which only a member sees |
| `l6-discovery-privacy` › `/library` scan | no name of the test world on `/library` | the PUBLIC STARTUP's name may appear for anyone, its owner's name for members (discovery visible); private member, DRAFT venture, e-mails and ids never; other pages unchanged | DEC-W6P-D02 / D03 (PO D4) | the original spec, run on the new code, fails at "public member (owner) /library" because the owner is now a founder (the HEAD copy was re-run on the new build, then removed). PO confirmation H3 (DEC-L6-D1 / DEC-PDF-D1 reading) stays listed |
| `alpha-interaction-gaps` › `/library` card controls | every tab draws cards for a guest | a guest's founder tab is the sign-in state, whose single control is the real `/auth` link; the other tabs keep the card-control checks | DEC-W6P-D03 | no card exists for a guest; the "no dead control" intent is kept |

## Unit tests
| Test | OLD RULE | NEW FROZEN RULE | SOURCE | WHY VALID |
|---|---|---|---|---|
| `library-model.test` | cards built from startup.json (`startupTab`, `founderTab`), client search | cards built from the API DTOs (`startupCard`, `founderCard`, `problemCard`), facet groups, one deterministic request URL | API §25, P4-1 | the page renders API answers only; the old builders were removed |
| `startup-adapter.test` | members' names and roles extracted as founders | no member field is read; contact data still stripped; member count kept | DEC-W6P-D03 | the last reader of external founders is gone; they are never shown |

## Unchanged and still holding
`pdf-alpha-decisions` (its venture is a PROJECT: never listed), `alpha-interaction-gaps` homepage search (→ `/library?q=`, same result as the page's own search), `p0-landing`, `wf03-s09-public-organization`, `release-rc-responsive`: no expectation changed.

## Related
- [WF06-PROD-04_library-behaviour.md](WF06-PROD-04_library-behaviour.md) · [WF06-PROD-03_prod04-handoff.md](WF06-PROD-03_prod04-handoff.md)
