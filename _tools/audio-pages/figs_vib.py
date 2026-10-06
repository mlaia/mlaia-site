"""Figures for /audio-ai/vibration-analysis/ (simulated signals, fixed seed)."""
import math
import numpy as np
from scipy import signal
from figlib import *

rng = np.random.default_rng(7)

# ---------------------------------------------------------------- 1. envelope analysis
FS, T = 20000, 1.0
t = np.arange(int(FS * T)) / FS
SHAFT, N_BALLS, D_RATIO = 25.0, 9, 0.2
BPFO = N_BALLS / 2 * SHAFT * (1 - D_RATIO)          # outer-race defect frequency = 90 Hz
RES, DECAY = 3000.0, 0.0008                          # excited structural resonance

x = 2.0 * np.sin(2 * np.pi * SHAFT * t) + 0.8 * np.sin(2 * np.pi * 2 * SHAFT * t + 0.6)
tk = 0.003
while tk < T:                                        # impacts with ~1% slip jitter
    idx = t >= tk
    tau = t[idx] - tk
    x[idx] += 0.9 * np.exp(-tau / DECAY) * np.sin(2 * np.pi * RES * tau)
    tk += (1 / BPFO) * (1 + 0.01 * rng.standard_normal())
x += 0.3 * rng.standard_normal(len(t))

f_raw, p_raw = signal.welch(x, FS, nperseg=4096)
raw_db = 10 * np.log10(p_raw / p_raw.max())
sos = signal.butter(6, [2000, 4000], btype="band", fs=FS, output="sos")
env = np.abs(signal.hilbert(signal.sosfiltfilt(sos, x)))
env -= env.mean()
E = np.abs(np.fft.rfft(env * np.hanning(len(env))))
f_env = np.fft.rfftfreq(len(env), 1 / FS)
env_lin = E / E[(f_env > 5) & (f_env < 400)].max()


def decimate_xy(xs, ys, lo, hi, n=500):
    m = (xs >= lo) & (xs <= hi)
    xs, ys = xs[m], ys[m]
    if len(xs) <= n:
        return list(xs), list(ys)
    step = len(xs) / n
    out_x, out_y = [], []
    for i in range(n):                       # keep the max in each bucket so peaks survive
        a, b = int(i * step), int((i + 1) * step)
        j = a + int(np.argmax(ys[a:b]))
        out_x.append(xs[j]); out_y.append(ys[j])
    return out_x, out_y


