# Source inventory

`1hub.network - Tổng hợp thông tin sprint 1.xlsx` · sha256 `d228690fed5c02114025ed248b1f9daee854ba54126c872fe1ebc01f04aad2f9` · read-only (the original is never written).

| Sheet | Dimensions | Rows | Non-empty | Merged ranges | Formulas | Hyperlinks | Images | Entity | Flagged cells |
|---|---|---|---|---|---|---|---|---|---|
| Tổng hợp | A1:J15 | 15 | 15 | 14 | — | 12 | 0 | content plan (domains, targets, owners, external source links) | A2, A3, E5 |
| Sản phẩm chi tiết | A1:AC3 | 3 | 3 | 18 | — | 1 | 0 | 1 detailed product profile (2 header rows, merged) | K3 |
| Thư viện sản phẩm | A1:F391 | 391 | 184 | 0 | B32, B81 | 166 | 0 | product / startup list (A name, B pitch deck, C logo, D description, E sector, F stage) | B7, B8, B33, B35, B36, B71, B72, B82, B84, B85, B87, B88 |

Flagged = contains 'giả định', 'mô phỏng', 'chưa xác nhận', TBD, placeholder, sample, demo, test, or a bare 'Link' / 'LINK'.

## Product library columns

Rows with data 183 · unique names 132 · duplicate groups 51 · logo column filled 0 (no embedded images) · pitch-deck column is provenance only (header: 'không public lên website').

## Excel type / format anomalies

| SHEET | ROW | COLUMN | RAW_VALUE | DISPLAYED_VALUE | EXPECTED_TYPE | RECOMMENDED_ACTION |
|---|---|---|---|---|---|---|
| Thư viện sản phẩm | 32 | B | =HYPERLINK("<pitch URL: internal trace>","Link") | Link | URL | keep as provenance only; the formula hides the URL behind 'Link' |
| Thư viện sản phẩm | 81 | B | =HYPERLINK("<pitch URL: internal trace>","Link") | Link | URL | keep as provenance only; the formula hides the URL behind 'Link' |
| Sản phẩm chi tiết | 3 | E | 2026-03-01T00:00:00 | 03/2026 | year (Năm thành lập) | Thảo confirms the founding year; do not publish the month as a year |
| Sản phẩm chi tiết | 3 | V | % các vị trí | % các vị trí | team composition metric | placeholder text in a metric field; Thảo supplies the value or the field is omitted |
| Tổng hợp | 5 | E | Link → null!A1 (merged E5:E15) | Link | URL of the UI illustration | broken internal hyperlink over a merged range; Thảo re-links or drops it |

No scientific notation, percentage-as-number or error value found.

## Related

- [validation report](10-validation-report.md) · [manifest](content-pack-manifest.json)
