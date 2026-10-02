# MoMo fraud education film

A 3-minute stylized-3D film for the Mobile Money Fraud Hackathon (InnoFemme, KNUST, 26–28 Nov 2026).
The script and storyboard are in [SCRIPT.md](SCRIPT.md).

Everything is generated from code, so no 3D software or GPU is needed:

- **Scenes** are built in [three.js](https://threejs.org) (`scene/`) and rendered frame by frame in
  headless Chromium (`render.mjs`). Each frame is a pure function of time, so any frame can be
  re-rendered on its own.
- **Audio** (`audio/build_audio.py`) creates the voices with free Piper TTS, synthesizes the sound
  effects and the highlife-style music with numpy, mixes them with ducking under speech, and writes a
  `timeline.json`. The scenes sync to it: cue times, captions and per-frame lip-sync values.

## Build

```bash
pip install piper-tts scipy numpy
npm install                      # three, Figtree font, playwright
./fetch_voices.sh                # draft voices -> $VOICES_DIR (default /tmp/claude-0/voices)

python3 audio/build_audio.py scene1          # -> build/scene1/{mix.wav,timeline.json}
node render.mjs scene1 --stills 0,200,400    # quick stills -> build/scene1/stills/
node render.mjs scene1                       # full scene -> out/scene1.mp4 (~0.7 s/frame)
```

To preview live in a browser, run `npx http-server .` and open `/scene/index.html?scene=scene1`.
Click the page to play it with sound.

## Layout

| Path | What |
|---|---|
| `scene/lib/character.js` | Rigged stylized characters (arms, face, blinks, lip sync, walk cycle) |
| `scene/lib/world.js` | Kumasi roadside: sky, light presets, road, shops, trees, poles |
| `scene/lib/props.js` | Stall, phone with a live screen, tro-tro |
| `scene/lib/overlay.js` | Captions, lower thirds, chapter cards, fades, grain |
| `scene/scenes/sceneN.js` | Shot list and performance for each scene |
| `audio/build_audio.py` | Voices, sound effects, music, mix and timeline for each scene |
