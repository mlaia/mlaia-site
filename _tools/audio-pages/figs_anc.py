"""Figures for /audio-ai/noise-reduction-anc/."""
import cmath, math
from figlib import *

# 1. Suppression gain vs a priori SNR.
xs = [i / 10 for i in range(-250, 251)]
xi = [10 ** (x / 10) for x in xs]
wiener = [20 * math.log10(v / (1 + v)) for v in xi]
power_ss = [10 * math.log10(v / (1 + v)) for v in xi]  # power spectral subtraction, gamma = xi + 1
FLOOR = -15


def gain_extra(px, py, x0, x1, y0, y1):
    under = [f'<rect x="{x0}" y="{py(FLOOR):.1f}" width="{x1 - x0}" height="{y1 - py(FLOOR):.1f}" fill="{TINT}"/>',
             text(x1 - 10, y1 - 12, "below the floor: deep, fluctuating gains → musical noise", 11, fill=INK, anchor="end")]
    over = [f'<line x1="{x0}" y1="{py(FLOOR):.1f}" x2="{x1}" y2="{py(FLOOR):.1f}" stroke="{INK}" stroke-width="1.4" stroke-dasharray="6 3"/>',
            text(x1 - 8, py(FLOOR) - 7, "gain floor, e.g. −15 dB", 11, 600, anchor="end", halo=True),
            text(px(14), py(-4.5), "speech-dominated bins pass", 11, fill=QUIET, anchor="middle", halo=True)]
    return under, over


save("anc-gain.svg", chart(
    "ag", 680, 400, "How hard should each bin be suppressed?", "Single-channel gain rules vs. the estimated SNR in a time-frequency bin",
    (-25, 25), (-30, 2), [(v, f"{v:+d}" if v else "0") for v in range(-20, 21, 10)],
    [(v, f"{v} dB") for v in (0, -10, -20, -30)], "a priori SNR ξ (dB)", "gain (dB)",
    [("Wiener — suppresses harder at low SNR", SOLID, xs, wiener),
     ("Power spectral subtraction — gentler slope", DASH, xs, power_ss)],
    extra=gain_extra,
    aria="Gain in decibels versus a priori SNR. The Wiener gain falls about twice as steeply as power spectral subtraction at low SNR. "
         "A gain floor around minus 15 dB limits how deep the gain can go, which reduces musical noise."))


