# J8 Privacy Security

Journey 8 — privacy and security as a tester can see them. Two windows: your account (A) and a second account (B, e.g. `pending@example.test` or another tester).

### J8-01 · Private profile is not discoverable
| Field | Value |
|---|---|
| Persona · account | A (your account) + Guest |
| Start URL | `/me/privacy` |
| Preconditions | onboarding complete |
| Steps | 1. Set your profile visibility to the most private option, save. 2. As a guest, open `/`, `/library`, `/organizations/chapter-01` and search your name in the Library |
| Expected UI | your name appears nowhere public |
| Expected route | public pages stay |
| Expected data / state | visibility saved (reload `/me/privacy`) |
| Permission | public pages never list people |
| Negative | even a public-visibility member is only counted, never named, on organisation pages |
| Reset | set visibility back |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

### J8-02 · DRAFT venture is not public
| Field | Value |
|---|---|
| Persona · account | A (owner of a DRAFT venture from J3 / J6) + B + Guest |
| Start URL | `/projects/<A's venture id>/edit` |
| Preconditions | a DRAFT venture |
| Steps | 1. B opens the URL. 2. Guest opens it. 3. Search the venture name in `/library` |
| Expected UI | B: not-found page; guest: `/auth`; Library: not listed |
| Expected route | not-found / `/auth` |
| Expected data / state | nothing changes |
| Permission | owner and team only |
| Negative | a PUBLIC venture has no public page yet either (expected) |
| Reset | none |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

### J8-03 · Contact data not leaked
| Field | Value |
|---|---|
| Persona · account | Guest, then B |
| Start URL | `/organizations/chapter-01`, `/library`, `/` |
| Preconditions | none |
| Steps | look for e-mail addresses, phone numbers or internal ids on the pages |
| Expected UI | none shown (only public contact addresses of organisations, if any) |
| Expected route | stays |
| Expected data / state | none |
| Permission | contact data follows the member's consent; public pages hold none |
| Negative | view-source / network tab is optional; report anything personal |
| Reset | none |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

### J8-04 · Outsider mutation and IDOR blocked
| Field | Value |
|---|---|
| Persona · account | B |
| Start URL | A's venture edit / team URLs, A's application form URL |
| Preconditions | A shared the URLs with B |
| Steps | 1. B opens each URL. 2. B replaces the id with a random one |
| Expected UI | the same not-found page in every case; nothing about A's records shows |
| Expected route | not-found |
| Expected data / state | A's records unchanged |
| Permission | owner / team only; applications owner only |
| Negative | as above |
| Reset | none |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

### J8-05 · Role spoof blocked
| Field | Value |
|---|---|
| Persona · account | B (a member who declared a leadership role in onboarding) |
| Start URL | `/ops/network`, `/ops/org/10000000-0000-0000-0000-000000000101`, `/demo/programmes` |
| Preconditions | not a leader or admin |
| Steps | open each; add `?role=PLATFORM_ADMIN` to the URL and retry |
| Expected UI | not-found every time |
| Expected route | not-found |
| Expected data / state | nothing |
| Permission | roles come only from the server's assignments |
| Negative | as above |
| Reset | none |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

## Related
- [j6-application.md](j6-application.md) · [j4-chapter-ops.md](j4-chapter-ops.md)
