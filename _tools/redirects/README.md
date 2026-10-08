# Redirects for old WordPress URLs

`redirects.tsv` maps URLs from the 2024 WordPress site to their closest current page.
The list came from Search Console's "Not found (404)" report on 8 October 2026.

GitHub Pages can't send server-side 301 redirects. Instead, `make_redirects.py` writes an `index.html` stub at each old path. The stub:

- redirects immediately (meta refresh plus `location.replace`)
- declares the target as canonical, so Google treats it as a permanent redirect

To rebuild, run from the repository root:

```bash
python3 _tools/redirects/make_redirects.py
```

To add a redirect, add a row to `redirects.tsv` and rerun the script.
The script refuses to overwrite a real page.
Paths without a trailing slash are covered by their `/path/` stub, because GitHub Pages 301s `/path` to `/path/`.
