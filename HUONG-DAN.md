# Đưa Aporia lên mạng

Trang chạy trên **GitHub Pages**, miễn phí. Bạn chỉ cần một tài khoản GitHub và khoảng 15 phút, không cần cài phần mềm hay API key. Sau khi xong, lịch tin tự cập nhật khoảng 5 phút một lần, bạn không phải làm gì thêm.

## Bước 1. Tạo tài khoản GitHub

Vào [github.com](https://github.com) → **Sign up**. Tên đăng nhập (username) của bạn sẽ nằm trong địa chỉ web miễn phí: `https://<username>.github.io/aporia/`.

## Bước 2. Tạo kho chứa mã nguồn

1. Đăng nhập, bấm dấu **+** ở góc trên bên phải → **New repository**.
2. Ô **Repository name** gõ `aporia`. Chọn **Public**. Để nguyên các mục khác.
3. Bấm **Create repository**.

## Bước 3. Tải mã nguồn lên

1. Giải nén file `aporia-site.zip`.
2. Trên trang kho vừa tạo, bấm dòng chữ **uploading an existing file**.
3. Mở thư mục `aporia-site`, chọn **tất cả** file và thư mục bên trong (không chọn chính thư mục `aporia-site`), rồi kéo thả vào trang GitHub.
   - **Mac:** thư mục `.github` đang bị ẩn. Trong Finder nhấn **Cmd + Shift + .** (dấu chấm) để hiện nó, rồi mới chọn tất cả.
   - **Windows:** thư mục `.github` hiện bình thường.
4. Chờ tải xong, bấm **Commit changes**.
5. Kiểm tra danh sách file của kho phải có thư mục `.github`. Nếu không có, làm theo mục "Thiếu thư mục .github" ở cuối trang.

## Bước 4. Bật GitHub Pages

Trong kho: **Settings** → **Pages** (cột bên trái) → mục **Build and deployment** → **Source**: chọn **GitHub Actions**.

## Bước 5. Chạy lần đầu

1. Mở tab **Actions**. Nếu GitHub hỏi, bấm nút cho phép chạy (**I understand my workflows, go ahead and enable them**).
2. Bấm quy trình **Cập nhật lịch tin** → **Run workflow** → **Run workflow**.
3. Chờ 1–2 phút đến khi hiện dấu ✓ màu xanh.

Lần chạy tự động ngay sau Bước 3 có thể báo lỗi màu đỏ vì lúc đó GitHub Pages chưa được bật. Điều này bình thường: lần chạy ở Bước 5 sẽ thành công.

Trang của bạn đã chạy ở `https://<username>.github.io/aporia/`. Đường link này cũng hiện trong **Settings → Pages**. Bạn có thể gửi cho bất kỳ ai, mở được trên Chrome, Safari, cả điện thoại.

## Bước 6 (tuỳ chọn). Gắn tên miền riêng

1. **Chọn tên:** aporia.com đã có chủ. Hãy chọn tên khác, ví dụ `aporiafx.com`, `aporia-fx.com`, `aporia.trade`, `aporia.vn`, và kiểm tra tên còn trống tại nhà đăng ký.
2. **Mua tên miền:** tại Namecheap, Cloudflare Registrar, Porkbun… hoặc nhà đăng ký `.vn` như Mắt Bão, PA Vietnam, Nhân Hòa.
3. **Khai báo với GitHub:** Settings → Pages → **Custom domain** → nhập tên miền (ví dụ `www.aporiafx.com`) → **Save**.
4. **Trỏ tên miền về GitHub:** vào trang quản lý DNS của nơi bạn mua tên miền, thêm các bản ghi sau:

   | Loại | Tên (Host) | Giá trị |
   |---|---|---|
   | CNAME | `www` | `<username>.github.io` |
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |

5. Chờ vài phút đến 24 giờ để DNS cập nhật, rồi quay lại **Settings → Pages** và tích **Enforce HTTPS**.

## Cập nhật trang về sau

Khi có bản mới: vào kho → **Add file** → **Upload files** → kéo thả các file mới (ghi đè file cũ) → **Commit changes**. Trang tự đăng lại sau 1–2 phút.

## Khi gặp sự cố

- **Lịch báo "chưa được cập nhật cho tuần mới":** mở tab **Actions**, xem lần chạy gần nhất. Nếu có cảnh báo "không tải được lịch Forex Factory", nghĩa là Forex Factory đang tạm chặn; lần chạy sau (khoảng 5 phút) sẽ thử lại. Muốn chạy ngay thì bấm **Run workflow**.
- **Không thấy giá, biểu đồ, tin tức:** các phần này lấy từ TradingView. Trình chặn quảng cáo có thể chặn chúng; hãy tắt chặn cho trang của bạn.
- **Thiếu thư mục .github:** trong kho bấm **Add file** → **Create new file**. Ở ô tên file gõ `.github/workflows/cap-nhat-lich.yml`. Mở file cùng tên trong thư mục đã giải nén bằng Notepad (Windows) hoặc TextEdit (Mac), sao chép toàn bộ nội dung, dán vào GitHub, bấm **Commit changes**.
- **Lịch ngừng tự chạy:** GitHub tạm dừng lịch chạy của kho không có hoạt động trong 60 ngày. Trang tự lưu lịch mới vào kho mỗi tuần nên thường không bị dừng. Nếu bị, vào **Actions** → chọn quy trình → **Enable workflow**.

## Nguồn dữ liệu

- **Lịch tin:** dữ liệu lịch tuần công khai của [Forex Factory](https://www.forexfactory.com/calendar); trang luôn ghi rõ nguồn. Nếu trang có nhiều người dùng hoặc dùng cho mục đích thương mại, hãy đọc điều khoản sử dụng của Forex Factory.
- **Giá, biểu đồ, tin tức:** widget miễn phí của [TradingView](https://www.tradingview.com/widget/), được phép nhúng vào trang công khai khi giữ dòng ghi nguồn TradingView.
