"""Build the soundtrack and timeline for one scene.

Voices come from Piper (free, offline TTS). Sound effects and music are synthesized
here with numpy so the project needs no third-party audio assets.

Output (in build/<scene>/):
  mix.wav        stereo 48 kHz soundtrack
  timeline.json  cue times, captions and per-frame mouth openness for lip sync
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, resample_poly, sosfilt

SR = 48000
FPS = 24
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICES_DIR = os.environ.get("VOICES_DIR", "/tmp/claude-0/voices")
rng = np.random.default_rng(7)

VOICES = {
    "narrator": dict(model="en_GB-cori-high", length=1.08),
    "akosua": dict(model="en_GB-jenny_dioco-medium", length=1.0),
    "caller": dict(model="en_GB-alan-medium", length=0.95),
}


# ---------------------------------------------------------------- helpers

def db(x):
    return 10 ** (x / 20)


def lp(x, hz, order=2):
    return sosfilt(butter(order, hz, "low", fs=SR, output="sos"), x)


def hp(x, hz, order=2):
    return sosfilt(butter(order, hz, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def env_adsr(n, a=0.01, r=0.1):
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    if na:
        e[:na] = np.linspace(0, 1, na)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


class Track:
    """Stereo bus we can place mono sounds onto with gain and pan."""

    def __init__(self, seconds):
        self.buf = np.zeros((int(seconds * SR) + SR, 2))

    def add(self, sig, at, gain_db=0.0, pan=0.0):
        sig = np.asarray(sig, dtype=float)
        i = int(at * SR)
        sig = sig[: max(0, len(self.buf) - i)]
        if sig.ndim == 1:
            # Pan may be a constant or a per-sample curve.
            p = np.broadcast_to(pan, sig.shape)
            l, r = np.cos((p + 1) * np.pi / 4), np.sin((p + 1) * np.pi / 4)
            sig = np.stack([sig * l, sig * r], 1) * np.sqrt(2)
        self.buf[i : i + len(sig)] += sig * db(gain_db)


# ---------------------------------------------------------------- voices

def tts(role, text):
    v = VOICES[role]
    model = os.path.join(VOICES_DIR, v["model"] + ".onnx")
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        out = f.name
    subprocess.run(
        [sys.executable, "-m", "piper", "-m", model, "-f", out,
         "--length-scale", str(v["length"]), "--sentence-silence", "0.25"],
        input=text.encode(), check=True, capture_output=True)
    sr, y = wavfile.read(out)
    os.unlink(out)
    y = y.astype(float) / 32768
    y = resample_poly(y, SR, sr)
    # Trim leading/trailing silence so cue times are exact.
    idx = np.where(np.abs(y) > 0.01)[0]
    y = y[max(0, idx[0] - 200): idx[-1] + 2000]
    # Light "radio" polish: gentle high-pass and peak normalise.
    y = hp(y, 80)
    return y / np.max(np.abs(y)) * 0.9


def mouth_curve(y, start, total_frames):
    """Per-frame mouth openness (0..1) from the voice's loudness."""
    hop = SR // FPS
    out = np.zeros(total_frames)
    f0 = int(round(start * FPS))
    for k in range(len(y) // hop):
        if 0 <= f0 + k < total_frames:
            rms = np.sqrt(np.mean(y[k * hop:(k + 1) * hop] ** 2))
            out[f0 + k] = min(1.0, rms * 5)
    return out


def place(out, s, j):
    """Add s into out starting at sample j, clipping at the end."""
    if 0 <= j < len(out):
        k = min(len(s), len(out) - j)
        out[j:j + k] += s[:k]


# ---------------------------------------------------------------- SFX

def street_ambience(seconds):
    n = int(seconds * SR)
    brown = np.cumsum(rng.standard_normal(n))
    brown = hp(brown - np.convolve(brown, np.ones(4800) / 4800, "same"), 30)
    brown /= np.max(np.abs(brown))
    hiss = bp(rng.standard_normal(n), 800, 4000) * 0.05
    swell = 0.7 + 0.3 * np.sin(np.linspace(0, seconds * 0.6, n))
    return lp(brown, 400) * swell + hiss


def bird_chirp():
    d = rng.uniform(0.08, 0.16)
    t = np.arange(int(d * SR)) / SR
    f0 = rng.uniform(2800, 4200)
    f = f0 + rng.uniform(800, 1600) * np.sin(np.pi * t / d)
    sig = np.sin(2 * np.pi * np.cumsum(f) / SR)
    return sig * np.sin(np.pi * t / d) ** 2


def trotro_pass(seconds=5.0):
    """Minibus driving past: engine rumble with Doppler, plus the pan curve."""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    x = (t - seconds / 2) * 14  # metres from listener along the road
    dist = np.sqrt(x ** 2 + 6 ** 2)
    doppler = 1 - 0.04 * np.tanh(x / 6)
    f = 52 * doppler
    phase = 2 * np.pi * np.cumsum(f) / SR
    eng = sum(np.sign(np.sin(phase * h)) / h for h in (1, 2, 3)) * 0.6
    eng += lp(rng.standard_normal(n), 900) * 1.5
    eng = lp(eng, 1500) * (6 / dist) ** 1.3
    pan = np.tanh(x / 10) * 0.8
    return eng / np.max(np.abs(eng)), pan


def horn():
    d = 0.22
    t = np.arange(int(d * SR)) / SR
    tone = sum(np.sign(np.sin(2 * np.pi * f * t)) for f in (392, 494)) * 0.5
    tone = lp(tone, 2500) * env_adsr(len(t), 0.01, 0.04)
    gap = np.zeros(int(0.08 * SR))
    return np.concatenate([tone, gap, tone])


def marimba_note(freq, d=0.35):
    t = np.arange(int(d * SR)) / SR
    e = np.exp(-t * 9)
    return (np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * freq * 4 * t) * np.exp(-t * 30)) * e


