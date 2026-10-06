# Demo route and CTA matrix

DEMO-QA-PREP-B. Demo-critical actions only, from [SCREEN_ROUTE_MAP](../SCREEN_ROUTE_MAP.md) §Navigation / §CTA and the BASE spec `demo-home-about-01`. Nothing is added that the SOT does not draw.

| Class | Meaning |
|---|---|
| EXPECTED_WORKING | a real route or approved external URL; must answer < 400 |
| READ_ONLY_APPROVED | visual-only by DEMO-D6 / OUT_OF_SCOPE_POST_DEMO: no link, no write, no fake success (guest may go to `/auth`) |
| POST_DEMO | target screen not in the demo; plain label, no link |
| AWAITING_A_IMPLEMENTATION | becomes EXPECTED_WORKING when DIR2 / SP1-FOUNDER land |
| BROKEN | none found on BASE `4c9e7b7` (static review + BASE spec) |

## Homepage `/` (DM01)
| Action | Target | Class |
|---|---|---|
| Logo | `/` | EXPECTED_WORKING |
| Giới thiệu ▾ → About · iHUB Ventures ↗ · VNV ↗ · 1Hub ↗ | `/about`, external | EXPECTED_WORKING (4 links) |
| Chương trình ▾ → Chương trình, cuộc thi · Sự kiện | `/programmes`, `/events` (reserved) | POST_DEMO (labels) |
| Sản phẩm (header, footer) | `/products` | AWAITING (label on BASE) |
| Nhân tài | `/talents` (reserved) | POST_DEMO (label) |
| Tin tức | none | POST_DEMO (label) |
| VI \| EN | none | READ_ONLY_APPROVED (inert) |
| Đăng nhập · Tạo tài khoản · "Tham gia cộng đồng HUB Network" | `/auth` | EXPECTED_WORKING |
| Hero search scope Tất cả | `/library?q=` | EXPECTED_WORKING |
| Hero search scope Sản phẩm | `/products?q=` (SOT) | AWAITING (BASE: `/library?q=`) |
| Hero search scopes Chương trình · Nhân tài | none | READ_ONLY_APPROVED (`data-scope-kind="INERT"`) |
| "Tổ chức chương trình", "Gọi vốn" | none | READ_ONLY_APPROVED (`aria-disabled`) |
| Product rows, "Xem tất cả sản phẩm" | `/products/[slug]`, `/products` | AWAITING (plain text on BASE) |
| Programme cards, updates, news, video pause, "Nhận bản tin" | none | READ_ONLY_APPROVED |

## Directory `/products` (DM08)
| Action | Target | Class |
|---|---|---|
| Search, sector / stage / location filters | in-page over demo data | AWAITING |
| Startup card, "Xem hồ sơ" | `/products/[slug]` | AWAITING |
| "Theo dõi" | guest → `/auth` | AWAITING (then READ_ONLY_APPROVED) |
| "Góp ý" | S1-UAT-02 popup | EXPECTED_WORKING (existing behaviour) |

## Startup `/products/[slug]` (DM10–DM12)
| Action | Target | Class |
|---|---|---|
| "← Sản phẩm" | `/products` | AWAITING |
| Tabs Tổng quan · Chỉ số · Cập nhật | `/products/[slug]`, `/metrics`, `/updates` | AWAITING (Chỉ số / Cập nhật: DEMO-SP-TABS-01, SHOULD) |
| Team member → founder (allow-listed) | `/talents/[profileId]` | AWAITING |
| Website ↗ | external | AWAITING |
| "Theo dõi", "Đề nghị kết nối", "Hồ sơ đầy đủ & dataroom", "Yêu cầu xem", "Xem vị trí tuyển dụng", quarter picker | guest → `/auth` or inert | READ_ONLY_APPROVED (once drawn) |

## Founder `/talents/[profileId]` (DM13)
| Action | Target | Class |
|---|---|---|
| Product rows | `/products/[slug]` | AWAITING |
| Back (browser) / header nav | previous page, shell routes | AWAITING (page) / EXPECTED_WORKING (shell) |
| "Đã xác thực danh tính qua 1Hub" | none (DEMO-D10 state) | AWAITING; never a link, never "đã xác minh" |
| "Kết nối", "Theo dõi", "Thông tin liên hệ", "Xem tất cả …" | inert or guest → `/auth` | READ_ONLY_APPROVED |
| "+ Tạo sản phẩm", privacy labels | hidden (DEMO-D13) | must be absent |

## About `/about` (DM02–DM05)
| Action | Target | Class |
|---|---|---|
| Map tabs Thế giới · Việt Nam, marker → HUB popup, Esc / close | in-page dialog | EXPECTED_WORKING |
| Popup "Xem chi tiết HUB Chapter" | `/organizations/[slug]` (200) | EXPECTED_WORKING |
| "Xem thêm" (catalogue list) | in-page | EXPECTED_WORKING |
| Humans tabs HUB Tổng · HUB Khu vực · Câu lạc bộ, "Xem tất cả câu lạc bộ" | in-page | EXPECTED_WORKING |
| Facebook | `https://www.facebook.com/1hubnetwork` | EXPECTED_WORKING |
| "Tham gia HUB Network" | `/auth` | EXPECTED_WORKING |
| "Kết nối hợp tác", "Tìm thành viên", "Xem thành viên …", "Xem lịch sự kiện", timeline drag, partner logos | none | READ_ONLY_APPROVED |
| Ecosystem rows iHUB Incubator, APEC | no URL supplied (C2) | READ_ONLY_APPROVED (no link) |
| Return: logo / Giới thiệu | `/`, `/about` | EXPECTED_WORKING |

## Related
- [DEMO_VERTICAL_FLOW_QA](DEMO_VERTICAL_FLOW_QA.md) · [OUT_OF_SCOPE_POST_DEMO](../OUT_OF_SCOPE_POST_DEMO.md)
