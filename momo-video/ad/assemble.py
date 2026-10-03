"""Assemble the 30-second hackathon advert from generated clips and audio.

Timeline (seconds):
  0.0 - 9.0   shot A  (market, phone rings, she answers)       + caller line
  9.0 - 17.0  shot B  (decision point) -> freeze frame + silence
 17.0 - 30.0  shot C  (workshop)                               + narrator + music

Inputs (ad/):  clips/A.mp4 clips/B.mp4 clips/C.mp4
               audio/caller.mp3 audio/narrator.mp3 audio/music.mp3
Output:        ../out/ad_30s.mp4  (1920x1080, 24 fps, stereo AAC)
"""
import json
import os
import subprocess
import sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "out")
SR = 48000
FPS = 24
W, H = 1920, 1080

A_END, B_END, TOTAL = 9.0, 17.0, 30.0
FREEZE_AT = 13.6          # moment the market freezes inside shot B (absolute time)
CALLER_AT = 3.3           # caller line starts (after ring + answer)
NARRATOR_AT = B_END + 0.6
RING_AT = 1.2

ffm = ["ffmpeg", "-y", "-loglevel", "error"]


def run(cmd):
    subprocess.run(cmd, check=True)


def probe_dur(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", path],
                         capture_output=True, text=True, check=True).stdout
    return float(json.loads(out)["format"]["duration"])


def load_audio(path, start_trim=True):
    """Any audio file -> mono float array at SR, trimmed of leading/trailing silence."""
    tmp = path + ".tmp.wav"
    run(ffm + ["-i", path, "-ac", "1", "-ar", str(SR), tmp])
    _, y = wavfile.read(tmp)
    os.unlink(tmp)
    y = y.astype(float) / 32768
    if start_trim:
        idx = np.where(np.abs(y) > 0.01)[0]
        y = y[max(0, idx[0] - 200): idx[-1] + 2400]
    return y / max(1e-6, np.max(np.abs(y)))


def phone_voice(y):
    """Band-limit a line so it sounds like it comes through a handset heard nearby."""
    sos = butter(4, [300, 3400], "band", fs=SR, output="sos")
    z = sosfilt(sos, y)
    z = np.tanh(z * 2.2) / np.tanh(2.2)      # light saturation
    return z / max(1e-6, np.max(np.abs(z)))


def ringtone(seconds=2.4):
    t = np.arange(int(seconds * SR)) / SR
    tone = 0.5 * np.sin(2 * np.pi * 1760 * t) + 0.4 * np.sin(2 * np.pi * 2217 * t)
    gate = ((t % 0.5) < 0.07) | (((t - 0.14) % 0.5) < 0.07)
    env = np.convolve(gate.astype(float), np.ones(240) / 240, "same")
    bursts = (t % 2.0) < 1.0
    return tone * env * bursts * 0.6


def place(buf, sig, at, gain=1.0):
    i = int(at * SR)
    n = min(len(sig), len(buf) - i)
    if n > 0:
        buf[i:i + n] += sig[:n] * gain


