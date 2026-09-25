# SCREEN MAP — WF01–WF03 FINAL v1.0

This file maps approved Business Workflow Screen IDs to Thảo design sources and stable pixel references.

## WF01

| Screen ID | Design source | Final reference mode |
|---|---|---|
| WF01-S01 | AUTH1 · Đăng nhập & đăng ký | strict |
| WF01-S02 | AUTH2 · Kiểm tra hộp thư | strict |
| WF01-S03 | AUTH3 · Kết quả bấm link | state-board |
| WF01-S04 | AUTH4 · Lỗi & chặn | state-board |
| WF01-S05 | ONB1 · Bạn đến HUB để làm gì | strict |
| WF01-S06 | ONB2 · Thông tin cơ bản | strict |
| WF01-S07 | ONB3 · Quyền riêng tư & hiển thị | strict |
| WF01-S08 | ONB4 · Xong — làm gì tiếp | strict |

## WF02

| Screen ID | Design source | Final reference mode |
|---|---|---|
| WF02-S01 | ME0 · Tài khoản của tôi | strict |
| WF02-S02 | PRO2 · Sửa hồ sơ nhà sáng lập | strict |
| WF02-S03 | ME2 · Quyền riêng tư & hiển thị | long-page |
| WF02-S04 | ME6 · Vai trò & liên kết | long-page |
| WF02-S05 | PRO1 · Sửa hồ sơ startup | strict — also serves blank create state pattern |
| WF02-S06 | PRO3 · Thành viên đội | strict |
| WF02-S07 | ME4 · Cài đặt tài khoản | long-page |

## WF03

| Screen ID | Design source | Final reference mode |
|---|---|---|
| WF03-S01 | ADM8 · Chapter & thành viên | strict |
| WF03-S02 | ORG1 · Bảng điều khiển đơn vị | strict |
| WF03-S03 | ADM17 · Danh sách tài khoản | long-page |
| WF03-S04 | ADM18 · Chi tiết tài khoản | long-page |
| WF03-S05 | ADM5 · Challenge | strict |
| WF03-S06 | ORGP2 · Quản lý hồ sơ tổ chức | long-page |
| WF03-S07 | Chapter Summit — admin crop | derived-crop |
| WF03-S08 | ADM21 · Quản lý quan hệ tổ chức | long-page |
| WF03-S09 | Hồ sơ Chapter — public page crop | derived-crop |

## Notes

- Source files are preserved under `design-reference/source-thao/`.
- Normalized above-fold references are under `design-reference/final/`.
- `manifest.yaml` is the canonical machine-readable mapping used by visual tests.
- Font family is overridden by `DESIGN_TOKENS_v1.0.css`; do not infer typography from old raster glyphs.
