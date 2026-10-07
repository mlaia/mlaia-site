"""Render audio-ai sub-pages from content JSON into the practice-page shell.

Usage: python3 render_audio.py <site_root> <content.json> [...]
Each JSON produces <site_root>/audio-ai/<slug>/index.html.
"""
import html, json, os, sys

BASE = "https://www.mlaia.com"
GA = "G-1T3R1HL53V"


def esc(s):
    # Content strings may already contain entities (&amp;); normalise before escaping.
    return html.escape(html.unescape(s), quote=True)


def strip_tags(s):
    out, depth = [], 0
    for ch in s:
        if ch == "<":
            depth += 1
        elif ch == ">":
            depth = max(0, depth - 1)
        elif not depth:
            out.append(ch)
    return html.unescape("".join(out))


def card(c):
    link = f'<a href="{esc(c["link"]["href"])}">{c["link"]["text"]}</a>' if c.get("link") else ""
    num = f'<span class="p-number">{esc(c["number"])}</span>' if c.get("number") else ""
    return f'<article class="p-service">{num}<h3>{c["h3"]}</h3><p>{c["p"]}</p>{link}</article>'


def section(s, white):
    cls = "p-section white" if white else "p-section"
    sid = f' id="{esc(s["id"])}"' if s.get("id") else ""
    parts = [f'<section class="{cls}"{sid}><div class="p-wrap">']
    if s.get("eyebrow"):
        parts.append(f'<p class="p-eyebrow">{s["eyebrow"]}</p>')
    parts.append(f'<h2>{s["h2"]}</h2>')
    if s.get("lead"):
        parts.append(f'<p class="p-section-lead">{s["lead"]}</p>')
    for para in s.get("paragraphs", []):
        parts.append(f'<p class="p-section-lead">{para}</p>')
    if s.get("cards"):
        parts.append('<div class="p-grid">' + "".join(card(c) for c in s["cards"]) + "</div>")
    for fig in s.get("figures", []):
        svgs = "".join(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "figures", f)).read() for f in fig["files"])
        body_cls = "p-figure-panels" if len(fig["files"]) > 1 else "p-figure-scroll"
        parts.append(f'<figure class="p-figure"><div class="{body_cls}">{svgs}</div><figcaption>{fig["caption"]}</figcaption></figure>')
    if s.get("steps"):
        parts.append('<div class="p-process">' + "".join(
            f'<article class="p-step"><span>{i:02d}</span><h3>{st["h3"]}</h3><p>{st["p"]}</p></article>'
            for i, st in enumerate(s["steps"], 1)) + "</div>")
    if s.get("capabilities"):
        parts.append('<div class="p-capabilities"><strong>' + s["capabilities"]["label"] + "</strong>" +
                     "".join(f"<span>{x}</span>" for x in s["capabilities"]["items"]) + "</div>")
    if s.get("cta"):
        parts.append(f'<p><a class="p-button" href="{esc(s["cta"]["href"])}">{s["cta"]["text"]}</a></p>')
    if s.get("note"):
        parts.append(f'<p class="p-note">{s["note"]}</p>')
    parts.append("</div></section>")
    return "".join(parts)


