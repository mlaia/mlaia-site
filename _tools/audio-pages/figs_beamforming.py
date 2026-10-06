"""Generate physics-based inline SVG figures for the beamforming page.

Writes figures/*.svg next to this script. Colours follow assets/practices.css tokens.
"""
import cmath, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "figures")
os.makedirs(OUT, exist_ok=True)

INK, BLUE, QUIET, LINE = "#0a1628", "#0057ff", "#526078", "#dce3f0"
C = 343.0  # speed of sound, m/s
FONT = "font-family=\"'DM Sans',Arial,sans-serif\""


def array_factor_db(theta, n_mics, spacing_m, freq_hz, steer=0.0):
    """Delay-and-sum response of a uniform linear array; theta from broadside."""
    k = 2 * math.pi * freq_hz / C
    psi = k * spacing_m * (math.sin(theta) - math.sin(steer))
    af = abs(sum(cmath.exp(1j * n * psi) for n in range(n_mics))) / n_mics
    return 20 * math.log10(max(af, 1e-6))


def polar_panel(title, subtitle, curves, annotations, floor_db=-30):
    """One polar plot, 0 deg (broadside) pointing up. curves: (label, style, fn)."""
    W, H, cx, cy, R = 360, 430, 180, 210, 132
    o = [f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" {FONT} role="img" aria-label="{title}: {subtitle}">']
    o.append(f'<text x="{cx}" y="26" text-anchor="middle" font-size="15" font-weight="700" fill="{INK}">{title}</text>')
    o.append(f'<text x="{cx}" y="46" text-anchor="middle" font-size="12.5" fill="{QUIET}">{subtitle}</text>')
    # rings every 10 dB
    ring_labels = []
    for db in range(0, floor_db - 1, -10):
        r = R * (db - floor_db) / -floor_db
        if r <= 0:
            continue
        o.append(f'<circle cx="{cx}" cy="{cy}" r="{r:.1f}" fill="none" stroke="{LINE}" stroke-width="1"/>')
        ring_labels.append(f'<text x="{cx + 4}" y="{cy - r + 12:.1f}" font-size="10.5" fill="{QUIET}" stroke="#fff" stroke-width="3" paint-order="stroke">{db} dB</text>')
    # spokes and angle labels
    for deg in range(0, 360, 30):
        a = math.radians(deg)
        x, y = cx + R * math.sin(a), cy - R * math.cos(a)
        o.append(f'<line x1="{cx}" y1="{cy}" x2="{x:.1f}" y2="{y:.1f}" stroke="{LINE}" stroke-width="1"/>')
    for deg, lab in ((0, "0° look"), (90, "90°"), (180, "180°"), (270, "−90°")):
        a = math.radians(deg)
        x, y = cx + (R + 16) * math.sin(a), cy - (R + 16) * math.cos(a) + 4
        anchor = "start" if deg == 90 else "end" if deg == 270 else "middle"
        o.append(f'<text x="{x:.1f}" y="{y:.1f}" text-anchor="{anchor}" font-size="11" fill="{QUIET}">{lab}</text>')
    # curves
    for _, style, fn in curves:
        pts = []
        for i in range(721):
            th = math.radians(i * 0.5)
            r = R * (max(fn(th), floor_db) - floor_db) / -floor_db
            pts.append(f"{cx + r * math.sin(th):.1f},{cy - r * math.cos(th):.1f}")
        o.append(f'<polyline points="{" ".join(pts)}" fill="none" {style}/>')
    o.extend(ring_labels)
    # array: four mic dots along the horizontal axis
    for i in range(4):
        o.append(f'<circle cx="{cx - 15 + i * 10}" cy="{cy}" r="3" fill="{INK}"/>')
    for a in annotations:
        o.append(a)
    # legend
    for i, (label, style, _) in enumerate(curves):
        ly, x0 = H - 48 + i * 22, 36
        name, _, note = label.partition(" — ")
        o.append(f'<line x1="{x0}" y1="{ly}" x2="{x0 + 26}" y2="{ly}" {style}/>')
        o.append(f'<text x="{x0 + 34}" y="{ly + 4}" font-size="12" fill="{INK}"><tspan font-weight="700">{name}</tspan>'
                 + (f'<tspan fill="{QUIET}"> — {note}</tspan>' if note else "") + "</text>")
    o.append("</svg>")
    return "".join(o)


def callout(x1, y1, x2, y2, text, anchor="start"):
    return (f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{INK}" stroke-width="1"/>'
            f'<text x="{x2 + (4 if anchor == "start" else -4)}" y="{y2 + 4}" text-anchor="{anchor}" font-size="11.5" font-weight="600" fill="{INK}">{text}</text>')


SOLID = f'stroke="{BLUE}" stroke-width="2.4" stroke-linejoin="round"'
DASH = f'stroke="{QUIET}" stroke-width="1.8" stroke-dasharray="5 4"'

# Panel A: 4 mics, 2 cm spacing (6 cm aperture): frequency decides directivity.
panel_a = polar_panel(
    "Small aperture", "4 mics · 2 cm spacing · 6 cm across",
    [("4 kHz — a usable beam", SOLID, lambda t: array_factor_db(t, 4, 0.02, 4000)),
     ("500 Hz — almost omnidirectional", DASH, lambda t: array_factor_db(t, 4, 0.02, 500))], [])

# Panel B: 6 kHz, 2 cm vs 6 cm spacing: wide spacing creates grating lobes.
lobe = math.asin(C / 6000 / 0.06)  # first grating lobe direction from broadside
panel_b = polar_panel(
    "Spacing vs. aliasing", "4 mics at 6 kHz (half-wavelength ≈ 2.9 cm)",
    [(f"6 cm spacing — grating lobes at ±{math.degrees(lobe):.0f}°", SOLID, lambda t: array_factor_db(t, 4, 0.06, 6000)),
     ("2 cm spacing — no grating lobes", DASH, lambda t: array_factor_db(t, 4, 0.02, 6000))], [])

open(os.path.join(OUT, "bf-patterns-a.svg"), "w").write(panel_a)
open(os.path.join(OUT, "bf-patterns-b.svg"), "w").write(panel_b)


# Figure 2: delay-and-sum mechanism.
def delay_and_sum():
    W, H = 720, 360
    th = math.radians(30)
    mx, my, d = [140 + 110 * i for i in range(4)], 170, 110
    prop = (math.sin(th), math.cos(th))          # travel direction (down-right)
    front = (math.cos(th), -math.sin(th))         # along the wavefront
    o = [f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" {FONT} role="img" '
         f'aria-label="Delay-and-sum: a plane wave from angle theta reaches each microphone later by d times sine theta over c; '
         f'delaying each channel to cancel that offset makes the target add in phase at the sum.">']
    o.append(f'<defs><marker id="ds-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
             f'<path d="M0,0 L10,5 L0,10 z" fill="{INK}"/></marker>'
             f'<marker id="ds-arrow-b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
             f'<path d="M0,0 L10,5 L0,10 z" fill="{BLUE}"/></marker></defs>')
    # wavefronts: lines through points upstream of mic 0
    for k, op in ((0, 1), (1, .55), (2, .3)):
        px, py = mx[0] - prop[0] * 46 * k, my - prop[1] * 46 * k
        x1, y1 = px - front[0] * 120, py - front[1] * 120
        x2, y2 = px + front[0] * 300, py + front[1] * 300
        o.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{QUIET}" stroke-width="1.4" stroke-opacity="{op}"/>')
    o.append(f'<text x="{mx[0] + front[0] * 300 - 6:.1f}" y="{my + front[1] * 300 - 8:.1f}" text-anchor="end" font-size="11.5" fill="{QUIET}">wavefront</text>')
    # propagation arrow
    sx, sy = 40, 36
    o.append(f'<line x1="{sx}" y1="{sy}" x2="{sx + prop[0] * 70:.1f}" y2="{sy + prop[1] * 70:.1f}" stroke="{INK}" stroke-width="1.6" marker-end="url(#ds-arrow)"/>')
    o.append(f'<text x="{sx + 4}" y="{sy - 14}" font-size="12" font-weight="600" fill="{INK}">plane wave from θ</text>')
    # broadside reference and theta arc at mic 0
    o.append(f'<line x1="{mx[0]}" y1="{my}" x2="{mx[0]}" y2="{my - 92}" stroke="{QUIET}" stroke-width="1" stroke-dasharray="3 3"/>')
    ax, ay = mx[0] - prop[0] * 60, my - prop[1] * 60
    o.append(f'<path d="M{mx[0]},{my - 60} A60,60 0 0 0 {ax:.1f},{ay:.1f}" fill="none" stroke="{INK}" stroke-width="1"/>')
    o.append(f'<text x="{mx[0] - 22}" y="{my - 66}" font-size="13" fill="{INK}">θ</text>')
    # extra path to mic 1, in blue
    ex = d * math.sin(th)
    fx, fy = mx[1] - prop[0] * ex, my - prop[1] * ex
    o.append(f'<line x1="{fx:.1f}" y1="{fy:.1f}" x2="{mx[1]}" y2="{my}" stroke="{BLUE}" stroke-width="2.6"/>')
    o.append(f'<text x="{mx[1] + 8}" y="{my - 34}" font-size="12" font-weight="700" fill="{BLUE}">d·sinθ</text>')
    o.append(f'<text x="{mx[1] + 8}" y="{my - 20}" font-size="11" fill="{BLUE}">extra path</text>')
    # mics and spacing
    for i, x in enumerate(mx):
        o.append(f'<circle cx="{x}" cy="{my}" r="7" fill="#fff" stroke="{INK}" stroke-width="2"/>')
        o.append(f'<text x="{x + 12}" y="{my + 18}" font-size="11" fill="{QUIET}">mic {i + 1}</text>')
    o.append(f'<line x1="{mx[0]}" y1="{my + 30}" x2="{mx[1]}" y2="{my + 30}" stroke="{INK}" stroke-width="1" marker-start="url(#ds-arrow)" marker-end="url(#ds-arrow)"/>')
    o.append(f'<text x="{(mx[0] + mx[1]) / 2}" y="{my + 26}" text-anchor="middle" font-size="12" fill="{INK}">d</text>')
    # delay boxes: first-reached mic waits longest
    by = my + 52
    for i, x in enumerate(mx):
        lab = ["+3Δ", "+2Δ", "+Δ", "+0"][i]
        o.append(f'<line x1="{x}" y1="{my + 8}" x2="{x}" y2="{by}" stroke="{INK}" stroke-width="1.2"/>')
        o.append(f'<rect x="{x - 26}" y="{by}" width="52" height="28" rx="4" fill="#eaf0fc" stroke="{BLUE}" stroke-width="1.4"/>')
        o.append(f'<text x="{x}" y="{by + 19}" text-anchor="middle" font-size="12.5" font-weight="700" fill="{INK}">{lab}</text>')
    # sum node
    sxn, syn = (mx[0] + mx[3]) / 2, by + 100
    for x in mx:
        o.append(f'<line x1="{x}" y1="{by + 28}" x2="{sxn + (x - sxn) * 0.12:.1f}" y2="{syn - 16}" stroke="{INK}" stroke-width="1.2" marker-end="url(#ds-arrow)"/>')
    o.append(f'<circle cx="{sxn}" cy="{syn}" r="16" fill="#fff" stroke="{INK}" stroke-width="2"/>')
    o.append(f'<text x="{sxn}" y="{syn + 6}" text-anchor="middle" font-size="17" font-weight="700" fill="{INK}">Σ</text>')
    o.append(f'<line x1="{sxn + 16}" y1="{syn}" x2="{sxn + 110}" y2="{syn}" stroke="{BLUE}" stroke-width="2" marker-end="url(#ds-arrow-b)"/>')
    o.append(f'<text x="{sxn + 118}" y="{syn - 4}" font-size="12" font-weight="700" fill="{INK}">target adds in phase</text>')
    o.append(f'<text x="{sxn + 118}" y="{syn + 12}" font-size="11.5" fill="{QUIET}">other directions partly cancel</text>')
    # key relation
    o.append(f'<rect x="{W - 176}" y="{by - 2}" width="160" height="50" rx="6" fill="#fff" stroke="{LINE}"/>')
    o.append(f'<text x="{W - 96}" y="{by + 19}" text-anchor="middle" font-size="13" font-weight="700" fill="{INK}">Δ = d·sinθ / c</text>')
    o.append(f'<text x="{W - 96}" y="{by + 37}" text-anchor="middle" font-size="11" fill="{QUIET}">c ≈ 343 m/s</text>')
    o.append("</svg>")
    return "".join(o)


open(os.path.join(OUT, "bf-delay-sum.svg"), "w").write(delay_and_sum())


# Figure 3: where AEC sits relative to the beamformer.
def aec_placement():
    W, H = 720, 330
    o = [f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" {FONT} role="img" '
         f'aria-label="Two orderings of echo cancellation and beamforming. A: one canceller per microphone before the beamformer, '
         f'cost grows with microphone count but each canceller sees a fixed echo path. B: one canceller after the beamformer, '
         f'cheaper but the echo path it models changes whenever the beam steers.">']
    o.append(f'<defs><marker id="aec-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">'
             f'<path d="M0,0 L10,5 L0,10 z" fill="{INK}"/></marker></defs>')

    def box(x, y, w, label, hot=False, sub=None):
        fill, stroke, sw = ("#eaf0fc", BLUE, 2) if hot else ("#fff", INK, 1.4)
        s = f'<rect x="{x}" y="{y}" width="{w}" height="40" rx="5" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'
        s += f'<text x="{x + w / 2}" y="{y + (20 if sub else 25)}" text-anchor="middle" font-size="12.5" font-weight="700" fill="{INK}">{label}</text>'
        if sub:
            s += f'<text x="{x + w / 2}" y="{y + 33}" text-anchor="middle" font-size="10.5" fill="{QUIET}">{sub}</text>'
        return s

    def arrow(x1, x2, y, label=None):
        s = f'<line x1="{x1}" y1="{y}" x2="{x2 - 2}" y2="{y}" stroke="{INK}" stroke-width="1.4" marker-end="url(#aec-arrow)"/>'
        if label:
            s += f'<text x="{(x1 + x2) / 2}" y="{y - 7}" text-anchor="middle" font-size="10.5" fill="{QUIET}">{label}</text>'
        return s

    rows = [
        (70, "A · Cancel echo per microphone", [("Mics", False, None, 70), ("AEC × N", True, "one per mic", 110), ("Beamformer", False, None, 110), ("Post-filter", False, None, 100)],
         ["N ch", "N ch", "1 ch", "out"], "Cost grows with N.", "Each canceller models a fixed loudspeaker-to-mic path."),
        (225, "B · Cancel echo after the beam", [("Mics", False, None, 70), ("Beamformer", False, None, 110), ("AEC × 1", True, "single canceller", 110), ("Post-filter", False, None, 100)],
         ["N ch", "1 ch", "1 ch", "out"], "One canceller.", "The echo path it models changes whenever the beam steers."),
    ]
    for y, title, boxes, labels, line1, line2 in rows:
        o.append(f'<text x="24" y="{y - 30}" font-size="13.5" font-weight="700" fill="{INK}">{title}</text>')
        x, gap = 24, 56
        aec_x = None
        for i, (lab, hot, sub, w) in enumerate(boxes):
            o.append(box(x, y, w, lab, hot, sub))
            if hot:
                aec_x = x + w / 2
            nx = x + w + gap
            o.append(arrow(x + w, nx if i < len(boxes) - 1 else x + w + 44, y + 20, labels[i]))
            x = nx
        o.append(f'<text x="{x - gap + 50}" y="{y + 25}" font-size="12" font-weight="600" fill="{INK}">to codec / ASR</text>')
        # far-end reference into the AEC
        o.append(f'<line x1="{aec_x}" y1="{y - 22}" x2="{aec_x}" y2="{y - 2}" stroke="{BLUE}" stroke-width="1.4" stroke-dasharray="4 3" marker-end="url(#aec-arrow)"/>')
        o.append(f'<text x="{aec_x + 6}" y="{y - 12}" font-size="10.5" fill="{BLUE}">loudspeaker reference</text>')
        o.append(f'<text x="24" y="{y + 64}" font-size="12" font-weight="700" fill="{INK}">{line1}</text>')
        o.append(f'<text x="{24 + 7.2 * len(line1) + 8:.0f}" y="{y + 64}" font-size="12" fill="{QUIET}">{line2}</text>')
    o.append(f'<line x1="24" y1="160" x2="{W - 24}" y2="160" stroke="{LINE}"/>')
    o.append("</svg>")
    return "".join(o)


open(os.path.join(OUT, "bf-aec-order.svg"), "w").write(aec_placement())
print("figures:", sorted(os.listdir(OUT)))
