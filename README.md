# Aporia

Trang công khai cho trader vàng, dầu và forex, giao diện tiếng Việt theo giờ Việt Nam:

- **Lịch tin** (`index.html`): lịch kinh tế tuần kiểu Forex Factory, lọc theo mức độ, tiền tệ, tin vàng, tin dầu; bấm vào tin để xem giải thích; xem lại các tuần trước; cột Thực tế cho các tin chính; tab kết quả trực tiếp.
- **Thị trường** (`thi-truong.html`): giá trực tiếp, biểu đồ có EMA34/89, bảng giá, tin đỏ sắp tới.
- **Giờ giao dịch** (`gio-giao-dich.html`): bản đồ phiên và khung nên, không nên vào lệnh cho từng mã, tự đổi theo giờ mùa hè/đông.
- **Tin tức** (`tin-tuc.html`): tin forex, vàng, dầu và nguồn tin gốc.

## Dữ liệu

- Lịch tin: `scripts/update_calendar.py` tải lịch tuần của Forex Factory khoảng 5 phút một lần và nạp lại cả tuần lúc 6:00 sáng thứ Hai giờ Việt Nam (GitHub Actions, file `.github/workflows/cap-nhat-lich.yml`), lưu vào `data/`. Trang tự tải lại lịch mỗi phút.
- Số liệu thực tế: dữ liệu công khai của Forex Factory không có số Actual, nên `scripts/update_actuals.py` (workflow "Số liệu thực tế", file `.github/workflows/ket-qua-tin.yml`) lấy số của các tin chính thẳng từ nơi công bố: lãi suất Fed, ECB, BoE, RBA; CPI, NFP, tỷ lệ thất nghiệp, lương giờ của Mỹ (BLS); CPI Anh (ONS). Số lưu vào `data/actuals.json` và hiện ở cột Thực tế (xanh: tốt hơn dự báo cho đồng tiền đó, đỏ: kém hơn, vàng: bằng dự báo). Số của các tin khác xem ở tab "Kết quả trực tiếp" (TradingView).
- Giá, biểu đồ, tin tức: widget miễn phí của TradingView, tải trực tiếp trên trình duyệt người xem.

Không cần máy chủ, cơ sở dữ liệu hay API key. Hướng dẫn đưa lên mạng: xem `HUONG-DAN.md`.

Thông tin chỉ để tham khảo, không phải khuyến nghị đầu tư.