# 2. Feedforward vs feedback ANC architectures.
def architectures():
    W, H, p = 740, 330, "aa"
    o = [svg_open(W, H, "Feedforward ANC: an outer reference microphone feeds a filter that drives the speaker, racing the noise's acoustic path to the ear. "
                        "Feedback ANC: an error microphone at the ear closes a loop through a controller and the speaker; suppression in one band is paid for by amplification in another."),
         markers(p)]
    for ox, title, sub in ((0, "Feedforward", "outer mic hears the noise first"), (380, "Feedback", "inner mic measures what reaches the ear")):
        o.append(text(ox + 20, 26, title, 15, 700))
        o.append(text(ox + 20, 44, sub, 11.5, fill=QUIET))
        # noise source and acoustic path to the ear (shared by both)
        o.append(f'<circle cx="{ox + 50}" cy="86" r="15" fill="#fff" stroke="{INK}" stroke-width="1.6"/>')
        o.append(text(ox + 50, 90, "noise", 10.5, 600, anchor="middle"))
        o.append(arrow([(ox + 65, 86), (ox + 320, 86), (ox + 320, 186)], p, BLUE, "acoustic path to the ear", (ox + 190, 78), width=2.2))
        o.append(f'<circle cx="{ox + 320}" cy="200" r="13" fill="#fff" stroke="{INK}" stroke-width="1.8"/>')
        o.append(text(ox + 320, 205, "+", 15, 700, anchor="middle"))
        o.append(text(ox + 338, 204, "ear", 11.5, 600))
    # feedforward electronics
    o.append(arrow([(50, 101), (50, 180)], p, label="reaches mic first", label_at=(56, 145), label_anchor="start"))
    o.append(f'<circle cx="50" cy="194" r="9" fill="#fff" stroke="{INK}" stroke-width="1.8"/>')
    o.append(text(50, 222, "ref mic", 10.5, fill=QUIET, anchor="middle"))
    o.append(arrow([(59, 194), (88, 194)], p))
    o.append(box(90, 176, 128, 40, "ADC → filter → DAC", hot=True, size=11.5))
    o.append(arrow([(218, 196), (240, 196)], p))
    o.append(box(242, 176, 52, 40, "driver", size=11.5))
    o.append(arrow([(294, 198), (305, 199)], p, label="anti-noise", label_at=(268, 236)))
    o.append(text(20, 268, "Electronic path must be shorter than the acoustic", 11.5, 700))
    o.append(text(20, 285, "path, or the anti-noise arrives late (causality).", 11.5, 700))
    o.append(text(20, 305, "Depends on fit; no loop to go unstable.", 11.5, fill=QUIET))
    # feedback loop
    ox = 380
    o.append(arrow([(ox + 320, 213), (ox + 320, 248)], p))
    o.append(f'<circle cx="{ox + 320}" cy="258" r="9" fill="#fff" stroke="{INK}" stroke-width="1.8"/>')
    o.append(text(ox + 336, 262, "error mic", 10.5, fill=QUIET))
    o.append(arrow([(ox + 311, 258), (ox + 222, 258)], p, label="residual", label_at=(ox + 268, 250)))
    o.append(box(ox + 100, 238, 120, 40, "controller C", hot=True, size=11.5))
    o.append(arrow([(ox + 160, 238), (ox + 160, 216)], p))
    o.append(box(ox + 130, 176, 60, 40, "driver", size=11.5))
    o.append(arrow([(ox + 190, 198), (ox + 305, 199)], p, label="anti-noise", label_at=(ox + 250, 190)))
    o.append(text(ox + 20, 305, "Closed loop: no reference needed, but suppression in one", 11.5, 700))
    o.append(text(ox + 20, 322, "band is paid for with a boost elsewhere (waterbed effect).", 11.5, 700))
    o.append(f'<line x1="372" y1="14" x2="372" y2="{H - 6}" stroke="{LINE}"/>')
    o.append("</svg>")
    return "".join(o)


save("anc-architectures.svg", architectures())

# 3. Cancellation vs frequency for a pure timing error.
fs_ = [10 ** (math.log10(20) + i * (math.log10(10000) - math.log10(20)) / 600) for i in range(601)]


def residual_db(f, tau):
    return 20 * math.log10(max(abs(1 - cmath.exp(-2j * math.pi * f * tau)), 1e-9))


series = [("10 µs late", DASH, fs_, [residual_db(f, 10e-6) for f in fs_]),
          ("25 µs late", SOLID, fs_, [residual_db(f, 25e-6) for f in fs_]),
          ("50 µs late — adds noise above ≈ 3.3 kHz", DOT, fs_, [residual_db(f, 50e-6) for f in fs_])]


def timing_extra(px, py, x0, x1, y0, y1):
    under = [f'<rect x="{x0}" y="{y0}" width="{x1 - x0}" height="{py(0) - y0:.1f}" fill="{TINT}"/>',
             text(x0 + 10, y0 + 18, "above 0 dB the anti-noise makes it louder", 11, fill=INK)]
    over = [f'<line x1="{x0}" y1="{py(0):.1f}" x2="{x1}" y2="{py(0):.1f}" stroke="{INK}" stroke-width="1.2"/>',
            text(x0 + 10, py(0) + 15, "0 dB: no benefit", 11, 600, halo=True)]
    return under, over


save("anc-timing.svg", chart(
    "at", 680, 420, "Why ANC is a low-frequency tool", "Residual noise when perfectly matched anti-noise arrives late by τ",
    (20, 10000), (-45, 8), [(v, l) for v, l in ((20, "20"), (100, "100"), (1000, "1k"), (10000, "10k"))],
    [(v, f"{v} dB") for v in (0, -10, -20, -30, -40)], "frequency (Hz)", "residual vs. no ANC (dB)", series,
    xlog=True, extra=timing_extra,
    aria="Residual noise versus frequency for anti-noise that is late by 10, 25 or 50 microseconds. Cancellation is deep at low frequencies, "
         "falls to about minus 10 dB near 1 to 5 kilohertz, and above one over six tau the anti-noise increases the noise."))
