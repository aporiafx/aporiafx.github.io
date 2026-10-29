/* Aporia — economic calendar page, Forex Factory style: one row per release, grouped by day in Vietnam time,
   filters for impact / currency / gold & oil, a "now" marker, a Vietnamese explainer per event and past weeks. */
(() => {
  "use strict";
  const {M, H, DAY, ZONE, AFTER_TENT, $, esc, LS, pad, hm, vnStart, dayKey, dayLabel, ddmm, dur, ZNAME, tzAbbr, localHM, CCYS} = AP;
  /* Short countdown for narrow screens: 45p, 3g05, 1n8g. */
  const cdur = (ms) => { const m = Math.round(Math.abs(ms) / M); if (m < 60) return m + "p"; const h = Math.floor(m / 60), r = m % 60; if (h < 24) return h + "g" + (r ? pad(r) : ""); const d = Math.floor(h / 24), rh = h % 24; return d + "n" + (rh ? rh + "g" : ""); };

  /* ---------------------------------------------------------
     What each release measures, why it matters, usual effect ({C} = currency)
     --------------------------------------------------------- */
  const INFO = [
    {re: /^ADP/i, c: ["USD"], m: "Số việc làm mới ở khu vực tư nhân, theo dữ liệu trả lương của ADP. Bản tuần (Weekly) là trung bình 4 tuần gần nhất.", w: "Ra trước báo cáo việc làm chính thức nên hay được dùng để đoán NFP, dù hai số liệu nhiều khi lệch nhau.", e: "Thực tế > Dự báo: thường tốt cho USD."},
    {re: /non-?farm employment change/i, c: ["USD"], m: "Số việc làm mới ngoài khu vực nông nghiệp trong tháng trước (Bộ Lao động Mỹ).", w: "Tin quan trọng nhất về thị trường lao động Mỹ, tác động trực tiếp tới kỳ vọng lãi suất của Fed. Thường là tin biến động mạnh nhất tháng, ra thứ Sáu đầu tháng.", e: "Thực tế > Dự báo: thường tốt cho USD.", g: "Số liệu mạnh thường đẩy USD và lợi suất tăng, vàng giảm; số liệu yếu thì ngược lại."},
    {re: /average hourly earnings/i, c: ["USD"], m: "Mức tăng thu nhập bình quân mỗi giờ của người lao động Mỹ.", w: "Lương tăng nhanh tạo áp lực lạm phát, khiến Fed giữ lãi suất cao lâu hơn. Ra cùng NFP.", e: "Thực tế > Dự báo: thường tốt cho USD."},
    {re: /unemployment claims|jobless claims/i, c: ["USD"], m: "Số người nộp đơn xin trợ cấp thất nghiệp lần đầu trong tuần trước.", w: "Dữ liệu lao động ra mỗi thứ Năm, phản ánh sớm nhất làn sóng sa thải.", e: "Thực tế < Dự báo (ít đơn hơn): thường tốt cho USD.", g: "Số đơn tăng mạnh thường làm USD yếu đi và đỡ giá vàng."},
    {re: /jolts/i, c: ["USD"], m: "Số vị trí việc làm còn trống cuối tháng (khảo sát JOLTS).", w: "Cho biết nhu cầu tuyển dụng; số việc trống giảm là dấu hiệu thị trường lao động hạ nhiệt.", e: "Thực tế > Dự báo: thường tốt cho USD."},
    {re: /employment cost index/i, c: ["USD"], m: "Chi phí lao động theo quý, gồm lương và phúc lợi.", w: "Fed theo dõi sát vì phản ánh áp lực lạm phát từ tiền lương.", e: "Thực tế > Dự báo: thường tốt cho USD."},
    {re: /claimant count/i, m: "Thay đổi số người nhận trợ cấp thất nghiệp ở Anh.", w: "Ra cùng số liệu việc làm và tiền lương của Văn phòng Thống kê Anh (ONS).", e: "Thực tế < Dự báo: thường tốt cho GBP."},
    {re: /average earnings index/i, m: "Thu nhập bình quân ở Anh (trung bình 3 tháng, so với cùng kỳ).", w: "BoE theo dõi sát vì lương quyết định lạm phát khu vực dịch vụ.", e: "Thực tế > Dự báo: thường tốt cho GBP."},
    {re: /unemployment change/i, m: "Thay đổi số người thất nghiệp trong tháng.", w: "Phản ánh sức khoẻ thị trường lao động.", e: "Thực tế < Dự báo: thường tốt cho {C}."},
    {re: /unemployment rate/i, m: "Tỷ lệ người trong lực lượng lao động đang thất nghiệp và tìm việc.", w: "Thước đo chính về độ chặt của thị trường lao động; tỷ lệ tăng nhanh làm tăng kỳ vọng hạ lãi suất.", e: "Thực tế < Dự báo: thường tốt cho {C}."},
    {re: /^employment change/i, m: "Thay đổi số người có việc làm trong tháng.", w: "Dữ liệu việc làm quan trọng nhất trong tháng của {C}.", e: "Thực tế > Dự báo: thường tốt cho {C}."},
    {re: /trimmed mean cpi/i, m: "CPI lõi loại bỏ các mặt hàng tăng, giảm mạnh nhất (trimmed mean).", w: "Thước đo lạm phát cơ bản mà Ngân hàng Dự trữ Úc (RBA) theo dõi sát nhất.", e: "Thực tế > Dự báo: thường tốt cho AUD."},
    {re: /pce price index/i, m: "Chỉ số giá chi tiêu tiêu dùng cá nhân; bản lõi (Core) loại bỏ thực phẩm và năng lượng.", w: "Thước đo lạm phát Fed dùng cho mục tiêu 2%. Ra cùng thu nhập và chi tiêu cá nhân.", e: "Thực tế > Dự báo: thường tốt cho USD."},
    {re: /gdp price index/i, m: "Chỉ số giá trong GDP: thước đo lạm phát của toàn nền kinh tế.", w: "Ra cùng GDP, bổ sung cho bức tranh lạm phát.", e: "Thực tế > Dự báo: thường tốt cho {C}."},
    {re: /inflation expectations/i, m: "Mức lạm phát người tiêu dùng kỳ vọng trong 1 năm và 5 năm tới.", w: "Ngân hàng trung ương lo ngại kỳ vọng lạm phát cao sẽ tự đẩy giá tăng.", e: "Thực tế > Dự báo: thường tốt cho {C}."},
    {re: /\bppi\b/i, m: "Chỉ số giá sản xuất: thay đổi giá bán của nhà sản xuất.", w: "Chỉ báo sớm cho lạm phát tiêu dùng.", e: "Thực tế > Dự báo: thường tốt cho {C}."},
    {re: /\bcpi\b/i, m: "Mức thay đổi giá của giỏ hàng hoá và dịch vụ tiêu dùng. Bản lõi (Core) loại bỏ thực phẩm và năng lượng.", w: "Lạm phát quyết định hướng đi lãi suất của ngân hàng trung ương; bản lõi thường được chú ý hơn bản tổng.", e: "Thực tế > Dự báo: thường tốt cho {C}.", g: "CPI Mỹ cao hơn dự báo thường đẩy lợi suất và USD tăng, gây áp lực lên vàng."},
    {re: /import prices|export prices|shop price/i, m: "Thay đổi giá hàng nhập khẩu, xuất khẩu hoặc giá bán trong cửa hàng.", w: "Thông tin phụ về áp lực lạm phát; thường tác động nhỏ.", e: "Thực tế > Dự báo: thường tốt cho {C}."},
    {re: /\bgdp\b/i, m: "Tốc độ tăng trưởng tổng giá trị hàng hoá và dịch vụ của nền kinh tế.", w: "Thước đo rộng nhất về sức khoẻ kinh tế. Bản công bố đầu tiên (Advance, Flash, Prelim) gây biến động mạnh nhất, các bản điều chỉnh sau ít tác động hơn.", e: "Thực tế > Dự báo: thường tốt cho {C}."},
    {re: /retail sales|consumer spending/i, m: "Thay đổi doanh số bán lẻ hoặc chi tiêu của người tiêu dùng; bản lõi (Core) thường loại bỏ ô tô.", w: "Tiêu dùng là động lực lớn nhất của tăng trưởng.", e: "Thực tế > Dự báo: thường tốt cho {C}."},
    {re: /personal (income|spending)/i, m: "Thu nhập hoặc chi tiêu cá nhân của người dân Mỹ trong tháng.", w: "Ra cùng PCE; chi tiêu chiếm phần lớn GDP Mỹ.", e: "Thực tế > Dự báo: thường tốt cho USD."},
    {re: /\bism\b/i, c: ["USD"], m: "Khảo sát giám đốc mua hàng của Viện Quản lý Cung ứng (ISM). Trên 50 là mở rộng, dưới 50 là thu hẹp.", w: "Ra sớm đầu tháng, phản ánh nhanh xu hướng kinh tế; các chỉ số con về giá và việc làm cũng được chú ý.", e: "Thực tế > Dự báo: thường tốt cho USD."},
    {re: /empire state|philly fed|richmond manufacturing|chicago pmi/i, m: "Khảo sát hoạt động sản xuất tại một khu vực của Mỹ.", w: "Ra trước ISM nên được dùng để đoán xu hướng chung; tác động thường nhỏ.", e: "Thực tế > Dự báo: thường tốt cho USD."},
    {re: /\bpmi\b/i, m: "Khảo sát giám đốc mua hàng. Trên 50 là mở rộng, dưới 50 là thu hẹp.", w: "Bản sơ bộ (Flash) ra trước khi tháng kết thúc nên thường gây biến động hơn bản chính thức.", e: "Thực tế > Dự báo: thường tốt cho {C}."},
    {re: /durable goods/i, m: "Đơn đặt hàng hàng hoá lâu bền (dùng trên 3 năm); bản lõi loại bỏ phương tiện vận tải.", w: "Chỉ báo sớm cho đầu tư và sản xuất.", e: "Thực tế > Dự báo: thường tốt cho USD."},
    {re: /industrial production/i, m: "Sản lượng của ngành sản xuất, khai khoáng và tiện ích.", w: "Phản ánh sức khoẻ khu vực công nghiệp.", e: "Thực tế > Dự báo: thường tốt cho {C}."},
    {re: /consumer confidence|consumer sentiment|consumer climate/i, m: "Khảo sát niềm tin của người tiêu dùng về kinh tế và tài chính cá nhân.", w: "Niềm tin cao thường đi kèm chi tiêu mạnh.", e: "Thực tế > Dự báo: thường tốt cho {C}."},
    {re: /ifo business climate/i, m: "Khảo sát khoảng 9.000 doanh nghiệp Đức về tình hình và kỳ vọng kinh doanh.", w: "Chỉ báo sớm cho kinh tế Đức, nền kinh tế lớn nhất khối euro.", e: "Thực tế > Dự báo: thường tốt cho EUR."},
    {re: /zew/i, m: "Khảo sát nhà đầu tư và chuyên gia phân tích về triển vọng kinh tế Đức.", w: "Phản ánh kỳ vọng của giới tài chính, ra sớm trong tháng.", e: "Thực tế > Dự báo: thường tốt cho EUR."},
    {re: /trade balance/i, m: "Chênh lệch giá trị xuất khẩu và nhập khẩu.", w: "Ảnh hưởng tới cung cầu đồng tiền; thường tác động nhỏ.", e: "Thực tế > Dự báo: thường tốt cho {C}."},
    {re: /home sales|housing starts|building permits|\bhpi\b|mortgage|house price/i, m: "Dữ liệu thị trường nhà ở.", w: "Nhạy với lãi suất nên phản ánh sớm tác động của chính sách tiền tệ; thường tác động nhỏ.", e: "Thực tế > Dự báo: thường tốt cho {C}."},
    {re: /money supply|private loans|lending|private sector credit|wholesale inventories|^cbi |sppi|payrolls/i, m: "Số liệu tiền tệ, tín dụng hoặc kinh doanh bổ trợ.", w: "Thường ít tác động tới giá.", e: "Thực tế > Dự báo: thường tốt cho {C}."},
    {re: /federal funds rate/i, m: "Lãi suất mục tiêu do Ủy ban Thị trường Mở (FOMC) của Fed quyết định, khoảng 8 lần mỗi năm.", w: "Quyết định thường đã được thị trường định giá trước; điều gây biến động là tín hiệu về các lần điều chỉnh tiếp theo trong tuyên bố, dự báo và họp báo.", e: "Lãi suất hoặc giọng điệu cao hơn kỳ vọng (diều hâu): thường tốt cho USD.", g: "Fed diều hâu thường làm vàng giảm; Fed nới lỏng (bồ câu) thường đỡ giá vàng."},
    {re: /fomc statement/i, m: "Văn bản FOMC công bố cùng quyết định lãi suất.", w: "Thị trường so từng chữ với lần trước để tìm thay đổi trong định hướng chính sách.", e: "Giọng điệu diều hâu hơn dự kiến: thường tốt cho USD.", g: "Fed diều hâu thường làm vàng giảm; Fed nới lỏng (bồ câu) thường đỡ giá vàng."},
    {re: /fomc press conference/i, m: "Họp báo của Chủ tịch Fed sau quyết định lãi suất.", w: "Câu trả lời về lộ trình lãi suất có thể đảo chiều phản ứng ban đầu, nên giá hay giật hai chiều trong cả giờ họp báo.", e: "Giọng điệu diều hâu: thường tốt cho USD.", g: "Fed diều hâu thường làm vàng giảm; Fed nới lỏng (bồ câu) thường đỡ giá vàng."},
    {re: /fomc economic projections/i, m: "Dự báo kinh tế và biểu đồ chấm (dot plot) lãi suất của các thành viên FOMC, công bố 4 lần mỗi năm.", w: "Dot plot cho thấy số lần tăng, giảm lãi suất dự kiến, nhiều khi gây biến động mạnh hơn chính quyết định.", e: "Dot plot cao hơn kỳ vọng: thường tốt cho USD."},
    {re: /fomc meeting minutes/i, m: "Biên bản cuộc họp FOMC, công bố khoảng 3 tuần sau cuộc họp.", w: "Cho thấy mức độ đồng thuận và những lo ngại của các thành viên.", e: "Giọng điệu diều hâu: thường tốt cho USD."},
    {re: /main refinancing rate/i, m: "Lãi suất chính sách của Ngân hàng Trung ương châu Âu (ECB).", w: "Thị trường chú ý tuyên bố và họp báo của Chủ tịch ECB về lộ trình tiếp theo nhiều hơn chính quyết định.", e: "Lãi suất hoặc giọng điệu cao hơn kỳ vọng: thường tốt cho EUR."},
    {re: /ecb press conference/i, m: "Họp báo của Chủ tịch ECB sau quyết định lãi suất.", w: "Thường gây biến động mạnh hơn chính quyết định.", e: "Giọng điệu diều hâu: thường tốt cho EUR."},
    {re: /official bank rate votes/i, m: "Số phiếu tăng, giữ hoặc giảm lãi suất của 9 thành viên Ủy ban Chính sách Tiền tệ của BoE.", w: "Số phiếu lệch kỳ vọng thường làm GBP giật mạnh ngay khi công bố.", e: "Nhiều phiếu nghiêng về tăng lãi suất hơn dự kiến: thường tốt cho GBP."},
    {re: /official bank rate/i, m: "Lãi suất chính sách của Ngân hàng Trung ương Anh (BoE).", w: "Công bố 12:00 giờ London cùng tỷ lệ phiếu và tóm tắt chính sách.", e: "Lãi suất hoặc giọng điệu cao hơn kỳ vọng: thường tốt cho GBP."},
    {re: /monetary policy summary/i, m: "Tóm tắt lý do quyết định lãi suất của BoE.", w: "Giọng điệu về lạm phát và lộ trình lãi suất quyết định phản ứng của GBP.", e: "Giọng điệu diều hâu: thường tốt cho GBP."},
    {re: /boj policy rate/i, m: "Lãi suất chính sách của Ngân hàng Trung ương Nhật (BoJ).", w: "BoJ không công bố giờ cố định; quyết định thường ra khoảng 11:30–12:30 giờ Tokyo. Thị trường tìm tín hiệu về các lần tăng lãi suất tiếp theo.", e: "Lãi suất hoặc giọng điệu cao hơn kỳ vọng: thường tốt cho JPY (USDJPY giảm)."},
    {re: /boj outlook report/i, m: "Báo cáo triển vọng kinh tế và giá cả của BoJ, 4 lần mỗi năm, gồm dự báo lạm phát.", w: "Dự báo lạm phát cao hơn củng cố khả năng BoJ tăng lãi suất.", e: "Dự báo cao hơn kỳ vọng: thường tốt cho JPY."},
    {re: /boj press conference/i, m: "Họp báo của Thống đốc BoJ sau cuộc họp chính sách.", w: "Thường gây biến động mạnh vì thị trường tìm tín hiệu về lộ trình lãi suất.", e: "Giọng điệu diều hâu: thường tốt cho JPY."},
    {re: /cash rate/i, m: "Lãi suất chính sách của Ngân hàng Dự trữ Úc (RBA).", w: "Công bố 14:30 giờ Sydney; tuyên bố và họp báo của Thống đốc RBA cho tín hiệu về các lần điều chỉnh tiếp theo.", e: "Lãi suất hoặc giọng điệu cao hơn kỳ vọng: thường tốt cho AUD."},
    {re: /rba rate statement|rba press conference|rba monetary policy meeting minutes/i, m: "Tuyên bố, họp báo hoặc biên bản của RBA về chính sách tiền tệ.", w: "Giọng điệu về lạm phát và lãi suất quyết định phản ứng của AUD.", e: "Giọng điệu diều hâu: thường tốt cho AUD."},
    {re: /monetary policy statement/i, m: "Tuyên bố chính sách tiền tệ đi kèm quyết định lãi suất.", w: "Thị trường đọc kỹ để tìm thay đổi trong định hướng.", e: "Giọng điệu diều hâu: thường tốt cho {C}."},
    {re: /speaks|testifies|press conference/i, m: "Phát biểu hoặc trả lời báo chí của quan chức ngân hàng trung ương hoặc chính phủ.", w: "Thị trường tìm tín hiệu về lãi suất. Lời của người đứng đầu ngân hàng trung ương tác động mạnh hơn nhiều so với các thành viên khác.", e: "Giọng điệu diều hâu (nghiêng về thắt chặt): thường tốt cho {C}."},
    {re: /budget|forecast statement/i, m: "Chính phủ công bố ngân sách: thuế, chi tiêu và kế hoạch vay nợ. Ở Anh, Văn phòng Trách nhiệm Ngân sách (OBR) công bố dự báo kinh tế kèm theo.", w: "Ảnh hưởng tới lợi suất trái phiếu và kỳ vọng lãi suất; tỷ giá có thể biến động mạnh trong lúc phát biểu.", e: "Tác động hai chiều, tuỳ phản ứng của thị trường trái phiếu."},
    {re: /bond auction/i, m: "Đấu giá trái phiếu chính phủ; con số là lợi suất trung bình và tỷ lệ đặt mua so với lượng phát hành.", w: "Phản ánh nhu cầu với trái phiếu; thường tác động nhỏ.", e: "Ít tác động trực tiếp tới tỷ giá."},
    {re: /crude oil inventories/i, m: "Thay đổi tồn kho dầu thô Mỹ trong tuần (EIA), thứ Tư 10:30 giờ New York.", w: "Tin quan trọng nhất trong tuần với giá dầu.", e: "Tồn kho tăng nhiều hơn dự báo: thường xấu cho giá dầu."},
    {re: /api weekly/i, m: "Tồn kho dầu theo Viện Dầu khí Mỹ (API), thứ Ba 16:30 giờ New York.", w: "Ra trước EIA một ngày nên được dùng để đoán số liệu EIA.", e: "Tồn kho tăng: thường xấu cho giá dầu."},
    {re: /natural gas storage/i, m: "Thay đổi tồn kho khí tự nhiên Mỹ trong tuần (EIA).", w: "Chủ yếu tác động tới giá khí đốt, ít ảnh hưởng tới tỷ giá.", e: "Tồn kho tăng nhiều hơn dự báo: thường xấu cho giá khí."},
    {re: /holiday/i, m: "Ngày nghỉ lễ ngân hàng.", w: "Thanh khoản thấp, spread có thể giãn rộng, giá dễ giật bất thường.", e: "Nên giảm khối lượng hoặc đứng ngoài với các cặp tiền liên quan."}
  ];
  const FALLBACK = {
    high: {m: "Tin được Forex Factory xếp mức tác động cao.", w: "Có thể làm giá biến động mạnh và spread giãn rộng quanh giờ công bố.", e: "Thực tế tốt hơn dự báo: thường tốt cho {C}."},
    medium: {m: "Tin được Forex Factory xếp mức tác động vừa.", w: "Có thể gây biến động ngắn, nhất là khi lệch xa dự báo.", e: "Thực tế tốt hơn dự báo: thường tốt cho {C}."},
    low: {m: "Tin được Forex Factory xếp mức tác động thấp.", w: "Thường ít ảnh hưởng tới giá.", e: "Thực tế tốt hơn dự báo: thường tốt cho {C}."},
    holiday: {m: "Ngày nghỉ lễ.", w: "Thanh khoản thấp.", e: "Nên giảm khối lượng."}
  };
  const GOLD_GENERIC = "Số liệu Mỹ tốt hơn dự báo thường đẩy USD và lợi suất tăng, gây áp lực lên vàng; kém hơn thì ngược lại.";
  const LOCAL = {USD: "N", EUR: "F", GBP: "L", JPY: "T", AUD: "S"};
  const IMP_NAME = {high: "Tin đỏ (tác động cao)", medium: "Tin cam (tác động vừa)", low: "Tin vàng nhạt (tác động thấp)", holiday: "Nghỉ lễ"};
  function infoFor(e){
    for (const x of INFO) if ((!x.c || x.c.indexOf(e.ccy) >= 0) && x.re.test(e.title)) return x;
    return FALLBACK[e.impact] || FALLBACK.low;
  }
  const ib = (imp) => '<span class="ib ' + imp + '" title="' + (IMP_NAME[imp] || "") + '"><i></i><i></i><i></i></span>';

  /* ---------------------------------------------------------
     Filters (remembered in this browser)
     --------------------------------------------------------- */
  const IMPS = [["high", "Đỏ"], ["medium", "Cam"], ["low", "Thấp"], ["holiday", "Nghỉ lễ"]];
  const DEF = {imp: ["high", "medium", "holiday"], ccy: CCYS.slice(), grp: "ALL", up: false, scope: "week"};
  const readSet = (k, def, ok) => { const v = LS.get("cal." + k, null); if (v === null) return def.slice(); const a = v.split(",").filter((x) => ok.indexOf(x) >= 0); return a; };
  const F = {
    imp: readSet("imp", DEF.imp, IMPS.map((x) => x[0])),
    ccy: readSet("ccy", DEF.ccy, CCYS),
    grp: ["ALL", "XAU", "OIL"].indexOf(LS.get("cal.grp", "ALL")) >= 0 ? LS.get("cal.grp", "ALL") : "ALL",
    up: LS.get("cal.up", "0") === "1",
    scope: ["today", "tomorrow", "week"].indexOf(LS.get("cal.scope", "week")) >= 0 ? LS.get("cal.scope", "week") : "week",
    q: ""
  };
  function saveF(){ LS.set("cal.imp", F.imp.join(",")); LS.set("cal.ccy", F.ccy.join(",")); LS.set("cal.grp", F.grp); LS.set("cal.up", F.up ? "1" : "0"); LS.set("cal.scope", F.scope); }
  function renderFilters(){
    $("fImp").innerHTML = IMPS.map(([k, n]) => '<button type="button" class="chip" data-imp="' + k + '" aria-pressed="' + (F.imp.indexOf(k) >= 0) + '">' + ib(k) + n + "</button>").join("");
    $("fCcy").innerHTML = CCYS.map((c) => '<button type="button" class="chip" data-ccy="' + c + '" aria-pressed="' + (F.ccy.indexOf(c) >= 0) + '"' + (F.grp !== "ALL" ? ' disabled title="Đang lọc theo nhóm"' : "") + ">" + c + "</button>").join("");
    $("fGrp").innerHTML = [["ALL", "Tất cả"], ["XAU", "Tin vàng"], ["OIL", "Tin dầu"]].map(([k, n]) => '<button type="button" class="chip" data-grp="' + k + '" aria-pressed="' + (F.grp === k) + '">' + n + "</button>").join("");
    $("fUp").checked = F.up;
    document.querySelectorAll("#fScope .chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === F.scope)));
    const n = (F.imp.slice().sort().join() !== DEF.imp.slice().sort().join() ? 1 : 0) + (F.grp === "ALL" && F.ccy.length !== CCYS.length ? 1 : 0) + (F.grp !== "ALL" ? 1 : 0) + (F.up ? 1 : 0) + (F.q ? 1 : 0);
    $("fToggle").textContent = "Bộ lọc" + (n ? " · " + n : "");
  }
  $("fToggle").addEventListener("click", () => { const o = !$("filters").classList.contains("open"); $("filters").classList.toggle("open", o); $("fToggle").setAttribute("aria-expanded", String(o)); });
  $("fImp").addEventListener("click", (e) => { const b = e.target.closest("[data-imp]"); if (!b) return; const k = b.dataset.imp; F.imp = F.imp.indexOf(k) >= 0 ? F.imp.filter((x) => x !== k) : F.imp.concat([k]); saveF(); renderFilters(); render(); });
  $("fCcy").addEventListener("click", (e) => { const b = e.target.closest("[data-ccy]"); if (!b || b.disabled) return; const k = b.dataset.ccy; F.ccy = F.ccy.indexOf(k) >= 0 ? F.ccy.filter((x) => x !== k) : F.ccy.concat([k]); saveF(); renderFilters(); render(); });
  $("fGrp").addEventListener("click", (e) => { const b = e.target.closest("[data-grp]"); if (!b) return; F.grp = b.dataset.grp; saveF(); renderFilters(); render(); });
  $("fScope").addEventListener("click", (e) => { const b = e.target.closest("[data-v]"); if (!b || b.disabled) return; F.scope = b.dataset.v; saveF(); renderFilters(); render(); });
  $("fUp").addEventListener("change", () => { F.up = $("fUp").checked; saveF(); render(); });
  let qTimer = 0;
  $("fQ").addEventListener("input", () => { clearTimeout(qTimer); qTimer = setTimeout(() => { F.q = $("fQ").value.trim().toLowerCase(); renderFilters(); render(); }, 150); });
  $("fReset").addEventListener("click", () => { Object.assign(F, {imp: DEF.imp.slice(), ccy: DEF.ccy.slice(), grp: "ALL", up: false, scope: "week", q: ""}); $("fQ").value = ""; saveF(); renderFilters(); render(); });

  /* ---------------------------------------------------------
     Weeks: the current one from data/calendar.json, older ones from the archive
     --------------------------------------------------------- */
  let weeks = [], sel = "", view = null; /* view = {week, at, events, current} */
  const weekLabel = (w) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(w || ""); if (!m) return "—"; const a = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])), b = new Date(a.getTime() + 6 * DAY); return pad(a.getUTCDate()) + "/" + pad(a.getUTCMonth() + 1) + " – " + pad(b.getUTCDate()) + "/" + pad(b.getUTCMonth() + 1) + "/" + b.getUTCFullYear(); };
  function weekNav(){
    const list = weeks.slice();
    if (AP.cal.week && list.indexOf(AP.cal.week) < 0) list.unshift(AP.cal.week);
    list.sort().reverse();
    const i = list.indexOf(sel);
    $("wPrev").disabled = i < 0 || i >= list.length - 1;
    $("wNext").disabled = i <= 0;
    $("wLab").textContent = "Tuần " + weekLabel(sel) + (sel === AP.cal.week ? " · tuần này" : "");
    $("wPrev").onclick = () => { if (i >= 0 && i < list.length - 1) openWeek(list[i + 1]); };
    $("wNext").onclick = () => { if (i > 0) openWeek(list[i - 1]); };
    const cur = sel === AP.cal.week;
    document.querySelectorAll("#fScope .chip").forEach((b) => { b.disabled = !cur && b.dataset.v !== "week"; });
  }
  async function openWeek(w){
    sel = w;
    if (w === AP.cal.week){ view = {week: w, at: AP.cal.at, events: AP.cal.events, current: true}; weekNav(); render(); return; }
    $("ct").innerHTML = '<div class="empty">Đang tải tuần ' + esc(weekLabel(w)) + "…</div>";
    weekNav();
    try { const d = await AP.loadWeek(w); if (sel === w){ view = {week: w, at: d.at, events: d.events, current: false}; render(); } }
    catch { if (sel === w) $("ct").innerHTML = '<div class="empty">Không tải được lịch tuần này.</div>'; }
  }

  /* ---------------------------------------------------------
     Table
     --------------------------------------------------------- */
  const open = new Set();
  function srcLine(){
    const c = AP.cal;
    let st;
    if (c.state === "loading") st = '<span class="st"><i class="warn"></i>Đang tải lịch…</span>';
    else if (c.state === "error") st = '<span class="st"><i class="err"></i>Không tải được lịch. Tải lại trang để thử lại.</span>';
    else if (!AP.calFresh()) st = '<span class="st"><i class="warn"></i>Lịch chưa được cập nhật cho tuần mới (lần cuối ' + hm(c.at) + " " + ddmm(c.at) + ")</span>";
    else st = '<span class="st"><i class="ok"></i>Forex Factory · cập nhật ' + hm(c.at) + " " + ddmm(c.at) + " · kiểm tra 5 phút/lần</span>";
    $("srcLine").innerHTML = st + "<span>Giờ Việt Nam (GMT+7)</span><span>Bấm vào một tin để xem giải thích</span>";
  }
  function pass(e, now){
    if (F.imp.indexOf(e.impact) < 0) return false;
    if (F.grp !== "ALL"){ if (!e.tags.has(F.grp)) return false; }
    else if (F.ccy.indexOf(e.ccy) < 0) return false;
    if (F.up && view.current && (e.allDay ? dayKey(e.t) < dayKey(now) : e.t + (e.tentative && e.impact === "high" ? AFTER_TENT : ZONE) < now)) return false;
    if (F.q){
      const hay = (e.title + " " + (e.vn || "") + " " + e.ccy).toLowerCase();
      if (hay.indexOf(F.q) < 0) return false;
    }
    if (view.current && F.scope !== "week"){
      const d0 = vnStart(now) + (F.scope === "tomorrow" ? DAY : 0);
      if (e.t < d0 || e.t >= d0 + DAY) return false;
    }
    return true;
  }
  const ACT_SRC = {Fed: "Fed (thông cáo FOMC)", BLS: "Cục Thống kê Lao động Mỹ (BLS)", ECB: "Ngân hàng Trung ương châu Âu (ECB)",
    BoE: "Ngân hàng Trung ương Anh (BoE)", ONS: "Văn phòng Thống kê Anh (ONS)", RBA: "Ngân hàng Dự trữ Úc (RBA)"};
  function detail(e){
    const x = infoFor(e);
    const C = (s) => s.replace(/\{C\}/g, e.ccy);
    const gold = x.g && e.ccy === "USD" ? x.g : (e.ccy === "USD" && e.tags.has("XAU") ? GOLD_GENERIC : "");
    const k = LOCAL[e.ccy];
    const after = e.tentative && e.impact === "high" ? AFTER_TENT : ZONE;
    const meta = [];
    if (!e.allDay && k) meta.push((e.tentative ? "Giờ dự kiến: " : "Giờ công bố: ") + localHM(k, e.t) + " giờ " + ZNAME[k] + " (" + tzAbbr(k, e.t) + ") = " + hm(e.t) + " giờ VN");
    if (e.allDay) meta.push(e.tentative ? "Giờ chưa cố định trong ngày" : "Cả ngày");
    meta.push("Tên gốc: " + esc(e.title));
    if (e.actual) meta.push("Thực tế " + esc(e.actual) + " · nguồn: " + esc(ACT_SRC[e.actSrc] || e.actSrc || "—") + (e.actAt ? ", lấy lúc " + hm(e.actAt) + " " + ddmm(e.actAt) : ""));
    meta.push(IMP_NAME[e.impact] || "");
    if (e.impact === "high" && !e.allDay) meta.push("Trên bản đồ giờ giao dịch: đứng ngoài " + hm(e.t - ZONE) + "–" + hm(e.t + after));
    return '<div class="det" id="d-' + e.id + '">'
      + "<div><h4>Đo lường</h4><p>" + esc(C(x.m)) + "</p></div>"
      + "<div><h4>Vì sao quan trọng</h4><p>" + esc(C(x.w)) + (e.tentative && e.impact === "high" ? " Giờ trong lịch là giờ dự kiến, nên vùng cần tránh kéo dài 60 phút sau đó." : "") + "</p></div>"
      + "<div><h4>Tác động thường thấy</h4><p class=\"eff\">" + esc(C(x.e)) + "</p>" + (gold ? '<p style="margin-top:6px"><b style="color:#e6bd5c">Với vàng:</b> ' + esc(gold) + "</p>" : "") + "</div>"
      + '<div class="meta">' + meta.map((m) => "<span>" + m + "</span>").join("") + "</div></div>";
  }
  function row(e, now){
    const after = e.tentative && e.impact === "high" ? AFTER_TENT : ZONE;
    const d = e.t - now;
    const past = view.current ? (e.allDay ? dayKey(e.t) < dayKey(now) : d < -after) : false;
    const zone = view.current && !e.allDay && e.impact === "high" && d <= ZONE && -d <= after;
    let left = "";
    if (zone) left = '<span class="lg">' + (d > 0 ? "VÙNG CẤM · còn " + dur(d) : "VÙNG CẤM") + '</span><span class="sh">' + (d > 0 ? "CẤM " + cdur(d) : "CẤM") + "</span>";
    else if (view.current && !past && !e.allDay && d < 36 * H) left = '<span class="lg">còn ' + dur(d) + '</span><span class="sh">còn ' + cdur(d) + "</span>";
    const tm = e.allDay ? (e.tentative ? "Trong ngày" : "Cả ngày") : (e.tentative ? "~" : "") + hm(e.t);
    const badges = (F.grp !== "XAU" && e.tags.has("XAU") ? '<span class="bdg au" title="Tin ảnh hưởng mạnh tới giá vàng">VÀNG</span>' : "")
      + (F.grp !== "OIL" && e.tags.has("OIL") ? '<span class="bdg oil" title="Tin ảnh hưởng tới giá dầu">DẦU</span>' : "")
      + (e.tentative ? '<span class="bdg tent" title="Giờ chưa cố định">giờ dự kiến</span>' : "");
    const isOpen = open.has(e.id);
    return '<div class="cr' + (past ? " past" : "") + (zone ? " zone" : "") + (e.impact === "holiday" ? " hol" : "") + '" role="button" tabindex="0" data-id="' + e.id + '" aria-expanded="' + isOpen + '" aria-controls="d-' + e.id + '">'
      + '<span class="tm' + (e.tentative ? " tent" : "") + (e.allDay ? " ad" : "") + '">' + tm + (left ? '<span class="left">' + left + "</span>" : "") + "</span>"
      + '<span class="ccy">' + e.ccy + "</span>"
      + ib(e.impact)
      + '<span class="ev"><b>' + esc(e.vn || e.title) + "</b>" + badges + (e.vn && e.vn !== e.title ? '<span class="og">' + esc(e.title) + "</span>" : "") + "</span>"
      + '<span class="num act' + (e.actual ? (e.better > 0 ? " up" : e.better < 0 ? " down" : " eq") : "") + '"' + (e.actual ? ' title="' + (e.better > 0 ? "Tốt hơn dự báo cho " + e.ccy : e.better < 0 ? "Kém hơn dự báo cho " + e.ccy : "Bằng dự báo") + '"' : "") + ">" + (e.actual ? '<span class="k">Thực tế</span>' + esc(e.actual) : "") + "</span>"
      + '<span class="num">' + (e.forecast ? '<span class="k">Dự báo</span>' + esc(e.forecast) : "") + "</span>"
      + '<span class="num pv">' + (e.previous ? '<span class="k">Kỳ trước</span>' + esc(e.previous) : "") + "</span>"
      + '<span class="chev" aria-hidden="true">›</span></div>'
      + (isOpen ? detail(e) : "");
  }
  function render(){
    srcLine();
    const box = $("ct");
    if (!view){ if (AP.cal.state === "error") box.innerHTML = '<div class="empty">Không tải được lịch tin. Kiểm tra kết nối rồi tải lại trang.</div>'; return; }
    const now = Date.now();
    const list = view.events.filter((e) => pass(e, now));
    let html = '<div class="cr ch" aria-hidden="true"><span>Giờ</span><span>Tiền</span><span></span><span>Sự kiện</span><span class="r">Thực tế</span><span class="r">Dự báo</span><span class="r">Kỳ trước</span><span></span></div>';
    if (!list.length){
      box.innerHTML = html + '<div class="empty">' + (view.events.length ? "Không có tin nào khớp bộ lọc. Bấm “Bỏ lọc” để xem lại tất cả." : "Tuần này chưa có dữ liệu lịch.") + "</div>";
      return;
    }
    const today = dayKey(now);
    const byDay = new Map();
    for (const e of list){ const k = dayKey(e.t); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(e); }
    let nowDone = !view.current;
    for (const [k, evs] of byDay){
      if (!nowDone && k > today){
        html += '<div class="nowline">Bây giờ ' + hm(now) + "</div>";
        nowDone = true;
      }
      const hi = evs.filter((e) => e.impact === "high").length;
      html += '<div class="cday' + (k === today && view.current ? " today" : "") + '"><span>' + dayLabel(evs[0].t) + (k === today && view.current ? " · hôm nay" : "") + '</span><span class="cnt">' + evs.length + " tin" + (hi ? " · " + hi + " tin đỏ" : "") + "</span></div>";
      for (const e of evs){
        const after = e.tentative && e.impact === "high" ? AFTER_TENT : ZONE;
        if (!nowDone && k === today && !e.allDay && e.t + after > now){
          const nx = e.t - now;
          html += '<div class="nowline">Bây giờ ' + hm(now) + (nx > 0 ? " · tin tiếp theo còn " + dur(nx) : "") + "</div>";
          nowDone = true;
        }
        html += row(e, now);
      }
      if (!nowDone && k === today){ html += '<div class="nowline">Bây giờ ' + hm(now) + " · hết tin trong ngày</div>"; nowDone = true; }
    }
    box.innerHTML = html;
  }
  function toggle(id){
    if (open.has(id)) open.delete(id); else open.add(id);
    render();
    const r = document.querySelector('.cr[data-id="' + id + '"]');
    if (r) r.focus({preventScroll: true});
  }
  $("ct").addEventListener("click", (e) => { const r = e.target.closest(".cr[data-id]"); if (r) toggle(r.dataset.id); });
  $("ct").addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const r = e.target.closest(".cr[data-id]");
    if (r){ e.preventDefault(); toggle(r.dataset.id); }
  });

  /* ---------------------------------------------------------
     Tabs: weekly table / live results (TradingView)
     --------------------------------------------------------- */
  let liveLoaded = false;
  function setTab(live){
    $("tabWeek").setAttribute("aria-selected", String(!live));
    $("tabLive").setAttribute("aria-selected", String(live));
    $("paneWeek").hidden = live;
    $("paneLive").hidden = !live;
    if (live && !liveLoaded){
      liveLoaded = true;
      AP.tv($("tvCal"), "events", {colorTheme: "dark", isTransparent: true, width: "100%", height: "100%", locale: "vi_VN", importanceFilter: "0,1", countryFilter: "us,eu,gb,jp,au"}, {height: "100%"});
    }
  }
  $("tabWeek").addEventListener("click", () => setTab(false));
  $("tabLive").addEventListener("click", () => setTab(true));

  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */
  renderFilters();
  srcLine();
  AP.startActuals();
  AP.onCal(async (c) => {
    if (c.state !== "ready"){ render(); return; }
    if (!view || view.current){ sel = c.week; view = {week: c.week, at: c.at, events: c.events, current: true}; }
    weekNav(); render();
    weeks = await AP.loadWeekIndex();
    weekNav();
  });
  AP.onTick(() => { if (view && view.current) render(); });
})();
