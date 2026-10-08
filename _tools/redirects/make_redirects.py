"""Generate redirect stubs for old WordPress URLs.

GitHub Pages cannot send server-side 301s, so each old path gets an
index.html that redirects immediately (meta refresh + JS) and declares the
target as canonical. Google treats an instant meta refresh as a permanent
redirect.

Usage, from the repository root:
    python3 _tools/redirects/make_redirects.py
"""
import html, os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TSV = os.path.join(os.path.dirname(os.path.abspath(__file__)), "redirects.tsv")
BASE = "https://www.mlaia.com"

STUB = """<!doctype html>
<html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Moved | MLAIA</title>
<link rel="canonical" href="{canonical}">
<meta http-equiv="refresh" content="0; url={target}">
<script>location.replace({target_js})</script>
</head><body style="font-family:Arial,sans-serif;padding:40px">
<p>{text} <a href="{target}">{link}</a></p>
</body></html>
"""


def rows():
    for line in open(TSV, encoding="utf-8"):
        if line.strip() and not line.startswith("#"):
            old, new, *_ = line.rstrip("\n").split("\t")
            yield old, new


def main():
    written, skipped = 0, []
    paths = {old for old, _ in rows()}
    for old, new in rows():
        if not old.endswith("/"):
            # GitHub Pages 301s /x to /x/ when the directory exists, so /x/ covers it.
            if old + "/" in paths:
                continue
            skipped.append(old)
            continue
        dest = os.path.join(ROOT, old.strip("/"), "index.html")
        if os.path.exists(dest) and "Moved | MLAIA" not in open(dest, encoding="utf-8").read():
            sys.exit(f"refusing to overwrite a real page: {dest}")
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        he = old.startswith("/he/")
        target = BASE + new
        canonical = BASE + new.split("#")[0]
        open(dest, "w", encoding="utf-8").write(STUB.format(
            lang="he" if he else "en",
            canonical=html.escape(canonical, quote=True),
            target=html.escape(target, quote=True),
            target_js=repr(target).replace("'", '"'),
            text="העמוד עבר לכתובת חדשה:" if he else "This page has moved:",
            link="להמשך" if he else "Continue"))
        written += 1
    print(f"wrote {written} redirect stubs")
    if skipped:
        print("skipped (no trailing slash, no directory form):", skipped)


if __name__ == "__main__":
    main()
