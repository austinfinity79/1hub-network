<!--
ARCHIVE — DO NOT EDIT BELOW THE MARKER.
Source: ~/Downloads/1hubnetwork_demo_test_script_7.10.26.md (Thảo, 07/10/2026; 11 580 bytes)
sha256 of the source file: 1919884860a8bfa8359d02585dd2986886d414bb0d22f9c055d9e723c274d80a
Everything after the marker line is byte-identical to the source file. Verify:
  sed '1,/^<!-- ORIGINAL-BEGIN -->$/d' RUNBOOK_ORIGINAL.md | shasum -a 256
Archived by FINAL-ACCEPTANCE-SOT-01. Proposed acceptance v2: RUNBOOK_SOT.md.
-->
<!-- ORIGINAL-BEGIN -->
# Kịch bản Test 1hub.network (07/10/2026)

**Thời lượng demo:** 6–8 phút  
**Mục tiêu:** Cho thấy 1hub.network không chỉ là một website giới thiệu, mà là nền tảng quy tụ chương trình, sự kiện, sản phẩm/giải pháp và nhân tài trên cùng một hạ tầng dữ liệu có thể tiếp tục mở rộng.

---

## A. Chuẩn bị trước khi test

### Dữ liệu demo cần được pin sẵn

- Thư viện Chương trình/cuộc thi, sự kiện, sản phẩm, nhân tài hiện danh sách nhiều, có thể filter.
- 01 Sản phẩm có profile hoàn chỉnh.
- 01 Founder liên kết với sản phẩm đó, có profile public hoàn chỉnh.
- Founder demo đã hoàn tất xác thực định danh CCCD; trạng thái xác thực được hiển thị công khai bằng ký hiệu nổi bật trên hồ sơ.
- 01 trang Giới thiệu HUB có sẵn thông tin và đường link trỏ ra các website khác tương ứng:
  - APEC Innovation Challenge.
  - iHUB Ventures.
  - Vietnam’s National Ventures.
- Không sử dụng dữ liệu nháp, card trống, ảnh placeholder, text Lorem Ipsum hoặc link chưa hoàn thiện.

### Thiết lập demo

- Mở website ở cửa sổ ẩn danh, chưa đăng nhập.
- Dùng màn hình desktop 16:9.
- Tắt notification, extension và các tab không liên quan.
- Chuẩn bị sẵn tab dự phòng cho:
  - APEC Innovation Challenge.
  - iHUB Ventures.
  - Vietnam’s National Ventures.
- Hero video tự chạy ở chế độ **không có âm thanh**; có poster/fallback khi mạng yếu.

---

## B. Kịch bản demo và checklist test

