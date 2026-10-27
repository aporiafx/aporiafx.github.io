#!/usr/bin/env python3
"""Fetch this week's Forex Factory calendar and store it for the site.

Writes (when the events changed, or always when FORCE=1):
  data/calendar.json          current week, read by every page
  data/weeks/<sunday>.json    archive copy, used by "Tuần trước"
  data/weeks/index.json       list of archived weeks (newest first, at most 104)

Runs from .github/workflows/cap-nhat-lich.yml about every 5 minutes, plus a forced
refresh of the whole week at 06:00 Monday Vietnam time. Standard library only.
Forex Factory asks for at most 2 requests per 5 minutes, so each run makes exactly one
request; when it fails, the stored calendar stays and the next run tries again.
"""
import datetime
import json
import os
import sys
import time
import urllib.error
import urllib.request
from zoneinfo import ZoneInfo

URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
KEEP = {"USD", "EUR", "GBP", "JPY", "AUD"}
# Releases without a fixed time: Forex Factory lists them as "Tentative" but the JSON carries a placeholder time.
TENTATIVE = {("JPY", "BOJ Policy Rate"), ("JPY", "Monetary Policy Statement"), ("JPY", "BOJ Outlook Report")}
ALLDAY_TENTATIVE = {("EUR", "German Prelim CPI m/m")}
NY = ZoneInfo("America/New_York")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")


def output(name, value):
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a", encoding="utf-8") as f:
            f.write(f"{name}={value}\n")


def fetch():
    req = urllib.request.Request(URL, headers={"User-Agent": "aporia-calendar/1.1 (+https://github.com/ledung-lang/aporia)", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            data = json.loads(r.read().decode("utf-8"))
        if isinstance(data, list) and data:
            return data
        raise ValueError("dữ liệu trống hoặc sai định dạng")
    except (urllib.error.URLError, ValueError, json.JSONDecodeError, TimeoutError) as e:
        print(f"::warning::Không tải được lịch Forex Factory ({e}), giữ nguyên lịch cũ.")
        return None


def normalize(raw):
    out = []
    for x in raw:
        ccy = str(x.get("country", "")).upper()
        if ccy not in KEEP:
            continue
        title = str(x.get("title", "")).strip()
        try:
            dt = datetime.datetime.fromisoformat(str(x.get("date", "")))
        except ValueError:
            continue
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=NY)
        impact = str(x.get("impact", "")).lower()
        if impact not in ("high", "medium", "low", "holiday"):
            impact = "low"
        key = (ccy, title)
        ev = {
            "t": int(dt.timestamp() * 1000),
            "ccy": ccy,
            "title": title,
            "impact": impact,
            "forecast": str(x.get("forecast") or ""),
            "previous": str(x.get("previous") or ""),
            "allDay": impact == "holiday" or key in ALLDAY_TENTATIVE,
        }
        if key in TENTATIVE or key in ALLDAY_TENTATIVE:
            ev["tentative"] = True
        out.append(ev)
    out.sort(key=lambda e: (e["t"], e["ccy"], e["title"]))
    return out


def week_of(events):
    """Sunday (New York date) that starts the Forex Factory week."""
    first = min(datetime.datetime.fromtimestamp(e["t"] / 1000, NY) for e in events)
    sunday = first.date() - datetime.timedelta(days=(first.weekday() + 1) % 7)
    return sunday.isoformat()


def read_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    os.replace(tmp, path)


def main():
    force = os.environ.get("FORCE") == "1"
    raw = fetch()
    if raw is None:
        output("changed", "false")
        return 0
    events = normalize(raw)
    if not events:
        print("::warning::Lịch tải về không có tin USD/EUR/GBP/JPY/AUD, giữ nguyên lịch cũ.")
        output("changed", "false")
        return 0
    week = week_of(events)
    current = read_json(os.path.join(DATA, "calendar.json"), {})
    if not force and current.get("week") == week and current.get("events") == events:
        print(f"Không có thay đổi (tuần {week}, {len(events)} tin).")
        output("changed", "false")
        return 0
    doc = {"at": int(time.time() * 1000), "week": week, "src": "Forex Factory", "events": events}
    write_json(os.path.join(DATA, "calendar.json"), doc)
    write_json(os.path.join(DATA, "weeks", week + ".json"), doc)
    idx = read_json(os.path.join(DATA, "weeks", "index.json"), [])
    idx = sorted({w for w in idx if isinstance(w, str)} | {week}, reverse=True)[:104]
    write_json(os.path.join(DATA, "weeks", "index.json"), idx)
    print(f"{'Nạp lại' if force else 'Đã cập nhật'} lịch tuần {week}: {len(events)} tin.")
    output("changed", "true")
    return 0


if __name__ == "__main__":
    sys.exit(main())
