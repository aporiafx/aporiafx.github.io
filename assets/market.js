/* Aporia — market page: TradingView chart with EMA34/89, quotes board, and the next releases from the weekly calendar. */
(() => {
  "use strict";
  const {$, esc, LS, hm, dayKey, dur, ZONE, AFTER_TENT, TV_SYMS} = AP;
  const SD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const IVS = [["5", "M5"], ["15", "M15"], ["60", "H1"], ["240", "H4"], ["D", "D1"]];
  let sym = TV_SYMS.some((s) => s.id === LS.get("mk.sym", "")) ? LS.get("mk.sym", "") : "XAU";
  let iv = IVS.some((x) => x[0] === LS.get("mk.iv", "")) ? LS.get("mk.iv", "") : "D";

  function renderButtons(){
    $("syms").innerHTML = TV_SYMS.map((s) => '<button type="button" class="chip" data-s="' + s.id + '" aria-pressed="' + (s.id === sym) + '" title="' + esc(s.name) + '">' + s.code + "</button>").join("")
      + '<span style="flex:1"></span>' + IVS.map(([v, n]) => '<button type="button" class="chip" data-iv="' + v + '" aria-pressed="' + (v === iv) + '">' + n + "</button>").join("");
  }
  function renderChart(){
    const s = TV_SYMS.find((x) => x.id === sym) || TV_SYMS[0];
    $("chartTitle").textContent = s.name + " · " + s.code;
    AP.tv($("chart"), "advanced-chart", {
      autosize: true,
      symbol: s.tv,
      interval: iv,
      timezone: "Asia/Ho_Chi_Minh",
      theme: "dark",
      style: "1",
      locale: "vi_VN",
      backgroundColor: "rgba(15, 19, 24, 1)",
      gridColor: "rgba(34, 41, 50, 0.6)",
      hide_volume: true,
      allow_symbol_change: true,
      calendar: false,
      studies: [
        {id: "MAExp@tv-basicstudies", inputs: {length: 34}},
        {id: "MAExp@tv-basicstudies", inputs: {length: 89}}
      ],
      support_host: "https://www.tradingview.com"
    }, {height: "100%"});
  }
  $("syms").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.s){ sym = b.dataset.s; LS.set("mk.sym", sym); const f = {XAU: "XAU", EUR: "EUR", GBP: "GBP", JPY: "JPY", AUD: "AUD", WTI: "OIL", BRENT: "OIL"}[sym]; if (f) AP.setFocus(f); }
    if (b.dataset.iv){ iv = b.dataset.iv; LS.set("mk.iv", iv); }
    renderButtons(); renderChart();
  });

  function renderQuotes(){
    AP.tv($("quotes"), "market-quotes", {
      width: "100%", height: "100%",
      symbolsGroups: [
        {name: "Kim loại và dầu", symbols: [{name: "OANDA:XAUUSD", displayName: "Vàng (XAUUSD)"}, {name: "OANDA:XAGUSD", displayName: "Bạc (XAGUSD)"}, {name: "TVC:USOIL", displayName: "Dầu WTI"}, {name: "TVC:UKOIL", displayName: "Dầu Brent"}]},
        {name: "Forex", symbols: [{name: "OANDA:EURUSD", displayName: "EUR/USD"}, {name: "OANDA:GBPUSD", displayName: "GBP/USD"}, {name: "OANDA:USDJPY", displayName: "USD/JPY"}, {name: "OANDA:AUDUSD", displayName: "AUD/USD"}]},
        {name: "USD và lợi suất", symbols: [{name: "TVC:DXY", displayName: "Chỉ số USD (DXY)"}, {name: "TVC:US10Y", displayName: "Lợi suất Mỹ 10 năm"}, {name: "TVC:US02Y", displayName: "Lợi suất Mỹ 2 năm"}]}
      ],
      showSymbolLogo: true, isTransparent: true, colorTheme: "dark", locale: "vi_VN"
    }, {height: "100%"});
  }

  /* Next red/orange releases from the weekly calendar, so the chart and the news risk sit side by side. */
  function renderUpcoming(){
    const box = $("upc");
    const c = AP.cal;
    if (c.state === "loading"){ box.innerHTML = '<div class="empty">Đang tải lịch…</div>'; return; }
    if (c.state === "error"){ box.innerHTML = '<div class="empty">Không tải được lịch tin.</div>'; return; }
    const now = Date.now();
    const list = c.events.filter((e) => !e.allDay && (e.impact === "high" || e.impact === "medium") && e.t + (e.tentative && e.impact === "high" ? AFTER_TENT : ZONE) > now).slice(0, 10);
    if (!list.length){ box.innerHTML = '<div class="empty">Không còn tin đỏ, cam nào trong lịch tuần này.</div>'; return; }
    box.innerHTML = '<ul class="uplist">' + list.map((e) => {
      const d = e.t - now;
      return '<li><span class="tm">' + (e.tentative ? "~" : "") + hm(e.t) + '<span class="left">' + (dayKey(e.t) !== dayKey(now) ? SD[AP.vn(e.t).wd] + " " + AP.ddmm(e.t) : d > 0 ? "còn " + dur(d) : "đang ra") + "</span></span>"
        + '<span class="ib ' + e.impact + '"><i></i><i></i><i></i></span><span class="ccy">' + e.ccy + "</span><span>" + esc(e.vn || e.title)
        + (e.tags.has("XAU") ? '<span class="bdg au">VÀNG</span>' : "") + (e.tags.has("OIL") ? '<span class="bdg oil">DẦU</span>' : "") + "</span></li>";
    }).join("") + "</ul>";
  }

  renderButtons();
  renderChart();
  renderQuotes();
  AP.onCal(renderUpcoming);
  AP.onTick(renderUpcoming);
})();