def envelope_figure():
    W, H = 740, 640
    parts = [svg_open(W, H, "Simulated outer-race bearing fault. The raw waveform and raw spectrum are dominated by shaft rotation and a 3 kHz resonance, "
                            f"with no clear line at the {BPFO:.0f} Hz defect frequency. After band-pass filtering around the resonance and demodulating, "
                            f"the envelope spectrum shows clear peaks at {BPFO:.0f}, {2 * BPFO:.0f} and {3 * BPFO:.0f} Hz."),
             markers("ve")]

    def panel(y, h, title, sub, xr, yr, xs, ys, xticks, yticks, xlabel, extra=None, fill=False):
        L, R = 64, 20
        x0, x1, y0, y1 = L, W - R, y + 36, y + h - 34
        px = lambda v: x0 + (v - xr[0]) / (xr[1] - xr[0]) * (x1 - x0)
        py = lambda v: y1 - (v - yr[0]) / (yr[1] - yr[0]) * (y1 - y0)
        o = [text(x0, y + 14, title, 13, 700), text(x0, y + 29, sub, 11, fill=QUIET)]
        for v, lab in yticks:
            o += [f'<line x1="{x0}" y1="{py(v):.1f}" x2="{x1}" y2="{py(v):.1f}" stroke="{LINE}"/>', text(x0 - 6, py(v) + 4, lab, 10, fill=QUIET, anchor="end")]
        for v, lab in xticks:
            o.append(text(px(v), y1 + 15, lab, 10, fill=QUIET, anchor="middle"))
        o.append(text(x1, y1 + 29, xlabel, 10.5, fill=QUIET, anchor="end"))
        if extra:
            o += extra(px, py, x0, x1, y0, y1)
        pts = " ".join(f"{px(a):.1f},{py(min(max(b, yr[0]), yr[1])):.1f}" for a, b in zip(xs, ys))
        o.append(f'<polyline points="{pts}" fill="none" stroke="{BLUE}" stroke-width="1.3" stroke-linejoin="round"/>')
        o.append(f'<rect x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}" fill="none" stroke="{QUIET}" stroke-opacity=".5"/>')
        return o

    # (a) waveform, first 100 ms
    m = t < 0.1
    parts += panel(0, 190, "1 · Raw acceleration", "shaft rotation and noise hide the small periodic impacts",
                   (0, 0.1), (-5.5, 5.5), list(t[m][::2]), list(x[m][::2]),
                   [(v / 100, f"{v * 10}") for v in range(0, 11, 2)], [(-4, "−4"), (0, "0"), (4, "4")], "time (ms)")

    # (b) raw spectrum with demodulation band
    def band(px, py, x0, x1, y0, y1):
        return [f'<rect x="{px(2000):.1f}" y="{y0}" width="{px(4000) - px(2000):.1f}" height="{y1 - y0}" fill="{TINT}"/>',
                text((px(2000) + px(4000)) / 2, y0 + 16, "band-pass 2–4 kHz around the resonance", 10.5, 600, anchor="middle", halo=True),
                text(px(BPFO) + 6, y0 + 16, f"nothing distinctive at {BPFO:.0f} Hz", 10.5, fill=QUIET, halo=True)]
    bx, by = decimate_xy(f_raw, raw_db, 0, 5000)
    parts += panel(200, 200, "2 · Raw spectrum", "energy at shaft speed and a broad resonance near 3 kHz",
                   (0, 5000), (-60, 2), bx, by, [(v, f"{v // 1000}k" if v else "0") for v in range(0, 5001, 1000)],
                   [(0, "0 dB"), (-20, "−20"), (-40, "−40"), (-60, "−60")], "frequency (Hz)", band)

    # (c) envelope spectrum with fault-frequency markers
    def marks(px, py, x0, x1, y0, y1):
        o = []
        for k in (1, 2, 3, 4):
            fx = px(k * BPFO)
            o.append(f'<line x1="{fx:.1f}" y1="{y0}" x2="{fx:.1f}" y2="{y1}" stroke="{INK}" stroke-width="1" stroke-dasharray="3 3"/>')
            o.append(text(fx + 4, y0 + 14, "BPFO" if k == 1 else f"{k}×", 10.5, 700, halo=True))
        return o
    ex, ey = decimate_xy(f_env, env_lin, 0, 400)
    parts += panel(410, 220, "3 · Envelope spectrum", f"demodulating the band reveals the impact rate · BPFO = {BPFO:.0f} Hz for 9 balls on a 25 Hz shaft",
                   (0, 400), (0, 1.08), ex, ey, [(v, f"{v}") for v in range(0, 401, 50)],
                   [(0, "0"), (0.5, "0.5"), (1, "1")], "frequency (Hz)", marks)
    parts.append("</svg>")
    return "".join(parts)


save("vib-envelope.svg", envelope_figure())

# ---------------------------------------------------------------- 2. order tracking on a run-up
FS2, T2 = 4096, 4.0
t2 = np.arange(int(FS2 * T2)) / FS2
f_shaft = 10 + (40 - 10) * t2 / T2                       # run-up 10 -> 40 Hz
phase = 2 * np.pi * np.cumsum(f_shaft) / FS2              # tachometer-derived shaft angle
y2 = np.cos(phase) + 0.6 * np.cos(3 * phase) + 0.25 * rng.standard_normal(len(t2))

Y = np.abs(np.fft.rfft(y2 * np.hanning(len(y2))))
fy = np.fft.rfftfreq(len(y2), 1 / FS2)
Y /= Y.max()

