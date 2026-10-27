/* Aporia — news page: TradingView headline feeds for forex, gold and oil, plus the sources traders check first. */
(() => {
  "use strict";
  const {$} = AP;
  const feed = (id, cfg) => AP.tv($(id), "timeline", Object.assign({isTransparent: true, displayMode: "regular", width: "100%", height: "100%", colorTheme: "dark", locale: "vi_VN"}, cfg), {height: "100%"});
  feed("nFx", {feedMode: "market", market: "forex"});
  feed("nGold", {feedMode: "symbol", symbol: "OANDA:XAUUSD"});
  feed("nOil", {feedMode: "symbol", symbol: "TVC:USOIL"});

  const SRC = [
    ["Tin nóng", [["investingLive", "https://investinglive.com/", "tin FX nhanh"], ["FinancialJuice", "https://www.financialjuice.com/", "tin dạng squawk"], ["Reuters Markets", "https://www.reuters.com/markets/", "xác nhận tin"]]],
    ["Lịch và lãi suất", [["Forex Factory", "https://www.forexfactory.com/calendar", "lịch kinh tế"], ["CME FedWatch", "https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html", "kỳ vọng Fed"], ["ASX RBA Rate Tracker", "https://www.asx.com.au/markets/trade-our-derivatives-market/futures-market/rba-rate-tracker", "kỳ vọng RBA"]]],
    ["Phân tích", [["ING Think", "https://think.ing.com/", "FX Daily, hàng hoá"], ["TradingView", "https://www.tradingview.com/chart/", "biểu đồ"], ["FRED", "https://fred.stlouisfed.org/", "lợi suất, DXY"]]],
    ["Vàng", [["World Gold Council", "https://www.gold.org/goldhub", "ETF, NHTW mua vàng"], ["CFTC COT", "https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm", "vị thế quỹ"]]],
    ["Dầu", [["EIA tồn kho tuần", "https://www.eia.gov/petroleum/supply/weekly/", "thứ Tư"], ["OPEC", "https://www.opec.org/", "báo cáo tháng"]]],
    ["USD", [["Federal Reserve", "https://www.federalreserve.gov/", "Fed"], ["BLS", "https://www.bls.gov/", "CPI, việc làm"]]],
    ["EUR", [["ECB", "https://www.ecb.europa.eu/", "lãi suất"], ["Eurostat", "https://ec.europa.eu/eurostat", "CPI khối euro"], ["Destatis", "https://www.destatis.de/EN/", "dữ liệu Đức"]]],
    ["GBP", [["Bank of England", "https://www.bankofengland.co.uk/", "lãi suất"], ["ONS", "https://www.ons.gov.uk/", "CPI, lương"]]],
    ["JPY", [["Bank of Japan", "https://www.boj.or.jp/en/", "lãi suất"], ["Bộ Tài chính Nhật", "https://www.mof.go.jp/english/", "can thiệp tỷ giá"]]],
    ["AUD", [["RBA", "https://www.rba.gov.au/", "lãi suất"], ["ABS", "https://www.abs.gov.au/", "CPI tháng"]]]
  ];
  $("src").innerHTML = SRC.map(([h, list]) => "<div><h3>" + h + "</h3><ul>" + list.map(([n, u, d]) => '<li><a href="' + u + '" target="_blank" rel="noopener">' + n + "</a><span>" + d + "</span></li>").join("") + "</ul></div>").join("");
})();
