/* Aporia — shared code for every page: time zones and sessions, trading-hours advice per instrument,
   weekly calendar loading, header (clock, focus status, next red event), footer, TradingView embeds. */
(() => {
  "use strict";
  const M = 6e4, H = 36e5, DAY = 864e5, VN = 7 * H, ZONE = 15 * M, AFTER_TENT = 60 * M;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const LS = {
    get(k, d = null){ try { const v = localStorage.getItem("aporia." + k); return v === null ? d : v; } catch { return d; } },
    set(k, v){ try { localStorage.setItem("aporia." + k, v); return true; } catch { return false; } }
  };

  /* =========================================================
     Time helpers (every market time is computed in its own zone)
     ========================================================= */
  const fmtCache = {};
  function zoneParts(ms, tz){
    const f = fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat("en-US", {timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short"}));
    const o = {};
    for (const p of f.formatToParts(new Date(ms))) o[p.type] = p.value;
    return {y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second, wd: o.weekday};
  }
  function tzOffset(ms, tz){
    const base = ms - (((ms % 1000) + 1000) % 1000);
    const p = zoneParts(base, tz);
    return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - base;
  }
  function zonedToUtc(y, m, d, h, mi, tz){
    const guess = Date.UTC(y, m - 1, d, h, mi);
    const off = tzOffset(guess, tz);
    let t = guess - off;
    const off2 = tzOffset(t, tz);
    if (off2 !== off) t = guess - off2;
    return t;
  }
  function vn(ms){ const d = new Date(ms + VN); return {y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds(), wd: d.getUTCDay()}; }
  const pad = (n) => String(n).padStart(2, "0");
  const hm = (ms) => { const p = vn(ms); return pad(p.h) + ":" + pad(p.mi); };
  const vnStart = (ms) => { const p = vn(ms); return Date.UTC(p.y, p.m - 1, p.d) - VN; };
  const dayKey = (ms) => { const p = vn(ms); return p.y + "-" + pad(p.m) + "-" + pad(p.d); };
  const WD = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const dayLabel = (ms) => { const p = vn(ms); return WD[p.wd] + " " + pad(p.d) + "/" + pad(p.m); };
  const ddmm = (ms) => { const p = vn(ms); return pad(p.d) + "/" + pad(p.m); };
  function addDays(y, m, d, n){ const t = new Date(Date.UTC(y, m - 1, d + n)); return {y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), wd: t.getUTCDay()}; }
  function dur(ms){
    const m = Math.round(Math.abs(ms) / M);
    if (m < 60) return m + " phút";
    const h = Math.floor(m / 60), r = m % 60;
    if (h < 24) return h + " giờ" + (r ? " " + r + " phút" : "");
    const dd = Math.floor(h / 24), rh = h % 24;
    return dd + " ngày" + (rh ? " " + rh + " giờ" : "");
  }

  const TZ = {L: "Europe/London", N: "America/New_York", T: "Asia/Tokyo", S: "Australia/Sydney", B: "Asia/Shanghai", F: "Europe/Berlin"};
  const ZNAME = {L: "London", N: "New York", T: "Tokyo", S: "Sydney", B: "Bắc Kinh", F: "Frankfurt"};
  const WK = [1, 2, 3, 4, 5];
  const atLocal = (k, dt, h, mi) => zonedToUtc(dt.y, dt.m, dt.d, h, mi, TZ[k]);
  const localHM = (k, t) => { const p = zoneParts(t, TZ[k]); return pad(p.h) + ":" + pad(p.mi); };
  function tzAbbr(k, t){
    const o = Math.round(tzOffset(t, TZ[k]) / H);
    const map = {L: {0: "GMT", 1: "BST"}, N: {"-5": "EST", "-4": "EDT"}, S: {10: "AEST", 11: "AEDT"}, T: {9: "JST"}, B: {8: "CST"}, F: {1: "CET", 2: "CEST"}};
    return (map[k] && map[k][o]) || ("UTC" + (o >= 0 ? "+" : "−") + Math.abs(o));
  }
  const utcLabel = (k, t) => { const o = Math.round(tzOffset(t, TZ[k]) / H); return "UTC" + (o >= 0 ? "+" : "−") + Math.abs(o); };

  function occ(dayStart, a, b, days){
    const p = vn(dayStart), out = [];
    for (const off of [-1, 0, 1]){
      const dt = addDays(p.y, p.m, p.d, off);
      if (days && days.indexOf(dt.wd) < 0) continue;
      const s = atLocal(a[0], dt, a[1], a[2]);
      let e = atLocal(b[0], dt, b[1], b[2]);
      if (e <= s) e += DAY;
      const cs = Math.max(s, dayStart), ce = Math.min(e, dayStart + DAY);
      if (ce > cs) out.push({a: cs, b: ce, ra: s, rb: e});
    }
    return out;
  }
  function closedSpans(dayStart){
    const p = vn(dayStart), out = [];
    for (const off of [-3, -2, -1, 0, 1]){
      const dt = addDays(p.y, p.m, p.d, off);
      if (dt.wd !== 5) continue;
      const a = atLocal("N", dt, 17, 0), b = atLocal("N", addDays(dt.y, dt.m, dt.d, 2), 17, 0);
      const cs = Math.max(a, dayStart), ce = Math.min(b, dayStart + DAY);
      if (ce > cs) out.push({a: cs, b: ce, ra: a, rb: b});
    }
    return out;
  }
  function fxOpen(ms){
    const p = zoneParts(ms, TZ.N);
    if (p.wd === "Sat") return false;
    if (p.wd === "Fri" && p.h >= 17) return false;
    if (p.wd === "Sun" && p.h < 17) return false;
    return true;
  }
  function nyseOpen(ms){
    const p = zoneParts(ms, TZ.N);
    if (p.wd === "Sat" || p.wd === "Sun") return false;
    const m = p.h * 60 + p.mi;
    return m >= 570 && m < 960;
  }
  const SESS = [
    {k: "S", name: "Sydney", o: 7, c: 16},
    {k: "T", name: "Tokyo", o: 9, c: 18},
    {k: "L", name: "London", o: 8, c: 17},
    {k: "N", name: "New York", o: 8, c: 17}
  ];
  const sessSpans = (dayStart, S) => occ(dayStart, [S.k, S.o, 0], [S.k, S.c, 0], WK);

  /* =========================================================
     Trading-hours advice per instrument (anchored to local exchange times)
     ========================================================= */
  const GEN = {n: "Hạn chế", d: "Biên độ hẹp, dễ nhiễu. Chỉ setup C (range), giảm khối lượng."};
  const S_ = {
    ldnOpen: {l: "stop", a: ["L", 8, 0], b: ["L", 8, 15], n: "Mở cửa London", d: "15 phút đầu hay quét hai đầu range phiên Á. Chỉ đánh dấu đỉnh/đáy, chưa vào lệnh."},
    usData: {l: "stop", a: ["N", 8, 15], b: ["N", 8, 45], n: "Tin Mỹ 8:30 giờ New York", d: "Spread giãn, trượt giá. Đứng ngoài, chờ nến M5 sau tin đóng cửa."},
    nyse: {l: "stop", a: ["N", 9, 30], b: ["N", 9, 35], n: "Mở cửa chứng khoán Mỹ", d: "Giá hay giật trong 5–15 phút. Chờ nến M5 đầu tiên đóng cửa."},
    rollFx: {l: "stop", a: ["N", 16, 45], b: ["N", 17, 15], n: "Rollover", d: "Spread giãn mạnh quanh 17:00 giờ New York. Không mở lệnh mới, kiểm tra SL.", days: [1, 2, 3, 4]},
    rollCmd: {l: "stop", a: ["N", 16, 45], b: ["N", 17, 0], n: "Rollover", d: "Spread giãn trước giờ sàn tạm nghỉ. Không mở lệnh mới.", days: [1, 2, 3, 4]},
    weekOpen: {l: "stop", a: ["N", 17, 0], b: ["N", 18, 0], n: "Mở cửa đầu tuần", d: "Thanh khoản rất mỏng, có thể gap giá. Không vào lệnh.", days: [0]},
    usPm: {l: "warn", a: ["N", 11, 30], b: ["N", 16, 45], n: "Chiều Mỹ", d: "Châu Âu đã đóng cửa, lực giảm dần, dễ đảo chiều. Hạn chế mở lệnh mới."}
  };
  const cmdBreak = (what) => ({l: "off", a: ["N", 17, 0], b: ["N", 18, 0], n: what + " nghỉ 1 giờ", d: "Sàn tạm dừng 17:00–18:00 giờ New York, giá đứng yên.", days: [1, 2, 3, 4]});
  const earlyAsia = (end) => ({l: "warn", a: ["N", 18, 0], b: end, n: "Đầu phiên Á", d: "Thanh khoản mỏng sau khi Mỹ đóng cửa, spread rộng. Không nên vào lệnh.", days: [0, 1, 2, 3, 4]});
  const ldnLunch = (start, end) => ({l: "warn", a: start, b: end, n: "London nghỉ trưa", d: "Lực giảm sau buổi sáng London. Chủ yếu quản lý lệnh đang mở."});
  const T_US10 = {k: "N", h: 10, m: 0, n: "Tin Mỹ 10:00 (ISM, JOLTS, niềm tin tiêu dùng…)"};
  const T_FED = {k: "N", h: 14, m: 0, n: "Fed công bố lãi suất (ngày họp FOMC)"};

  const INSTR = [
    {id: "XAU", code: "XAUUSD", name: "Vàng", aff: (e) => e.tags.has("XAU"),
      segs: [
        earlyAsia(["T", 9, 0]),
        {l: "warn", a: ["T", 9, 0], b: ["L", 8, 0], n: "Phiên Á", d: "Vàng thường đi ngang trong biên hẹp. Chỉ setup C (range), giảm khối lượng."},
        ldnLunch(["L", 10, 30], ["N", 8, 15]), S_.usPm,
        {l: "good", a: ["L", 8, 15], b: ["L", 10, 30], n: "Sáng London", d: "Dòng tiền châu Âu vào, vàng chọn hướng trong ngày. Vào theo xu hướng (setup A/B)."},
        {l: "best", a: ["N", 8, 45], b: ["N", 11, 30], n: "Giao thoa London – New York", d: "Thanh khoản và biến động cao nhất ngày, xu hướng rõ. Ưu tiên setup A/B."},
        S_.ldnOpen, S_.usData, S_.nyse, S_.rollCmd, cmdBreak("Vàng"), S_.weekOpen
      ],
      ticks: [T_US10, T_FED, {k: "L", h: 10, m: 30, n: "Giá fix LBMA buổi sáng"}, {k: "L", h: 15, m: 0, n: "Giá fix LBMA buổi chiều"}],
      drivers: "DXY, lợi suất thực Mỹ 10 năm, kỳ vọng lãi suất Fed, rủi ro địa chính trị.",
      tip: "NFP, CPI, FOMC làm vàng biến động mạnh nhất tuần: đứng ngoài ±15 phút, vào lại khi nến M15 sau tin đóng cửa."},
    {id: "EUR", code: "EURUSD", name: "Euro", aff: (e) => e.ccy === "USD" || e.ccy === "EUR",
      segs: [
        earlyAsia(["T", 9, 0]),
        {l: "warn", a: ["T", 9, 0], b: ["F", 8, 0], n: "Phiên Á", d: "EUR đi ngang, biên độ hẹp. Tránh trade breakout."},
        {l: "warn", a: ["F", 8, 0], b: ["L", 8, 0], n: "Frankfurt mở cửa", d: "Châu Âu bắt đầu, dữ liệu Đức có thể ra. Theo dõi, chưa vội vào lệnh."},
        ldnLunch(["L", 11, 0], ["N", 8, 15]),
        {l: "warn", a: ["L", 16, 30], b: ["N", 16, 45], n: "Chiều Mỹ", d: "Châu Âu đã đóng cửa, EUR thường đi ngang. Hạn chế mở lệnh mới."},
        {l: "best", a: ["L", 8, 15], b: ["L", 11, 0], n: "Sáng London", d: "EUR có lực nhất trong ngày, dữ liệu Đức và khối euro ra trong khung này. Ưu tiên setup A/B."},
        {l: "good", a: ["N", 8, 45], b: ["L", 16, 30], n: "Giao thoa London – New York", d: "Thanh khoản cao, phản ứng mạnh với tin Mỹ. Đi theo xu hướng đã hình thành."},
        S_.ldnOpen, S_.usData, S_.rollFx, S_.weekOpen
      ],
      ticks: [{k: "F", h: 10, m: 0, n: "PMI khối euro"}, {k: "F", h: 11, m: 0, n: "Eurostat: CPI, GDP khối euro"}, {k: "F", h: 14, m: 0, n: "CPI sơ bộ Đức"}, {k: "F", h: 14, m: 15, n: "ECB công bố lãi suất (ngày họp)"}],
      drivers: "Chênh lệch lãi suất ECB – Fed, dữ liệu Đức và khối euro, DXY.",
      tip: "Sáng London là khung sạch nhất; chiều Mỹ EUR thường đi ngang."},
    {id: "GBP", code: "GBPUSD", name: "Bảng Anh", aff: (e) => e.ccy === "USD" || e.ccy === "GBP",
      segs: [
        earlyAsia(["T", 9, 0]),
        {l: "warn", a: ["T", 9, 0], b: ["L", 7, 0], n: "Phiên Á", d: "GBP đi ngang, biên độ hẹp. Tránh trade breakout."},
        {l: "warn", a: ["L", 7, 0], b: ["L", 8, 0], n: "Châu Âu mở cửa", d: "Thanh khoản đang vào. Theo dõi, chưa vội vào lệnh."},
        {l: "warn", a: ["L", 6, 55], b: ["L", 7, 15], n: "Giờ dữ liệu Anh (ONS)", d: "Ngày có tin, nến M5 rất nhiễu ngay trước giờ mở cửa London."},
        ldnLunch(["L", 10, 30], ["N", 8, 15]),
        {l: "warn", a: ["L", 16, 30], b: ["N", 16, 45], n: "Chiều Mỹ", d: "London đã đóng cửa, GBP thường đi ngang. Hạn chế mở lệnh mới."},
        {l: "best", a: ["L", 8, 15], b: ["L", 10, 30], n: "Sáng London", d: "GBP mạnh nhất trong ngày khi London vào phiên. Ưu tiên setup A/B."},
        {l: "good", a: ["N", 8, 45], b: ["L", 16, 30], n: "Giao thoa London – New York", d: "Thanh khoản cao, phản ứng mạnh với tin Mỹ. Đi theo xu hướng đã hình thành."},
        S_.ldnOpen, S_.usData, S_.rollFx, S_.weekOpen
      ],
      ticks: [{k: "L", h: 7, m: 0, n: "ONS: CPI, việc làm, GDP Anh"}, {k: "L", h: 9, m: 30, n: "PMI Anh"}, {k: "L", h: 12, m: 0, n: "BoE công bố lãi suất (ngày họp)"}],
      drivers: "Lạm phát và tiền lương ở Anh, kỳ vọng BoE, lợi suất trái phiếu Anh.",
      tip: "Dữ liệu Anh ra 07:00 giờ London, ngay trước giờ mở cửa: M5 rất nhiễu. Tỷ lệ phiếu của BoE thường gây giật mạnh."},
    {id: "JPY", code: "USDJPY", name: "Yên Nhật", aff: (e) => e.ccy === "USD" || e.ccy === "JPY",
      segs: [
        earlyAsia(["T", 8, 30]),
        {l: "warn", a: ["T", 8, 30], b: ["T", 9, 0], n: "Giờ dữ liệu Nhật", d: "Ngày có tin (CPI, việc làm), giá có thể giật trước giờ Tokyo mở cửa."},
        {l: "warn", a: ["T", 11, 30], b: ["L", 8, 0], n: "Chiều châu Á", d: "Lực yếu dần trước khi châu Âu mở cửa."},
        ldnLunch(["L", 10, 30], ["N", 8, 15]), S_.usPm,
        {l: "good", a: ["T", 9, 0], b: ["T", 11, 30], n: "Sáng Tokyo", d: "Dòng tiền Nhật vào thị trường. Chú ý giá fix Tokyo lúc 9:55."},
        {l: "good", a: ["L", 8, 15], b: ["L", 10, 30], n: "Sáng London", d: "Thanh khoản châu Âu vào, USDJPY theo xu hướng chung của USD."},
        {l: "best", a: ["N", 8, 45], b: ["N", 11, 30], n: "Giờ Mỹ", d: "USDJPY bám lợi suất trái phiếu Mỹ, xu hướng rõ nhất trong ngày. Ưu tiên setup A/B."},
        S_.ldnOpen, S_.usData, S_.rollFx, S_.weekOpen
      ],
      ticks: [{k: "T", h: 8, m: 30, n: "Dữ liệu Nhật (CPI, việc làm…)"}, {k: "T", h: 9, m: 55, n: "Giá fix Tokyo"}, {k: "T", h: 12, m: 0, n: "BoJ công bố (ngày họp, giờ không cố định)"}, {k: "T", h: 15, m: 30, n: "Họp báo BoJ"}],
      drivers: "Chênh lệch lợi suất Mỹ – Nhật, chính sách BoJ, tâm lý rủi ro toàn cầu.",
      tip: "Khi Bộ Tài chính Nhật lên tiếng cảnh báo, giá có thể đảo chiều vài trăm pip trong vài phút."},
    {id: "AUD", code: "AUDUSD", name: "Đô la Úc", aff: (e) => e.ccy === "USD" || e.ccy === "AUD",
      segs: [
        earlyAsia(["S", 10, 0]),
        {l: "warn", a: ["T", 11, 30], b: ["L", 8, 0], n: "Chiều châu Á", d: "Lực yếu dần trước khi châu Âu mở cửa."},
        ldnLunch(["L", 10, 30], ["N", 8, 15]), S_.usPm,
        {l: "good", a: ["S", 10, 0], b: ["T", 11, 30], n: "Phiên Úc – Tokyo sáng", d: "Dữ liệu Úc và Trung Quốc ra trong khung này, AUD có lực."},
        {l: "good", a: ["L", 8, 15], b: ["L", 10, 30], n: "Sáng London", d: "Thanh khoản châu Âu vào, AUD đi theo tâm lý rủi ro chung."},
        {l: "best", a: ["N", 8, 45], b: ["N", 11, 30], n: "Giao thoa London – New York", d: "Biến động cao nhất ngày, phản ứng mạnh với tin Mỹ và chứng khoán Mỹ. Ưu tiên setup A/B."},
        S_.ldnOpen, S_.usData, S_.rollFx, S_.weekOpen
      ],
      ticks: [{k: "S", h: 11, m: 30, n: "ABS: CPI tháng, việc làm Úc"}, {k: "S", h: 14, m: 30, n: "RBA công bố lãi suất (ngày họp)"}, {k: "B", h: 9, m: 30, n: "PMI Trung Quốc (cuối tháng)"}, {k: "B", h: 10, m: 0, n: "Dữ liệu Trung Quốc (NBS)"}],
      drivers: "Dữ liệu Úc và Trung Quốc, giá quặng sắt, chứng khoán Mỹ, tâm lý rủi ro.",
      tip: "Hai khung đáng trade: sáng phiên Úc khi có dữ liệu, và khi Mỹ vào phiên."},
    {id: "OIL", code: "DẦU", name: "WTI · Brent", aff: (e) => e.tags.has("OIL") || (e.ccy === "USD" && e.impact === "high"),
      segs: [
        earlyAsia(["T", 9, 0]),
        {l: "warn", a: ["T", 9, 0], b: ["L", 8, 0], n: "Phiên Á", d: "Dầu ít lực, chủ yếu đi ngang."},
        {l: "warn", a: ["L", 11, 0], b: ["N", 9, 0], n: "Chờ sàn NYMEX", d: "WTI chờ giờ chính của sàn Mỹ. Tránh tin Mỹ 8:30."},
        {l: "warn", a: ["N", 14, 30], b: ["N", 16, 45], n: "Sau giờ chốt NYMEX", d: "Lực giảm sau giờ chốt giá. Hạn chế mở lệnh mới."},
        {l: "good", a: ["L", 8, 15], b: ["L", 11, 0], n: "Brent – châu Âu", d: "Brent giao dịch sôi động theo London, WTI theo sau."},
        {l: "best", a: ["N", 9, 0], b: ["N", 14, 30], n: "Giờ chính sàn NYMEX", d: "Thanh khoản dầu cao nhất ngày, giá chốt lúc 14:30 giờ New York."},
        {l: "stop", a: ["N", 10, 15], b: ["N", 10, 45], n: "Tồn kho dầu EIA", d: "Thứ Tư 10:30 giờ New York, dầu biến động mạnh. Đứng ngoài ±15 phút.", days: [3]},
        S_.ldnOpen, S_.usData, S_.rollCmd, cmdBreak("Dầu"), S_.weekOpen
      ],
      ticks: [{k: "N", h: 10, m: 30, n: "Tồn kho dầu EIA (thứ Tư)", days: [3]}, {k: "N", h: 13, m: 0, n: "Số giàn khoan Baker Hughes (thứ Sáu)", days: [5]}, {k: "N", h: 14, m: 30, n: "Chốt giá NYMEX"}, {k: "N", h: 16, m: 30, n: "Tồn kho dầu API (thứ Ba)", days: [2]}],
      drivers: "Tồn kho EIA/API, quyết định OPEC+, địa chính trị Trung Đông, USD.",
      tip: "Giờ chính sàn NYMEX có thanh khoản tốt nhất. Tránh tin tồn kho EIA chiều thứ Tư."}
  ];
  const LV = {
    best: {name: "Tốt nhất", k: "go"}, good: {name: "Tốt", k: "go"}, warn: {name: "Hạn chế", k: "warn"},
    stop: {name: "Tránh", k: "stop"}, ev: {name: "Tin đỏ", k: "stop"}, off: {name: "Nghỉ", k: "off"}
  };

  /* =========================================================
     Event titles: Vietnamese names and gold/oil relevance
     ========================================================= */
  const CCYS = ["USD", "EUR", "GBP", "JPY", "AUD"];
  const CCY_LABEL = {XAU: "VÀNG", OIL: "DẦU"};
  const GOLD_EN = /non-?farm|\bnfp\b|unemployment|jobless|claims|average hourly|earnings|\bcpi\b|\bpce\b|\bppi\b|inflation|federal funds|fomc|fed chair|\bfed\b|powell|interest rate|\bgdp\b|retail sales|\bism\b|jolts|\badp\b|employment cost|consumer confidence|sentiment|durable/i;
  const OIL_RE = /crude|\boil\b|opec|\beia\b|natural gas|baker hughes|\bapi weekly|dầu|khí đốt/i;
  const VN_EXACT = {
    "Non-Farm Employment Change": "Bảng lương phi nông nghiệp (NFP)", "ADP Non-Farm Employment Change": "Việc làm khu vực tư nhân ADP", "ADP Weekly Employment Change": "Việc làm ADP hằng tuần",
    "Unemployment Rate": "Tỷ lệ thất nghiệp", "Unemployment Claims": "Đơn xin trợ cấp thất nghiệp", "Average Hourly Earnings m/m": "Thu nhập bình quân theo giờ m/m", "JOLTS Job Openings": "Số việc làm trống JOLTS",
    "Core CPI m/m": "CPI lõi m/m", "Core CPI y/y": "CPI lõi y/y", "Core PPI m/m": "PPI lõi m/m",
    "Core PCE Price Index m/m": "Chỉ số giá PCE lõi m/m", "PCE Price Index m/m": "Chỉ số giá PCE m/m",
    "Federal Funds Rate": "Fed công bố lãi suất", "FOMC Statement": "Tuyên bố của FOMC", "FOMC Press Conference": "Họp báo FOMC", "FOMC Meeting Minutes": "Biên bản họp FOMC", "FOMC Economic Projections": "Dự báo kinh tế của FOMC",
    "Advance GDP q/q": "GDP sơ bộ q/q", "Prelim GDP q/q": "GDP điều chỉnh q/q", "Final GDP q/q": "GDP chính thức q/q", "Advance GDP Price Index q/q": "Chỉ số giá GDP sơ bộ q/q",
    "Retail Sales m/m": "Doanh số bán lẻ m/m", "Core Retail Sales m/m": "Doanh số bán lẻ lõi m/m",
    "ISM Manufacturing PMI": "PMI sản xuất ISM", "ISM Services PMI": "PMI dịch vụ ISM", "Flash Manufacturing PMI": "PMI sản xuất sơ bộ", "Flash Services PMI": "PMI dịch vụ sơ bộ",
    "CB Consumer Confidence": "Niềm tin tiêu dùng CB", "Prelim UoM Consumer Sentiment": "Tâm lý tiêu dùng UoM sơ bộ", "Revised UoM Consumer Sentiment": "Tâm lý tiêu dùng UoM điều chỉnh",
    "Prelim UoM Inflation Expectations": "Kỳ vọng lạm phát UoM sơ bộ", "Revised UoM Inflation Expectations": "Kỳ vọng lạm phát UoM điều chỉnh",
    "Durable Goods Orders m/m": "Đơn hàng lâu bền m/m", "Core Durable Goods Orders m/m": "Đơn hàng lâu bền lõi m/m",
    "Crude Oil Inventories": "Tồn kho dầu thô EIA", "Natural Gas Storage": "Tồn kho khí đốt", "API Weekly Statistical Bulletin": "Tồn kho dầu API",
    "Employment Cost Index q/q": "Chỉ số chi phí lao động ECI", "Empire State Manufacturing Index": "Chỉ số sản xuất Empire State", "Philly Fed Manufacturing Index": "Chỉ số sản xuất Philly Fed",
    "Building Permits": "Giấy phép xây dựng", "Housing Starts": "Nhà khởi công", "New Home Sales": "Doanh số nhà mới", "Existing Home Sales": "Doanh số nhà cũ", "Pending Home Sales m/m": "Doanh số nhà chờ bán m/m",
    "Trade Balance": "Cán cân thương mại", "Goods Trade Balance": "Cán cân thương mại hàng hoá", "Bank Holiday": "Nghỉ lễ ngân hàng",
    "Main Refinancing Rate": "ECB công bố lãi suất", "ECB Press Conference": "Họp báo ECB", "Monetary Policy Statement": "Tuyên bố chính sách tiền tệ",
    "CPI Flash Estimate y/y": "CPI sơ bộ khối euro y/y", "Core CPI Flash Estimate y/y": "CPI lõi sơ bộ khối euro y/y", "German Prelim CPI m/m": "CPI sơ bộ Đức m/m",
    "German ifo Business Climate": "Chỉ số môi trường kinh doanh ifo (Đức)", "German ZEW Economic Sentiment": "Chỉ số ZEW (Đức)",
    "German Flash Manufacturing PMI": "PMI sản xuất sơ bộ Đức", "German Flash Services PMI": "PMI dịch vụ sơ bộ Đức", "Prelim Flash GDP q/q": "GDP sơ bộ khối euro q/q", "German Prelim GDP q/q": "GDP sơ bộ Đức q/q",
    "Official Bank Rate": "BoE công bố lãi suất", "MPC Official Bank Rate Votes": "Tỷ lệ phiếu lãi suất của BoE", "Monetary Policy Summary": "Tóm tắt chính sách tiền tệ BoE",
    "Claimant Count Change": "Số người nhận trợ cấp thất nghiệp", "Average Earnings Index 3m/y": "Thu nhập bình quân 3 tháng y/y", "GDP m/m": "GDP tháng m/m", "Annual Budget Release": "Công bố ngân sách năm",
    "BOJ Policy Rate": "BoJ công bố lãi suất", "BOJ Press Conference": "Họp báo BoJ", "BOJ Outlook Report": "Báo cáo triển vọng BoJ",
    "Tokyo Core CPI y/y": "CPI lõi Tokyo y/y", "National Core CPI y/y": "CPI lõi toàn quốc Nhật y/y", "BOJ Core CPI y/y": "CPI lõi theo BoJ y/y",
    "Cash Rate": "RBA công bố lãi suất", "RBA Rate Statement": "Tuyên bố lãi suất RBA", "RBA Press Conference": "Họp báo RBA",
    "Employment Change": "Thay đổi số việc làm", "Autumn Forecast Statement": "Báo cáo dự báo kinh tế mùa thu (Anh)", "Spring Forecast Statement": "Báo cáo dự báo kinh tế mùa xuân (Anh)", "Trimmed Mean CPI m/m": "CPI lõi (trimmed mean) m/m", "Trimmed Mean CPI q/q": "CPI lõi (trimmed mean) q/q"
  };
  const VN_RE = [
    [/^Fed Chair (.+) Speaks$/, "Chủ tịch Fed $1 phát biểu"], [/^FOMC Member (.+) Speaks$/, "Thành viên FOMC $1 phát biểu"],
    [/^ECB President (.+) Speaks$/, "Chủ tịch ECB $1 phát biểu"], [/^BOE Gov (.+) Speaks$/, "Thống đốc BoE $1 phát biểu"],
    [/^BOJ Gov (.+) Speaks$/, "Thống đốc BoJ $1 phát biểu"], [/^RBA Gov (.+) Speaks$/, "Thống đốc RBA $1 phát biểu"],
    [/^RBA Assist Gov (.+) Speaks$/, "Trợ lý thống đốc RBA $1 phát biểu"], [/^(.+) Speaks$/, "$1 phát biểu"]
  ];
  function vnTitle(t){ if (VN_EXACT[t]) return VN_EXACT[t]; for (const [re, rep] of VN_RE) if (re.test(t)) return t.replace(re, rep); return null; }
  function hash(s){ let h = 2166136261; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  /* =========================================================
     Paint one VN day for an instrument, minute by minute
     ========================================================= */
  /* Releases within 2 minutes of each other (e.g. BoJ rate + outlook report) form one group. */
  function groupByTime(list){
    const out = [];
    for (const e of list.slice().sort((a, b) => a.t - b.t)){
      let g = out.find((x) => e.t >= x.t && e.t - x.end <= 2 * M);
      if (!g){ g = {t: e.t, end: e.t, ccys: [], names: [], high: false}; out.push(g); }
      if (e.t > g.end) g.end = e.t;
      const c = CCY_LABEL[e.ccy] || e.ccy, n = e.vn || e.title;
      if (g.ccys.indexOf(c) < 0) g.ccys.push(c);
      if (g.names.indexOf(n) < 0) g.names.push(n);
      if (e.impact === "high") g.high = true;
      if (e.tentative && e.impact === "high") g.tent = true;
    }
    for (const g of out) g.label = g.ccys.join("/") + ": " + g.names.slice(0, 3).join(", ") + (g.names.length > 3 ? " và " + (g.names.length - 3) + " tin khác" : "");
    return out.sort((a, b) => a.t - b.t);
  }
  function paint(dayStart, inst, evs){
    const lv = new Array(1440).fill("warn"), nm = new Array(1440).fill(GEN.n), ds = new Array(1440).fill(GEN.d);
    const put = (sp, l, n, d) => {
      const i0 = Math.max(0, Math.round((sp.a - dayStart) / M)), i1 = Math.min(1440, Math.round((sp.b - dayStart) / M));
      for (let i = i0; i < i1; i++){ lv[i] = l; nm[i] = n; ds[i] = d; }
    };
    const pass = (ok) => { for (const g of inst.segs) if (ok(g.l)) for (const sp of occ(dayStart, g.a, g.b, g.days || WK)) put(sp, g.l, g.n, g.d); };
    pass((l) => l === "warn");
    pass((l) => l === "good" || l === "best");
    pass((l) => l === "stop" || l === "off");
    for (const sp of closedSpans(dayStart)) put(sp, "off", "Đóng cửa cuối tuần", "Thị trường nghỉ từ 17:00 thứ Sáu đến 17:00 Chủ nhật giờ New York.");
    for (const g of groupByTime(evs.filter((e) => !e.allDay && e.impact === "high" && inst.aff(e))))
      put({a: g.t - ZONE, b: g.end + (g.tent ? AFTER_TENT : ZONE)}, "ev", g.label, g.tent
        ? "Tin đỏ dự kiến khoảng " + hm(g.t) + ", giờ chưa cố định. Đứng ngoài đến khi tin ra và nến M15 sau tin đóng cửa."
        : "Tin đỏ lúc " + hm(g.t) + ". Đứng ngoài 15 phút trước và sau tin.");
    const out = [];
    let i0 = 0;
    for (let i = 1; i <= 1440; i++){
      if (i === 1440 || lv[i] !== lv[i0] || nm[i] !== nm[i0]){
        out.push({l: lv[i0], n: nm[i0], d: ds[i0], a: dayStart + i0 * M, b: dayStart + i * M});
        i0 = i;
      }
    }
    return out;
  }
  function winSpans(dayStart, inst){
    const out = [];
    for (const g of inst.segs) if (g.l === "good" || g.l === "best")
      for (const sp of occ(dayStart, g.a, g.b, g.days || WK)) out.push({l: g.l, n: g.n, d: g.d, a: sp.a, b: sp.b, ra: sp.ra, rb: sp.rb});
    return out.sort((x, y) => x.a - y.a);
  }
  const endLabel = (t, s) => (t >= s + DAY ? "24:00" : hm(t));
  function spanText(w, s, long){
    if (w.ra < s) return long ? "00:00–" + hm(w.rb) + " (tiếp từ tối hôm trước)" : "đến " + hm(w.rb);
    if (w.rb > s + DAY) return hm(w.ra) + "–" + hm(w.rb) + (long ? " (sang sáng hôm sau)" : "");
    return hm(w.ra) + "–" + hm(w.rb);
  }
  function ticksFor(dayStart, inst){
    const out = [];
    for (const t of inst.ticks)
      for (const sp of occ(dayStart, [t.k, t.h, t.m], [t.k, t.h, t.m + 1], t.days || WK))
        if (sp.ra >= dayStart && sp.ra < dayStart + DAY) out.push({t: sp.ra, n: t.n, k: t.k, lt: pad(t.h) + ":" + pad(t.m)});
    return out.sort((a, b) => a.t - b.t);
  }
  function mergeRuns(rs){
    const mg = [];
    for (const r of rs){ const p = mg[mg.length - 1]; if (p && p.l === r.l && p.n === r.n && p.b === r.a) p.b = r.b; else mg.push(Object.assign({}, r)); }
    return mg;
  }


  /* =========================================================
     Weekly calendar: data/calendar.json (current week) + data/weeks/<week>.json (archive)
     ========================================================= */
  function decorate(e){
    const tags = new Set([e.ccy]);
    const title = e.title || "";
    if (e.ccy === "USD" && e.impact !== "holiday" && e.impact !== "low" && (e.impact === "high" || GOLD_EN.test(title))) tags.add("XAU");
    if (OIL_RE.test(title)) tags.add("OIL");
    return Object.assign({}, e, {tags, vn: vnTitle(title)});
  }
  function fromDoc(d){
    const out = [];
    const list = d && Array.isArray(d.events) ? d.events : [];
    for (const x of list){
      if (!x || typeof x.t !== "number" || typeof x.title !== "string") continue;
      const ccy = String(x.ccy || "").toUpperCase();
      if (CCYS.indexOf(ccy) < 0) continue;
      const im = String(x.impact || "").toLowerCase();
      const impact = ["high", "medium", "low", "holiday"].indexOf(im) >= 0 ? im : "low";
      out.push(decorate({id: "e" + hash(ccy + "|" + x.title + "|" + x.t), t: x.t, ccy, title: x.title, impact,
        forecast: String(x.forecast || ""), previous: String(x.previous || ""), allDay: !!x.allDay || impact === "holiday", tentative: !!x.tentative}));
    }
    return out.sort((a, b) => a.t - b.t || (b.impact === "high") - (a.impact === "high"));
  }
  const cal = {doc: null, events: [], at: 0, week: "", state: "loading", ver: 0};
  const calSubs = [];
  function weekEnd(week){
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(week || "");
    if (!m) return 0;
    return zonedToUtc(+m[1], +m[2], +m[3] + 7, 12, 0, TZ.N);
  }
  function calFresh(){ return cal.state === "ready" && cal.events.length > 0 && Date.now() < (weekEnd(cal.week) || cal.at + 8 * DAY); }
  async function getJson(path){
    const r = await fetch(path + (path.indexOf("?") < 0 ? "?" : "&") + "v=" + Math.floor(Date.now() / 3e5), {cache: "no-cache"});
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }
  async function loadCal(){
    try {
      const d = await getJson("data/calendar.json");
      const evs = fromDoc(d);
      const changed = !cal.doc || d.at !== cal.at || d.week !== cal.week;
      Object.assign(cal, {doc: d, events: evs, at: typeof d.at === "number" ? d.at : 0, week: d.week || "", state: "ready"});
      if (changed){ cal.ver++; stCache = {}; calSubs.forEach((fn) => fn(cal)); }
    } catch (e){
      if (cal.state !== "ready"){ cal.state = "error"; cal.ver++; calSubs.forEach((fn) => fn(cal)); }
    }
  }
  function onCal(fn){ calSubs.push(fn); if (cal.state !== "loading") fn(cal); }
  const weekCache = {};
  async function loadWeek(week){
    if (weekCache[week]) return weekCache[week];
    const d = await getJson("data/weeks/" + week + ".json");
    return (weekCache[week] = {week: d.week || week, at: d.at || 0, events: fromDoc(d)});
  }
  async function loadWeekIndex(){
    try { const d = await getJson("data/weeks/index.json"); return Array.isArray(d) ? d.filter((w) => /^\d{4}-\d{2}-\d{2}$/.test(w)).sort().reverse() : []; }
    catch { return []; }
  }

  /* =========================================================
     Focus instrument status (header chip)
     ========================================================= */
  let focus = LS.get("focus", "XAU");
  if (!INSTR.some((x) => x.id === focus)) focus = "XAU";
  let stCache = {};
  function focusStatus(now){
    const m = Math.floor(now / M);
    if (stCache.m === m && stCache.focus === focus && stCache.ev === cal.ver) return stCache;
    const inst = INSTR.find((x) => x.id === focus) || INSTR[0];
    const s0 = vnStart(now);
    let rs = [];
    for (const k of [-1, 0, 1, 2]) rs = rs.concat(paint(s0 + k * DAY, inst, cal.events));
    const mg = mergeRuns(rs);
    let i = mg.findIndex((r) => now >= r.a && now < r.b);
    if (i < 0) i = 0;
    const cur = mg[i];
    let j = i + 1;
    while (j < mg.length && mg[j].l === cur.l) j++;
    stCache = {m, focus, ev: cal.ver, inst, cur, nxt: mg[j] || null};
    return stCache;
  }
  const focusSubs = [];
  function setFocus(id){
    if (!INSTR.some((x) => x.id === id)) return;
    focus = id; LS.set("focus", id); stCache = {};
    const sel = $("focus"); if (sel) sel.value = id;
    renderHeader(Date.now());
    focusSubs.forEach((fn) => fn(id));
  }

  /* =========================================================
     Header, footer, live ticker
     ========================================================= */
  const PAGES = [["lich", "./", "Lịch tin"], ["thi-truong", "thi-truong.html", "Thị trường"], ["gio", "gio-giao-dich.html", "Giờ giao dịch"], ["tin", "tin-tuc.html", "Tin tức"]];
  const LOGO = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#12161c"/><circle cx="16" cy="16" r="9.5" fill="none" stroke="#f5a524" stroke-width="3" stroke-linecap="round" stroke-dasharray="44 15.7" transform="rotate(3 16 16)"/><circle cx="16" cy="16" r="2.6" fill="#f5a524"/></svg>';
  function buildHeader(){
    const page = document.body.getAttribute("data-page") || "";
    const top = $("top");
    if (!top) return;
    top.innerHTML = '<div class="tb"><a class="brand" href="./" aria-label="Aporia, về trang lịch tin">' + LOGO + '<span class="wm">APORIA</span></a>'
      + '<nav class="nav" aria-label="Mục chính">' + PAGES.map(([k, href, name]) => '<a href="' + href + '"' + (k === page ? ' aria-current="page"' : "") + ">" + name + "</a>").join("") + "</nav>"
      + '<div class="spacer"></div><div class="clocks" id="wcs" aria-label="Giờ các thị trường"></div>'
      + '<div class="clock"><span class="t" id="clk">--:--:--</span><span class="d" id="clkd">giờ Việt Nam</span></div></div>'
      + '<div class="sb2"><div class="status" id="st" title="Khung giờ giao dịch của mã đang theo dõi"><span class="dot"></span><select class="sel" id="focus" aria-label="Mã theo dõi"></select><span class="lab" id="stLab">—</span><span class="cd" id="stCd"></span></div><div class="nxt" id="nxt"></div></div>';
    const sel = $("focus");
    sel.innerHTML = INSTR.map((x) => '<option value="' + x.id + '">' + x.code + "</option>").join("");
    sel.value = focus;
    sel.addEventListener("change", () => setFocus(sel.value));
    if ("ResizeObserver" in window){
      new ResizeObserver(() => {
        const sticky = getComputedStyle(top).position === "sticky";
        document.documentElement.style.setProperty("--hdr", sticky ? top.offsetHeight + "px" : "0px");
      }).observe(top);
    }
  }
  function renderHeader(now){
    if (!$("clk")) return;
    const p = vn(now);
    $("clk").textContent = pad(p.h) + ":" + pad(p.mi) + ":" + pad(p.s);
    $("clkd").textContent = dayLabel(now) + "/" + p.y + " · giờ VN";
    const open = fxOpen(now);
    $("wcs").innerHTML = [["S", "SYD"], ["T", "TYO"], ["L", "LDN"], ["N", "NY"]].map(([k, lab]) => {
      const S = SESS.find((x) => x.k === k), q = zoneParts(now, TZ[k]);
      const on = open && q.wd !== "Sat" && q.wd !== "Sun" && q.h >= S.o && q.h < S.c;
      return '<span class="wc' + (on ? " on" : "") + '" title="' + S.name + " · " + tzAbbr(k, now) + (on ? " · phiên đang mở" : " · phiên đang đóng") + '"><b>' + lab + "</b>" + pad(q.h) + ":" + pad(q.mi) + "</span>";
    }).join("");
    const st = focusStatus(now);
    $("st").className = "status k-" + LV[st.cur.l].k;
    $("stLab").textContent = LV[st.cur.l].name + " · " + st.cur.n;
    $("stCd").textContent = st.nxt ? "→ " + hm(st.nxt.a) + " · còn " + dur(st.nxt.a - now) : "";
    const nx = cal.events.find((e) => !e.allDay && e.impact === "high" && e.t + (e.tentative ? AFTER_TENT : ZONE) > now);
    const el = $("nxt");
    if (cal.state === "loading") el.textContent = "";
    else if (!nx) el.innerHTML = '<span>Không còn tin đỏ trong lịch tuần này.</span>';
    else {
      const d = nx.t - now, live = d <= ZONE;
      el.innerHTML = '<span class="ib high"><i></i><i></i><i></i></span><span class="ttl">' + (live ? '<b style="color:var(--stop)">Vùng cấm tin đỏ</b> · ' : "Tin đỏ tiếp theo: ") + "<b>" + hm(nx.t) + (dayKey(nx.t) !== dayKey(now) ? " " + dayLabel(nx.t) : "") + " · " + nx.ccy + "</b> " + esc(nx.vn || nx.title) + "</span>"
        + '<span class="mono" style="white-space:nowrap">' + (d > 0 ? "còn " + dur(d) : "đang diễn ra") + "</span>";
    }
  }
  function buildFooter(){
    const f = $("foot");
    if (!f) return;
    f.innerHTML = "<div>Aporia · Lịch tin: dữ liệu tuần của <a href=\"https://www.forexfactory.com/calendar\" target=\"_blank\" rel=\"noopener\">Forex Factory</a>, tự cập nhật mỗi giờ. Giá, biểu đồ và tin tức: <a href=\"https://www.tradingview.com/\" target=\"_blank\" rel=\"noopener nofollow\">TradingView</a>. Mọi giờ hiển thị theo giờ Việt Nam (GMT+7) và tự đổi khi các thị trường chuyển giờ mùa hè/đông.</div>"
      + "<div>Thông tin chỉ để tham khảo, không phải khuyến nghị đầu tư. Khung giờ kiến nghị là giả thuyết xuất phát, hãy kiểm chứng bằng nhật ký giao dịch của chính bạn.</div>";
  }
  /* TradingView widgets: free embeds, loaded from s3.tradingview.com. */
  function tv(box, name, config, opts){
    if (!box) return;
    opts = opts || {};
    box.innerHTML = "";
    const ph = document.createElement("div");
    ph.className = "tv-ph";
    ph.textContent = "Đang tải dữ liệu TradingView…";
    const wrap = document.createElement("div");
    wrap.className = "tradingview-widget-container";
    if (opts.height) wrap.style.height = opts.height;
    const inner = document.createElement("div");
    inner.className = "tradingview-widget-container__widget";
    if (opts.height) inner.style.height = "calc(100% - 24px)";
    wrap.appendChild(inner);
    const cp = document.createElement("div");
    cp.className = "tradingview-widget-copyright";
    cp.innerHTML = '<a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank">Dữ liệu: TradingView</a>';
    wrap.appendChild(cp);
    box.appendChild(ph);
    box.appendChild(wrap);
    const fail = (msg) => { ph.className = "tv-ph err"; ph.textContent = msg; };
    const s = document.createElement("script");
    s.type = "text/javascript";
    s.async = true;
    s.src = "https://s3.tradingview.com/external-embedding/embed-widget-" + name + ".js";
    s.text = JSON.stringify(config);
    s.onerror = () => fail("Không tải được TradingView. Kiểm tra mạng, hoặc tắt trình chặn quảng cáo cho trang này.");
    const obs = new MutationObserver(() => { if (wrap.querySelector("iframe")){ ph.remove(); obs.disconnect(); } });
    obs.observe(wrap, {childList: true, subtree: true});
    setTimeout(() => { if (ph.isConnected && !wrap.querySelector("iframe") && !ph.classList.contains("err")) fail("TradingView chưa phản hồi. Tải lại trang để thử lại."); }, 20000);
    wrap.appendChild(s);
  }
  const TV_SYMS = [
    {id: "XAU", tv: "OANDA:XAUUSD", name: "Vàng", code: "XAUUSD"},
    {id: "EUR", tv: "OANDA:EURUSD", name: "EUR/USD", code: "EURUSD"},
    {id: "GBP", tv: "OANDA:GBPUSD", name: "GBP/USD", code: "GBPUSD"},
    {id: "JPY", tv: "OANDA:USDJPY", name: "USD/JPY", code: "USDJPY"},
    {id: "AUD", tv: "OANDA:AUDUSD", name: "AUD/USD", code: "AUDUSD"},
    {id: "WTI", tv: "TVC:USOIL", name: "Dầu WTI", code: "WTI"},
    {id: "BRENT", tv: "TVC:UKOIL", name: "Dầu Brent", code: "BRENT"},
    {id: "DXY", tv: "TVC:DXY", name: "Chỉ số USD", code: "DXY"},
    {id: "US10Y", tv: "TVC:US10Y", name: "Lợi suất Mỹ 10 năm", code: "US10Y"}
  ];
  function buildTicker(){
    const box = $("ticker");
    if (!box) return;
    tv(box, "ticker-tape", {symbols: TV_SYMS.map((s) => ({proName: s.tv, title: s.code})), showSymbolLogo: true, isTransparent: true, displayMode: "adaptive", colorTheme: "dark", locale: "vi_VN"});
  }

  /* =========================================================
     Boot shared parts; pages add their own renderers through AP.onTick / AP.onCal
     ========================================================= */
  const tickSubs = [];
  let lastMin = -1;
  function tick(){
    const now = Date.now();
    renderHeader(now);
    const m = Math.floor(now / M);
    if (m !== lastMin){
      const dayChanged = lastMin >= 0 && dayKey(now) !== dayKey(lastMin * M);
      lastMin = m;
      tickSubs.forEach((fn) => fn(now, dayChanged));
    }
  }
  buildHeader();
  buildFooter();
  buildTicker();
  renderHeader(Date.now());
  setInterval(tick, 1000);
  loadCal();
  setInterval(loadCal, 20 * M);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible"){ loadCal(); tick(); } });
  onCal(() => { stCache = {}; renderHeader(Date.now()); });

  window.AP = {
    M, H, DAY, VN, ZONE, AFTER_TENT, $, esc, LS, zoneParts, tzOffset, zonedToUtc, vn, pad, hm, vnStart, dayKey, WD, dayLabel, ddmm, addDays, dur,
    TZ, ZNAME, WK, atLocal, localHM, tzAbbr, utcLabel, occ, closedSpans, fxOpen, nyseOpen, SESS, sessSpans,
    GEN, INSTR, LV, CCYS, CCY_LABEL, vnTitle, groupByTime, paint, winSpans, endLabel, spanText, ticksFor, mergeRuns,
    cal, calFresh, weekEnd, onCal, loadCal, loadWeek, loadWeekIndex,
    focusId: () => focus, setFocus, onFocus: (fn) => focusSubs.push(fn), focusStatus,
    onTick: (fn) => tickSubs.push(fn), tv, TV_SYMS
  };
})();