def video_edit(a, b, c, dur_a, dur_b, dur_c):
    """Build the picture: A | B with freeze | C, each conformed to its slot."""
    seg_a = A_END
    seg_b_live = FREEZE_AT - A_END
    seg_b_freeze = B_END - FREEZE_AT
    seg_c = TOTAL - B_END
    # Slow a clip down slightly if it is shorter than its slot, rather than freezing early.
    def fit(src, dst, slot, src_dur, extra=""):
        rate = min(1.0, src_dur / slot)            # <1 slows the clip
        vf = f"setpts={1 / rate:.5f}*PTS,fps={FPS},scale={W}:{H}:flags=lanczos{extra}"
        run(ffm + ["-i", src, "-t", f"{slot:.3f}", "-an", "-vf", vf, "-c:v", "libx264", "-preset", "medium", "-crf", "16", dst])
    fit(a, "/tmp/seg_a.mp4", seg_a, dur_a)
    fit(b, "/tmp/seg_b_live.mp4", seg_b_live, min(dur_b, seg_b_live))
    # freeze: take the last frame of the live part and hold it
    run(ffm + ["-sseof", "-0.05", "-i", "/tmp/seg_b_live.mp4", "-frames:v", "1", "-update", "1", "/tmp/freeze.png"])
    run(ffm + ["-loop", "1", "-framerate", str(FPS), "-i", "/tmp/freeze.png", "-t", f"{seg_b_freeze:.3f}",
               "-vf", f"scale={W}:{H},zoompan=z='min(zoom+0.0004,1.06)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={W}x{H}:fps={FPS}",
               "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "/tmp/seg_b_freeze.mp4"])
    fit(c, "/tmp/seg_c.mp4", seg_c, dur_c)
    with open("/tmp/concat.txt", "w") as f:
        for s in ["/tmp/seg_a.mp4", "/tmp/seg_b_live.mp4", "/tmp/seg_b_freeze.mp4", "/tmp/seg_c.mp4"]:
            f.write(f"file '{s}'\n")
    run(ffm + ["-f", "concat", "-safe", "0", "-i", "/tmp/concat.txt", "-c", "copy", "/tmp/picture.mp4"])


def sound_mix(a_src, b_src, c_src):
    n = int(TOTAL * SR) + SR
    bus = np.zeros((n, 2))
    mono = lambda y: np.stack([y, y], 1)

    # Ambience from the generated clips' own audio (no intelligible speech was requested).
    amb_a = load_audio(a_src, start_trim=False)
    amb_b = load_audio(b_src, start_trim=False)
    amb_c = load_audio(c_src, start_trim=False)
    t = np.arange(n) / SR
    # A: full market until the cut; B: quieter, falling to near silence at the freeze.
    env_a = (t < A_END).astype(float)
    env_b = np.clip((t - A_END) / 0.4, 0, 1) * np.clip((FREEZE_AT - t) / 0.6, 0.04, 1) * (t < B_END)
    env_c = np.clip((t - B_END) / 0.8, 0, 1) * (t >= B_END)
    a2 = np.zeros(n); place(a2, amb_a, 0)
    b2 = np.zeros(n); place(b2, amb_b, A_END)
    c2 = np.zeros(n); place(c2, amb_c, B_END)
    bus += mono(a2 * env_a) * 0.9 + mono(b2 * env_b) * 0.7 + mono(c2 * env_c) * 0.25

    # Phone ring (generated clips may also contain one; ours guarantees it is heard).
    ring = ringtone()
    r2 = np.zeros(n); place(r2, ring, RING_AT)
    bus += mono(r2) * 0.5

    # Caller, through the handset, slightly right of centre (phone at her right ear).
    caller = phone_voice(load_audio(os.path.join(HERE, "audio", "caller.mp3")))
    cl = np.zeros(n); place(cl, caller, CALLER_AT)
    bus[:, 0] += cl * 0.42
    bus[:, 1] += cl * 0.58

    # Music under the workshop, ducked under the narrator.
    music = load_audio(os.path.join(HERE, "audio", "music.mp3"), start_trim=False)
    m2 = np.zeros(n); place(m2, music, B_END - 0.3)
    fade_out = np.clip((TOTAL - t) / 1.5, 0, 1)
    fade_in = np.clip((t - (B_END - 0.3)) / 1.2, 0, 1)
    narrator = load_audio(os.path.join(HERE, "audio", "narrator.mp3"))
    nr = np.zeros(n); place(nr, narrator, NARRATOR_AT)
    env_n = np.convolve(np.abs(nr), np.ones(SR // 8) / (SR // 8), "same")
    duck = 1 - 0.55 * np.clip(env_n * 6, 0, 1)
    bus += mono(m2 * fade_in * fade_out * duck) * 0.32
    bus += mono(nr) * 1.0

    bus = bus[: int(TOTAL * SR)]
    bus *= 0.89 / np.max(np.abs(bus))
    wavfile.write("/tmp/mix.wav", SR, (bus * 32767).astype(np.int16))


def main():
    clips = {k: os.path.join(HERE, "clips", f"{k}.mp4") for k in "ABC"}
    durs = {k: probe_dur(p) for k, p in clips.items()}
    print("clip durations", durs)
    video_edit(clips["A"], clips["B"], clips["C"], durs["A"], durs["B"], durs["C"])
    sound_mix(clips["A"], clips["B"], clips["C"])
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, "ad_30s.mp4")
    run(ffm + ["-i", "/tmp/picture.mp4", "-i", "/tmp/mix.wav", "-map", "0:v", "-map", "1:a", "-t", str(TOTAL),
               "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
               "-c:a", "aac", "-b:a", "192k", out])
    print("wrote", out, probe_dur(out))


if __name__ == "__main__":
    main()