| Bước | Thao tác demo | Lời dẫn pitching | Kết quả kỹ thuật bắt buộc |
|---:|---|---|---|
| 1 | Mở trang Home khi chưa đăng nhập | “Đây là điểm vào chung để các đơn vị tổ chức, startup, dự án và nhân tài cùng khám phá cơ hội trong hệ sinh thái.” | Root domain mở public; không yêu cầu login; không lỗi layout, video hoặc font. |
| 2 | Để Hero video chạy khoảng 5–8 giây | “Nền tảng bắt đầu từ hai phía: đơn vị có nhu cầu hoặc muốn tổ chức chương trình; và những đội ngũ có sản phẩm, giải pháp hoặc năng lực.” | Video autoplay muted; không che CTA; có poster/fallback; tải mượt, không ảnh hưởng thao tác navbar. |
| 3 | Lướt nhanh Hero CTA và Global Search | “Người dùng có thể bắt đầu từ một nhu cầu, một chương trình, một sản phẩm hoặc một nhân tài; toàn bộ dữ liệu được kết nối để sử dụng lại.” | Thanh search hiển thị; CTA hiển thị đúng; bấm CTA cần login phải có route/return URL đúng. |
| 4 | Bấm menu **Chương trình** | “Đây là nơi quy tụ các chương trình, cuộc thi khởi nghiệp và hoạt động đổi mới sáng tạo.” | Route Chương trình hoạt động; trạng thái active trên navbar đúng; directory có dữ liệu. |
| 5 | Giới thiệu nhanh bộ lọc Chương trình | “Đơn vị tổ chức và người tham gia có thể tìm theo lĩnh vực, trạng thái, phạm vi triển khai và thời gian.” | Filter mở/đóng ổn định; chọn filter cập nhật card; reset filter hoạt động; không reload trắng trang. |
| 6 | Bấm menu **Sự kiện** | “Lớp sự kiện giúp các hoạt động trong mạng lưới được tìm thấy và tiếp cận rộng hơn, thay vì phân tán trên nhiều kênh.” | Route Sự kiện hoạt động; hiển thị list/calendar đúng thiết kế. |
| 7 | Giới thiệu nhanh bộ lọc Sự kiện | “Người dùng có thể lọc theo thời gian, địa điểm, trạng thái và chủ đề để tìm hoạt động phù hợp.” | Filter trả kết quả đúng; card có thông tin tối thiểu: thời gian, địa điểm, trạng thái và CTA. |
| 8 | Bấm menu **Sản phẩm** | “Đây là lớp dữ liệu về các sản phẩm, giải pháp và dự án đang được phát triển trong hệ sinh thái.” | Route Sản phẩm hoạt động; danh sách không trống; card hiển thị thống nhất. |
| 9 | Giới thiệu nhanh bộ lọc Sản phẩm | “Các giải pháp có thể được khám phá theo lĩnh vực, giai đoạn phát triển và khu vực.” | Search/filter hoạt động; khi không có kết quả có empty state rõ; xóa filter quay lại đầy đủ dữ liệu. |
| 10 | Bấm menu **Nhân tài** | “Song song với sản phẩm, nền tảng cũng quy tụ các cá nhân có năng lực để hình thành đội ngũ và nguồn lực cho hệ sinh thái.” | Route Nhân tài hoạt động; talent card có tên, headline/chuyên môn, kỹ năng và địa điểm. |
| 11 | Giới thiệu nhanh bộ lọc Nhân tài | “Có thể khám phá nhân tài theo chuyên môn, kỹ năng và địa điểm.” | Filter hoạt động; không lộ dữ liệu riêng tư; không cần mở Talent Detail ở bước demo này. |
| 12 | Quay lại màn **Sản phẩm** | “Để thấy dữ liệu không đứng riêng lẻ, tôi quay lại một sản phẩm cụ thể.” | Back hoặc navbar giữ hoạt động ổn định; không lỗi route/cache. |
| 13 | Bấm vào profile sản phẩm đã được pin sẵn | “Mỗi sản phẩm có một profile riêng: mô tả giải pháp, lĩnh vực, giai đoạn phát triển và đội ngũ liên quan.” | Product Detail tải đúng slug; các section có dữ liệu; không có broken image/link. |
| 14 | Kéo đến phần **Đội ngũ** | “Phần đội ngũ giúp nhìn thấy những người đang trực tiếp phát triển giải pháp, thay vì chỉ nhìn một card dự án độc lập.” | Founder/team card hiển thị đúng người và vai trò; card có thể bấm. |
| 15 | Bấm vào 01 Founder | “Từ sản phẩm, lãnh đạo có thể đi sâu đến hồ sơ của người sáng lập: năng lực, kinh nghiệm, vai trò trong hệ sinh thái và trạng thái định danh đã được xác thực.” | Founder Profile mở đúng route; liên kết ngược lại sản phẩm đúng; chỉ hiển thị dữ liệu public; có ký hiệu xác thực CCCD nổi bật, dễ nhận biết. |
| 16 | Bấm menu **Giới thiệu** | “Lớp giới thiệu cho thấy nền tảng được đặt trong một mạng lưới lớn hơn: cộng đồng HUB, các chương trình và những cấu phần hỗ trợ phát triển.” | Route Giới thiệu hoạt động; nội dung/CTA không bị vỡ ở desktop. |
| 17 | Bấm **APEC Innovation Challenge** | “Với các chương trình quy mô lớn, 1hub.network có thể là điểm kết nối hệ sinh thái và dẫn sang trải nghiệm chuyên biệt của từng challenge.” | Mở đúng URL APEC ở tab mới; tab 1hub vẫn giữ nguyên; không lỗi chứng chỉ, redirect hoặc trang trắng. |
| 18 | Quay lại tab 1hub.network, vẫn ở màn Giới thiệu | “Từ hệ sinh thái, nền tảng cũng kết nối với các cấu phần hỗ trợ startup đi sâu hơn.” | Quay lại đúng tab/trang; không mất trạng thái hoặc reload lỗi. |
| 19 | Bấm deck **iHUB Ventures** | “Đây là hướng kết nối các startup tiềm năng với nguồn lực đầu tư và hỗ trợ tăng trưởng.” | Mở đúng link deck iHUB Ventures ở tab mới; bản deck hiển thị được trên desktop. |
| 20 | Quay lại, bấm deck **Vietnam’s National Ventures** | “Đây là một cấu phần khác của hệ sinh thái vốn và đầu tư, kết nối với hành trình phát triển dài hạn của startup.” | Mở đúng link deck Vietnam’s National Ventures ở tab mới; không lỗi quyền truy cập hoặc trang không tồn tại. |
| 21 | Kết thúc tại trang Giới thiệu hoặc quay về Home | “Mục tiêu của 1hub.network là để các chương trình, giải pháp, nhân tài và nguồn lực không còn hoạt động rời rạc; từ đó tạo thành một hệ sinh thái có dữ liệu, có khả năng kết nối và phát triển liên tục.” | Không có link lỗi, route lỗi hoặc dữ liệu demo không nhất quán trong toàn bộ hành trình. |

