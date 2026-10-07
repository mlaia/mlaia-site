"""Render 1200x630 share images (og:image) for MLAIA pages with headless Chrome.

Usage, from the repository root:
    python3 _tools/share-images/make_cards.py
Writes assets/og-image.png (site default) and assets/og/<name>.png.
"""
import html, os, subprocess, sys, tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FIGS = os.path.join(ROOT, "_tools", "audio-pages", "figures")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
W, H = 1200, 630

CSS = """
*{box-sizing:border-box;margin:0}
html,body{width:1200px;height:630px;overflow:hidden}
body{background:#0a1628;color:#fff;font-family:'DM Sans',Arial,sans-serif;position:relative}
body:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 85% 0%,rgba(0,87,255,.35),transparent 55%)}
.card{position:relative;height:100%;padding:56px 64px;display:flex;gap:48px}
.logo{font-family:'Syne',sans-serif;font-weight:800;font-size:34px;letter-spacing:-1.5px}
.logo span{color:#3d7bff}
.eyebrow{margin-top:40px;color:#66d9f0;font-weight:700;font-size:17px;letter-spacing:.16em;text-transform:uppercase}
h1{margin-top:16px;font-size:54px;line-height:1.06;letter-spacing:-.035em;font-weight:700}
.sub{margin-top:20px;font-size:23px;line-height:1.4;color:#c7d2e3}
.url{position:absolute;left:64px;bottom:48px;font-size:19px;color:#8fa3c0;font-weight:600}
.panel{background:#fff;border-radius:14px;padding:20px;display:flex;align-items:center;justify-content:center}
.panel svg{width:100%;height:100%}
.side .text{flex:0 0 520px}
.side .panel{flex:1;height:518px}
.stack{flex-direction:column;gap:0}
.stack .head{display:flex;align-items:baseline;gap:28px}
.stack .head .eyebrow{margin-top:0}
.stack h1{font-size:44px;margin-top:22px}
.stack .panel{margin-top:26px;height:372px}
.stack .url{display:none}
.list{flex-direction:column;align-items:stretch;justify-content:center;gap:0;padding:12px 32px;color:#0a1628}
.list div{display:flex;gap:18px;align-items:baseline;padding:18px 0;border-bottom:1px solid #dce3f0;font-size:25px;font-weight:700}
.list div:last-child{border-bottom:0}
.list small{font-family:ui-monospace,Menlo,monospace;color:#0057ff;font-size:19px;font-weight:600;min-width:34px}
"""
HEAD = ('<!doctype html><html><head><meta charset="utf-8">'
        '<link href="https://fonts.googleapis.com/css2?family=Syne:wght@800&family=DM+Sans:wght@400;600;700&display=block" rel="stylesheet">'
        f'<style>{CSS}</style></head><body>')
LOGO = '<div class="logo">ML<span>AI</span>A</div>'


def fig(name):
    return open(os.path.join(FIGS, name)).read()


def rows(items):
    return '<div class="panel list">' + "".join(
        f"<div><small>{i:02d}</small>{html.escape(t)}</div>" for i, t in enumerate(items, 1)) + "</div>"


def side(eyebrow, title, sub, url, panel):
    return (HEAD + f'<div class="card side"><div class="text">{LOGO}<div class="eyebrow">{eyebrow}</div>'
            f'<h1>{title}</h1><div class="sub">{sub}</div></div>{panel}<div class="url">{url}</div></div></body></html>')


def stack(eyebrow, title, panel):
    return (HEAD + f'<div class="card stack"><div class="head">{LOGO}<div class="eyebrow">{eyebrow}</div></div>'
            f'<h1>{title}</h1>{panel}</div></body></html>')


CARDS = {
    "og-image.png": side("Specialist AI consulting", "Audio, medical AI<br>&amp; prediction.",
                         "Led by Dr. Yochai Edlitz · Ph.D., Weizmann Institute", "mlaia.com",
                         rows(["Audio & acoustics", "Medical AI", "Prediction & causal analysis", "AI & automation"])),
    "og/audio-ai.png": side("Audio &amp; Acoustics", "Intelligence starts<br>with the signal.",
                            "Acoustics, classical DSP and machine learning, engineered together.", "mlaia.com/audio-ai",
                            rows(["Microphone arrays & beamforming", "Noise reduction & ANC", "On-device audio AI", "Vibration analysis"])),
    "og/audio-lab.png": side("Interactive audio lab", "Change it. See it.<br>Hear it.",
                             "Three browser experiments in signal processing. No microphone or uploads needed.", "mlaia.com/audio-ai/lab",
                             rows(["Noise filtering", "Beamforming", "Active noise control"])),
    "og/beamforming-microphone-arrays.png": side("Audio &amp; Acoustics", "Microphone array<br>beamforming.",
                                                 "Geometry sets the limits before any algorithm runs.", "mlaia.com/audio-ai/beamforming-microphone-arrays",
                                                 f'<div class="panel">{fig("bf-patterns-b.svg")}</div>'),
    "og/noise-reduction-anc.png": stack("Audio &amp; Acoustics", "Noise reduction &amp; active noise cancellation",
                                        f'<div class="panel">{fig("anc-timing.svg")}</div>'),
    "og/edge-audio-ai.png": stack("Audio &amp; Acoustics", "On-device audio AI, within memory, latency and power",
                                  f'<div class="panel">{fig("edge-cascade.svg")}</div>'),
    "og/vibration-analysis.png": side("Audio &amp; Acoustics", "Vibration analysis<br>&amp; machine learning.",
                                      "Find the fault the raw spectrum hides.", "mlaia.com/audio-ai/vibration-analysis",
                                      f'<div class="panel">{fig("vib-envelope.svg")}</div>'),
}


def render(name, page):
    out = os.path.join(ROOT, "assets", name)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as f:
        f.write(page)
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                    f"--window-size={W},{H}", "--virtual-time-budget=8000", f"--screenshot={out}", "file://" + f.name],
                   check=True, capture_output=True)
    os.unlink(f.name)
    print("wrote", os.path.relpath(out, ROOT))


if __name__ == "__main__":
    only = set(sys.argv[1:])
    for name, page in CARDS.items():
        if not only or name in only:
            render(name, page)
