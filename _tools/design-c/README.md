# Design C ("engineering bold"): how to convert a page

Reference implementation: `audio-ai/index.html`. Shared files: `assets/mlaia-c.css` (design system) and `assets/mlaia-c.js` (live canvases). Nothing in these files affects a page that does not opt in, and `practices.css`, `practice.js` and `site-shell.*` are unchanged.

## Content rules (strict)

- Use the live page's current text. Keep every URL, section id, FAQ text (word for word, the JSON-LD mirrors it), every JSON-LD block (byte-identical: diff the `application/ld+json` scripts before and after), the contact form (Formspree action, field names, hidden fields), GA/consent behaviour and the site shell.
- Never mention client patents or patent numbers, or Kotleak. No road-noise or car-cabin specifics. No client names in "where we've applied it"; client names only in case studies and testimonials exactly as on the live page.
- Before committing: `grep -nE "12,112,736|0314550|Kotleak|road-noise|cabin" <page>` must print nothing.

## 1. Head

Replace the Syne/DM Sans font link and `practices.css` with:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=IBM+Plex+Sans:wght@400;500;600&family=Martian+Mono:wdth,wght@87.5,300..600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/mlaia-c.css">
<script src="/assets/practice.js" defer></script>
<script src="/assets/mlaia-c.js" defer></script>
...JSON-LD untouched...
<link rel="stylesheet" href="/assets/site-shell.css"><script src="/assets/site-shell.js" defer></script>
```

Drop the page's own inline `<style>` for the old components (`.au-*` etc.) once nothing uses them. Only drop `practices.css` if the page no longer uses any `p-*` *styling* (the `p-*` hooks below are kept as JS hooks only).

## 2. Body and JS hooks that must stay

```html
<body class="practice-page <practice> c-page" data-practice="<practice-id>" data-site-shell="true">
```

- `practice-page` on body: practice.js only wires consent, GA and the form when it is there.
- `data-practice`: analytics practice label.
- Keep the `.site-quick-nav` markup exactly (site-shell). `mlaia-c.css` restyles it dark, scoped to `body.c-page`.
- practice.js hooks, keep these class names alongside the `c-*` ones:
  `button.p-menu` + `nav.p-nav-links#practice-nav` (menu toggles `.open`), `form.p-form` with `.p-form-status`, `button.p-cookie-settings`, `div.p-consent` with `[data-consent="yes|no"]` buttons, `a[href="#contact"]` for CTA tracking.
- Add `c-reading` to the body for the light reading variant (long articles); same type and accents on warm grey, instrument screens stay dark.

## 3. Components (classes)

Layout: `.c-wrap` (max 1440px, 40/24/16px gutter), `.c-sec` (section padding + rule), `.c-sec--alt` (raised background), `.c-split` > `.c-split__head` (sticky left heading, 4/8 columns).

Type: `.c-kicker` with `<span class="c-idx">03</span>` (mono label), `.c-display` (h1, condensed; wrap the accent words in `<span class="c-accent">`), `.c-h2`, `.c-h3`, `.c-lead`, `.c-head` (kicker + h2 + lead block), `.c-note` (mono footnote), `.c-prose` (long-form article body), `.c-mono`, `.c-amber` / `.c-blue` (data colours only: legends, readouts), `.c-sr` (visually hidden).

Buttons and links: `.c-btn`, `.c-btn--ghost`, `.c-btns` (row), `.c-link` (underlined display link), `.c-links` (row of links).

Navigation: `header.c-nav` > `.c-wrap.c-nav__inner` > `a.c-logo`, `button.p-menu.c-menu`, `nav.p-nav-links.c-nav-links` (last item `a.c-btn`). `.c-skip` skip link. `nav.c-crumb` breadcrumb.

Hero: `section.c-hero` (graticule background) containing
- `.c-instrument[data-c-instrument]` > `.c-screen[data-c-scope]` (canvas) + `.c-readout` (`p.c-readout__title`, `dl` of `div` > `dt`/`dd[data-c-read]`; `.c-big`, `.c-raw`, `.c-out` for the headline numbers, `.c-opt` hidden on phones);
- `p.c-legend` (one plain sentence saying what the colours are and what to drag);
- `.c-wrap.c-hero__copy` > crumb, h1, `.c-hero__row` (intro `p` + `.c-btns`), `.c-specs-title` + `dl.c-specs` (3 facts), `.c-creds` list.

Applications: `ul.c-apps` > `li` > `a.c-app` > `span.c-app__num`, `div` (h3, p, `span.c-app__go`), `canvas.c-trace[data-c-trace]`.

Lab teaser: `.c-lab` > `.c-lab__vis[data-c-instrument]` (`.c-screen.c-screen--y[data-c-waterfall]` with `p.c-screen__label` + canvas, then `p.c-legend`) and `.c-lab__txt`.

Link tiles: `.c-tiles` > `a.c-tile` > `small`, `strong`, `span` (3 columns, 2 at tablet, 1 on phones).

Cells: `.c-cells` (3 columns), `.c-cells--4`, `.c-cells--2` > `article.c-cell` > `span.c-cell__num`, h3, p, optional `a.c-link`.