---

## C. Link ngoài cần test trước buổi pitch

| Hạng mục | Link cần cấu hình / kiểm tra | Yêu cầu |
|---|---|---|
| APEC Innovation Challenge | URL demo APEC do team chốt | Mở tab mới; đi đến Home của challenge; không yêu cầu quyền nội bộ. |
| iHUB Ventures | https://deck.ihub.ventures/ | Mở tab mới; hiển thị deck đúng. |
| Vietnam’s National Ventures | https://vnv.ihub.ventures/ | Mở tab mới; hiển thị deck đúng. |

**Quy tắc kỹ thuật cho tất cả external link:**

- Mở tab mới.
- Không làm mất trang 1hub.network đang demo.
- Có fallback nếu URL lỗi hoặc không truy cập được.
- Trước buổi pitch phải test trên đúng mạng, đúng máy và đúng trình duyệt sẽ trình chiếu.

---

## D. Checklist pass/fail trước QAQC

### Bắt buộc PASS

- [ ] Home public, không login vẫn xem được toàn bộ nội dung demo.
- [ ] Hero video chạy ổn định, muted, không che CTA và có fallback.
- [ ] Navbar điều hướng đúng tới: Chương trình, Sự kiện, Sản phẩm, Nhân tài, Giới thiệu.
- [ ] Tất cả route không có lỗi 404, blank page hoặc loading vô hạn.
- [ ] Mỗi directory có dữ liệu demo đủ tốt để giới thiệu.
- [ ] Search/filter ở Chương trình, Sự kiện, Sản phẩm, Nhân tài đều hoạt động.
- [ ] Product Detail mở được từ card sản phẩm.
- [ ] Team section của Product Detail hiển thị đúng founder demo.
- [ ] Founder Profile mở được từ team card.
- [ ] Founder Profile liên kết ngược đúng tới sản phẩm.
- [ ] Founder demo có ký hiệu xác thực CCCD nổi bật trên hồ sơ public; không hiển thị số CCCD, ảnh giấy tờ hoặc dữ liệu định danh nhạy cảm.
- [ ] APEC, iHUB Ventures và Vietnam’s National Ventures mở đúng link ngoài ở tab mới.
- [ ] Không có text placeholder, card rỗng, hình vỡ, URL dev/staging hoặc dữ liệu nhạy cảm.
- [ ] Logo dẫn về Home.
- [ ] Font, màu, spacing và responsive desktop ổn định ở độ phân giải trình chiếu.

### Cần xác nhận trước khi test

- [ ] Tên sản phẩm demo sẽ dùng trong pitch.
- [ ] Tên founder demo sẽ dùng trong pitch.
- [ ] Tên chương trình và sự kiện demo sẽ dùng trong pitch.
- [ ] URL APEC chính xác.
- [ ] Người chịu trách nhiệm cập nhật nội dung nếu phát hiện lỗi dữ liệu.
- [ ] Người điều khiển demo và người hỗ trợ kỹ thuật trực tiếp trong buổi pitch.
- [ ] Có video demo/screen recording 2–3 phút dự phòng nếu mạng hoặc link ngoài gặp sự cố.

---

## E. Lưu ý scope cần xác nhận với team

Kịch bản này yêu cầu **Founder Profile mở được từ phần Đội ngũ của Product Detail**. Nếu Talent/Founder Detail đang được deferred trong scope hiện tại, cần ưu tiên làm một phiên bản public tối thiểu cho đúng founder demo; nếu không, bỏ bước 15 khỏi pitch để tránh dẫn vào màn chưa hoàn thiện.
