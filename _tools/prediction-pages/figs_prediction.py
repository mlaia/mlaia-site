"""Figures for the /predictive-intelligence/ topic pages.

Writes SVGs into _tools/audio-pages/figures/, where the shared renderer reads them.
Run from the repository root: python3 _tools/prediction-pages/figs_prediction.py
The demand chart uses simulated data with a fixed seed. The other two are schematics.
"""
import os, random, sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "audio-pages"))
from figlib import INK, QUIET, LINE, svg_open, markers, text, arrow, save  # noqa: E402

ACC, ACC_TINT = "#b07800", "#fff4d8"  # prediction practice colour (assets/practices.css .predictive)


# 1. Intermittent demand with a Croston-style forecast.
def intermittent():
    W, H, p = 760, 300, "pd"
    rng = random.Random(7)
    weeks = 52
    demand = [rng.choice([1, 2, 2, 3, 4, 6, 9]) if rng.random() < 0.22 else 0 for _ in range(weeks)]

    # Croston (1972): smooth non-zero sizes and the intervals between them separately; forecast = size / interval.
    alpha, z, q, gap, fc = 0.15, None, None, 1, []
    for d in demand:
        fc.append(None if z is None else z / q)
        if d > 0:
            if z is None:
                z, q = float(d), float(gap)
            else:
                z += alpha * (d - z)
                q += alpha * (gap - q)
            gap = 1
        else:
            gap += 1
    zero_share = demand.count(0) / weeks

    L, R, T, B = 52, 20, 58, 72
    x0, x1, y0, y1 = L, W - R, T, H - B
    ymax = 10
    bw = (x1 - x0) / weeks

    def px(i):
        return x0 + i * bw

    def py(v):
        return y1 - v / ymax * (y1 - y0)

    o = [svg_open(W, H, f"Simulated weekly demand for one slow-moving item over {weeks} weeks. About {round(zero_share * 100)}% of weeks have zero demand, "
                        "and non-zero weeks vary in size. A Croston-style forecast, which smooths demand size and the interval between demands separately, "
                        "gives a steady demand rate rather than chasing each spike."),
         markers(p)]
    o.append(text(x0, 24, "One slow-moving item, week by week", 15, 700))
    o.append(text(x0, 43, f"Simulated data · {round(zero_share * 100)}% of weeks have no demand at all", 12, fill=QUIET))
    for v in (0, 5, 10):
        o.append(f'<line x1="{x0}" y1="{py(v):.1f}" x2="{x1}" y2="{py(v):.1f}" stroke="{LINE}"/>')
        o.append(text(x0 - 6, py(v) + 4, str(v), 10.5, fill=QUIET, anchor="end"))
    for i, d in enumerate(demand):
        if d:
            o.append(f'<rect x="{px(i) + 1.5:.1f}" y="{py(d):.1f}" width="{bw - 3:.1f}" height="{py(0) - py(d):.1f}" fill="{INK}"/>')
        else:
            o.append(f'<circle cx="{px(i) + bw / 2:.1f}" cy="{py(0) - 3:.1f}" r="1.6" fill="{QUIET}"/>')
    pts = " ".join(f"{px(i) + bw / 2:.1f},{py(f):.1f}" for i, f in enumerate(fc) if f is not None)
    o.append(f'<polyline points="{pts}" fill="none" stroke="{ACC}" stroke-width="2.6" stroke-linejoin="round"/>')
    for t in (0, 13, 26, 39, 52):
        o.append(text(px(t) if t < weeks else x1, y1 + 16, f"week {t}" if t else "0", 10.5, fill=QUIET, anchor="middle" if t < weeks else "end"))
    o.append(f'<text transform="translate(16 {(y0 + y1) / 2:.1f}) rotate(-90)" text-anchor="middle" font-size="11.5" fill="{INK}">units</text>')
    ly = H - 18
    o.append(f'<rect x="{x0}" y="{ly - 11}" width="12" height="12" fill="{INK}"/>')
    o.append(text(x0 + 18, ly, "actual demand", 12, 700))
    o.append(f'<line x1="{x0 + 140}" y1="{ly - 5}" x2="{x0 + 166}" y2="{ly - 5}" stroke="{ACC}" stroke-width="2.6"/>')
    o.append(text(x0 + 174, ly, "Croston-style rate forecast", 12, 700))
    o.append(text(x0 + 352, ly, "— average size ÷ average interval", 12, fill=QUIET))
    o.append("</svg>")
    return "".join(o)


