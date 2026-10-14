#!/usr/bin/env python3
"""
Legt eine neue Single komplett auf der Seite an — in einem Rutsch.

    python3 tools/new-release.py \\
        --title "not done yet" --subgenre "Liquid Funk" --bpm 174 \\
        --date 2026-10-04 \\
        --wav "assets/tracks/not done yet.wav" --cover "assets/covers/not done yet.jpg" \\
        --spotify https://open.spotify.com/track/... \\
        --apple https://music.apple.com/us/album/... \\
        --hyperfollow "https://distrokid.com/hyperfollow/audiohabitat/...?ref=release"

Das Skript erledigt, was sonst sechs Handgriffe sind:

  1. Audio: WAV -> AAC-m4a (wie die anderen Tracks), WAV bleibt für den Download.
  2. Cover: 2000 px JPG + WebP (og:image / Download) und 800 px WebP (Seite).
  3. js/tracks.js: neuer Eintrag ganz oben, "isNew" wandert auf den neuen Release.
  4. music/<slug>/index.html aus tools/release-page.template.html.
  5. index.html: Schema.org-Eintrag, og:image und der statische Featured-Block.
  6. sitemap.xml und der Zählsatz im About-Text.

Mit --dry-run wird nichts geschrieben. Mit --no-assets werden Audio/Cover nicht
neu erzeugt (nur prüfen, dass assets/tracks/<slug>.m4a/.wav und
assets/covers/<slug>*.{jpg,webp} schon da sind). Nur Singles; EPs bitte von Hand.
Danach: Seite lokal ansehen, dann committen und pushen.
"""
import argparse
import datetime
import html
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GITHUB_FILE_LIMIT = 100 * 1024 * 1024  # bytes; GitHub rejects larger files

MONTHS_DE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August",
             "September", "Oktober", "November", "Dezember"]
MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August",
             "September", "October", "November", "December"]
NUM_DE = ["null", "Eine", "Zwei", "Drei", "Vier", "Fünf", "Sechs", "Sieben", "Acht", "Neun", "Zehn",
          "Elf", "Zwölf", "Dreizehn", "Vierzehn", "Fünfzehn", "Sechzehn", "Siebzehn", "Achtzehn",
          "Neunzehn", "Zwanzig", "Einundzwanzig", "Zweiundzwanzig", "Dreiundzwanzig",
          "Vierundzwanzig", "Fünfundzwanzig", "Sechsundzwanzig", "Siebenundzwanzig",
          "Achtundzwanzig", "Neunundzwanzig", "Dreißig"]
NUM_EN = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
          "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
          "Eighteen", "Nineteen", "Twenty", "Twenty-one", "Twenty-two", "Twenty-three",
          "Twenty-four", "Twenty-five", "Twenty-six", "Twenty-seven", "Twenty-eight",
          "Twenty-nine", "Thirty"]


# ---------- small helpers ----------

def die(msg):
    sys.exit("FEHLER: " + msg)


def slugify(title):
    s = title.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or die("Aus dem Titel lässt sich kein Slug bilden — bitte --slug angeben.")


def esc(s):
    """HTML-escape for text nodes and attributes (apostrophes stay readable)."""
    return html.escape(s, quote=False).replace('"', "&quot;")


def jesc(s):
    """Inner part of a JSON string literal (no surrounding quotes)."""
    return json.dumps(s, ensure_ascii=False)[1:-1]


def join_list(items, word):
    if len(items) <= 1:
        return "".join(items)
    return ", ".join(items[:-1]) + f" {word} " + items[-1]


class Files:
    """Collects file writes so --dry-run can show them without touching disk."""

    def __init__(self, dry):
        self.dry = dry
        self.written = []

    def read(self, rel):
        return (ROOT / rel).read_text(encoding="utf-8")

    def write(self, rel, text):
        self.written.append(rel)
        if not self.dry:
            path = ROOT / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")


# ---------- reading the existing catalogue ----------

def read_releases(tracks_js):
    """Titles/covers/pages/subgenres of existing releases, newest first (file order)."""
    start = tracks_js.index("var RELEASES = [")
    body = tracks_js[start:]
    marks = [m.start() for m in re.finditer(r'\{\s*type:\s*"(?:single|ep)"', body)]
    out = []
    for i, a in enumerate(marks):
        block = body[a:(marks[i + 1] if i + 1 < len(marks) else len(body))]
        t = re.search(r'title:\s*"((?:[^"\\]|\\.)*)"', block)
        page = re.search(r'page:\s*"music/([^/"]+)/"', block)
        sub = re.search(r'subgenre:\s*"([^"]+)"', block)
        cov = re.search(r'cover:\s*"assets/covers/([^"]+)\.webp"', block)
        out.append({
            "title": json.loads('"' + t.group(1) + '"') if t else "",
            "slug": page.group(1) if page else None,
            "subgenre": sub.group(1) if sub else "",
            "cover": cov.group(1) if cov else "cover-singles",  # DEFAULT_COVER
        })
    return out


