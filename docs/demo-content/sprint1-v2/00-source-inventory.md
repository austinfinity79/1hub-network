# Source inventory

`1hub.network - Tổng hợp thông tin sprint 1 (1).xlsx` · sha256 `4b023eaf4499162170faf8379d1de01bff5453a6535d4d260b608332264c3bfc` · read-only (the original is never written).

| Sheet | Dimensions | Rows | Non-empty | Merged ranges | Formulas | Hyperlinks | Images | Entity | Flagged cells |
|---|---|---|---|---|---|---|---|---|---|
| Tổng hợp | A1:J15 | 15 | 15 | 14 | — | 12 | 0 | content plan (domains, targets, owners, external source links) | A2, A3, E5 |
| Sản phẩm chi tiết | A1:AC1003 | 1003 | 3 | 18 | — | 1 | 0 | 1 detailed product profile (2 header rows, merged) | K3 |
| Nhân tài chi tiết | A1:AC1004 | 1004 | 5 | 15 | — | 2 | 0 | ? | — |
| Thư viện sản phẩm | A1:F178 | 178 | 178 | 0 | — | 14 | 0 | product / startup list (A name, B pitch deck, C logo, D description, E sector, F stage) | — |
| Ảnh homepage | A1:K24 | 24 | 24 | 10 | — | 13 | 4 | ? | — |
| Thành viên HUB_Orgchart | A1:O45 | 45 | 45 | 21 | — | 40 | 0 | ? | — |
| Thư viện nhân tài | A1:L120 | 120 | 120 | 10 | — | 40 | 0 | ? | — |

Flagged = contains 'giả định', 'mô phỏng', 'chưa xác nhận', TBD, placeholder, sample, demo, test, or a bare 'Link' / 'LINK'.

## Product library columns

Rows with data 177 · unique names 126 · duplicate groups 51 · logo column filled 0 (no embedded images) · pitch-deck column is provenance only (header: 'không public lên website').

## Excel type / format anomalies

| SHEET | ROW | COLUMN | RAW_VALUE | DISPLAYED_VALUE | EXPECTED_TYPE | RECOMMENDED_ACTION |
|---|---|---|---|---|---|---|
| Sản phẩm chi tiết | 3 | E | 2026-03-01T00:00:00 | 03/2026 | year (Năm thành lập) | Thảo confirms the founding year; do not publish the month as a year |
| Sản phẩm chi tiết | 3 | V | % các vị trí | % các vị trí | team composition metric | placeholder text in a metric field; Thảo supplies the value or the field is omitted |
| Tổng hợp | 5 | E | Link → null!A1 (merged E5:E15) | Link | URL of the UI illustration | broken internal hyperlink over a merged range; Thảo re-links or drops it |

No scientific notation, percentage-as-number or error value found.

## Related

- [validation report](10-validation-report.md) · [manifest](content-pack-manifest.json)
