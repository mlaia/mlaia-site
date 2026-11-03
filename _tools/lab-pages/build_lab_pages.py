#!/usr/bin/env python3
"""Build one indexable page per audio-lab demo: /audio-ai/lab/<slug>/index.html.

The demo markup is copied from the hub (/audio-ai/lab/index.html), so the hub stays the
single source for each experiment. Edit an experiment there, then re-run:

    python3 _tools/lab-pages/build_lab_pages.py

The shared JS (assets/audio-lab.js, assets/audio-lab-demos.js) wires up only the
experiments whose section is on the page, so each page carries exactly one section.
Page-specific copy (title, description, explainer) lives in PAGES below.
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HUB = ROOT / "audio-ai" / "lab" / "index.html"
SITE = "https://www.mlaia.com"

TOPICS = {
    "anc": ("/audio-ai/noise-reduction-anc/", "Noise reduction and ANC"),
    "beam": ("/audio-ai/beamforming-microphone-arrays/", "Microphone arrays and beamforming"),
    "vib": ("/audio-ai/vibration-analysis/", "Vibration analysis"),
    "edge": ("/audio-ai/edge-audio-ai/", "On-device audio AI"),
}

# Explainer copy: plain technical English, synthetic signals only, no performance claims.
PAGES = [
    {
        "slug": "noise-filtering", "section": "noise", "num": "01", "short": "Noise filtering",
        "tile": "Low-pass filtering, input and output SNR",
        "title": "Low-pass filter noise reduction – interactive demo | MLAIA",
        "name": "Low-pass filter noise reduction – interactive demo",
        "h1": 'Low-pass filter noise reduction: <span class="c-accent">interactive demo</span>',
        "kicker": "Audio lab · Noise filtering",
        "description": "Interactive low-pass filter demo: set the input SNR and cutoff for a synthetic tone in white noise, listen to the result and see output SNR and how much wanted signal survives.",
        "teaches": "Low-pass filtering, signal-to-noise ratio and the noise-versus-distortion trade-off",
        "topic": "anc",
        "answer": "A low-pass filter improves signal-to-noise ratio when the wanted signal sits mostly below the cutoff and the noise is spread across the whole band. In this demo you set the input SNR and the cutoff of a Butterworth filter, then hear and measure the result. Set the cutoff too low and the filter removes part of the wanted signal along with the hiss.",
        "body": [
            "White noise has equal power per hertz, so most of its energy lies far above the few hundred hertz to low kilohertz where a melody’s harmonics sit. A low-pass filter attenuates everything above its cutoff. The noise power that passes shrinks with the bandwidth kept, while a signal concentrated below the cutoff passes almost unchanged.",
            "The demo filters the clean melody and the noise separately with the same second-order Butterworth filter. That is why it can report the output SNR and the share of signal power retained exactly, instead of estimating them. Move the cutoff below the melody’s upper harmonics and the retained figure drops and the tone sounds duller: a better SNR number does not always mean a better-sounding signal.",
            "Filtering is the baseline in sensor conditioning and audio front ends. When speech and noise overlap in frequency, a fixed filter cannot separate them, and adaptive methods such as spectral subtraction or trained models take over. For that work, see {topic}.",
        ],
    },
    {
        "slug": "beamforming", "section": "beamforming", "num": "02", "short": "Beamforming",
        "tile": "Steer a delay-and-sum microphone array",
        "title": "Microphone array beamforming simulator | MLAIA",
        "name": "Microphone array beamforming simulator",
        "h1": 'Microphone array <span class="c-accent">beamforming simulator</span>',
        "kicker": "Audio lab · Beamforming",
        "description": "Interactive delay-and-sum beamforming simulator: steer a uniform linear microphone array, change the number of microphones and hear how two sources from different directions are passed or attenuated.",
        "teaches": "Delay-and-sum beamforming, array factor, steering and aperture",
        "topic": "beam",
        "answer": "Beamforming combines the signals of several microphones so that sound from one direction adds up in phase and sound from other directions partly cancels. This simulator steers an ideal delay-and-sum linear array toward one of two tones and plots its directional response, so you can see and hear how the steering angle and the number of microphones change what gets through.",
        "body": [
            "A source off to the side reaches each microphone at a slightly different time. A delay-and-sum beamformer delays each channel to undo that arrival-time difference for the chosen look direction, then averages the channels. Sound from the look direction adds coherently; sound from other directions arrives with mismatched phases and is attenuated by the amount the array factor in the chart shows.",
            "The microphones here are 4 cm apart. Adding microphones widens the aperture, which narrows the main lobe and deepens the attenuation away from it. The response also depends on frequency: the two sources are tones at 1,000 Hz and 650 Hz, and the lower tone sees a wider beam from the same array. Side lobes mean an off-axis source can still leak through at some angles.",
            "Real arrays add reverberation, microphone mismatch, moving talkers and a compute budget, which is where adaptive beamformers and learned spatial filters come in. See {topic}.",
        ],
    },
    {
        "slug": "active-noise-control", "section": "anc", "num": "03", "short": "Active noise control",
        "tile": "Cancel a hum with an opposing tone",
        "title": "Active noise control (ANC) interactive demo | MLAIA",
        "name": "Active noise control (ANC) interactive demo",
        "h1": 'Active noise control (ANC): <span class="c-accent">interactive demo</span>',
        "kicker": "Audio lab · Active noise control",
        "description": "Interactive active noise control demo: adjust the phase and amplitude of an anti-noise tone against a 180 Hz hum and see and hear destructive interference at one point.",
        "teaches": "Destructive interference, phase and amplitude matching in active noise control",
        "topic": "anc",
        "answer": "Active noise control cancels sound by adding a second sound with the same amplitude and the opposite phase, so the two pressure waves sum to nearly zero. In this demo you tune the phase and amplitude of an opposing tone against a 180 Hz hum and watch the residual. At 180° and matched amplitude the modelled point goes silent; at 0° the hum doubles.",
        "body": [
            "Sound waves superpose linearly. The residual amplitude, relative to the original, is the magnitude of 1 + a·e<sup>jφ</sup>, where a is the amplitude ratio of the anti-noise and φ its phase offset. Small errors leave a residual, and with matched amplitudes a phase error beyond 60° makes the combination louder than the hum alone.",
            "Real systems do this continuously. A reference or error microphone measures the noise, an adaptive filter such as filtered-x LMS updates the anti-noise, and the controller needs a model of the acoustic path from loudspeaker to error microphone. Cancellation is local: a null at one point does not mean a quiet room, and it is easiest at low frequencies, where wavelengths are long compared with the space to be controlled. The same principles carry over to active noise and vibration control in machines and structures.",
            "This demo sets the phase and amplitude by hand to show the principle; it is not a controller. For adaptive ANC work, see {topic}.",
        ],
    },
    {
        "slug": "bearing-fault-vibration", "section": "vibration", "num": "04", "short": "Bearing fault vibration",
        "tile": "Envelope analysis finds an outer-race defect",
        "title": "Bearing fault vibration analysis – interactive demo | MLAIA",
        "name": "Bearing fault vibration analysis – interactive demo",
        "h1": 'Bearing fault vibration analysis: <span class="c-accent">interactive demo</span>',
        "kicker": "Audio lab · Vibration analysis",
        "description": "Interactive bearing fault demo: simulate a rotating machine with imbalance and an outer-race defect, and see why envelope analysis reveals the BPFO line that the raw spectrum hides.",
        "teaches": "Envelope analysis, ball-pass frequency of the outer race (BPFO) and imbalance detection",
        "topic": "vib",
        "answer": "An early bearing defect produces small, repetitive impacts that barely change the overall vibration level, but envelope analysis exposes them as a line at the bearing’s fault frequency. This demo simulates a machine with adjustable imbalance and an outer-race defect, then shows the waveform, the raw spectrum and the envelope spectrum against an alarm threshold.",
        "body": [
            "Each time a rolling element passes an outer-race defect it strikes it, and the impact rings a structural resonance, here at 3 kHz. In the raw spectrum that energy is smeared around the resonance and is easy to miss next to the shaft harmonics. Envelope analysis band-pass filters around the resonance, takes the magnitude of the analytic signal to recover the rhythm of the impacts, and computes the spectrum of that envelope. The repetition rate then appears as a line at the ball-pass frequency of the outer race (BPFO) and its harmonics.",
            "Imbalance behaves differently: it raises the line at 1× shaft speed in the raw spectrum, so the demo tracks the two faults with separate indicators. BPFO depends on bearing geometry and shaft speed, which is why the demo assumes a known speed, as from a tachometer.",
            "Real machines add speed variation, transmission paths and other faults, and alarm thresholds should come from each machine’s own baseline. See {topic}.",
        ],
    },
    {
        "slug": "sound-event-detection", "section": "sound-events", "num": "05", "short": "Sound event detection",
        "tile": "Hits and false alarms of an energy detector",
        "title": "Sound event detection – interactive demo | MLAIA",
        "name": "Sound event detection – interactive demo",
        "h1": 'Sound event detection: <span class="c-accent">interactive demo</span>',
        "kicker": "Audio lab · Sound event detection",
        "description": "Interactive sound event detection demo: tune an energy detector’s feature and threshold on a synthetic scene and see hits, misses and false alarms against ground truth.",
        "teaches": "Energy-based sound event detection, feature choice and the hit versus false-alarm trade-off",
        "topic": "edge",
        "answer": "Sound event detection finds when target sounds occur in a stream of audio and marks where each one starts and ends. This demo runs a simple energy detector over an eight-second synthetic scene of knocks, beeps and low-frequency rumbles and scores it against ground truth, so you can see how the feature and the threshold trade hits against false alarms.",
        "body": [
            "The detector splits the audio into short frames, computes a log energy for each, and flags frames that rise a set number of decibels above the clip’s median level. Neighbouring flagged frames are merged into events. Watching broadband energy, the rumbles look like events and trigger false alarms; restricting the feature to the 1–6 kHz band, where the knocks and beeps carry their energy, ignores them. A lower threshold catches quieter targets and lets more noise through; a higher one does the reverse.",
            "This trade-off is the central design decision for always-on detectors on phones, wearables and sensors. A cheap energy or band-energy stage often runs first and wakes a trained classifier only when something happens, which keeps power low. Learned detectors replace the hand-picked feature and threshold, but the trade-off remains: it moves into the choice of operating point. See {topic}.",
        ],
    },
    {
        "slug": "speech-enhancement", "section": "spectral-subtraction", "num": "06", "short": "Speech enhancement",
        "tile": "Spectral subtraction and musical noise",
        "title": "Spectral subtraction speech enhancement demo | MLAIA",
        "name": "Spectral subtraction speech enhancement demo",
        "h1": 'Spectral subtraction <span class="c-accent">speech enhancement demo</span>',
        "kicker": "Audio lab · Speech enhancement",
        "description": "Interactive spectral subtraction demo: estimate the noise spectrum, subtract it frame by frame from a speech-like signal and hear the trade-off between noise reduction, distortion and musical noise.",
        "teaches": "Spectral subtraction, over-subtraction, spectral floor and musical noise",
        "topic": "anc", "topic_href": "/audio-ai/noise-reduction-anc/#speech-enhancement", "topic_label": "speech enhancement and noise reduction",
        "answer": "Spectral subtraction reduces steady background noise by estimating the noise power spectrum and subtracting it from each short-time frame of the noisy signal. In this demo you choose the noise type, the input SNR, the over-subtraction factor and the spectral floor, then compare the spectrograms and listen to the clean, noisy and enhanced signals.",
        "body": [
            "The signal is cut into overlapping windowed frames and transformed with an FFT. The noise spectrum is estimated from a stretch that contains only noise, here the first half second. Each frequency bin then gets a gain that shrinks it according to how much of its power the noise estimate explains, and the frames are resynthesised by overlap-add.",
            "Over-subtraction removes more than the estimate to suppress noise peaks, at the cost of eating into speech. Where the gain swings from frame to frame, isolated bins survive and are heard as warbling “musical noise”; the spectral floor limits the attenuation and keeps the residual smoother. The method assumes stationary noise, so a fixed estimate suits a steady fan and goes stale when the noise fluctuates. Adaptive noise trackers and trained enhancement models address that.",
            "This is noise reduction on a captured signal, unlike active noise control, which plays anti-noise into the air. See {topic}.",
        ],
    },
]
BY_SECTION = {p["section"]: p for p in PAGES}


def og(p):
    return f"{SITE}/assets/og/lab-{p['slug']}.png"


def url(p):
    return f"/audio-ai/lab/{p['slug']}/"


def extract(hub):
    def one(pattern):
        m = re.search(pattern, hub, re.S)
        assert m, pattern
        return m.group(0)
    parts = {
        "fonts": one(r'<link rel="preconnect" href="https://fonts.googleapis.com">.*?rel="stylesheet">'),
        "ga": one(r"<script>\(function\(\)\{var GA=.*?</script>"),
        "quicknav": one(r'<nav class="site-quick-nav".*?</nav>'),
        "volume": one(r'<label for="volume">.*?</label>'),
        "stop": one(r'<button type="button" id="stop".*?</button>'),
        "note": one(r'<p class="lab-note">.*?</p>'),
        "status": one(r'<p class="lab-status" id="audio-status".*?</p>'),
        "noscript": one(r"<noscript>.*?</noscript>"),
        "contact": one(r'<section class="c-contact" id="contact".*?</section>'),
        "footer": one(r'<footer class="c-footer">.*?</footer>'),
        "sections": {},
    }
    for p in PAGES:
        sec = one(r'<section class="lab-experiment c-sec" id="%s".*?</section>' % re.escape(p["section"]))
        sec = re.sub(r'<a class="lab-open"[^>]*>.*?</a>', "", sec)  # hub-only "Open as a page" link
        # in-page anchors to other experiments become links to their pages
        sec = re.sub(r'href="#([a-z-]+)"', lambda m: f'href="{url(BY_SECTION[m.group(1)])}"' if m.group(1) in BY_SECTION else m.group(0), sec)
        parts["sections"][p["section"]] = sec
    return parts


def jsonld(p):
    page_url = SITE + url(p)
    crumbs = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "MLAIA", "item": SITE + "/"},
        {"@type": "ListItem", "position": 2, "name": "Audio & Acoustics", "item": SITE + "/audio-ai/"},
        {"@type": "ListItem", "position": 3, "name": "Audio lab", "item": SITE + "/audio-ai/lab/"},
        {"@type": "ListItem", "position": 4, "name": p["name"], "item": page_url},
    ]}
    resource = {"@context": "https://schema.org", "@type": ["WebPage", "LearningResource"],
                "name": p["name"], "description": p["description"], "url": page_url,
                "inLanguage": "en", "isAccessibleForFree": True,
                "learningResourceType": "Interactive simulation", "teaches": p["teaches"],
                "image": og(p),
                "isPartOf": {"@type": "WebPage", "name": "Interactive Audio Lab", "url": SITE + "/audio-ai/lab/"},
                "provider": {"@id": SITE + "/#organization"}}
    dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(",", ":"))
    return (f'<script type="application/ld+json">{dump(crumbs)}</script>'
            f'<script type="application/ld+json">{dump(resource)}</script>')


def build(p, parts):
    e = html.escape
    page_url = SITE + url(p)
    OG = og(p)
    topic_href, topic_name = TOPICS[p["topic"]]
    topic_href = p.get("topic_href", topic_href)
    topic_link = f'<a href="{topic_href}">{p.get("topic_label", topic_name.lower())}</a>'
    body = "".join(f"<p>{para.format(topic=topic_link)}</p>" for para in p["body"])
    jumps = "".join(
        f'<a href="{url(q)}"' + (' aria-current="page"' if q is p else "") + f'>{q["num"]} / {q["short"]}</a>'
        for q in PAGES)
    tiles = "".join(
        f'<a class="c-tile" href="{url(q)}"><small>{q["num"]} / {q["short"]}</small><strong>{q["name"]}</strong><span>{q["tile"]}</span></a>'
        for q in PAGES if q is not p)
    head = (
        '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        f'<title>{e(p["title"], quote=False)}</title><meta name="description" content="{e(p["description"])}">'
        + parts["fonts"] + "\n"
        '<link rel="stylesheet" href="/assets/mlaia-c.css"><link rel="stylesheet" href="/assets/audio-lab.css">'
        '<script src="/assets/audio-lab.js" defer></script><script src="/assets/audio-lab-demos.js" defer></script>'
        f'<link rel="canonical" href="{page_url}">'
        f'<meta property="og:title" content="{e(p["title"])}"><meta property="og:description" content="{e(p["description"])}">'
        f'<meta property="og:type" content="website"><meta property="og:url" content="{page_url}">'
        f'<meta property="og:image" content="{OG}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
        f'<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{e(p["title"])}">'
        f'<meta name="twitter:description" content="{e(p["description"])}"><meta name="twitter:image" content="{OG}">'
        + jsonld(p)
        + '<link rel="stylesheet" href="/assets/site-shell.css"><script src="/assets/site-shell.js" defer></script>'
        + parts["ga"] + "</head>"
    )
    return "\n".join([
        head + '<body class="practice-page audio-lab lab-demo-page c-page" data-site-shell="true">',
        "<!-- Generated by _tools/lab-pages/build_lab_pages.py from /audio-ai/lab/index.html. Edit the hub or the script, not this file. -->",
        parts["quicknav"],
        f'<a class="c-skip" href="#main">Skip to the {e(p["short"].lower())} demo</a>',
        '<header class="c-nav">\n  <div class="c-wrap c-nav__inner">\n    <a class="c-logo" href="/">MLAIA</a>\n'
        '    <nav class="lab-nav" aria-label="Main navigation">\n      <a href="/audio-ai/lab/">← Audio lab</a>\n'
        '      <a class="c-btn" href="#contact">Let’s talk</a>\n    </nav>\n  </div>\n</header>',
        '<main class="lab-main" id="main">',
        '<section class="c-hero lab-hero" aria-labelledby="page-title">',
        '<div class="c-wrap"><div class="lab-heading lab-heading--demo"><div>'
        f'<nav class="c-crumb" aria-label="Breadcrumb"><a href="/">MLAIA</a> / <a href="/audio-ai/">Audio &amp; Acoustics</a> / <a href="/audio-ai/lab/">Audio lab</a> / {e(p["short"])}</nav>'
        f'<p class="c-kicker"><span class="c-idx" aria-hidden="true">{p["num"]}</span>{e(p["kicker"])}</p>'
        f'<h1 class="c-display" id="page-title">{p["h1"]}</h1>'
        f'<p class="lab-answer">{p["answer"]}</p></div><span class="lab-badge">SYNTHETIC SIGNALS</span></div></div>',
        f'<div class="lab-toolbar"><div class="c-wrap lab-toolbar__inner"><nav class="lab-jumps" aria-label="Audio lab demos">{jumps}</nav>{parts["volume"]}{parts["stop"]}</div></div>',
        f'<div class="c-wrap">{parts["note"]}{parts["status"]}{parts["noscript"]}</div>',
        "</section>",
        parts["sections"][p["section"]],
        f'<section class="c-sec lab-explain" aria-labelledby="explain-title"><div class="c-wrap c-split"><div class="c-split__head"><p class="c-kicker">The principle</p><h2 class="c-h2" id="explain-title">How it works</h2></div>'
        f'<div class="c-prose">{body}</div></div></section>',
        f'<section class="c-sec lab-more" aria-labelledby="more-title"><div class="c-wrap"><p class="c-kicker">Audio lab</p><h2 class="c-h2" id="more-title">More demos</h2>'
        f'<div class="c-tiles">{tiles}</div>'
        f'<p class="c-links"><a class="c-link" href="/audio-ai/lab/">All six demos on one page: the audio lab</a><a class="c-link" href="{topic_href}">{topic_name} →</a></p></div></section>',
        '<section class="c-sec lab-end-sec" aria-label="Next steps"><div class="c-wrap lab-end"><a class="c-btn" href="/audio-ai/#contact">Discuss your audio or edge-AI project →</a><a class="c-link" href="/#interactive-demos">Explore all demonstrations</a></div></section>',
        "</main>",
        parts["contact"],
        parts["footer"],
        "</body></html>",
        "",
    ])


def main():
    parts = extract(HUB.read_text(encoding="utf-8"))
    for p in PAGES:
        out = ROOT / "audio-ai" / "lab" / p["slug"] / "index.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(build(p, parts), encoding="utf-8")
        words = len(re.sub(r"<[^>]+>", " ", p["answer"] + " " + " ".join(p["body"])).split())
        print(f"{out.relative_to(ROOT)}  explainer {words} words")


if __name__ == "__main__":
    main()
