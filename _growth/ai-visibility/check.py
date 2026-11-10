#!/usr/bin/env python3
"""Ask AI answer engines our prompt set and record whether our domains are cited.

Engines run only when their key is present in the environment:
  OPENAI_API_KEY      ChatGPT (Responses API with web search)
  PERPLEXITY_API_KEY  Perplexity (sonar)
  GEMINI_API_KEY      Gemini (generateContent with Google Search grounding)

Usage:
  python3 check.py                # run every engine that has a key
  python3 check.py --engines openai,perplexity
  python3 check.py --dry-run      # no network: show prompts and the table layout

Writes results/<date>.json (full answers and citations) and appends log.csv
(one row per prompt x engine). No dependencies beyond the standard library.
"""
import argparse, csv, datetime as dt, json, os, re, sys, time, urllib.error, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
PROMPTS = json.load(open(os.path.join(HERE, "prompts.json")))
LOG = os.path.join(HERE, "log.csv")
LOG_FIELDS = ["date", "engine", "prompt_id", "brand", "cited", "mentioned",
              "citation_rank", "n_citations", "our_url"]

MODELS = {
    "openai": os.environ.get("OPENAI_MODEL", "gpt-5"),
    "perplexity": os.environ.get("PERPLEXITY_MODEL", "sonar"),
    "gemini": os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
}


def post(url, body, headers, timeout=120):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", **headers})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def ask_openai(prompt):
    key = os.environ["OPENAI_API_KEY"]
    data = post("https://api.openai.com/v1/responses",
                {"model": MODELS["openai"], "tools": [{"type": "web_search"}], "input": prompt},
                {"Authorization": f"Bearer {key}"})
    text, urls = [], []
    for item in data.get("output", []):
        for part in item.get("content", []) or []:
            if part.get("type") == "output_text":
                text.append(part.get("text", ""))
                for ann in part.get("annotations", []) or []:
                    if ann.get("type") == "url_citation" and ann.get("url"):
                        urls.append(ann["url"])
    return "\n".join(text), urls


def ask_perplexity(prompt):
    key = os.environ["PERPLEXITY_API_KEY"]
    data = post("https://api.perplexity.ai/chat/completions",
                {"model": MODELS["perplexity"], "messages": [{"role": "user", "content": prompt}]},
                {"Authorization": f"Bearer {key}"})
    text = data["choices"][0]["message"]["content"]
    urls = list(data.get("citations") or [])
    urls += [r.get("url") for r in data.get("search_results") or [] if r.get("url")]
    return text, urls


def ask_gemini(prompt):
    key = os.environ["GEMINI_API_KEY"]
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODELS['gemini']}:generateContent?key={key}"
    data = post(url, {"contents": [{"parts": [{"text": prompt}]}], "tools": [{"google_search": {}}]}, {})
    cand = (data.get("candidates") or [{}])[0]
    text = "\n".join(p.get("text", "") for p in cand.get("content", {}).get("parts", []))
    urls = []
    for ch in cand.get("groundingMetadata", {}).get("groundingChunks", []) or []:
        u = ch.get("web", {}).get("uri")
        if u:
            urls.append(u)
    return text, urls


ENGINES = {"openai": ("OPENAI_API_KEY", ask_openai),
           "perplexity": ("PERPLEXITY_API_KEY", ask_perplexity),
           "gemini": ("GEMINI_API_KEY", ask_gemini)}


def dedupe(seq):
    seen, out = set(), []
    for s in seq:
        if s and s not in seen:
            seen.add(s); out.append(s)
    return out


def score(text, urls, brand):
    """cited = one of our domains is in the citation list; mentioned = brand name or domain in the answer."""
    b = PROMPTS["brands"][brand]
    urls = dedupe(urls)
    rank, our = "", ""
    for i, u in enumerate(urls, 1):
        if any(d in u.lower() for d in b["domains"]):
            rank, our = i, u
            break
    low = text.lower()
    mentioned = any(n.lower() in low for n in b["names"]) or any(d in low for d in b["domains"])
    return {"cited": bool(rank), "mentioned": mentioned, "citation_rank": rank,
            "n_citations": len(urls), "our_url": our}


def run(engines, dry):
    today = dt.date.today().isoformat()
    rows, full = [], []
    for eng in engines:
        envkey, fn = ENGINES[eng]
        if not dry and not os.environ.get(envkey):
            print(f"[skip] {eng}: {envkey} not set", file=sys.stderr)
            continue
        for p in PROMPTS["prompts"]:
            if dry:
                text, urls = "", []
            else:
                try:
                    text, urls = fn(p["text"])
                except urllib.error.HTTPError as e:
                    print(f"[error] {eng} {p['id']}: HTTP {e.code} {e.read()[:200]!r}", file=sys.stderr)
                    continue
                except Exception as e:  # network, parse
                    print(f"[error] {eng} {p['id']}: {e}", file=sys.stderr)
                    continue
                time.sleep(1)
            s = score(text, urls, p["brand"])
            rows.append({"date": today, "engine": eng, "prompt_id": p["id"], "brand": p["brand"], **s})
            full.append({"engine": eng, "prompt": p, "answer": text, "citations": dedupe(urls), **s})
    return today, rows, full


def summarise(rows):
    if not rows:
        return "no rows"
    out = ["", f"{'brand':<11}{'engine':<12}{'prompts':>8}{'cited':>7}{'mentioned':>11}"]
    for brand in PROMPTS["brands"]:
        for eng in dedupe(r["engine"] for r in rows):
            rs = [r for r in rows if r["brand"] == brand and r["engine"] == eng]
            if rs:
                out.append(f"{brand:<11}{eng:<12}{len(rs):>8}{sum(r['cited'] for r in rs):>7}{sum(r['mentioned'] for r in rs):>11}")
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--engines", default=",".join(ENGINES))
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    engines = [e.strip() for e in a.engines.split(",") if e.strip() in ENGINES]
    today, rows, full = run(engines, a.dry_run)
    print(summarise(rows))
    if a.dry_run:
        print(f"\n(dry run: {len(PROMPTS['prompts'])} prompts x {len(engines)} engines, nothing written)")
        return
    if not rows:
        sys.exit("nothing ran: set at least one API key")
    os.makedirs(os.path.join(HERE, "results"), exist_ok=True)
    json.dump(full, open(os.path.join(HERE, "results", f"{today}.json"), "w"), indent=1, ensure_ascii=False)
    new = not os.path.exists(LOG)
    with open(LOG, "a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=LOG_FIELDS)
        if new:
            w.writeheader()
        w.writerows(rows)
    print(f"\nwrote results/{today}.json and appended {len(rows)} rows to log.csv")


if __name__ == "__main__":
    main()