# ---------- assets ----------

def make_audio(wav_src, slug, no_assets):
    dest_wav = ROOT / "assets/tracks" / f"{slug}.wav"
    dest_m4a = ROOT / "assets/tracks" / f"{slug}.m4a"
    if no_assets:
        if not dest_m4a.exists():
            die(f"{dest_m4a.relative_to(ROOT)} fehlt (--no-assets).")
        return dest_wav.exists()
    if not wav_src:
        die("--wav fehlt (oder --no-assets, wenn die Dateien schon unter assets/tracks/<slug>.* liegen).")
    wav_src = Path(wav_src).expanduser()
    if not wav_src.exists():
        die(f"WAV nicht gefunden: {wav_src}")
    # AAC for streaming
    if shutil.which("afconvert"):
        cmd = ["afconvert", str(wav_src), str(dest_m4a), "-f", "m4af", "-d", "aac",
               "-s", "3", "-u", "vbrq", "91", "-q", "127"]
    elif shutil.which("ffmpeg"):
        cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(wav_src), "-c:a", "aac", "-b:a", "192k", str(dest_m4a)]
    else:
        die("Weder afconvert (macOS) noch ffmpeg gefunden — kein AAC-Export möglich.")
    print("  Audio -> AAC:", dest_m4a.relative_to(ROOT))
    subprocess.run(cmd, check=True)
    # lossless copy for the pay-what-you-want download
    size = wav_src.stat().st_size
    if size > GITHUB_FILE_LIMIT:
        print(f"  WARNUNG: WAV ist {size / 1048576:.0f} MB — über GitHubs 100-MB-Grenze, wird NICHT "
              "übernommen (Download fällt auf die m4a zurück).")
        return False
    if wav_src.resolve() != dest_wav.resolve():
        shutil.copyfile(wav_src, dest_wav)
    print(f"  WAV: {dest_wav.relative_to(ROOT)} ({size / 1048576:.0f} MB)")
    return True


def make_covers(cover_src, slug, no_assets):
    out = ROOT / "assets/covers"
    need = [out / f"{slug}.jpg", out / f"{slug}.webp", out / f"{slug}-800.webp"]
    if no_assets:
        missing = [p.name for p in need if not p.exists()]
        if missing:
            die("Cover-Dateien fehlen (--no-assets): " + ", ".join(missing))
        return
    if not cover_src:
        die("--cover fehlt (oder --no-assets).")
    try:
        from PIL import Image
    except ImportError:
        die("Pillow fehlt: pip3 install Pillow")
    src = Path(cover_src).expanduser()
    if not src.exists():
        die(f"Cover nicht gefunden: {src}")
    im = Image.open(src).convert("RGB")
    if im.width != im.height:
        print(f"  WARNUNG: Cover ist nicht quadratisch ({im.width}x{im.height}).")
    full = im.copy()
    full.thumbnail((2000, 2000), Image.LANCZOS)
    small = im.copy()
    small.thumbnail((800, 800), Image.LANCZOS)
    full.save(need[0], quality=88, optimize=True, progressive=True)
    full.save(need[1], quality=82, method=6)
    small.save(need[2], quality=80, method=6)
    print("  Cover:", ", ".join(p.name for p in need))


# ---------- the edits ----------