Callout: `.c-callout` (two columns, raised panel).

Records (case studies): `article.c-record` > left `div` (`p.c-record__big[aria-hidden]` big display name, add `--fill` for the first one; `p.c-record__who`; h3; summary; `p.c-record__outcome`) + right `div.c-facts` (h4 + p pairs: Problem, Constraints, What we did, Outcome).

Quotes: `.c-quotes` > `blockquote.c-quote` > p + cite.

Other: `.c-chips` (strong label + `span` chips or `a.c-link`s), `.c-steps` > `article.c-step` > `span.c-step__num[aria-hidden]` + h3 + p, `.c-faq` > `details` > `summary` + `p`, `section.c-contact#contact` > `.c-wrap.c-contact__grid` > `.c-contact__copy` + `form.p-form.c-form` (`.c-form__row` for two fields side by side), `footer.c-footer` > `.c-wrap` > text + `nav`, `div.p-consent.c-consent`.

Tokens (on `.c-page`, overridden by `.c-reading`): `--c-bg`, `--c-bg-2`, `--c-bg-3`, `--c-grid`, `--c-rule`, `--c-rule-2`, `--c-fg`, `--c-text`, `--c-muted`, `--c-amber`, `--c-blue`, `--c-focus`, `--c-btn-*`, `--c-display`, `--c-body`, `--c-mono`, `--c-fs-*`, `--c-gutter`, `--c-max`, `--c-sec`, `--c-gap`, `--c-scope-h`. Amber means raw/input signal, blue means processed/output; do not use them for decoration (the one accent phrase in the h1 is the only exception, as in the approved mockup).

## 4. Live canvases (`mlaia-c.js`)

Auto-initialises on DOMContentLoaded. `window.MLAIAC.init(root)` re-scans after injecting markup; `MLAIAC.instruments` (each has `.frames`, `.visible`) and `MLAIAC.running` help testing.

- `[data-c-scope]` hero oscilloscope: a tone plus white noise at 48 kHz through a fixed 4th-order Butterworth low-pass. Attributes: `data-tone` (Hz, default 440), `data-cutoff` (Hz, default 1000), `data-value` (0..1 starting noise position, default 0.55), `data-hint` (play the one-time "show me" glide 1.5 s after it first appears). The drag handle sets the noise level. Optional native range inputs inside the closest `[data-c-instrument]`: `input[data-c-ctl="tone"]` (semitones from 440 Hz, min -25 max 26), `input[data-c-ctl="level"]` (dB, -20..0), `input[data-c-ctl="phase"]` (degrees, 0..360), each with an `output[data-c-ctl-out="tone|level|phase"]`; markup and styling: `.c-ctls` > `label.c-ctl` > `span.c-ctl__name` + input + `output.c-ctl__val`. Readouts are any `[data-c-read="raw|out|gain|tgain|lag|delay"]` (raw SNR, filtered SNR, improvement, tone gain through the filter, phase lag at the tone, phase delay). They are the exact expected values from the filter's response, not estimates: above the cutoff the filtered SNR drops and the improvement goes negative, as it really does.
- `[data-c-waterfall]` scrolling spectrogram. `data-value` sets the starting tone height (0..1 of 0–4 kHz).
- `canvas[data-c-trace="ear|drone|vib|anc|tone"]` small trace per application row. ear: noisy speech (amber) and cleaned (blue); drone: rotor harmonics with gusts; vib: machine tone with bearing impacts (amber) and envelope (blue); anc: noise (amber) and residual (blue); tone: noisy tone and cleaned. Add new signal kinds in `Trace()`; for Medical use e.g. an ECG, for Prediction a forecast band, keeping amber = observed/raw and blue = model output.

Interactive canvases get a visible handle automatically (`.c-handle`, role="slider", focusable, arrow/Page/Home/End keys, a chip such as "◀ drag ▶ noise −7 dB"). Horizontal handles drag anywhere on the screen (`touch-action: pan-y` keeps vertical page scroll); vertical handles drag from the handle on touch, tap elsewhere to jump. Any new interactive canvas must also get a `p.c-legend` sentence in normal text saying what the colours mean and what to drag.

Behaviour guaranteed by the scheduler: one shared requestAnimationFrame loop, time-based (slow, smooth motion, about half the mockup speed); canvases off-screen (IntersectionObserver) or in a hidden tab do not draw; `prefers-reduced-motion: reduce` (or `?still` in the URL) draws one static frame and redraws only on input; canvases are sized to `devicePixelRatio` (capped at 2) via ResizeObserver; all canvases are `aria-hidden="true"`, the meaning is in the legend, readouts and slider value text.

## 5. Check before committing

1. `python3 -m http.server` from the repo root, open the page at 1440px and 375px: no horizontal scroll (`document.documentElement.scrollWidth === innerWidth`), no console errors.
2. Tab through: focus ring visible on every control, the handle moves with arrow keys.
3. Emulate reduced motion: `MLAIAC.running` is false and frame counters stay still.
4. Scroll to the footer: `MLAIAC.running` becomes false.
5. Tags balanced, JSON-LD diff empty, every `#anchor` and `/path` resolves, the grep in "Content rules" is empty.
