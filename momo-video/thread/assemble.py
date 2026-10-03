"""Assemble "The Thread" — 30-second 3D-animated hackathon advert.

Picture: seven generated clips (clips/S1.mp4 … S7.mp4), cut to the music.
Sound:   music bed (audio/music.mp3), voice-over split at its pauses and placed
         on the shots (audio/vo.mp3), light ambience from the clips' own audio.
Output:  ../out/the_thread_30s.mp4  (1920x1080, 24 fps, stereo AAC)
"""
import json
import os
import subprocess

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "out")
SR, FPS, W, H = 48000, 24, 1920, 1080
TOTAL = 30.0

# shot slots (seconds): [S1, S2, S3, S4, S5, S6, S7]
SLOTS = [4.6, 4.0, 4.4, 4.6, 4.4, 4.6, 3.4]
assert abs(sum(SLOTS) - TOTAL) < 1e-6
STARTS = np.concatenate([[0], np.cumsum(SLOTS)[:-1]])
XFADE_67 = 0.7     # dissolve from the canopy into the end frame

# Where each voice-over phrase lands (phrase index -> absolute start time)
# 0 "One phone call."                      S1
# 1 "One thread, pulled loose."            S2
# 2 "That is how it starts."               S3
# 3 "But in Kumasi, we know what thread can become."  S4
# 4 "Bring your mind. Bring your hands."   S5
# 5 "Mobile Money Fraud Hackathon."        S6
# 6 "Let's weave something no one can pull apart."    S7
PHRASE_AT = [1.1, STARTS[1] + 0.3, STARTS[2] + 0.5, STARTS[3] + 0.4, STARTS[4] + 0.3, STARTS[5] + 0.3, STARTS[6] - 0.2]

ffm = ["ffmpeg", "-y", "-loglevel", "error"]


def run(cmd):
    subprocess.run(cmd, check=True)


def probe_dur(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", path],
                         capture_output=True, text=True, check=True).stdout
    return float(json.loads(out)["format"]["duration"])


def load_audio(path):
    tmp = path + ".tmp.wav"
    run(ffm + ["-i", path, "-ac", "1", "-ar", str(SR), tmp])
    _, y = wavfile.read(tmp)
    os.unlink(tmp)
    y = y.astype(float) / 32768
    return y / max(1e-6, np.max(np.abs(y)))