def edit_tracks_js(files, a, wav_ok):
    s = files.read("js/tracks.js")
    if f'page: "music/{a.slug}/"' in s:
        die(f"'{a.slug}' steht schon in js/tracks.js.")
    s = re.sub(r",\s*isNew:\s*true", "", s)  # only the newest release is "new"
    j = lambda v: json.dumps(v, ensure_ascii=False)
    d = a.date
    lines = [f'  {{ type: "single", title: {j(a.title)}, cover: "assets/covers/{a.slug}.webp", isNew: true,']
    if a.hyperfollow:
        lines.append(f'    hyperfollow: {j(a.hyperfollow)},')
    lines.append(f'    subgenre: {j(a.subgenre)}, bpm: {a.bpm}, page: "music/{a.slug}/", '
                 f'date: "{d.day:02d}.{d.month:02d}.{d.year}",')
    track = f'{{ title: {j(a.title)}, file: "assets/tracks/{a.slug}.m4a"'
    if wav_ok:
        track += f', wav: "assets/tracks/{a.slug}.wav"'
    extra = []
    if a.spotify:
        extra.append(f'      spotify: {j(a.spotify)}')
    if a.apple:
        extra.append(f'      apple: {j(a.apple)}')
    if extra:
        track += ",\n" + ",\n".join(extra) + " }"
    else:
        track += " }"
    lines.append(f'    tracks: [{track}] }},')
    entry = "\n".join(lines) + "\n"
    marker = "var RELEASES = [\n"
    if marker not in s:
        die("'var RELEASES = [' in js/tracks.js nicht gefunden.")
    s = s.replace(marker, marker + entry, 1)
    files.write("js/tracks.js", s)
    return s


def similar_cards(releases, a, limit=3):
    others = [r for r in releases if r["slug"] and r["slug"] != a.slug]
    same = [r for r in others if r["subgenre"] == a.subgenre]
    rest = [r for r in others if r["subgenre"] != a.subgenre]
    if a.similar:
        by_slug = {r["slug"]: r for r in others}
        picks = [by_slug[s] for s in a.similar if s in by_slug]
        unknown = [s for s in a.similar if s not in by_slug]
        if unknown:
            die("Unbekannte Slugs in --similar: " + ", ".join(unknown))
    else:
        picks = (same + rest)[:limit]
    cards = []
    for r in picks:
        cards.append(
            f'          <a class="similar-card" href="../{r["slug"]}/">\n'
            f'            <img loading="lazy" src="../../assets/covers/{r["cover"]}-800.webp" alt="">\n'
            f'            <span>{esc(r["title"])}</span>\n'
            f'          </a>')
    return "\n".join(cards)


def build_page(files, a, releases, wav_ok):
    t = files.read("tools/release-page.template.html")
    d = a.date
    date_de = f"{d.day}. {MONTHS_DE[d.month - 1]} {d.year}"
    date_en = f"{MONTHS_EN[d.month - 1]} {d.day}, {d.year}"

    names = []
    if a.spotify:
        names.append("Spotify")
    if a.apple:
        names.append("Apple Music")
    plat_de = join_list(names + ["allen Plattformen"], "und")
    plat_en = join_list(names + ["everywhere"], "and")

    same = [u for u in (a.spotify, a.apple, a.hyperfollow) if u]
    sameas = ",\n".join(f'    "{jesc(u)}"' for u in same)

    btns = []
    if a.spotify:
        btns.append(f'          <a class="btn btn--primary" href="{esc(a.spotify)}" target="_blank" rel="noopener">Spotify</a>')
    if a.apple:
        btns.append(f'          <a class="btn btn--primary" href="{esc(a.apple)}" target="_blank" rel="noopener">Apple Music</a>')
    if a.hyperfollow:
        btns.append(
            f'          <a class="btn btn--primary" href="{esc(a.hyperfollow)}" target="_blank" rel="noopener">\n'
            '            <span data-lang="de">Alle Plattformen</span>\n'
            '            <span data-lang="en">All platforms</span>\n'
            '          </a>')

    desc_de = a.desc_de or (f'„{a.title}“ ist die neue Single von Audio Habitat — {a.subgenre} auf '
                            f'{a.bpm} BPM, erschienen am {date_de} über iDs Music Hub.')
    desc_en = a.desc_en or (f'"{a.title}" is the new single from Audio Habitat — {a.subgenre} at '
                            f'{a.bpm} BPM, released on {date_en} via iDs Music Hub.')

    values = {
        "TITLE": esc(a.title), "TITLE_JSON": jesc(a.title), "SLUG": a.slug,
        "SUBGENRE": esc(a.subgenre), "SUBGENRE_JSON": jesc(a.subgenre), "BPM": str(a.bpm),
        "DATE_ISO": d.isoformat(), "DATE_DE": date_de, "DATE_EN": date_en,
        "PLATFORMS_DE": plat_de, "PLATFORMS_EN": plat_en,
        "SAMEAS_LINES": sameas, "ACTION_BUTTONS": "\n".join(btns),
        "DESC_DE": esc(desc_de), "DESC_EN": esc(desc_en),
        "SIMILAR_CARDS": similar_cards(releases, a),
    }
    for k, v in values.items():
        t = t.replace("{{" + k + "}}", v)
    left = re.findall(r"\{\{[A-Z_]+\}\}", t)
    if left:
        die("Unersetzte Platzhalter in der Vorlage: " + ", ".join(sorted(set(left))))
    if not wav_ok:
        pass  # the release page only streams the m4a, nothing to adjust
    files.write(f"music/{a.slug}/index.html", t)
    return date_de


