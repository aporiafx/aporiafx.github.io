/* Aporia — trading-hours page: session map, per-instrument advice and red-news zones from the weekly calendar. */
(() => {
  "use strict";
  const {M, H, DAY, ZONE, AFTER_TENT, $, esc, vn, pad, hm, vnStart, dayKey, dayLabel, ddmm, dur, TZ, ZNAME, tzOffset, tzAbbr, utcLabel, localHM,
    fxOpen, SESS, sessSpans, closedSpans, GEN, INSTR, LV, groupByTime, paint, winSpans, endLabel, spanText, ticksFor} = AP;
  /* =========================================================
     Trading-hours map
     ========================================================= */
  let viewOff = 0, lastRecs = [];
  const viewStart = () => vnStart(Date.now()) + viewOff * DAY;
  function bedWidth(){
    const el = $("map");
    const labw = parseFloat(getComputedStyle(el).getPropertyValue("--labw")) || 168;
    return Math.max(120, el.clientWidth - 24 - labw - 10);
  }
  function renderOpen(now){
    const s = vnStart(now), open = fxOpen(now);
    const live = (S) => open && sessSpans(s, S).concat(sessSpans(s - DAY, S)).some((x) => now >= x.ra && now < x.rb);
    let tags = SESS.map((S) => '<span class="tag' + (live(S) ? " on" : "") + '">' + S.name + (live(S) ? " · đang mở" : "") + "</span>").join("");
    if (live(SESS[2]) && live(SESS[3])) tags += '<span class="tag on">Giao thoa London – New York</span>';
    if (!open) tags += '<span class="tag">FX đóng cửa cuối tuần</span>';
    $("openTags").innerHTML = tags;
    $("dst").innerHTML = dstHtml(now);
  }
  let dstCache = {day: "", html: ""};
  function nextChange(k, from){
    const tz = TZ[k], o0 = tzOffset(from, tz);
    for (let i = 1; i <= 400; i++){
      const t = from + i * DAY;
      if (tzOffset(t, tz) !== o0){
        let lo = t - DAY, hi = t;
        while (hi - lo > M){ const mid = Math.floor((lo + hi) / 2); if (tzOffset(mid, tz) === o0) lo = mid; else hi = mid; }
        return {t: hi, o0, o1: tzOffset(hi, tz)};
      }
    }
    return null;
  }
  function dstHtml(now){
    const key = dayKey(now);
    if (dstCache.day === key) return dstCache.html;
    const season = (k, t) => {
      const o = Math.round(tzOffset(t, TZ[k]) / H);
      if (k === "L") return o === 1 ? "giờ mùa hè" : "giờ mùa đông";
      if (k === "N") return o === -4 ? "giờ mùa hè" : "giờ mùa đông";
      if (k === "S") return o === 11 ? "giờ mùa hè Úc" : "giờ mùa đông Úc";
      return "không đổi giờ";
    };
    let html = "<div>" + ["L", "N", "S", "T"].map((k) => "<b>" + ZNAME[k] + "</b> " + tzAbbr(k, now) + " (" + utcLabel(k, now) + ", " + season(k, now) + ")").join(" · ") + "</div>";
    const ch = ["L", "N", "S"].map((k) => ({k, c: nextChange(k, now)})).filter((x) => x.c).sort((a, b) => a.c.t - b.c.t)[0];
    if (ch){
      const later = ch.c.o1 < ch.c.o0;
      const what = {L: "giờ mở cửa London và dữ liệu Anh", N: "giờ mở cửa Mỹ, tin 8:30, Fed", S: "phiên Sydney và dữ liệu Úc"}[ch.k];
      html += '<div class="chg">Đổi giờ tới: ' + ZNAME[ch.k] + " sang " + tzAbbr(ch.k, ch.c.t + H) + " ngày " + ddmm(ch.c.t) + " → " + what + " " + (later ? "muộn hơn" : "sớm hơn") + " 1 giờ theo giờ VN. Bản đồ tự cập nhật.</div>";
    }
    dstCache = {day: key, html};
    return html;
  }

  function renderMap(){
    const s = viewStart(), now = Date.now(), isToday = viewOff === 0, W = bedWidth(), evs = AP.cal.events;
    const pct = (t) => ((t - s) / DAY * 100).toFixed(3);
    const wpct = (a, b) => Math.max(0.15, (b - a) / DAY * 100).toFixed(3);
    const fits = (txt, a, b) => txt && (b - a) / DAY * W >= txt.length * 6.4 + 10;
    const sg = (a, b, cls, txt, title) => '<div class="sg ' + cls + '" style="left:' + pct(a) + "%;width:" + wpct(a, b) + '%" title="' + esc(title) + '">' + (fits(txt, a, b) ? esc(txt) : "") + "</div>";
    const nl = isToday ? '<div class="nl" style="left:' + pct(now) + '%"></div>' : "";
    const row = (lab, bed, slim) => '<div class="mrow"><div class="mlab">' + lab + '</div><div class="mbed' + (slim ? " slim" : "") + '">' + bed + nl + "</div></div>";
    const closed = closedSpans(s);
    let html = "";

    let ax = "";
    for (let h = 0; h <= 24; h += 3) ax += '<span class="' + (h === 0 ? "a0" : h === 24 ? "a24" : (h % 6 ? "t3" : "")) + '" style="left:' + (h / 24 * 100) + '%">' + pad(h) + ":00</span>";
    html += '<div class="mrow"><div class="mlab"><small>Giờ VN</small></div><div class="axis">' + ax + "</div></div>";

    html += '<div class="mgrp">Phiên thị trường</div>';
    const spansBy = {};
    for (const S of SESS){
      const sp = sessSpans(s, S);
      spansBy[S.k] = sp;
      let bed = sp.map((x) => {
        const live = isToday && now >= x.ra && now < x.rb && fxOpen(now);
        const title = S.name + " " + pad(S.o) + ":00–" + pad(S.c) + ":00 giờ địa phương (" + tzAbbr(S.k, x.ra) + ") = " + hm(x.ra) + "–" + hm(x.rb) + " giờ VN" + (vn(x.rb).d !== vn(x.ra).d ? " (hôm sau)" : "");
        return sg(x.a, x.b, "sess" + (live ? " live" : ""), hm(x.a) + "–" + endLabel(x.b, s), title);
      }).join("");
      bed += closed.map((c) => sg(c.a, c.b, "l-off", "", "Thị trường đóng cửa cuối tuần")).join("");
      html += row("<b>" + S.name + "</b><small>" + pad(S.o) + "–" + pad(S.c) + " " + tzAbbr(S.k, s + 12 * H) + "</small>", bed, true);
    }
    const OL = [["S", "T", "Sydney – Tokyo"], ["T", "L", "Tokyo – London"], ["L", "N", "London – New York", true]];
    let olBed = "";
    for (const [x, y, name, main] of OL){
      const seen = {};
      for (const p of spansBy[x]) for (const q of spansBy[y]){
        const a = Math.max(p.ra, q.ra), b = Math.min(p.rb, q.rb);
        if (b <= a || seen[a]) continue;
        seen[a] = 1;
        const ca = Math.max(a, s), cb = Math.min(b, s + DAY);
        if (cb > ca) olBed += sg(ca, cb, "ol" + (main ? " main" : ""), name, "Giao thoa " + name + ": " + hm(a) + "–" + hm(b) + " giờ VN" + (main ? " · thanh khoản cao nhất trong ngày" : ""));
      }
    }
    html += row("<b>Giao thoa</b><small>thanh khoản dồn lại</small>", olBed, true);

    html += '<div class="mgrp">Kiến nghị theo mã</div>';
    const recs = [];
    for (const inst of INSTR){
      const runs = paint(s, inst, evs), tk = ticksFor(s, inst), wins = winSpans(s, inst);
      recs.push({inst, runs, tk, wins});
      let bed = sg(s, s + DAY, "l-warn", "", GEN.n + ": " + GEN.d);
      for (const r of runs) if (r.l === "warn" && r.n !== GEN.n) bed += sg(r.a, r.b, "l-warn", "", hm(r.a) + "–" + endLabel(r.b, s) + " · Hạn chế · " + r.n + ": " + r.d);
      bed += wins.map((w) => sg(w.a, w.b, "l-" + w.l, "", spanText(w, s, true) + " · " + LV[w.l].name + " · " + w.n + ": " + w.d)).join("");
      const ovs = runs.filter((r) => r.l === "stop" || r.l === "off" || r.l === "ev");
      bed += ovs.map((r) => sg(r.a, r.b, "l-" + r.l + " ov", "", hm(r.a) + "–" + endLabel(r.b, s) + " · " + LV[r.l].name + " · " + r.n + ": " + r.d)).join("");
      bed += wins.map((w) => {
        const tm = spanText(w, s, false), full = w.n + " · " + tm;
        const txt = fits(full, w.a, w.b) ? full : fits(tm, w.a, w.b) ? tm : "";
        return txt ? '<div class="sgt" style="left:' + pct(w.a) + "%;width:" + wpct(w.a, w.b) + '%">' + esc(txt) + "</div>" : "";
      }).join("");
      bed += tk.map((x) => '<div class="mk" style="left:' + pct(x.t) + '%" title="' + esc(hm(x.t) + " · " + x.n + " (" + x.lt + " giờ " + ZNAME[x.k] + ")") + '"></div>').join("");
      for (const e of evs) if (!e.allDay && e.impact === "medium" && inst.aff(e) && e.t >= s && e.t < s + DAY)
        bed += sg(e.t - 3 * M, e.t + 3 * M, "evm ov", "", "Tin cam " + e.ccy + " lúc " + hm(e.t) + ": " + (e.vn || e.title));
      let dot = "";
      if (isToday){
        const cur = runs.find((r) => now >= r.a && now < r.b);
        if (cur) dot = '<span class="ld ' + cur.l + '" title="Lúc này: ' + LV[cur.l].name + " · " + esc(cur.n) + '"></span>';
      }
      const best = wins.find((w) => w.l === "best" && w.ra >= s) || wins.find((w) => w.l === "best");
      html += row("<b>" + dot + inst.code + "</b>" + (best ? '<small class="best">Tốt nhất ' + spanText(best, s, false) + "</small>" : "<small>Thị trường nghỉ</small>"), bed);
    }

    html += '<div class="mgrp">Tin trong lịch</div>';
    let evBed = "";
    const dayEvs = evs.filter((e) => !e.allDay && (e.impact === "high" || e.impact === "medium") && e.t >= s - ZONE && e.t <= s + DAY + ZONE);
    const nEv = dayEvs.filter((e) => e.t >= s && e.t < s + DAY).length;
    const grp = groupByTime(dayEvs);
    for (const g of grp.filter((x) => !x.high).concat(grp.filter((x) => x.high))){
      const a = Math.max(s, g.t - (g.high ? ZONE : 3 * M)), b = Math.min(s + DAY, g.end + (g.tent ? AFTER_TENT : g.high ? ZONE : 3 * M));
      if (b > a) evBed += sg(a, b, g.high ? "l-ev" : "evm", g.ccys.join("/"), hm(g.t) + " · " + g.label + (g.tent ? " · tin đỏ, giờ dự kiến" : g.high ? " · có tin đỏ" : " · tin cam"));
    }
    html += row("<b>Tin</b><small>" + (nEv ? nEv + " tin đỏ/cam trong ngày" : "không có tin đỏ/cam") + "</small>", evBed, true);
    $("map").innerHTML = html;
    $("dLab").textContent = isToday ? "Hôm nay · " + ddmm(s) : dayLabel(s);
    lastRecs = recs;
    renderRecs(s, recs);
  }
  $("dPrev").addEventListener("click", () => { viewOff = Math.max(-7, viewOff - 1); renderMap(); });
  $("dNext").addEventListener("click", () => { viewOff = Math.min(14, viewOff + 1); renderMap(); });
  $("dToday").addEventListener("click", () => { viewOff = 0; renderMap(); });

  /* Crosshair: hover the map to read any minute in every market's local time. */
  const hover = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (hover){
    const wrap = $("mapwrap");
    wrap.addEventListener("pointermove", (ev) => {
      const beds = wrap.querySelectorAll(".mbed");
      if (!beds.length) return;
      const r0 = beds[0].getBoundingClientRect(), rl = beds[beds.length - 1].getBoundingClientRect(), rw = wrap.getBoundingClientRect();
      const x = ev.clientX - r0.left;
      if (x < 0 || x > r0.width || ev.clientY < r0.top - 26 || ev.clientY > rl.bottom){ $("xh").hidden = true; $("xr").hidden = true; return; }
      const t = viewStart() + x / r0.width * DAY;
      const lx = r0.left - rw.left + x;
      const xh = $("xh"), xr = $("xr");
      xh.hidden = false; xr.hidden = false;
      xh.style.left = lx + "px"; xh.style.top = (r0.top - rw.top) + "px"; xh.style.height = (rl.bottom - r0.top) + "px";
      const inst = INSTR.find((i) => i.id === AP.focusId()) || INSTR[0];
      const rec = lastRecs.find((r) => r.inst === inst);
      const run = rec && rec.runs.find((r) => t >= r.a && t < r.b);
      xr.innerHTML = "<b>" + hm(t) + "</b> VN <small>· SYD " + localHM("S", t) + " · TYO " + localHM("T", t) + " · LDN " + localHM("L", t) + " · NY " + localHM("N", t) + "</small>" + (run ? " <small>·</small> " + inst.code + ": " + esc(LV[run.l].name) : "");
      const half = xr.offsetWidth / 2;
      xr.style.left = Math.max(half + 4, Math.min(rw.width - half - 4, lx)) + "px";
      xr.style.top = Math.max(0, r0.top - rw.top - 30) + "px";
    });
    wrap.addEventListener("pointerleave", () => { $("xh").hidden = true; $("xr").hidden = true; });
  }

  function avoidList(runs){
    const out = [];
    for (const r of runs){
      if (r.l !== "stop" && r.l !== "off" && r.l !== "ev") continue;
      const p = out[out.length - 1];
      if (p && p.n === r.n && p.b === r.a){ p.b = r.b; continue; }
      out.push(Object.assign({}, r));
    }
    return out;
  }
  function renderRecs(s, recs){
    $("knTitle").textContent = "Kiến nghị giờ giao dịch · " + dayLabel(s) + " · giờ VN";
    const list = (items, empty) => items.length ? "<ul>" + items.join("") + "</ul>" : '<span class="none">' + (empty || "—") + "</span>";
    const span = (r) => hm(r.a) + "–" + endLabel(r.b, s);
    const key = (r) => r.n + "|" + r.a + "|" + r.b;
    const avoids = recs.map((r) => avoidList(r.runs));
    const common = avoids[0].filter((x) => avoids.every((l) => l.some((y) => key(y) === key(x))));
    const ck = {};
    common.forEach((x) => (ck[key(x)] = 1));
    const box = $("common");
    if (common.length){
      box.hidden = false;
      box.innerHTML = "<h3>Nên tránh với mọi mã · " + dayLabel(s) + "</h3><ul>" + common.map((r) => '<li><span class="tm' + (r.l === "off" ? " off" : "") + '">' + span(r) + "</span>" + esc(r.n) + '<span class="ds">' + esc(r.d) + "</span></li>").join("") + "</ul>";
    } else box.hidden = true;
    const rows = recs.map(({inst, tk, wins}, i) => {
      const wli = (w) => {
        const tm = w.ra < s ? "00:00–" + hm(w.rb) : hm(w.ra) + "–" + hm(w.rb);
        const note = w.ra < s ? "tiếp từ tối hôm trước" : w.rb > s + DAY ? "kéo sang sáng hôm sau" : "";
        return '<li><span class="tm ' + w.l + '">' + tm + '</span><span class="nm">' + esc(w.n) + "</span>" + (note ? '<span class="ds">(' + note + ")</span>" : "") + '<span class="ds">' + esc(w.d) + "</span></li>";
      };
      const best = wins.filter((w) => w.l === "best").map(wli);
      const good = wins.filter((w) => w.l === "good").map(wli);
      const own = avoids[i].filter((r) => !ck[key(r)]);
      const av = own.map((r) => '<li><span class="tm ' + r.l + '">' + span(r) + '</span><span class="nm">' + esc(r.n) + '</span><span class="ds">' + esc(r.d) + "</span></li>");
      const ticks = tk.map((x) => '<li><span class="tm tick">' + hm(x.t) + '</span><span class="nm">' + esc(x.n) + '</span><span class="ds">' + x.lt + " giờ " + ZNAME[x.k] + "</span></li>");
      return '<tr><td class="code"><b>' + inst.code + "</b><small>" + esc(inst.name) + '</small></td><td data-l="Khung tốt nhất">' + list(best, "Không có trong ngày") + '</td><td data-l="Khung tốt">' + list(good, "Không có trong ngày") + '</td><td data-l="Nên tránh thêm">' + list(av, common.length ? "Chỉ các khung chung ở trên" : "—") + '</td><td data-l="Giờ ra tin thường lệ">' + list(ticks, "Không có trong ngày") + '</td><td data-l="Động lực giá và lưu ý"><span class="drv">' + esc(inst.drivers) + '</span><span class="tip">' + esc(inst.tip) + "</span></td></tr>";
    }).join("");
    $("rtWrap").innerHTML = '<table class="rt"><colgroup><col class="c0"><col class="c1"><col class="c2"><col class="c3"><col class="c4"><col></colgroup><thead><tr><th scope="col">Mã</th><th scope="col">Khung tốt nhất</th><th scope="col">Khung tốt</th><th scope="col">Nên tránh thêm</th><th scope="col">Giờ ra tin thường lệ</th><th scope="col">Động lực giá và lưu ý</th></tr></thead><tbody>' + rows + "</tbody></table>";
  }


  function renderNow(now){
    const st = AP.focusStatus(now);
    $("nowDot").className = "dot k-" + LV[st.cur.l].k;
    $("nowLab").textContent = st.inst.code + " lúc này: " + LV[st.cur.l].name + " · " + st.cur.n;
    $("nowDesc").textContent = st.cur.d;
    $("nowNx").textContent = st.nxt ? "Tiếp theo lúc " + hm(st.nxt.a) + (dayKey(st.nxt.a) !== dayKey(now) ? " " + dayLabel(st.nxt.a) : "") + ": " + LV[st.nxt.l].name + " · " + st.nxt.n + " (còn " + dur(st.nxt.a - now) + ")" : "";
  }
  function calNote(){
    const el = $("calNote");
    if (!el) return;
    if (AP.cal.state === "error") el.innerHTML = '<span style="color:var(--warn)">Không tải được lịch tin: bản đồ chưa có vùng tin đỏ.</span>';
    else if (AP.cal.state === "ready" && !AP.calFresh()) el.innerHTML = '<span style="color:var(--warn)">Lịch tin đã cũ (tuần ' + esc(AP.cal.week) + "): vùng tin đỏ có thể thiếu.</span>";
    else if (AP.cal.state === "ready") el.textContent = "Vùng tin đỏ lấy từ lịch tuần (Forex Factory), cập nhật " + hm(AP.cal.at) + " " + ddmm(AP.cal.at) + ".";
    else el.textContent = "Đang tải lịch tin…";
  }
  AP.onTick((now, dayChanged) => {
    if (dayChanged) dstCache = {day: "", html: ""};
    renderOpen(now); renderNow(now);
    renderMap();
  });
  AP.onCal(() => { renderMap(); renderNow(Date.now()); calNote(); });
  AP.onFocus(() => { renderMap(); renderNow(Date.now()); });
  let lastW = 0;
  if ("ResizeObserver" in window){
    new ResizeObserver(() => { const w = $("map").clientWidth; if (Math.abs(w - lastW) > 4){ lastW = w; requestAnimationFrame(renderMap); } }).observe($("map"));
  }
  const now0 = Date.now();
  renderOpen(now0); renderNow(now0); renderMap(); calNote();
})();