def split_phrases(y, min_gap=0.28, thresh=0.02, max_parts=7):
    """Split a voice track at its pauses; merge the smallest gaps until <= max_parts."""
    hop = SR // 100
    env = np.array([np.sqrt(np.mean(y[i:i + hop] ** 2)) for i in range(0, len(y) - hop, hop)])
    voiced = env > thresh
    segs, start = [], None
    for i, v in enumerate(voiced):
        if v and start is None:
            start = i
        elif not v and start is not None:
            segs.append([start, i]); start = None
    if start is not None:
        segs.append([start, len(voiced)])
    # merge segments separated by short gaps
    merged = [segs[0]]
    for s in segs[1:]:
        if (s[0] - merged[-1][1]) * hop / SR < min_gap:
            merged[-1][1] = s[1]
        else:
            merged.append(s)
    while len(merged) > max_parts:
        gaps = [merged[i + 1][0] - merged[i][1] for i in range(len(merged) - 1)]
        k = int(np.argmin(gaps))
        merged[k][1] = merged[k + 1][1]
        del merged[k + 1]
    out = []
    for a, b in merged:
        i0 = max(0, a * hop - SR // 20)
        i1 = min(len(y), b * hop + SR // 8)
        out.append(y[i0:i1])
    return out


def place(buf, sig, at, gain=1.0):
    i = int(at * SR)
    n = min(len(sig), len(buf) - i)
    if n > 0:
        buf[i:i + n] += sig[:n] * gain


def conform(src, dst, seconds, speed=1.0):
    vf = f"setpts={1 / speed:.5f}*PTS,fps={FPS},scale={W}:{H}:flags=lanczos"
    run(ffm + ["-i", src, "-an", "-vf", vf, "-t", f"{seconds:.3f}", "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", dst])


def picture(clips, durs):
    segs = []
    for i, (slot, start) in enumerate(zip(SLOTS, STARTS)):
        k = f"S{i + 1}"
        need = slot + (XFADE_67 if i == 5 else 0)
        speed = min(1.0, durs[k] / need)  # slow slightly if the clip is shorter than its slot
        conform(clips[k], f"/tmp/t_{k}.mp4", need, speed)
        segs.append(f"/tmp/t_{k}.mp4")
    # S6 -> S7 dissolve
    run(ffm + ["-i", segs[5], "-i", segs[6], "-filter_complex",
               f"[0:v][1:v]xfade=transition=fade:duration={XFADE_67}:offset={SLOTS[5]:.3f}[v]", "-map", "[v]",
               "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "/tmp/t_S67.mp4"])
    final = segs[:5] + ["/tmp/t_S67.mp4"]
    with open("/tmp/concat_thread.txt", "w") as f:
        for s in final:
            f.write(f"file '{s}'\n")
    run(ffm + ["-f", "concat", "-safe", "0", "-i", "/tmp/concat_thread.txt", "-c", "copy", "/tmp/thread_cat.mp4"])
    # fade in from black, gentle fade at the very end
    run(ffm + ["-i", "/tmp/thread_cat.mp4", "-vf", f"fade=t=in:st=0:d=0.7,fade=t=out:st={TOTAL - 0.6:.2f}:d=0.6",
               "-t", str(TOTAL), "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "/tmp/thread_pic.mp4"])


def sound(clips):
    n = int(TOTAL * SR) + SR
    bus = np.zeros((n, 2))
    t = np.arange(n) / SR
    st = lambda y: np.stack([y, y], 1)

    # Voice-over phrases placed on the shots
    vo = load_audio(os.path.join(HERE, "audio", "vo.mp3"))
    phrases = split_phrases(vo)
    print("voice phrases:", len(phrases), [round(len(p) / SR, 2) for p in phrases])
    vo_bus = np.zeros(n)
    at_list = PHRASE_AT if len(phrases) == len(PHRASE_AT) else None
    cursor = 1.1
    for i, p in enumerate(phrases):
        at = at_list[i] if at_list else max(cursor, PHRASE_AT[min(i, len(PHRASE_AT) - 1)])
        # never overlap the previous phrase
        at = max(at, cursor)
        place(vo_bus, p, at)
        cursor = at + len(p) / SR + 0.25
    vo_bus = np.clip(vo_bus, -1, 1)
    # gentle presence lift
    vo_bus = sosfilt(butter(2, 120, "high", fs=SR, output="sos"), vo_bus)
    bus += st(vo_bus) * 1.0

    # Music, ducked under the voice, with a breath at the catch (start of S4)
    music = load_audio(os.path.join(HERE, "audio", "music.mp3"))
    m = np.zeros(n); place(m, music, 0)
    env_v = np.convolve(np.abs(vo_bus), np.ones(SR // 6) / (SR // 6), "same")
    duck = 1 - 0.45 * np.clip(env_v * 7, 0, 1)
    catch = STARTS[3]
    breath = 1 - 0.55 * np.exp(-((t - catch) ** 2) / (2 * 0.25 ** 2))
    tail = np.clip((TOTAL - t) / 1.2, 0, 1)
    bus += st(m * duck * breath * tail) * 0.42

    # Light ambience from the clips' own audio (no speech requested), low in the mix
    gains = {"S1": 0.35, "S2": 0.25, "S3": 0.35, "S4": 0.2, "S5": 0.45, "S6": 0.3, "S7": 0.15}
    for i, k in enumerate([f"S{j}" for j in range(1, 8)]):
        try:
            a = load_audio(clips[k])
        except Exception:
            continue
        seg = np.zeros(n); place(seg, a, STARTS[i])
        # window to the slot with short fades
        w = np.clip((t - STARTS[i]) / 0.3, 0, 1) * np.clip((STARTS[i] + SLOTS[i] - t) / 0.3, 0, 1)
        bus += st(seg * w) * gains[k]

    bus = bus[: int(TOTAL * SR)]
    bus *= 0.89 / np.max(np.abs(bus))
    wavfile.write("/tmp/thread_mix.wav", SR, (bus * 32767).astype(np.int16))


def main():
    clips = {f"S{i}": os.path.join(HERE, "clips", f"S{i}.mp4") for i in range(1, 8)}
    durs = {k: probe_dur(p) for k, p in clips.items()}
    print("clips", durs)
    picture(clips, durs)
    sound(clips)
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, "the_thread_30s.mp4")
    run(ffm + ["-i", "/tmp/thread_pic.mp4", "-i", "/tmp/thread_mix.wav", "-map", "0:v", "-map", "1:a", "-t", str(TOTAL),
               "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
               "-c:a", "aac", "-b:a", "192k", out])
    print("wrote", out, probe_dur(out))


if __name__ == "__main__":
    main()
