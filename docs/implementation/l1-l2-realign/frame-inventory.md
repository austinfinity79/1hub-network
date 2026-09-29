# Frame Inventory

Every frame of the two boards of 28/09. Position is the frame's top-left corner on the board; all frames are 1440 px wide.

## L1 board
| Frame | Board x, y | Height | Screen | In this task |
|---|---|---|---|---|
| AUTH1 | 120, 120 | 900 | Đăng nhập | behaviour only (pixel-identical reference) |
| AUTH2 | 1920, 120 | 900 | Kiểm tra hòm thư | unchanged |
| AUTH3 | 1920, 1337 | 900 | Kết quả bấm link (state board) | unchanged |
| AUTH4 | 1920, 2703 | 900 | Lỗi & chặn (state board) | unchanged |
| ACC-05 | 3720, 114 | 999 | Hoàn thiện hồ sơ để bắt đầu (intro, four stages, AI block) | yes |
| ACC-06 | 5520, 120 | 1721 | Bước 1/4 Thông tin cơ bản, empty | yes |
| ACC-06 AI | 5520, 2074 | 1495 | Bước 1/4 with AI suggestions | state only if an AI provider exists |
| ACC-06 note | 5520, 3827 | 582 | "Bốn trạng thái của khối AI" | annotation, not a screen |
| ACC-07 | 7320, 120 | 1568 | Bước 2/4 Năng lực và lĩnh vực hoạt động | yes |
| ACC-08 | 9120, 120 | 1205 | Bước 3/4 Vai trò trong hệ sinh thái | yes |
| ACC-09 | 10920, 120 | 1371 | Bước 4/4 Rà soát và hoàn tất, marked "BẢN ĐỀ XUẤT — CHỜ SPEC ACC-09" | yes, as proposed |
| ACC-10 | 12720, 120 | 897 | Hồ sơ của bạn đã sẵn sàng | next actions only |
| FP1-OWN | 14520, 120 | 3762 | Hồ sơ của tôi (owner view) | yes, sections with a data source |

## L2 board
| Frame | Board x, y | Height | Screen | In this task |
|---|---|---|---|---|
| FP1 | 120, 120 | 3138 | Profile seen by another member | no: public and member-to-member exposure is HD-08 |
| PRJ1 | 120, 3420 | 1385 | Tạo dự án hoặc startup, bước 1/3 | behaviour: stage, creator role, type copy |
| ME0 | 1920, 120 | 1974 | Cài đặt | unchanged |
| PRJ2 | 1920, 3420 | 1084 | Ai cùng làm với bạn? bước 2/3 | behaviour: permission, link, e-mail |
| L12 dialog | 3720, 120 | 960 | Sửa kinh nghiệm | yes |
| PRJ3 | 3720, 3420 | 912 | Hồ sơ đã được tạo | behaviour: draft facts |
| ME7 | 5520, 122 | 993 | Dự án & startup của tôi, pending invitations | yes |
| Bridge note | 5520, 1260 | 402 | "Hai lối vào, một hồ sơ startup" | annotation |
| ORGP1 | 7320, 120 | 1013 | Organisation profile | no (WF03 / HD-08) |
| DIR1 | 9120, 120 | 2470 | Thư viện | no (done, DEC-L15) |
| EV2 | 10920, 145 | 1142 | Sự kiện list | no (HD-09) |
| NOTI1 | 12720, 120 | 670 | Trung tâm thông báo | no (no notification model) |
| EV1 | 14520, 154 | 999 | Event detail | no (HD-09) |

## Reference files
New frames are stored as lossless crops of the boards under `design-reference/final/revision/L1` and `L2` when their screen is implemented; the README there records board hash and crop rectangle. Existing references stay as they are.

## Related
- [overview.md](overview.md) · [l1-delta-matrix.md](l1-delta-matrix.md) · [l2-delta-matrix.md](l2-delta-matrix.md)