# 2. Risk is not response: the four uplift groups.
def uplift_quadrant():
    W, H, p = 760, 360, "pu"
    gx, gy, cw, ch = 220, 70, 250, 120
    o = [svg_open(W, H, "Four groups of customers, defined by what they would do with and without a retention offer. Persuadables leave without the offer "
                        "and stay with it. Sure things stay either way. Lost causes leave either way. Sleeping dogs stay without the offer and leave "
                        "because of it. A churn-risk score ranks lost causes and persuadables alike; only the persuadables are worth the offer."),
         markers(p)]
    o.append(text(20, 26, "A high churn score doesn't mean an offer will help", 15, 700))
    o.append(text(20, 45, "Each customer has two possible outcomes. Only one is ever observed.", 12, fill=QUIET))
    o.append(text(gx + cw, gy - 10, "If we make the offer…", 12, 700, anchor="middle"))
    cols = ["…they stay", "…they leave"]
    rows = ["…they leave", "…they stay"]
    cells = [[("Persuadables", "the offer changes the outcome", True), ("Lost causes", "high risk, the offer doesn't help", False)],
             [("Sure things", "stay anyway: the offer is a cost", False), ("Sleeping dogs", "the contact itself drives them away", False)]]
    for j, c in enumerate(cols):
        o.append(text(gx + cw * j + cw / 2, gy + 12, c, 11.5, fill=QUIET, anchor="middle"))
    o.append(text(gx - 16, gy - 10, "Without the offer…", 12, 700, anchor="end"))
    for i, r in enumerate(rows):
        o.append(text(gx - 16, gy + 24 + ch * i + ch / 2, r, 11.5, fill=QUIET, anchor="end"))
        for j in range(2):
            name, sub, hot = cells[i][j]
            x, y = gx + cw * j, gy + 24 + ch * i
            fill, stroke, sw = (ACC_TINT, ACC, 2.2) if hot else ("#fff", INK, 1.2)
            o.append(f'<rect x="{x + 4}" y="{y + 4}" width="{cw - 8}" height="{ch - 8}" rx="5" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')
            o.append(text(x + cw / 2, y + ch / 2 - 2, name, 15, 700, fill=ACC if hot else INK, anchor="middle"))
            o.append(text(x + cw / 2, y + ch / 2 + 18, sub, 11.5, fill=QUIET, anchor="middle"))
    # risk bracket on the top row
    bx = gx + 2 * cw + 18
    o.append(f'<line x1="{bx}" y1="{gy + 30}" x2="{bx}" y2="{gy + 24 + ch - 6}" stroke="{INK}" stroke-width="1.4"/>')
    o.append(text(bx + 10, gy + 70, "a churn score", 11.5, 700))
    o.append(text(bx + 10, gy + 86, "ranks this", 11.5, 700))
    o.append(text(bx + 10, gy + 102, "whole row high", 11.5, 700))
    o.append(text(20, H - 14, "An uplift model estimates, for customers like this one, how much the offer changes the chance of leaving.", 11.5, 700))
    o.append("</svg>")
    return "".join(o)