def ringtone(seconds):
    """A cheerful generic phone ringtone (not any real brand's)."""
    out = np.zeros(int(seconds * SR))
    pattern = [659, 784, 988, 784, 880, 0, 659, 784]
    step = 0.16
    pos = 0.0
    while pos < seconds:
        for i, f in enumerate(pattern):
            at = pos + i * step
            if f and at < seconds:
                note = marimba_note(f)
                place(out, note, int(at * SR))
        pos += len(pattern) * step + 0.5
    return out * 0.6


def vibrate(seconds):
    t = np.arange(int(seconds * SR)) / SR
    gate = ((t % 0.9) < 0.45).astype(float)
    gate = np.convolve(gate, np.ones(480) / 480, "same")
    buzz = np.sign(np.sin(2 * np.pi * 160 * t)) * 0.4 + lp(rng.standard_normal(len(t)), 300)
    return lp(buzz, 600) * gate


def whoosh(d=0.8):
    n = int(d * SR)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    for k, c in enumerate(np.geomspace(300, 5000, 16)):
        seg = slice(k * n // 16, (k + 1) * n // 16)
        out[seg] = bp(noise, c * 0.7, min(c * 1.4, 20000))[seg]
    return out * np.sin(np.linspace(0, np.pi, n)) ** 2


# ---------------------------------------------------------------- music

def pluck(freq, d, bright=0.5):
    """Karplus-Strong plucked string — reads as a palm-wine/highlife guitar."""
    n = int(d * SR)
    period = int(SR / freq)
    buf = rng.uniform(-1, 1, period)
    buf = lp(buf, 1500 + 5000 * bright) if period > 20 else buf
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % period]
        buf[i % period] = 0.996 * 0.5 * (buf[i % period] + buf[(i + 1) % period])
    return out


def highlife_bed(seconds, bpm=104):
    beat = 60 / bpm
    out = np.zeros(int(seconds * SR) + SR)
    # I - IV - I - V in G, two bars each chord-pair, palm-wine guitar arpeggio.
    G, C, D = [196, 247, 294, 392], [196, 262, 330, 392], [220, 294, 370, 440]
    prog = [G, C, G, D]
    arp = [0, 2, 1, 3, 2, 1, 3, 2]
    cache = {}
    bar = 0
    t = 0.0
    while t < seconds:
        chord = prog[bar % len(prog)]
        for k, idx in enumerate(arp):
            at = t + k * beat / 2
            f = chord[idx]
            if f not in cache:
                cache[f] = pluck(f, 0.9)
            place(out, cache[f] * (0.9 if k % 2 == 0 else 0.6), int(at * SR))
        # bass on beats 1 and 3
        for k, mult in ((0, 0.5), (2, 0.5)):
            f = chord[0] * mult
            key = ("b", f)
            if key not in cache:
                tt = np.arange(int(0.5 * SR)) / SR
                cache[key] = np.sin(2 * np.pi * f * tt) * np.exp(-tt * 5)
            place(out, cache[key] * 0.8, int((t + k * beat) * SR))
        # shaker on every 8th
        for k in range(8):
            j = int((t + k * beat / 2) * SR)
            n = int(0.06 * SR)
            s = hp(rng.standard_normal(n), 5000) * np.exp(-np.arange(n) / SR * 60) * (0.25 if k % 2 else 0.12)
            place(out, s, j)
        t += 4 * beat
        bar += 1
    return out / np.max(np.abs(out))