def render(d):
    slug = d["slug"]
    url = f"{BASE}/audio-ai/{slug}/"
    title = d["title"]
    desc = d["description"]
    crumb = d["breadcrumb"]
    service_ld = {
        "@context": "https://schema.org", "@type": "Service", "name": html.unescape(d["service_name"]),
        "serviceType": html.unescape(d["service_name"]), "description": html.unescape(desc), "url": url, "areaServed": "Worldwide",
        "provider": {"@type": "Organization", "@id": f"{BASE}/#organization", "name": "MLAIA Data Science", "url": f"{BASE}/"},
    }
    crumbs_ld = {
        "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "MLAIA", "item": f"{BASE}/"},
            {"@type": "ListItem", "position": 2, "name": "Audio & Acoustics", "item": f"{BASE}/audio-ai/"},
            {"@type": "ListItem", "position": 3, "name": html.unescape(crumb), "item": url},
        ]}
    faq_ld = {
        "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": strip_tags(f["q"]),
             "acceptedAnswer": {"@type": "Answer", "text": strip_tags(f["a"])}} for f in d["faq"]]}
    ld = "".join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>'
                 for x in (service_ld, crumbs_ld, faq_ld))

    brief = "".join(f"<div><dt>{dt}</dt><dd>{dd}</dd></div>" for dt, dd in d["brief"]["items"])
    lab = d.get("lab_link")
    hero_lab = f'<a href="{esc(lab["href"])}" class="p-button secondary">{lab["text"]}</a>' if lab else ""
    sections = "".join(section(s, i % 2 == 1) for i, s in enumerate(d["sections"]))
    faq_white = len(d["sections"]) % 2 == 1
    faq = "".join(f"<details><summary>{f['q']}</summary><p>{f['a']}</p></details>" for f in d["faq"])
    reads = "".join(
        f'<a href="{esc(r["href"])}"><small>{r["small"]}</small><strong>{r["strong"]} <span aria-hidden="true">↗</span></strong></a>'
        for r in d["reads"])

    return f'''<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(title)}</title><meta name="description" content="{esc(desc)}"><meta name="robots" content="index, follow"><link rel="canonical" href="{url}"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}"><meta property="og:type" content="website"><meta property="og:url" content="{url}"><meta property="og:image" content="{BASE}/assets/og/{slug}.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="{BASE}/assets/og/{slug}.png"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="/assets/practices.css"><script src="/assets/practice.js" defer></script>{ld}<link rel="stylesheet" href="/assets/site-shell.css"><script src="/assets/site-shell.js" defer></script></head>
<body class="practice-page audio" data-practice="audio-ai" data-site-shell="true">
<nav class="site-quick-nav" aria-label="Quick navigation"><a href="/" class="site-home"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/></svg><span data-en="Home" data-he="בית">Home</span></a><a href="#contact" class="site-contact-link"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v12H9l-5 4V4Z"/></svg><span data-en="Contact us" data-he="צרו קשר">Contact us</span></a></nav><a class="p-skip" href="#main">Skip to main content</a>
<header class="p-nav"><div class="p-wrap p-nav-inner"><a class="p-logo" href="/">ML<span>AI</span>A</a><button class="p-menu" type="button" aria-expanded="false" aria-controls="practice-nav">Menu</button>
<nav class="p-nav-links" id="practice-nav" aria-label="Main navigation"><a href="/audio-ai/" aria-current="true">Audio & Acoustics</a><a href="/medical-ai/" >Medical AI</a><a href="/predictive-intelligence/" >Prediction &amp; Causal Analysis</a><a href="/ai-automation/">AI &amp; Automation</a><a href="/blog.html">Insights</a><a class="p-button" href="#contact">Let’s talk</a></nav></div></header>
<main id="main">
<section class="p-hero"><div class="p-wrap"><div class="p-breadcrumb"><a href="/">MLAIA</a> / <a href="/audio-ai/">Audio & Acoustics</a> / {esc(crumb)}</div><div class="p-hero-grid"><div><p class="p-eyebrow">{d["eyebrow"]}</p><h1>{d["h1"]}</h1><p class="p-intro">{d["intro"]}</p><div class="p-actions"><a href="#contact" class="p-button" data-track="practice_cta">{d["cta"]} <span aria-hidden="true">↗</span></a>{hero_lab}</div></div>
<aside class="p-brief"><h2>{d["brief"]["h2"]}</h2><dl>{brief}</dl></aside></div><div class="p-proofline"><span>A specialist practice of MLAIA Data Science</span><span>Led by Dr. Yochai Edlitz · Ph.D., Weizmann Institute</span></div></div></section>
{sections}
<section class="p-section{" white" if faq_white else ""}"><div class="p-wrap p-faq"><p class="p-eyebrow">Before we start</p><h2>Good questions. Straight answers.</h2>{faq}</div></section>
<section class="p-section{"" if faq_white else " white"}"><div class="p-wrap"><p class="p-eyebrow">Keep exploring</p><h2>Related reading &amp; tools.</h2><div class="p-grid p-reads">{reads}</div></div></section>
<section class="p-contact" id="contact"><div class="p-wrap p-contact-grid"><div><p class="p-eyebrow" style="color:#66d9f0">Audio & Acoustics · {esc(crumb)}</p><h2>Tell us what<br>you’re working on.</h2><p>Share the problem, the data you have and what success would look like. We’ll discuss a practical next step.</p><p>Please don’t include confidential datasets, credentials or patient information.</p><p><a href="mailto:yochai@mlaia.com">yochai@mlaia.com</a><br><a href="tel:+972524846282">+972 52 484 6282</a></p></div>
<form class="p-form" action="https://formspree.io/f/mvzdggyq" method="POST"><input type="hidden" name="practice" value="audio-ai"><input type="hidden" name="topic" value="{esc(slug)}"><div class="p-form-row"><label>Name<input name="name" autocomplete="name" required></label><label>Company<input name="company" autocomplete="organization"></label></div><label>Work email<input type="email" name="email" autocomplete="email" required></label><label>What would you like to solve?<textarea name="message" required></textarea></label><p style="font-size:14px;margin:0">Your inquiry is handled under our <a href="/privacy.html">Privacy Policy</a>.</p><button type="submit" class="p-button">Send project inquiry →</button><p class="p-form-status" role="status" aria-live="polite"></p></form></div></section></main>
<footer class="p-footer"><div class="p-wrap"><div>© 2026 MLAIA Data Science · Israel · Working globally</div><div><a href="/#about">About MLAIA</a><a href="/privacy.html">Privacy</a><a href="/accessibility.html">Accessibility</a><a href="/terms.html">Terms</a><button type="button" class="p-cookie-settings">Cookie preferences</button></div></div></footer>
<div class="p-consent" hidden role="dialog" aria-label="Cookie preferences"><p>Optional analytics help us understand how the website is used. You can decline analytics and still use all site features. <a href="/privacy.html">Privacy Policy</a></p><div class="p-actions"><button class="p-button" type="button" data-consent="yes">Accept analytics</button><button class="p-button secondary" type="button" data-consent="no">Decline</button></div></div>
</body></html>
'''


if __name__ == "__main__":
    root = sys.argv[1]
    for path in sys.argv[2:]:
        d = json.load(open(path))
        out = os.path.join(root, "audio-ai", d["slug"], "index.html")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        open(out, "w").write(render(d))
        page = render(d)
        import re
        body = re.sub(r"<script.*?</script>", " ", page[page.index("<body"):], flags=re.S)
        words = len(strip_tags(body).split())
        print(f"wrote {out} ({words} words)")
