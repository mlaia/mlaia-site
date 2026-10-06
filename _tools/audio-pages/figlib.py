"""Shared helpers for hand-built inline SVG figures (MLAIA practice pages)."""
import math, os

INK, BLUE, QUIET, LINE, TINT = "#0a1628", "#0057ff", "#526078", "#dce3f0", "#eaf0fc"
FONT = "font-family=\"'DM Sans',Arial,sans-serif\""
SOLID = f'stroke="{BLUE}" stroke-width="2.4" stroke-linejoin="round"'
DASH = f'stroke="{QUIET}" stroke-width="1.8" stroke-dasharray="5 4"'
DOT = f'stroke="{INK}" stroke-width="1.8" stroke-dasharray="1.5 3.5" stroke-linecap="round"'

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "figures")
os.makedirs(OUT, exist_ok=True)


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def svg_open(W, H, label):
    return f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" {FONT} role="img" aria-label="{esc(label)}">'


def markers(prefix):
    return (f'<defs><marker id="{prefix}-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
            f'<path d="M0,0 L10,5 L0,10 z" fill="{INK}"/></marker>'
            f'<marker id="{prefix}-b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
            f'<path d="M0,0 L10,5 L0,10 z" fill="{BLUE}"/></marker></defs>')


def text(x, y, s, size=12, weight=None, fill=INK, anchor="start", halo=False):
    w = f' font-weight="{weight}"' if weight else ""
    h = ' stroke="#fff" stroke-width="3" paint-order="stroke"' if halo else ""
    return f'<text x="{x:.1f}" y="{y:.1f}" text-anchor="{anchor}" font-size="{size}"{w} fill="{fill}"{h}>{esc(s)}</text>'


def box(x, y, w, h, label, sub=None, hot=False, size=12.5):
    fill, stroke, sw = (TINT, BLUE, 2) if hot else ("#fff", INK, 1.4)
    s = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="5" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'
    cy = y + h / 2 + (-3 if sub else 4.5)
    s += text(x + w / 2, cy, label, size, 700, anchor="middle")
    if sub:
        s += text(x + w / 2, cy + 15, sub, 10.5, fill=QUIET, anchor="middle")
    return s


def arrow(points, prefix, color=INK, label=None, label_at=None, dashed=False, width=1.4, label_anchor="middle", label_color=None):
    """Polyline arrow through points [(x,y),...]; optional label at label_at (x,y)."""
    pts = " ".join(f"{x:.1f},{y:.1f}" for x, y in points)
    m = f"{prefix}-b" if color == BLUE else f"{prefix}-a"
    d = ' stroke-dasharray="4 3"' if dashed else ""
    s = f'<polyline points="{pts}" fill="none" stroke="{color}" stroke-width="{width}"{d} marker-end="url(#{m})"/>'
    if label:
        lx, ly = label_at
        s += text(lx, ly, label, 10.5, fill=label_color or (BLUE if color == BLUE else QUIET), anchor=label_anchor)
    return s


def chart(prefix, W, H, title, subtitle, xr, yr, xticks, yticks, xlabel, ylabel, series,
          xlog=False, extra=None, legend=True, margins=(58, 18, 64, 44), aria=None):
    """Line chart. series: [(legend label 'name — note', style, xs, ys)].
    extra(px, py) -> list of svg strings drawn above the series (px/py map data->pixels)."""
    L, R, T, B = margins
    n_leg = len(series) if legend else 0
    plot_b = H - B - n_leg * 22
    x0, x1, y0, y1 = L, W - R, T, plot_b

    def px(v):
        if xlog:
            return x0 + (math.log10(v) - math.log10(xr[0])) / (math.log10(xr[1]) - math.log10(xr[0])) * (x1 - x0)
        return x0 + (v - xr[0]) / (xr[1] - xr[0]) * (x1 - x0)

    def py(v):
        return y1 - (v - yr[0]) / (yr[1] - yr[0]) * (y1 - y0)

    o = [svg_open(W, H, aria or f"{title}. {subtitle}"), markers(prefix)]
    o.append(f'<defs><clipPath id="{prefix}-clip"><rect x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}"/></clipPath></defs>')
    if title:
        o.append(text(W / 2, 24, title, 15, 700, anchor="middle"))
    if subtitle:
        o.append(text(W / 2, 43, subtitle, 12.5, fill=QUIET, anchor="middle"))
    for v, lab in yticks:
        o.append(f'<line x1="{x0}" y1="{py(v):.1f}" x2="{x1}" y2="{py(v):.1f}" stroke="{LINE}"/>')
        o.append(text(x0 - 6, py(v) + 4, lab, 10.5, fill=QUIET, anchor="end"))
    for v, lab in xticks:
        o.append(f'<line x1="{px(v):.1f}" y1="{y0}" x2="{px(v):.1f}" y2="{y1}" stroke="{LINE}"/>')
        o.append(text(px(v), y1 + 16, lab, 10.5, fill=QUIET, anchor="middle"))
    o.append(f'<rect x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}" fill="none" stroke="{QUIET}" stroke-opacity=".5"/>')
    if xlabel:
        o.append(text((x0 + x1) / 2, y1 + 33, xlabel, 11.5, fill=INK, anchor="middle"))
    if ylabel:
        o.append(f'<text transform="translate(14 {(y0 + y1) / 2:.1f}) rotate(-90)" text-anchor="middle" font-size="11.5" fill="{INK}">{esc(ylabel)}</text>')
    under = extra(px, py, x0, x1, y0, y1) if extra else ([], [])
    o.extend(under[0])
    o.append(f'<g clip-path="url(#{prefix}-clip)">')
    for _, style, xs, ys in series:
        pts = " ".join(f"{px(x):.1f},{py(y):.1f}" for x, y in zip(xs, ys))
        o.append(f'<polyline points="{pts}" fill="none" {style}/>')
    o.append("</g>")
    o.extend(under[1])
    if legend:
        for i, (label, style, _, _) in enumerate(series):
            ly = H - 14 - (n_leg - 1 - i) * 22
            name, _, note = label.partition(" — ")
            o.append(f'<line x1="{x0}" y1="{ly - 4}" x2="{x0 + 26}" y2="{ly - 4}" {style}/>')
            o.append(f'<text x="{x0 + 34}" y="{ly}" font-size="12" fill="{INK}"><tspan font-weight="700">{esc(name)}</tspan>'
                     + (f'<tspan fill="{QUIET}"> — {esc(note)}</tspan>' if note else "") + "</text>")
    o.append("</svg>")
    return "".join(o)


def save(name, svg):
    open(os.path.join(OUT, name), "w").write(svg)
    print("wrote", name, f"{len(svg) / 1024:.1f} KB")
