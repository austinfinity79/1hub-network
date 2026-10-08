# S2-SMART-CAMPUS-DETAIL-ENRICH-01

Smart Campus detail: Đội ngũ completed from its verified source; Chỉ số and Cập nhật keep their honest empty states (no verified source).

## Source audit — "1hub.network - Tổng hợp thông tin sprint 1 (1).xlsx" (sha256 `4b023eaf…`), "Sản phẩm chi tiết" r3
| Cell | Content | Class | Destination |
|---|---|---|---|
| S3 | Nguyễn Quang Dũng - Tổng Giám đốc | VERIFIED (audit: team USE, guest-locked) | Đội ngũ, plain text (no profile in the system) |
| T3 | Nguyễn Duy Thanh - Giám đốc Công nghệ | VERIFIED | Đội ngũ, plain text (no profile) |
| U3 | Vũ Tuấn Anh - Giám đốc Marketing | VERIFIED | Đội ngũ, his NETWORK_ONLY profile (existing project member) |
| V3 | "% các vị trí" (header remnant) | MISSING (no value) | — |
| W3 / X3 / Y3 | MAU 3.000, 150 triệu VNĐ/quý, CSAT ≥80% | QUARANTINED / UNVERIFIED | Chỉ số stays empty |
| Z3 | Q3/2026 dated plan / log (15/07 – 30/09/2026) | HELD (audit "REVIEW before use"; not reviewed) | Cập nhật stays empty |

Nhân tài chi tiết D3 / AA3–AA4 confirm Dũng and Tuấn Anh as Smart Campus co-founders; no other person is mapped to the product.

## Change
| Item | Value |
|---|---|
| Defect | the team block only rendered people with a canonical profile (project member or owner), so the verified S3/T3 people could not show without creating fake profiles |
| Fix | `startup-overview.ts`: Smart Campus `team` = S3–U3 as written; `directory-data.ts`: a venture with a source team shows that list to the same viewers as the canonical team (signed-in members; a guest keeps the gate and receives no name) — a listed person with a visible profile is that member (link), one without a profile is plain text, one whose profile hides discovery is left out |
| Not changed | hero, problem, solution, vision, needs, website, stage "Thử nghiệm", region; no DB row, no profile created |
| Tests | `product-detail-smart-campus` (+ team guest/member, metrics/updates empty), `thao-06-startup-profile`, `demo-sp1-founder-01`: 39 / 39 |

To fill Chỉ số / Cập nhật later: verified metric values from the owner, and a PO review of the Z3 log (then data-only through the existing metrics / updates records).

## Related
- [PRODUCT-DETAIL-SMART-CAMPUS-01](PRODUCT-DETAIL-SMART-CAMPUS-01.md) · [TALENT-TUAN-ANH-MEMBER-ACCOUNT-01](TALENT-TUAN-ANH-MEMBER-ACCOUNT-01.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
