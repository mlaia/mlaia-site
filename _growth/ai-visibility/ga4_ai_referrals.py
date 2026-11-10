#!/usr/bin/env python3
"""Sessions from AI assistants (ChatGPT, Gemini, Perplexity, Copilot, Claude...) per GA4 property.

Auth: Application Default Credentials with the analytics.readonly scope, e.g.
  gcloud auth application-default login --scopes=openid,https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform
or GOOGLE_APPLICATION_CREDENTIALS pointing at a service account that has Viewer on the properties.

Usage: python3 ga4_ai_referrals.py [--days 28]
Appends one row per property x source to ga4_log.csv.
NextDemand's property is deliberately not listed.
"""
import argparse, csv, datetime as dt, json, os, subprocess, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
PROPERTIES = {"mlaia.com": "530669054", "ultrabot.ai": "561722932"}
AI_SOURCES = ["chatgpt.com", "chat.openai.com", "gemini.google.com", "perplexity.ai", "www.perplexity.ai",
              "copilot.microsoft.com", "claude.ai", "you.com", "duckduckgo.com/aichat", "meta.ai", "grok.com"]


def token():
    try:
        return subprocess.check_output(["gcloud", "auth", "application-default", "print-access-token"],
                                       text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        sys.exit("no access token: run the gcloud auth application-default login command in the docstring")


def run_report(prop, days, tok):
    body = {
        "dateRanges": [{"startDate": f"{days}daysAgo", "endDate": "yesterday"}],
        "dimensions": [{"name": "sessionSource"}, {"name": "sessionMedium"}],
        "metrics": [{"name": "sessions"}, {"name": "engagedSessions"}],
        "dimensionFilter": {"orGroup": {"expressions": [
            {"filter": {"fieldName": "sessionMedium", "stringFilter": {"value": "ai-assistant"}}},
            {"filter": {"fieldName": "sessionSource", "inListFilter": {"values": AI_SOURCES}}}]}},
        "limit": 100,
    }
    req = urllib.request.Request(f"https://analyticsdata.googleapis.com/v1beta/properties/{prop}:runReport",
                                 data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def total_sessions(prop, days, tok):
    body = {"dateRanges": [{"startDate": f"{days}daysAgo", "endDate": "yesterday"}], "metrics": [{"name": "sessions"}]}
    req = urllib.request.Request(f"https://analyticsdata.googleapis.com/v1beta/properties/{prop}:runReport",
                                 data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        d = json.load(r)
    return int(d.get("rows", [{}])[0].get("metricValues", [{}])[0].get("value", 0)) if d.get("rows") else 0


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--days", type=int, default=28)
    a = ap.parse_args()
    tok = token()
    today = dt.date.today().isoformat()
    rows = []
    for site, prop in PROPERTIES.items():
        tot = total_sessions(prop, a.days, tok)
        d = run_report(prop, a.days, tok)
        ai = 0
        for r in d.get("rows", []):
            src, med = [x["value"] for x in r["dimensionValues"]]
            s, e = [int(x["value"]) for x in r["metricValues"]]
            ai += s
            rows.append({"date": today, "days": a.days, "site": site, "source": src, "medium": med,
                         "sessions": s, "engaged": e, "site_sessions": tot})
            print(f"{site:<14}{src:<26}{med:<14}{s:>5} sessions  {e:>4} engaged")
        print(f"{site:<14}AI assistants total: {ai} of {tot} sessions ({(100*ai/tot if tot else 0):.0f}%)\n")
    log = os.path.join(HERE, "ga4_log.csv")
    new = not os.path.exists(log)
    with open(log, "a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["date", "days", "site", "source", "medium", "sessions", "engaged", "site_sessions"])
        if new:
            w.writeheader()
        w.writerows(rows)
    print(f"appended {len(rows)} rows to ga4_log.csv")


if __name__ == "__main__":
    main()