def edit_index(files, a):
    s = files.read("index.html")
    j = lambda v: json.dumps(v, ensure_ascii=False)
    same = [u for u in (a.spotify, a.apple, a.hyperfollow) if u]
    block = (
        '    {\n'
        '      "@type": "MusicRecording",\n'
        f'      "name": {j(a.title)},\n'
        '      "byArtist": {\n'
        '        "@id": "https://audiohabitatrec.com/#artist"\n'
        '      },\n'
        '      "genre": [\n'
        '        "Drum and Bass",\n'
        f'        {j(a.subgenre)}\n'
        '      ],\n'
        '      "additionalProperty": {\n'
        '        "@type": "PropertyValue",\n'
        '        "name": "BPM",\n'
        f'        "value": {a.bpm}\n'
        '      },\n'
        '      "sameAs": [\n'
        + ",\n".join(f'        {j(u)}' for u in same) + '\n'
        '      ],\n'
        f'      "image": "https://audiohabitatrec.com/assets/covers/{a.slug}.jpg",\n'
        f'      "url": "https://audiohabitatrec.com/music/{a.slug}/",\n'
        f'      "datePublished": "{a.date.isoformat()}"\n'
        '    },\n')
    marker = '    {\n      "@type": "MusicRecording",'
    if marker not in s:
        die("Konnte die Stelle für den Schema.org-Eintrag in index.html nicht finden.")
    s = s.replace(marker, block + marker, 1)

    cover = f"https://audiohabitatrec.com/assets/covers/{a.slug}.jpg"
    s = re.sub(r'(<meta property="og:image" content=")[^"]*(")', r"\g<1>" + cover + r"\2", s, count=1)
    s = re.sub(r'(<meta name="twitter:image" content=")[^"]*(")', r"\g<1>" + cover + r"\2", s, count=1)

    # static featured block = newest release (what visitors see before JS runs)
    def one(pattern, repl):
        nonlocal s
        s, n = re.subn(pattern, lambda m: repl(m), s, count=1)
        if n != 1:
            die("Statischer Featured-Block in index.html nicht erkannt: " + pattern)
    one(r'(<img id="featuredArt" src=")[^"]*(" alt=")[^"]*(")',
        lambda m: f'{m.group(1)}assets/covers/{a.slug}-800.webp{m.group(2)}{esc(a.title)}{m.group(3)}')
    one(r'(id="featuredKicker">)[^<]*(<)', lambda m: f"{m.group(1)}{esc(a.subgenre)} · {a.bpm} BPM{m.group(2)}")
    one(r'(id="featuredTitle">)[^<]*(<)', lambda m: m.group(1) + esc(a.title) + m.group(2))
    files.write("index.html", s)


def edit_sitemap(files, a):
    s = files.read("sitemap.xml")
    marker = "  <url>\n    <loc>https://audiohabitatrec.com/music/"
    if marker not in s:
        die("Keine bestehende /music/-Seite in sitemap.xml gefunden.")
    entry = (f"  <url>\n    <loc>https://audiohabitatrec.com/music/{a.slug}/</loc>\n"
             f"    <lastmod>{datetime.date.today().isoformat()}</lastmod>\n"
             "    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n")
    files.write("sitemap.xml", s.replace(marker, entry + marker, 1))


def edit_about(files, a, tracks_js):
    s = files.read("about.html")
    singles = len(re.findall(r'\{\s*type:\s*"single"', tracks_js))
    word_de = NUM_DE[singles] if singles < len(NUM_DE) else str(singles)
    word_en = NUM_EN[singles] if singles < len(NUM_EN) else str(singles)
    # closing quotes in the existing text are straight (") — accept typographic too
    s, n1 = re.subn(r'\b\w+( neue Singles und eine EP seit Juni 2026, von „[^“"]+[“"] bis „)[^“"]+([“"])',
                    lambda m: word_de + m.group(1) + a.title + m.group(2), s, count=1)
    s, n2 = re.subn(r'\b\w+( new singles and one EP since June 2026, from "[^"]+" to ")[^"]+(")',
                    lambda m: word_en + m.group(1) + a.title + m.group(2), s, count=1)
    if n1 != 1 or n2 != 1:
        print("  WARNUNG: Zählsatz in about.html nicht gefunden — bitte von Hand anpassen.")
        return
    files.write("about.html", s)