# 3. Difference-in-differences, idealised.
def did():
    W, H, p = 760, 320, "pc"
    L, R, T, B = 52, 150, 60, 54
    x0, x1, y0, y1 = L, W - R, T, H - B
    n, t0 = 12, 6

    def px(t):
        return x0 + t / (n - 1) * (x1 - x0)

    def py(v):
        return y1 - v / 100 * (y1 - y0)

    control = [12 + 2.0 * t for t in range(n)]
    treated_cf = [40 + 2.0 * t for t in range(n)]
    treated = [v + (0 if t < t0 else 20) for t, v in enumerate(treated_cf)]
    o = [svg_open(W, H, "Difference-in-differences, idealised. A treated group and a comparison group follow parallel trends before a change. "
                        "After the change, the treated group rises above the path implied by the comparison group's trend. The gap between the "
                        "observed treated line and that dashed counterfactual path is the estimated effect."),
         markers(p)]
    o.append(text(x0, 24, "Difference-in-differences, in one picture", 15, 700))
    o.append(text(x0, 43, "Idealised: the comparison group shows what the treated group would have done", 12, fill=QUIET))
    o.append(f'<rect x="{px(t0 - 0.5):.1f}" y="{y0}" width="{x1 - px(t0 - 0.5):.1f}" height="{y1 - y0}" fill="{ACC_TINT}" opacity=".6"/>')
    o.append(f'<line x1="{px(t0 - 0.5):.1f}" y1="{y0}" x2="{px(t0 - 0.5):.1f}" y2="{y1}" stroke="{INK}" stroke-dasharray="4 3"/>')
    o.append(text(px(t0 - 0.5) + 6, y0 + 14, "change starts", 11, 700))
    o.append(f'<line x1="{x0}" y1="{y1}" x2="{x1}" y2="{y1}" stroke="{QUIET}"/>')
    o.append(text((x0 + x1) / 2, y1 + 22, "time", 11.5, anchor="middle"))
    o.append(f'<text transform="translate(18 {(y0 + y1) / 2:.1f}) rotate(-90)" text-anchor="middle" font-size="11.5" fill="{INK}">outcome</text>')

    def line(vals, style, start=0):
        return f'<polyline points="{" ".join(f"{px(t):.1f},{py(v):.1f}" for t, v in enumerate(vals) if t >= start)}" fill="none" {style}/>'

    o.append(line(control, f'stroke="{QUIET}" stroke-width="2.2"'))
    o.append(line(treated_cf, f'stroke="{ACC}" stroke-width="2" stroke-dasharray="6 5"', t0 - 1))
    o.append(line(treated, f'stroke="{ACC}" stroke-width="2.8" stroke-linejoin="round"'))
    for t, v in enumerate(treated):
        o.append(f'<circle cx="{px(t):.1f}" cy="{py(v):.1f}" r="3" fill="{ACC}"/>')
    for t, v in enumerate(control):
        o.append(f'<circle cx="{px(t):.1f}" cy="{py(v):.1f}" r="3" fill="{QUIET}"/>')
    e = n - 1
    o.append(f'<line x1="{px(e) + 14:.1f}" y1="{py(treated[e]):.1f}" x2="{px(e) + 14:.1f}" y2="{py(treated_cf[e]):.1f}" stroke="{INK}" stroke-width="1.6"/>')
    for v in (treated[e], treated_cf[e]):
        o.append(f'<line x1="{px(e) + 9:.1f}" y1="{py(v):.1f}" x2="{px(e) + 19:.1f}" y2="{py(v):.1f}" stroke="{INK}" stroke-width="1.6"/>')
    o.append(text(px(e) + 26, (py(treated[e]) + py(treated_cf[e])) / 2 + 4, "estimated effect", 12, 700))
    o.append(text(px(e) + 26, py(treated[e]) + 4, "treated", 11.5, 700, fill=ACC))
    o.append(text(px(e) + 26, py(treated_cf[e]) + 18, "without the change", 11, fill=ACC))
    o.append(text(px(e) + 26, py(treated_cf[e]) + 32, "(assumed path)", 11, fill=QUIET))
    o.append(text(px(e) + 26, py(control[e]) + 4, "comparison", 11.5, 700, fill=QUIET))
    o.append("</svg>")
    return "".join(o)


save("pred-intermittent.svg", intermittent())
save("pred-uplift-groups.svg", uplift_quadrant())
save("pred-did.svg", did())
