# J7 Library

Journey 7 — the public Library (`/library`): tabs Bài toán, Startup, Nhà sáng lập. Guest or member; nothing is created.

### J7-01 · Data loads in every tab
| Field | Value |
|---|---|
| Persona · account | Guest (repeat once signed in) |
| Start URL | `/library` |
| Preconditions | none |
| Steps | 1. Open the page. 2. Switch Bài toán → Startup → Nhà sáng lập |
| Expected UI | each tab shows cards and a result count; the problem tab holds the supplied problem dataset |
| Expected route | stays on `/library` |
| Expected data / state | read only |
| Permission | public |
| Negative | no tab shows a source / provider label ("Dữ liệu minh hoạ", a source domain) |
| Reset | none |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

### J7-02 · Search and quick filters
| Field | Value |
|---|---|
| Persona · account | Guest |
| Start URL | `/library` |
| Preconditions | none |
| Steps | 1. Type a keyword in "Từ khoá"; change "Tìm trong". 2. Use a chip in "Tìm nhanh theo lĩnh vực". 3. Clear |
| Expected UI | the list and count update; a no-match search shows the empty state; clearing restores the list |
| Expected route | stays |
| Expected data / state | none |
| Permission | public |
| Negative | a nonsense keyword → "Không có … nào khớp bộ lọc." (not an error) |
| Reset | clear the search |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

### J7-03 · Filters and sort
| Field | Value |
|---|---|
| Persona · account | Guest |
| Start URL | `/library`, each tab |
| Preconditions | none |
| Steps | 1. Tick filters in "Bộ lọc" (several groups). 2. Change the sort. 3. "Xem thêm" |
| Expected UI | only matching cards; counts per filter value come from the records; sort reorders; "Xem thêm" loads the rest |
| Expected route | stays |
| Expected data / state | none |
| Permission | public |
| Negative | filters only offer values the records hold (no empty invented options); startup stages use the Alpha list (Ý tưởng, MVP, Pilot / Thử nghiệm, Đang bán, Tăng trưởng) |
| Reset | untick |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

### J7-04 · Cards and links
| Field | Value |
|---|---|
| Persona · account | Guest |
| Start URL | `/library` |
| Preconditions | none |
| Steps | 1. Read a few cards per tab. 2. Use a card's link when it has one |
| Expected UI | missing fields are left out, never filled with made-up values; a card links out to the record's own site in a new tab at most |
| Expected route | stays (external links open a new tab) |
| Expected data / state | none |
| Permission | public |
| Negative | founder actions on external records are disabled by design; there is no internal startup or founder detail page (FUTURE) |
| Reset | none |
| Result | ☐ PASS ☐ FAIL |
| Notes | Known limitation: Startup / Nhà sáng lập come from the startup directory source, not from member ventures |

## Related
- [j8-privacy-security.md](j8-privacy-security.md) · [../INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md](../INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md)
