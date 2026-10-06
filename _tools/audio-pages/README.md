# Audio topic pages: source and figures

Source for the four topic pages under `/audio-ai/`:
`beamforming-microphone-arrays`, `noise-reduction-anc`, `edge-audio-ai` and `vibration-analysis`.

Each page's `index.html` is generated. Edit the files here, then rebuild.
Don't hand-edit the page HTML, or the next rebuild will overwrite your change.

This folder starts with `_`, so GitHub Pages (Jekyll) does not publish it.
Keep that prefix. If a `.nojekyll` file is ever added, move this folder out of the site.

## Layout

| Path | What it is |
|------|------------|
| `content/<slug>.json` | Page text: meta, hero, sections, cards, steps, FAQ, related reads, and which figures go in which section |
| `render_audio.py` | Turns a content JSON into `audio-ai/<slug>/index.html` using the practice-page shell. Builds Service, BreadcrumbList and FAQPage JSON-LD from the same text |
| `figures/*.svg` | Generated figures, inlined into the pages at render time |
| `figs_beamforming.py` | Beamforming figures (polar patterns from the array factor, delay-and-sum, AEC placement) |
| `figs_anc.py` | Noise reduction & ANC figures |
| `figs_edge.py` | On-device audio AI figures |
| `figs_vib.py` | Vibration figures (simulated signals, fixed seed; needs numpy and scipy) |
| `figlib.py` | Shared SVG helpers and colour tokens (match `assets/practices.css`) |

## Rebuild

Run from the repository root:

```bash
python3 _tools/audio-pages/figs_beamforming.py
python3 _tools/audio-pages/figs_anc.py
python3 _tools/audio-pages/figs_edge.py
python3 _tools/audio-pages/figs_vib.py
python3 _tools/audio-pages/render_audio.py . _tools/audio-pages/content/*.json
```

If you only changed text, the last command is enough.

## Content rules

- Claim only experience the site already states. Don't invent clients, results or numbers.
- In JSON text fields, escape ampersands as `&amp;`. The renderer normalises `title`, `description`, `service_name` and `breadcrumb`, so either form works there.
- Figure captions must state any idealised assumptions a chart relies on.
- A new topic page also needs a link from the `#topics` section of `audio-ai/index.html`, plus entries in `sitemap.xml` and `llms.txt`.