SPR = 64                                                  # samples per revolution
revs = phase[-1] / (2 * np.pi)
angle_grid = np.arange(0, int(revs * SPR)) * 2 * np.pi / SPR
y_ang = np.interp(angle_grid, phase, y2)
O = np.abs(np.fft.rfft(y_ang * np.hanning(len(y_ang))))
orders = np.fft.rfftfreq(len(y_ang), 1 / SPR)
O /= O.max()

fx_, fy_ = decimate_xy(fy, Y, 0, 150, 400)
ox_, oy_ = decimate_xy(orders, O, 0, 5, 400)


def order_panels():
    common = dict(yr=(0, 1.08), yticks=[(0, "0"), (0.5, "0.5"), (1, "1")])
    a = chart("vo1", 370, 360, "Frequency spectrum", "speed sweeps 10 → 40 Hz during the record",
              (0, 150), common["yr"], [(v, str(v)) for v in range(0, 151, 30)], common["yticks"], "frequency (Hz)", "relative amplitude",
              [("smeared — 1× and 3× spread over bands", SOLID, fx_, fy_)],
              extra=lambda px, py, x0, x1, y0, y1: ([], [text(px(25), py(0.62), "1× spread", 10.5, 600, anchor="middle", halo=True),
                                                         text(px(75), py(0.45), "3× spread", 10.5, 600, anchor="middle", halo=True)]),
              aria="Ordinary frequency spectrum of a run-up from 10 to 40 hertz: the first and third shaft harmonics are smeared across 10 to 40 and 30 to 120 hertz.")
    b = chart("vo2", 370, 360, "Order spectrum", "same record, resampled to constant shaft angle",
              (0, 5), common["yr"], [(v, f"{v}×") for v in range(0, 6)], common["yticks"], "shaft order", None,
              [("sharp — components stay in fixed bins", SOLID, ox_, oy_)],
              extra=lambda px, py, x0, x1, y0, y1: ([], [text(px(1) + 6, py(0.95), "1×", 11, 700, halo=True), text(px(3) + 6, py(0.6), "3×", 11, 700, halo=True)]),
              aria="Order spectrum of the same run-up after resampling to constant shaft angle: sharp peaks at orders 1 and 3.")
    return a, b


oa, ob = order_panels()
save("vib-order-a.svg", oa)
save("vib-order-b.svg", ob)

# ---------------------------------------------------------------- 3. false alarms vs threshold and persistence
WINDOWS = 30 * 24 * 60                                    # one scored window per minute, 30 days
z = np.linspace(2.0, 5.0, 301)
p = 0.5 * np.array([math.erfc(v / math.sqrt(2)) for v in z])
series = []
for k, style in ((1, DASH), (2, SOLID), (3, DOT)):
    alarms = WINDOWS * p ** k
    label = {1: "single window", 2: "2 consecutive windows", 3: "3 consecutive windows"}[k]
    series.append((label, style, list(z), list(np.log10(np.maximum(alarms, 1e-12)))))


def fa_extra(px, py, x0, x1, y0, y1):
    return ([], [f'<line x1="{x0}" y1="{py(0):.1f}" x2="{x1}" y2="{py(0):.1f}" stroke="{INK}" stroke-width="1.2" stroke-dasharray="6 3"/>',
                 text(x1 - 6, py(0) - 6, "1 per month", 11, 600, anchor="end", halo=True)])


save("vib-alarms.svg", chart(
    "va", 680, 430, "Persistence rules change the false-alarm budget", "Idealised: one window per minute, healthy scores Gaussian and independent",
    (2, 5), (-4, 4.3), [(v, f"{v:g}σ") for v in (2, 2.5, 3, 3.5, 4, 4.5, 5)],
    [(v, {-4: "0.0001", -2: "0.01", 0: "1", 2: "100", 4: "10,000"}[v]) for v in (-4, -2, 0, 2, 4)],
    "alarm threshold on the healthy-score distribution", "false alarms per month", series, extra=fa_extra,
    aria="False alarms per machine per month versus threshold, for alerts on a single window or on two or three consecutive windows. "
         "Under the idealised independence assumption, requiring consecutive windows lowers false alarms by orders of magnitude at the same threshold."))
print(f"BPFO = {BPFO} Hz")
