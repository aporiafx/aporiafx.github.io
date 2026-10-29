#!/usr/bin/env python3
"""Fill in the released figure (Actual) of the key events in data/calendar.json.

Writes data/actuals.json:
  {"at": <ms>, "items": {"<CCY>|<title>|<t>": {"actual": "0.3%", "better": 1, "src": "BLS", "got": <ms>}}}
"better" compares the figure with the forecast, seen from that currency: 1 = better, -1 = worse,
0 = same as the forecast or no forecast.

Figures come straight from the official publishers, no API key needed:
  Fed statement, BLS (CPI, payrolls, unemployment, hourly earnings), ECB decision,
  BoE Monetary Policy Summary, ONS (UK CPI), RBA decision.
Runs from .github/workflows/ket-qua-tin.yml. When a key release is due within LOOKAHEAD it waits,
then polls the publisher until the new figure appears (at most POLL_AFTER after the release time).
TEST=1 prints the latest figure each publisher has out now and writes nothing.
Standard library only.
"""
import datetime
import email.utils
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

UA = "aporia-calendar/1.2 (+https://github.com/aporiafx/aporiafx.github.io)"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
LOOKAHEAD = 60 * 60      # wait for releases due within this many seconds
POLL_AFTER = 25 * 60     # keep polling this long after the release time
POLL_EVERY = 20          # seconds between polls
LATE = 7 * 24 * 3600     # fill figures missed earlier in the week
KEEP = 70 * 24 * 3600    # drop stored figures older than this
MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august",
          "september", "october", "november", "december"]
SUMMARY = []


def output(name, value):
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a", encoding="utf-8") as f:
            f.write(f"{name}={value}\n")


def say(line):
    """Log line, also shown on the run's summary page."""
    print(line)
    SUMMARY.append(line)


def write_summary(title):
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path and SUMMARY:
        with open(path, "a", encoding="utf-8") as f:
            f.write(f"### {title}\n\n" + "\n".join("- " + s.replace("::warning::", "⚠️ ") for s in SUMMARY) + "\n")