# ---------------------------------------------------------------- scenes

def scene1():
    """Morning in Kumasi — the test clip."""
    lines = []
    t = 2.0
    cues = {}

    def say(key, role, text, gap_after):
        nonlocal t
        y = tts(role, text)
        cues[key] = dict(start=round(t, 3), end=round(t + len(y) / SR, 3))
        lines.append((key, role, text, y, t))
        t += len(y) / SR + gap_after

    say("n1", "narrator", "Every morning, Auntie Akosua sells sachet water by the roadside in Kumasi.", 0.7)
    say("a1", "akosua", "Pure water! Ice-cold pure water!", 0.9)
    say("n2", "narrator", "Every cedi she saves goes into her mobile money wallet. School fees for Ama. Food for the week.", 0.6)
    cues["ring"] = dict(start=round(t, 3), end=round(t + 3.2, 3))
    cues["title"] = dict(start=round(t + 3.4, 3), end=round(t + 5.9, 3))
    duration = round(t + 6.4, 3)
    cues["trotro"] = dict(start=2.6, end=7.6)

    frames = int(round(duration * FPS))
    voice = Track(duration)
    sfx = Track(duration)
    music = Track(duration)
    mouth = np.zeros(frames)
    captions = []
    for key, role, text, y, at in lines:
        voice.add(y, at, 0 if role == "narrator" else -1.5, 0 if role == "narrator" else -0.15)
        if role != "narrator":
            mouth = np.maximum(mouth, mouth_curve(y, at, frames))
        captions.append(dict(start=cues[key]["start"], end=cues[key]["end"], speaker=role, text=text))

    # Street bed fades in from black, ducks under the ring.
    amb = street_ambience(duration)
    fade = np.clip(np.arange(len(amb)) / SR / 2.0, 0, 1)
    sfx.add(amb * fade, 0, -21)
    for k in range(18):
        at = rng.uniform(0.2, cues["n2"]["start"])
        sfx.add(bird_chirp(), at, rng.uniform(-30, -24), rng.uniform(-0.8, 0.8))
    eng, pan = trotro_pass(cues["trotro"]["end"] - cues["trotro"]["start"])
    sfx.add(eng, cues["trotro"]["start"], -19, pan)
    sfx.add(horn(), cues["trotro"]["start"] + 2.1, -20, 0.1)
    rs, re_ = cues["ring"]["start"], cues["ring"]["end"]
    sfx.add(vibrate(re_ - rs), rs, -22, 0.15)
    sfx.add(ringtone(re_ - rs), rs, -12, 0.15)
    sfx.add(whoosh(), cues["title"]["start"] - 0.4, -16)

    # Music: in under the narrator, out when the phone rings.
    bed = highlife_bed(duration)
    n = len(bed)
    tt = np.arange(n) / SR
    m_env = np.clip(tt / 3.0, 0, 1) * np.clip((rs + 0.6 - tt) / 1.2, 0, 1)
    music.add(bed * m_env, 0, -24)

    # Duck music + ambience under speech.
    speech = np.abs(voice.buf).max(1)
    speech = np.convolve(speech, np.ones(SR // 10) / (SR // 10), "same")
    duck = 1 - 0.45 * np.clip(speech * 8, 0, 1)
    mix = voice.buf + (sfx.buf + music.buf) * duck[:, None]
    mix = mix[: int(duration * SR)]
    mix *= 0.89 / np.max(np.abs(mix))
    return mix, dict(duration=duration, fps=FPS, cues=cues, captions=captions,
                     mouth=[round(float(m), 3) for m in mouth])


SCENES = {"scene1": scene1}

if __name__ == "__main__":
    name = sys.argv[1] if len(sys.argv) > 1 else "scene1"
    out_dir = os.path.join(ROOT, "build", name)
    os.makedirs(out_dir, exist_ok=True)
    mix, timeline = SCENES[name]()
    wavfile.write(os.path.join(out_dir, "mix.wav"), SR, (mix * 32767).astype(np.int16))
    with open(os.path.join(out_dir, "timeline.json"), "w") as f:
        json.dump(timeline, f, indent=1)
    print(f"{name}: {timeline['duration']}s, cues={json.dumps(timeline['cues'])}")
