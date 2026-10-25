#!/usr/bin/env python3
"""
Wellenform-Daten für die dezente Welle unter dem Plattenspieler (js/deck.js).

Für jede assets/tracks/<slug>.m4a entsteht assets/waves/<slug>.json: eine Liste von
WAVE_BINS Werten 0–100 (Lautheit je Abschnitt des Tracks). Ein paar hundert Bytes pro
Track, damit die Seite nicht den ganzen Track laden muss, um die Welle zu zeigen.

    python3 tools/make-waveforms.py              # alle Tracks, die noch keine Welle haben
    python3 tools/make-waveforms.py --force      # alle neu
    python3 tools/make-waveforms.py placeholder  # nur diese Slugs

Braucht afconvert (macOS) oder ffmpeg. new-release.py ruft das für neue Releases mit auf.
"""
import argparse
import array
import json
import math
import shutil
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TRACKS = ROOT / "assets/tracks"
WAVES = ROOT / "assets/waves"
WAVE_BINS = 160
DECODE_RATE = 8000   # reicht für eine Lautheitskurve und geht schnell


def decode_mono(src, dest):
    if shutil.which("afconvert"):
        cmd = ["afconvert", "-f", "WAVE", "-d", f"LEI16@{DECODE_RATE}", "-c", "1", str(src), str(dest)]
    elif shutil.which("ffmpeg"):
        cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(src), "-ac", "1", "-ar", str(DECODE_RATE), "-c:a", "pcm_s16le", str(dest)]
    else:
        sys.exit("Weder afconvert noch ffmpeg gefunden.")
    subprocess.run(cmd, check=True)


def peaks(wav_path):
    with wave.open(str(wav_path)) as w:
        samples = array.array("h", w.readframes(w.getnframes()))
    n = len(samples)
    if n == 0:
        return [0] * WAVE_BINS
    # RMS je Abschnitt: zeigt Drops, Breaks und Intros besser als reine Spitzenwerte
    rms = []
    for b in range(WAVE_BINS):
        chunk = samples[b * n // WAVE_BINS:(b + 1) * n // WAVE_BINS]
        rms.append(math.sqrt(sum(s * s for s in chunk) / len(chunk)) if chunk else 0.0)
    top = max(rms) or 1.0
    # steile Kurve: laut gemasterter DnB liegt sonst fast überall bei ~90 %, Breaks und Drops sollen sich abheben
    return [round(100 * (v / top) ** 2.2) for v in rms]


def make(slug, force=False):
    src = TRACKS / f"{slug}.m4a"
    out = WAVES / f"{slug}.json"
    if not src.exists():
        print(f"  übersprungen (keine m4a): {slug}")
        return False
    if out.exists() and not force:
        return False
    WAVES.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        tmp_wav = Path(tmp) / "mono.wav"
        decode_mono(src, tmp_wav)
        data = peaks(tmp_wav)
    out.write_text(json.dumps(data, separators=(",", ":")) + "\n")
    print(f"  Welle: {out.relative_to(ROOT)}")
    return True


def main():
    p = argparse.ArgumentParser(description="Wellenform-Daten für den Plattenspieler erzeugen.")
    p.add_argument("slugs", nargs="*", help="nur diese Tracks (Standard: alle)")
    p.add_argument("--force", action="store_true", help="vorhandene Wellen neu erzeugen")
    a = p.parse_args()
    slugs = a.slugs or sorted(f.stem for f in TRACKS.glob("*.m4a") if " " not in f.stem)
    made = sum(make(s, a.force) for s in slugs)
    print(f"{made} Welle(n) erzeugt.")


if __name__ == "__main__":
    main()