def verify(a):
    """Cheap safety net: JSON-LD parses, sitemap is well-formed, referenced files exist."""
    import xml.dom.minidom
    for rel in ("index.html", f"music/{a.slug}/index.html"):
        text = (ROOT / rel).read_text(encoding="utf-8")
        for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', text, re.S):
            json.loads(m.group(1))
    xml.dom.minidom.parse(str(ROOT / "sitemap.xml"))
    page = (ROOT / f"music/{a.slug}/index.html").read_text(encoding="utf-8")
    missing = []
    for ref in re.findall(r'(?:src|href)="(\.\./\.\./[^"#?]+)"', page):
        if not (ROOT / "music" / a.slug / ref).resolve().exists():
            missing.append(ref)
    if missing:
        die("Die neue Seite verweist auf fehlende Dateien: " + ", ".join(sorted(set(missing))))


def main():
    p = argparse.ArgumentParser(description="Neue Single auf der Seite anlegen.",
                                formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__)
    p.add_argument("--title", required=True)
    p.add_argument("--slug", help="URL/Dateiname; Standard: aus dem Titel")
    p.add_argument("--subgenre", required=True, help='z. B. "Liquid Funk", "Neurofunk", "Techstep"')
    p.add_argument("--bpm", required=True, type=int)
    p.add_argument("--date", required=True, help="Veröffentlichungsdatum JJJJ-MM-TT")
    p.add_argument("--wav", help="WAV-Master (für AAC-Export und Download)")
    p.add_argument("--cover", help="quadratisches Cover (JPG/PNG), gern ≥ 2000 px")
    p.add_argument("--spotify")
    p.add_argument("--apple")
    p.add_argument("--hyperfollow")
    p.add_argument("--desc-de")
    p.add_argument("--desc-en")
    p.add_argument("--similar", type=lambda v: [x.strip() for x in v.split(",") if x.strip()],
                   help="Komma-getrennte Slugs für 'Ähnliche Tracks' (Standard: gleiches Subgenre, dann neueste)")
    p.add_argument("--no-assets", action="store_true", help="Audio/Cover nicht neu erzeugen")
    p.add_argument("--dry-run", action="store_true", help="nichts schreiben")
    a = p.parse_args()

    try:
        a.date = datetime.date.fromisoformat(a.date)
    except ValueError:
        die("--date muss JJJJ-MM-TT sein, z. B. 2026-10-04")
    a.slug = a.slug or slugify(a.title)
    if (ROOT / "music" / a.slug).exists():
        die(f"music/{a.slug}/ gibt es schon.")

    files = Files(a.dry_run)
    existing = read_releases(files.read("js/tracks.js"))

    print(("[DRY-RUN] " if a.dry_run else "") + f'Neue Single "{a.title}" ({a.slug}), {a.subgenre}, {a.bpm} BPM, {a.date}')
    if a.dry_run:
        print("  Assets: übersprungen im Dry-Run")
        wav_ok = True
    else:
        wav_ok = make_audio(a.wav, a.slug, a.no_assets)
        make_covers(a.cover, a.slug, a.no_assets)

    tracks_js = edit_tracks_js(files, a, wav_ok)
    build_page(files, a, existing, wav_ok)
    edit_index(files, a)
    edit_sitemap(files, a)
    edit_about(files, a, tracks_js)

    if not a.dry_run:
        verify(a)
    print("\n" + ("Würde ändern:" if a.dry_run else "Geändert/angelegt:"))
    for rel in files.written:
        print("  ", rel)
    if not a.dry_run:
        print("\nNächste Schritte: Seite lokal ansehen (python3 -m http.server), dann\n"
              f"  git add js/tracks.js index.html about.html sitemap.xml music/{a.slug} "
              f"assets/covers/{a.slug}* assets/tracks/{a.slug}.*\n"
              f'  git commit -m "Add new single \\"{a.title}\\""  &&  git push origin main')
        if not (a.spotify and a.apple):
            print("\nHinweis: Spotify/Apple-Link fehlt — der Track fällt auf Hyperfollow/Artist-Profil zurück. "
                  "Nach der Veröffentlichung nachtragen (js/tracks.js + Release-Seite).")


if __name__ == "__main__":
    main()
