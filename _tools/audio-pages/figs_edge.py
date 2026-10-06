"""Figures for /audio-ai/edge-audio-ai/."""
from figlib import *


# 1. Wake-word cascade across power domains.
def cascade():
    W, H, p = 760, 250, "ec"
    o = [svg_open(W, H, "Wake-word cascade: microphone audio goes through an always-on front-end and a tiny first-stage detector on a low-power core. "
                        "Only candidates wake the main core, where a larger verifier confirms before the device acts. Rejections are discarded at either stage."),
         markers(p)]
    # power domains
    o.append(f'<rect x="96" y="30" width="330" height="136" rx="8" fill="{TINT}" stroke="{BLUE}" stroke-dasharray="5 4"/>')
    o.append(text(108, 50, "ALWAYS ON · runs every hop · low-power core / DSP", 10.5, 700, fill=BLUE))
    o.append(f'<rect x="496" y="30" width="170" height="136" rx="8" fill="#fff" stroke="{QUIET}" stroke-dasharray="5 4"/>')
    o.append(text(508, 50, "WOKEN ON DEMAND · main core", 10.5, 700, fill=QUIET))
    o.append(box(20, 80, 60, 44, "mic"))
    o.append(arrow([(80, 102), (110, 102)], p))
    o.append(box(112, 80, 120, 44, "front-end", "log-mel features"))
    o.append(arrow([(232, 102), (262, 102)], p))
    o.append(box(264, 80, 146, 44, "stage 1: tiny detector", "cheap, tuned for recall", hot=True, size=11.5))
    o.append(arrow([(410, 102), (512, 102)], p, BLUE, "candidates only", (461, 94), width=2))
    o.append(box(514, 80, 136, 44, "stage 2: verifier", "larger, tuned for precision", size=11.5))
    o.append(arrow([(650, 102), (686, 102)], p))
    o.append(box(688, 80, 52, 44, "act"))
    # rejections
    for x in (337, 582):
        o.append(arrow([(x, 124), (x, 196)], p, dashed=True))
    o.append(text(337, 214, "most audio stops here", 11, fill=QUIET, anchor="middle"))
    o.append(text(582, 214, "false candidates rejected", 11, fill=QUIET, anchor="middle"))
    o.append(text(20, 240, "Idle power is set by everything inside the blue frame, because it runs on every hop.", 11.5, 700))
    o.append("</svg>")
    return "".join(o)


save("edge-cascade.svg", cascade())


# 2. Re-running the window vs streaming with cached state.
def streaming():
    W, H, p, n = 860, 270, "es", 20
    o = [svg_open(W, H, "Without streaming, every hop recomputes all frames in the model's window. With streaming, cached intermediate state is reused "
                        "and each hop computes only the newest frame, so compute per hop drops roughly by the number of frames in the window."),
         markers(p)]
    cw, gap, x0 = 20, 4, 210
    rows = [(60, "Re-run the window", "every frame, every hop", [True] * n, f"{n} frames per hop"),
            (160, "Stream with cached state", "reuse earlier work", [False] * (n - 1) + [True], "1 frame per hop")]
    for y, title, sub, hot, note in rows:
        o.append(text(20, y + 14, title, 13, 700))
        o.append(text(20, y + 31, sub, 11, fill=QUIET))
        for i, h in enumerate(hot):
            x = x0 + i * (cw + gap)
            fill, stroke = (BLUE, BLUE) if h else ("#fff", LINE)
            o.append(f'<rect x="{x}" y="{y}" width="{cw}" height="36" rx="3" fill="{fill}" stroke="{stroke}" stroke-width="1.4"/>')
        o.append(text(x0 + n * (cw + gap) + 10, y + 23, note, 12, 700))
    o.append(arrow([(x0, 232), (x0 + n * (cw + gap) - gap, 232)], p, label="time → newest frame on the right", label_at=(x0 + 280, 250)))
    o.append(f'<rect x="{x0}" y="112" width="12" height="12" fill="{BLUE}"/>')
    o.append(text(x0 + 18, 122, "computed this hop", 11, fill=QUIET))
    o.append(f'<rect x="{x0 + 140}" y="112" width="12" height="12" fill="#fff" stroke="{LINE}" stroke-width="1.4"/>')
    o.append(text(x0 + 158, 122, "reused from cache", 11, fill=QUIET))
    o.append("</svg>")
    return "".join(o)


save("edge-streaming.svg", streaming())


# 3. Example end-to-end latency budget.
def latency():
    W, H, p = 740, 230, "el"
    segs = [("buffer the analysis window", 25, False), ("features", 2, False), ("inference", 8, True),
            ("decision smoothing (3 hops)", 30, False), ("wake + act", 5, False)]
    total = sum(s[1] for s in segs)
    x0, x1, y = 30, 710, 92
    scale = (x1 - x0) / 80
    o = [svg_open(W, H, f"Example latency budget from sound onset to action: {', '.join(f'{n} {v} ms' for n, v, _ in segs)}, about {total} ms in total. "
                        "In this example, inference is a small share; buffering and decision smoothing dominate."),
         markers(p)]
    o.append(text(30, 26, "Where the milliseconds go — an example budget", 15, 700))
    o.append(text(30, 45, "25 ms window · 10 ms hop · 3-hop smoothing. Real values come from profiling on your device.", 11.5, fill=QUIET))
    x = x0
    for i, (name, ms, hot) in enumerate(segs):
        w = ms * scale
        fill = BLUE if hot else (TINT if i % 2 == 0 else "#fff")
        o.append(f'<rect x="{x:.1f}" y="{y}" width="{w:.1f}" height="40" fill="{fill}" stroke="{BLUE if hot else INK}" stroke-width="1.2"/>')
        if w > 60:
            o.append(text(x + w / 2, y + 25, f"{ms} ms", 12, 700, fill="#fff" if hot else INK, anchor="middle"))
        # label below, alternating rows to avoid collisions
        ly = y + 62 if i % 2 == 0 else y + 82
        o.append(f'<line x1="{x + w / 2:.1f}" y1="{y + 40}" x2="{x + w / 2:.1f}" y2="{ly - 12}" stroke="{QUIET}"/>')
        o.append(text(x + w / 2, ly, f"{name}" + ("" if w > 60 else f" · {ms} ms"), 11, 700 if hot else None,
                      fill=BLUE if hot else INK, anchor="middle" if 60 < x + w / 2 < 640 else ("start" if x + w / 2 <= 60 else "end")))
        x += w
    o.append(f'<line x1="{x0}" y1="{y - 12}" x2="{x0}" y2="{y + 52}" stroke="{INK}" stroke-width="1.6"/>')
    o.append(text(x0, y - 18, "sound onset", 11, 600))
    o.append(f'<line x1="{x:.1f}" y1="{y - 12}" x2="{x:.1f}" y2="{y + 52}" stroke="{INK}" stroke-width="1.6"/>')
    o.append(text(x, y - 18, f"device acts ≈ {total} ms", 11, 700, anchor="middle"))
    for t in range(0, 81, 10):
        o.append(text(x0 + t * scale, y + 120, f"{t} ms" if t == 80 else f"{t}", 10, fill=QUIET, anchor="end" if t == 80 else "middle"))
        o.append(f'<line x1="{x0 + t * scale:.1f}" y1="{y + 104}" x2="{x0 + t * scale:.1f}" y2="{y + 108}" stroke="{QUIET}"/>')
    o.append(f'<line x1="{x0}" y1="{y + 104}" x2="{x1}" y2="{y + 104}" stroke="{QUIET}"/>')
    o.append("</svg>")
    return "".join(o)


save("edge-latency.svg", latency())
