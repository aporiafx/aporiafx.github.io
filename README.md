# Aporia

Trang công khai cho trader vàng, dầu và forex, giao diện tiếng Việt theo giờ Việt Nam:

- **Lịch tin** (`index.html`): lịch kinh tế tuần kiểu Forex Factory, lọc theo mức độ, tiền tệ, tin vàng, tin dầu; bấm vào tin để xem giải thích; xem lại các tuần trước; tab kết quả trực tiếp.
- **Thị trường** (`thi-truong.html`): giá trực tiếp, biểu đồ có EMA34/89, bảng giá, tin đỏ sắp tới.
- **Giờ giao dịch** (`gio-giao-dich.html`): bản đồ phiên và khung nên, không nên vào lệnh cho từng mã, tự đổi theo giờ mùa hè/đông.
- **Tin tức** (`tin-tuc.html`): tin forex, vàng, dầu và nguồn tin gốc.

## Dữ liệu

- Lịch tin: `scripts/update_calendar.py` tải lịch tuần của Forex Factory mỗi giờ (GitHub Actions, file `.github/workflows/cap-nhat-lich.yml`) và lưu vào `data/`.
- Giá, biểu đồ, tin tức: widget miễn phí của TradingView, tải trực tiếp trên trình duyệt người xem.

Không cần máy chủ, cơ sở dữ liệu hay API key. Hướng dẫn đưa lên mạng: xem `HUONG-DAN.md`.

Thông tin chỉ để tham khảo, không phải khuyến nghị đầu tư.
