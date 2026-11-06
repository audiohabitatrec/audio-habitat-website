# Werkzeuge

## `new-release.py` — neue Single anlegen

Erledigt alles, was für einen neuen Release nötig ist, in einem Aufruf: AAC-Export, Cover-Größen,
Eintrag in `js/tracks.js`, eigene Seite unter `music/<slug>/`, Schema.org-Eintrag und Featured-Block
auf der Startseite, Sitemap und den Zählsatz im About-Text. Das "Neu"-Tag wandert automatisch auf den
neuen Release.

```bash
python3 tools/new-release.py \
  --title "Titel" --subgenre "Liquid Funk" --bpm 174 --date 2026-10-04 \
  --wav "assets/tracks/Titel.wav" --cover "assets/covers/Titel.jpg" \
  --spotify "https://open.spotify.com/track/…" \
  --apple "https://music.apple.com/us/album/…" \
  --hyperfollow "https://distrokid.com/hyperfollow/audiohabitat/…?ref=release" \
  --desc-de "Text auf Deutsch." --desc-en "Text in English."
```

Pflicht sind nur `--title`, `--subgenre`, `--bpm` und `--date` (plus `--wav` und `--cover`, sofern die Dateien
nicht schon unter `assets/…/<slug>.*` liegen — dann `--no-assets`). Spotify-/Apple-Link und Texte sind optional;
ohne sie nutzt die Seite den Hyperfollow-Link und einen sachlichen Standardtext.

### Ankündigen statt sofort veröffentlichen

```bash
python3 tools/new-release.py --announce \
  --title "Titel" --subgenre "Neurofunk" --bpm 174 --date 2026-11-20 \
  --cover "music/Titel (Master)/Titel.jpg" \
  --hyperfollow "https://distrokid.com/hyperfollow/audiohabitat/titel?ref=release"
```

Legt nur Cover, Ankündigungsseite (Cover, VÖ-Datum, Countdown, „Jetzt vormerken“), den Eintrag in `js/tracks.js`
(`upcoming: true`, ohne Audio) und die Sitemap an. Auf der Startseite erscheint der Release im „Demnächst“-Streifen
über dem Player — Musik und Download gibt es noch nicht, die Audiodatei kommt erst am VÖ-Tag auf die Seite.

Am VÖ-Tag (Claude legt dafür bei der Ankündigung eine geplante Aufgabe an):

```bash
python3 tools/new-release.py --publish --slug titel --wav "music/Titel (Master)/Titel.wav" [--spotify … --apple …]
```

Titel, Genre, BPM, Datum und Pre-Save-Link kommen aus der Ankündigung. Danach ist es ein normaler Release
(Player, Welle, Download, Schema.org, Zählsatz). Sollte sich das Veröffentlichen verspäten, zeigt die Seite nach dem
Datum statt des Countdowns „Jetzt erschienen“ mit dem Link zu allen Plattformen.

Weitere Optionen:

- `--dry-run` — zeigt nur, was geändert würde, schreibt nichts.
- `--slug` — eigener URL-Name (Standard: aus dem Titel).
- `--similar slug1,slug2,slug3` — "Ähnliche Tracks" (Standard: gleiches Subgenre, dann die neuesten).

Danach: Seite lokal ansehen (`python3 -m http.server`), `git add` / `git commit` / `git push` (die genauen
Befehle gibt das Skript am Ende aus).

Grenzen: nur Singles (EPs bitte von Hand). Die WAV dient nur als Quelle für die m4a und kommt **nicht** auf die
Seite (GitHub Pages erlaubt insgesamt 1 GB; `.gitignore` sperrt alle `*.wav`). Downloads sind die m4a, wer eine WAV
braucht, fragt über das Formular „WAV anfragen“ im Download-Fenster. Masters lokal in `music/WAV-Masters (nur lokal)/`. Braucht Python 3 und Pillow (`pip3 install Pillow`), für den
AAC-Export `afconvert` (macOS) oder `ffmpeg`.

## `make-waveforms.py` — Welle unter dem Plattenspieler

Erzeugt für jede `assets/tracks/<slug>.m4a` eine kleine `assets/waves/<slug>.json` (Lautheitskurve, ~0,5 KB),
aus der der Plattenspieler die dezente Welle zeichnet. `new-release.py` macht das für neue Singles automatisch;
von Hand nur für EPs oder ausgetauschte Tracks nötig: `python3 tools/make-waveforms.py` (fehlende) oder
`python3 tools/make-waveforms.py --force <slug>`.

## `bust-cache.py` — Versionsnummern für CSS/JS

Hängt an jeden Verweis auf `css/…` und `js/…` eine Prüfsumme des Dateiinhalts (`style.css?v=3fa9c2d1`), damit
Browser nach einem Update nicht 10 Minuten lang alte Dateien mit neuen mischen. **Nach jeder Änderung an `css/` oder
`js/` ausführen:** `python3 tools/bust-cache.py`. `new-release.py` macht das automatisch.

`release-page.template.html` ist die Vorlage für die Release-Seite. Ändert man das Design der Release-Seiten,
sollte man sie dort mitziehen, damit neue Releases dasselbe bekommen.
