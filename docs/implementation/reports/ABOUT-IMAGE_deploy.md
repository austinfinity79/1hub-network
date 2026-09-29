# ABOUT-IMAGE Deploy

**ABOUT IMAGE HOTFIX + DEPLOY: DEPLOYED GREEN.** `ec33ee2` runs on https://1hubnetwork.io.vn. Mission 03 "Xây dựng nền tảng dữ liệu đổi mới sáng tạo Việt Nam" on `/about` shows the supplied Vietnam digital network picture instead of the "ẢNH · NỀN TẢNG DỮ LIỆU" placeholder.

## Asset
| Item | Value |
|---|---|
| Source | `anh-03 .png` (PO, 29/09), PNG 1672 × 941, 1 619 873 bytes |
| Deployed | `public/about/about-data-platform-vietnam.webp`, 1600 × 900 (ratio kept), 160 316 bytes; `cwebp -q 88 -sharp_yuv` (38.3 dB, no banding in the red gradients) |
| Binding | `about-data.ts` mission 03 `photo` (was `null`); alt "Bản đồ Việt Nam kết nối trong mạng lưới dữ liệu số"; crop focus `center 30%` |

## Frame and crop
| Width | Frame | Map in the crop |
|---|---|---|
| 1440 | 520 × 222 | whole |
| 1024 | 380 × 222 | whole |
| 768 | 720 × 180 (4 : 1) | north and centre; the southern tip is cut by the frame ratio |
| 390 | 342 × 180 | whole |

Frame, radius, reveal, row heights (283 / 381) and the other sections unchanged; `object-fit: cover`, no caption, no overlay.

## Gates
| Gate | Result |
|---|---|
| format, lint, typecheck, production build | PASS |
| `/about` at 1440 / 1024 / 768 / 390 (local and domain) | 200; picture loaded and filling the frame; caption 0; broken images 0; overflow 0; #418 0; console 0 |

## Release
| Item | Value |
|---|---|
| Deployed SHA | `ec33ee258acb1d5d832c211d6efb1732e6cde8c4` |
| Previous / rollback SHA | `2c6cc4ac4f42df252d81afc467ec541c622a07af` (`rollback.sh`) |
| DB | untouched: no migration, no seed; backup `onehub-20260929T110300Z.dump` taken by procedure |
| Domain | asset 200 `image/webp` (160 316 B; `/_next/image` w=1080 43 096 B); CLS 0 at every width; Nginx 5xx 0 (404 only `/health`); app log errors 0 |

## Related
- [LIBRARY-DATA_deploy.md](LIBRARY-DATA_deploy.md) — previous release