def get(url, data=None, headers=None, timeout=30):
    h = {"User-Agent": UA, "Accept": "*/*", "Accept-Language": "en"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=data, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def get_or_none(url, **kw):
    """Page text, or None when the page does not exist yet (404/410)."""
    try:
        return get(url, **kw)
    except urllib.error.HTTPError as e:
        if e.code in (404, 410):
            return None
        raise


def text_of(page):
    s = re.sub(r"(?is)<(script|style|noscript)\b.*?</\1>", " ", page)
    s = re.sub(r"(?s)<[^>]+>", " ", s)
    s = html.unescape(s)
    s = re.sub("[\u00a0\u2009\u202f]", " ", s)       # non-breaking and thin spaces
    s = re.sub("[\u2010\u2011\u2012\u2013\u2212]", "-", s)   # hyphen and dash variants
    return re.sub(r"\s+", " ", s)


def rss_items(xml):
    out = []
    for item in re.findall(r"(?s)<item\b.*?</item>", xml):
        def tag(name):
            m = re.search(r"(?s)<%s\b[^>]*>(.*?)</%s>" % (name, name), item)
            v = m.group(1) if m else ""
            v = re.sub(r"(?s)<!\[CDATA\[(.*?)\]\]>", r"\1", v)
            return html.unescape(v).strip()
        when = None
        try:
            when = email.utils.parsedate_to_datetime(tag("pubDate"))
        except (TypeError, ValueError):
            try:  # some feeds (RBA) give an ISO date in <dc:date> instead
                when = datetime.datetime.fromisoformat(tag("dc:date").replace("Z", "+00:00"))
            except ValueError:
                pass
        out.append({"title": tag("title"), "link": tag("link"), "when": when})
    return out


def on_day(item, day, tz):
    return item["when"] is not None and item["when"].astimezone(ZoneInfo(tz)).date() == day


def local_date(t_ms, tz):
    return datetime.datetime.fromtimestamp(t_ms / 1000, ZoneInfo(tz)).date()


def prev_month(ym, k=1):
    y, m = ym
    m -= k
    while m <= 0:
        m += 12
        y -= 1
    return (y, m)


def ref_month(t_ms, tz):
    """Monthly data released in month M describe month M-1."""
    d = local_date(t_ms, tz)
    return prev_month((d.year, d.month))


def frac(s):
    """'3-3/4' -> 3.75, '4' -> 4.0, '1/4' -> 0.25, '3.75' -> 3.75."""
    s = s.strip().rstrip(".")
    m = re.fullmatch(r"(\d+)-(\d+)/(\d+)", s)
    if m:
        return int(m.group(1)) + int(m.group(2)) / int(m.group(3))
    m = re.fullmatch(r"(\d+)/(\d+)", s)
    if m:
        return int(m.group(1)) / int(m.group(2))
    return float(s)


def r1(x):
    v = Decimal(repr(x)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
    return "0.0" if v == 0 else str(v)


def pct2(x):
    return f"{float(x):.2f}%"


def num(s):
    m = re.search(r"-?\d+(?:\.\d+)?", (s or "").replace(",", ""))
    return float(m.group(0)) if m else None


def earliest(text, patterns):
    """First match (by position) of any pattern: the decision sentence comes before dissents."""
    best = None
    for rx in patterns:
        m = rx.search(text)
        if m and (best is None or m.start() < best.start()):
            best = m
    return best


class Ctx:
    """Shared fetches for one run, so one call serves every event of the same publisher."""

    def __init__(self):
        self.cache = {}

    def fetch(self, key, ttl, fn):
        hit = self.cache.get(key)
        if hit and time.time() - hit[0] < ttl:
            return hit[1]
        value = fn()
        self.cache[key] = (time.time(), value)
        return value


# ---------------------------------------------------------------- sources
# BLS public API v1: no key, but only about 25 calls a day per address, so calls are spaced out.
BLS_IDS = ["CUSR0000SA0", "CUSR0000SA0L1E", "CUUR0000SA0", "CES0000000001", "LNS14000000", "CES0500000003"]


def bls_ttl(t_ms):
    """Seconds a BLS answer is reused: about 13 calls in the 25 minutes after a release."""
    since = time.time() - t_ms / 1000
    return 30 if since < 180 else 120 if since < 600 else 300


def bls_data(ctx, ttl=55):
    def call():
        y = datetime.date.today().year
        body = json.dumps({"seriesid": BLS_IDS, "startyear": str(y - 2), "endyear": str(y)}).encode()
        j = json.loads(get("https://api.bls.gov/publicAPI/v1/timeseries/data/", data=body,
                           headers={"Content-Type": "application/json"}))
        if j.get("status") != "REQUEST_SUCCEEDED":
            raise RuntimeError("BLS: " + "; ".join(j.get("message") or ["lỗi không rõ"]))
        out = {}
        for s in j["Results"]["series"]:
            pts = {}
            for d in s.get("data", []):
                p = d.get("period", "")
                if not re.fullmatch(r"M(0[1-9]|1[0-2])", p):
                    continue
                try:
                    pts[(int(d["year"]), int(p[1:]))] = float(d["value"])
                except (KeyError, ValueError):
                    pass
            out[s["seriesID"]] = pts
        return out
    return ctx.fetch("bls", ttl, call)


def bls_value(d, kind, ref):
    def mm(sid):
        s = d.get(sid, {})
        if ref in s and prev_month(ref) in s:
            return r1((s[ref] / s[prev_month(ref)] - 1) * 100) + "%"
        return None

    def yy(sid):
        s = d.get(sid, {})
        if ref in s and prev_month(ref, 12) in s:
            return r1((s[ref] / s[prev_month(ref, 12)] - 1) * 100) + "%"
        return None

    if kind == "cpi_mm":
        return mm("CUSR0000SA0")
    if kind == "core_mm":
        return mm("CUSR0000SA0L1E")
    if kind == "cpi_yy":
        return yy("CUUR0000SA0")
    if kind == "ahe_mm":
        return mm("CES0500000003")
    if kind == "nfp":
        s = d.get("CES0000000001", {})
        if ref in s and prev_month(ref) in s:
            return str(int(round(s[ref] - s[prev_month(ref)]))) + "K"
        return None
    if kind == "ur":
        s = d.get("LNS14000000", {})
        return r1(s[ref]) + "%" if ref in s else None
    return None


def bls(kind):
    def source(t_ms, ctx):
        return bls_value(bls_data(ctx, bls_ttl(t_ms)), kind, ref_month(t_ms, "America/New_York"))
    return source


FED_RE = re.compile(r"target range for the federal funds rate[^.]*?\b(?:at|to) ([0-9][0-9/\-]*) to ([0-9][0-9/\-]*) percent")


def fed_parse(text):
    m = FED_RE.search(text)
    return pct2(frac(m.group(2))) if m else None


def fed(t_ms, ctx):
    d = local_date(t_ms, "America/New_York")
    page = get_or_none(f"https://www.federalreserve.gov/newsevents/pressreleases/monetary{d:%Y%m%d}a.htm")
    if page is None:  # fall back to the press-release feed in case the address pattern changes
        for it in rss_items(ctx.fetch("fed-rss", 15, lambda: get("https://www.federalreserve.gov/feeds/press_monetary.xml"))):
            if "fomc statement" in it["title"].lower() and on_day(it, d, "America/New_York"):
                page = ctx.fetch("page:" + it["link"], 3600, lambda: get(it["link"]))
                break
    return fed_parse(text_of(page)) if page else None


ECB_RES = [re.compile(r"deposit facility, the main refinancing operations and the marginal lending facility will "
                      r"(?:remain unchanged at|be (?:increased|decreased|raised|reduced|lowered|cut) to) "
                      r"(\d+(?:\.\d+)?) ?% ?, ?(\d+(?:\.\d+)?) ?% ?,? and (\d+(?:\.\d+)?) ?%"),
           re.compile(r"main refinancing operations[^%]{0,160}?(\d+(?:\.\d+)?) ?% ?, ?(\d+(?:\.\d+)?) ?% ?,? and (\d+(?:\.\d+)?) ?%")]


def ecb_parse(text):
    m = earliest(text, ECB_RES[:1]) or earliest(text, ECB_RES[1:])
    return pct2(m.group(2)) if m else None


def ecb(t_ms, ctx):
    d = local_date(t_ms, "Europe/Berlin")
    mp = "ecb.mp" + d.strftime("%y%m%d")
    for it in rss_items(ctx.fetch("ecb-rss", 15, lambda: get("https://www.ecb.europa.eu/rss/press.html"))):
        if mp in it["link"] or ("monetary policy decision" in it["title"].lower() and on_day(it, d, "Europe/Berlin")):
            value = ecb_parse(text_of(ctx.fetch("page:" + it["link"], 3600, lambda: get(it["link"]))))
            if value:
                return value
    return None


BOE_RES = [re.compile(r"(?:maintain|hold|keep|leave) Bank Rate (?:unchanged )?at (\d+(?:\.\d+)?) ?%"),
           re.compile(r"(?:reduce|cut|lower|increase|raise) Bank Rate by [\d.]+ percentage points?,? to (\d+(?:\.\d+)?) ?%")]


def boe_parse(text):
    i = text.find("MPC voted")
    if i < 0:
        i = text.find("voted by a majority")
    m = earliest(text[i:i + 400] if i >= 0 else text, BOE_RES)
    return pct2(m.group(1)) if m else None


def boe(t_ms, ctx):
    d = local_date(t_ms, "Europe/London")
    page = get_or_none(f"https://www.bankofengland.co.uk/monetary-policy-summary-and-minutes/{d.year}/{MONTHS[d.month - 1]}-{d.year}")
    return boe_parse(text_of(page)) if page else None


RBA_RE = re.compile(r"cash rate target[^.]*?\b(?:at|to) (\d+(?:\.\d+)?) ?per ?cent")
# Row of the RBA cash rate table: effective date (the day after the decision), change, new target.
RBA_ROW = re.compile(r"(\d{1,2} [A-Z][a-z]{2} \d{4}) ([+-]?\d+\.\d{2}) (\d+\.\d{2})")


def rba_parse(text):
    m = RBA_RE.search(text)
    return pct2(m.group(1)) if m else None


def rba_table(text, day):
    """Target set at the decision of `day`, from the cash rate table (newest row first)."""
    for m in RBA_ROW.finditer(text):
        eff = datetime.datetime.strptime(m.group(1), "%d %b %Y").date()
        if eff < day:
            break
        if eff <= day + datetime.timedelta(days=3):
            return pct2(m.group(3))
    return None


def rba(t_ms, ctx):
    d = local_date(t_ms, "Australia/Sydney")
    value = rba_table(text_of(ctx.fetch("rba-table", 15, lambda: get("https://www.rba.gov.au/statistics/cash-rate/"))), d)
    if value:
        return value
    for it in rss_items(ctx.fetch("rba-rss", 15, lambda: get("https://www.rba.gov.au/rss/rss-cb-media-releases.xml"))):
        if "monetary policy decision" in it["title"].lower() and on_day(it, d, "Australia/Sydney"):
            value = rba_parse(text_of(ctx.fetch("page:" + it["link"], 3600, lambda: get(it["link"]))))
            if value:
                return value
    return None


def ons_months(ctx, series):
    j = json.loads(ctx.fetch("ons-" + series, 15, lambda: get(
        f"https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/{series}/mm23/data",
        headers={"Accept": "application/json"})))
    out = {}
    for row in j.get("months", []):
        try:
            out[(int(row["year"]), MONTHS.index(row["month"].strip().lower()) + 1)] = float(row["value"])
        except (KeyError, ValueError):
            pass
    return out


def ons(series):
    def source(t_ms, ctx):
        v = ons_months(ctx, series).get(ref_month(t_ms, "Europe/London"))
        return r1(v) + "%" if v is not None else None
    return source


# (currency, Forex Factory title) -> (source, publisher, +1 if a higher figure is better for the currency, sane range)
RATE = (0, 25)
RULES = {
    ("USD", "Federal Funds Rate"): (fed, "Fed", 1, RATE),
    ("USD", "CPI m/m"): (bls("cpi_mm"), "BLS", 1, (-5, 5)),
    ("USD", "Core CPI m/m"): (bls("core_mm"), "BLS", 1, (-5, 5)),
    ("USD", "CPI y/y"): (bls("cpi_yy"), "BLS", 1, (-10, 30)),
    ("USD", "Non-Farm Employment Change"): (bls("nfp"), "BLS", 1, (-25000, 25000)),
    ("USD", "Unemployment Rate"): (bls("ur"), "BLS", -1, (0, 30)),
    ("USD", "Average Hourly Earnings m/m"): (bls("ahe_mm"), "BLS", 1, (-5, 5)),
    ("EUR", "Main Refinancing Rate"): (ecb, "ECB", 1, RATE),
    ("GBP", "Official Bank Rate"): (boe, "BoE", 1, RATE),
    ("GBP", "CPI y/y"): (ons("d7g7"), "ONS", 1, (-10, 30)),
    ("AUD", "Cash Rate"): (rba, "RBA", 1, RATE),
}


def better(actual, forecast, sign):
    a, f = num(actual), num(forecast)
    if a is None or f is None or a == f:
        return 0
    return sign if a > f else -sign


def read_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def write_json(path, obj):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        f.write("\n")
    os.replace(tmp, path)


def attempt(job, ctx):
    try:
        value = job["source"](job["t"], ctx)
    except Exception as e:  # one publisher being down must not stop the others
        print(f"::warning::{job['src']} ({job['ccy']} {job['title']}): {e}")
        return None
    if value is None:
        return None
    lo, hi = job["range"]
    v = num(value)
    if v is None or not lo <= v <= hi:
        say(f"::warning::Bỏ số lạ {value!r} cho {job['ccy']} {job['title']} ({job['src']}).")
        return None
    return value


def run_test():
    """Show the latest figure each publisher has out now (no writing)."""
    ctx = Ctx()
    now = datetime.datetime.now(datetime.timezone.utc)

    def show(label, fn):
        try:
            say(f"{label}: {fn()}")
        except Exception as e:
            say(f"::warning::{label}: lỗi {e}")

    def last_fed():
        for it in rss_items(get("https://www.federalreserve.gov/feeds/press_monetary.xml")):
            if "fomc statement" in it["title"].lower():
                return f"{it['link']} -> {fed_parse(text_of(get(it['link']))) or 'không đọc được câu lãi suất'}"
        return "không thấy thông cáo FOMC trong RSS"

    def last_bls():
        d = bls_data(ctx)
        parts = []
        for sid in BLS_IDS:
            s = d.get(sid, {})
            if s:
                ym = max(s)
                parts.append(f"{sid} {ym[0]}-{ym[1]:02d}={s[ym]}")
        cpi, nfp = d.get("CUSR0000SA0", {}), d.get("CES0000000001", {})
        if cpi:
            ref = max(cpi)
            parts.append(f"CPI tháng {ref[1]:02d}/{ref[0]}: m/m %s, y/y %s, lõi m/m %s" % tuple(
                bls_value(d, k, ref) for k in ("cpi_mm", "cpi_yy", "core_mm")))
        if nfp:
            ref = max(nfp)
            parts.append(f"Việc làm tháng {ref[1]:02d}/{ref[0]}: NFP %s, thất nghiệp %s, lương giờ m/m %s" % tuple(
                bls_value(d, k, ref) for k in ("nfp", "ur", "ahe_mm")))
        return " | ".join(parts)

    def last_ecb():
        for it in rss_items(get("https://www.ecb.europa.eu/rss/press.html")):
            if "ecb.mp" in it["link"] or "monetary policy decision" in it["title"].lower():
                return f"{it['link']} -> MRO {ecb_parse(text_of(get(it['link']))) or 'không đọc được câu lãi suất'}"
        return "RSS lúc này không có thông cáo quyết định lãi suất (RSS chỉ giữ các tin mới nhất)"

    def last_boe():
        y, m = now.year, now.month
        for _ in range(4):
            url = f"https://www.bankofengland.co.uk/monetary-policy-summary-and-minutes/{y}/{MONTHS[m - 1]}-{y}"
            page = get_or_none(url)
            if page:
                return f"{url} -> {boe_parse(text_of(page)) or 'không đọc được câu lãi suất'}"
            y, m = prev_month((y, m))
        return "không thấy trang Monetary Policy Summary trong 4 tháng gần đây"

    def last_rba():
        m = RBA_ROW.search(text_of(get("https://www.rba.gov.au/statistics/cash-rate/")))
        row = f"bảng lãi suất: hiệu lực {m.group(1)}, thay đổi {m.group(2)}, mức {m.group(3)}%" if m else "không đọc được bảng lãi suất"
        for it in rss_items(get("https://www.rba.gov.au/rss/rss-cb-media-releases.xml")):
            if "monetary policy decision" in it["title"].lower():
                return f"{row} | {it['link']} -> {rba_parse(text_of(get(it['link']))) or 'không đọc được câu lãi suất'}"
        return row + " | RSS lúc này không có thông cáo quyết định (RSS chỉ giữ tin mới nhất)"

    def last_ons():
        d = ons_months(ctx, "d7g7")
        ym = max(d)
        return f"tháng {ym[1]:02d}/{ym[0]} = {d[ym]}%"

    show("Fed", last_fed)
    show("BLS", last_bls)
    show("ECB", last_ecb)
    show("BoE", last_boe)
    show("RBA", last_rba)
    show("ONS CPI y/y", last_ons)
    write_summary("Kiểm tra nguồn số liệu")
    output("changed", "false")
    output("more", "false")


def pending_jobs(cal, items, now):
    jobs = []
    for e in cal.get("events", []):
        rule = RULES.get((e.get("ccy"), e.get("title")))
        if not rule or e.get("allDay") or not isinstance(e.get("t"), int):
            continue
        key = f"{e['ccy']}|{e['title']}|{e['t']}"
        ts = e["t"] / 1000
        if key in items or now > ts + LATE:
            continue
        jobs.append({"key": key, "t": e["t"], "ts": ts, "ccy": e["ccy"], "title": e["title"],
                     "forecast": e.get("forecast", ""), "source": rule[0], "src": rule[1],
                     "sign": rule[2], "range": rule[3]})
    return jobs


def main():
    if os.environ.get("TEST") == "1":
        run_test()
        return 0
    cal = read_json(os.path.join(DATA, "calendar.json"), {})
    path = os.path.join(DATA, "actuals.json")
    store = read_json(path, {})
    items = store.get("items") if isinstance(store.get("items"), dict) else {}
    now = time.time()
    jobs = [j for j in pending_jobs(cal, items, now) if now >= j["ts"] - LOOKAHEAD]
    ctx = Ctx()
    got = {}

    def take(job, value):
        got[job["key"]] = {"actual": value, "better": better(value, job["forecast"], job["sign"]),
                           "src": job["src"], "got": int(time.time() * 1000)}
        say(f"{job['ccy']} {job['title']}: {value} (dự báo {job['forecast'] or '—'}, nguồn {job['src']})")

    # Releases already well past: one try each. The BLS allows few calls a day, so after the
    # first three hours its figures are retried only in hours 0, 6, 12 and 18 UTC.
    hour = datetime.datetime.now(datetime.timezone.utc).hour
    for job in [j for j in jobs if now > j["ts"] + POLL_AFTER]:
        if job["src"] == "BLS" and now > job["ts"] + 3 * 3600 and hour % 6:
            continue
        value = attempt(job, ctx)
        if value:
            take(job, value)
        else:
            say(f"Chưa lấy được {job['ccy']} {job['title']} ({job['src']}), sẽ thử lại sau.")

    # The next release (and anything released at the same moment): wait for it, then poll until the figures appear.
    live = sorted([j for j in jobs if now <= j["ts"] + POLL_AFTER], key=lambda j: j["ts"])
    t0 = None
    if live:
        t0 = live[0]["ts"]
        group = [j for j in live if j["ts"] == t0]
        wait = t0 - time.time()
        if wait > 0:
            say(f"Chờ {wait / 60:.0f} phút tới giờ công bố: " + ", ".join(f"{j['ccy']} {j['title']}" for j in group))
            time.sleep(wait + 2)
        deadline = t0 + POLL_AFTER
        while group:
            for job in list(group):
                value = attempt(job, ctx)
                if value:
                    take(job, value)
                    group.remove(job)
            if not group or time.time() + POLL_EVERY > deadline:
                break
            time.sleep(POLL_EVERY)
        for job in group:
            say(f"::warning::Chưa có số {job['ccy']} {job['title']} sau {POLL_AFTER // 60} phút, lần chạy sau sẽ thử lại.")

    # Another key release due within LOOKAHEAD (or still in its polling window) that this run did not
    # handle: the workflow starts a new run right away to wait for it.
    later = time.time()
    more = any(j["key"] not in got and (t0 is None or j["ts"] > t0)
               and j["ts"] + POLL_AFTER > later and j["ts"] - LOOKAHEAD <= later
               for j in pending_jobs(cal, items, later))
    output("more", "true" if more else "false")
    if not jobs:
        print("Không có tin chính nào đang chờ số liệu.")
    if not got:
        output("changed", "false")
        write_summary("Số liệu thực tế")
        return 0
    items.update(got)
    cutoff = (time.time() - KEEP) * 1000
    items = {k: v for k, v in items.items() if int(k.rsplit("|", 1)[1]) >= cutoff}
    write_json(path, {"at": int(time.time() * 1000), "items": items})
    output("changed", "true")
    write_summary("Số liệu thực tế")
    return 0


if __name__ == "__main__":
    sys.exit(main())
