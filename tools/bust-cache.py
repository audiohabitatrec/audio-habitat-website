#!/usr/bin/env python3
"""
Versionsnummern für CSS/JS (Cache-Busting).

GitHub Pages lässt Browser Dateien 10 Minuten cachen. Nach einem Update konnten Besucher so
eine Weile neues HTML mit altem CSS/JS mischen. Dieses Skript hängt an jeden Verweis auf eine
eigene .css/.js-Datei eine Prüfsumme ihres Inhalts (style.css?v=3fa9c2d1) — ändert sich die
Datei, ändert sich die Nummer, und der Browser lädt sie garantiert neu.

    python3 tools/bust-cache.py          # alle Seiten + Release-Vorlage aktualisieren

Nach jeder Änderung an css/ oder js/ ausführen (new-release.py macht es automatisch).
"""

import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = ["index.html", "about.html", "team.html", "impressum.html", "datenschutz.html", "404.html",
         "tools/release-page.template.html"] + sorted(str(p.relative_to(ROOT)) for p in ROOT.glob("music/*/index.html"))

REF = re.compile(r'((?:href|src)=")((?:\.\./)*(?:css|js)/[\w.-]+\.(?:css|js))(?:\?v=[0-9a-f]+)?(")')
_hashes = {}


def version(rel):
    if rel not in _hashes:
        f = ROOT / rel
        _hashes[rel] = hashlib.md5(f.read_bytes()).hexdigest()[:8] if f.exists() else None
    return _hashes[rel]


def main():
    changed = 0
    for page in PAGES:
        p = ROOT / page
        if not p.exists():
            continue
        s = p.read_text()

        def repl(m):
            path = m.group(2)
            rel = re.sub(r"^(\.\./)+", "", path)       # the template lives in tools/ but is copied to music/<slug>/
            v = version(rel)
            return m.group(1) + path + (f"?v={v}" if v else "") + m.group(3)

        s2 = REF.sub(repl, s)
        if s2 != s:
            p.write_text(s2)
            changed += 1
    print(f"Versionsnummern aktualisiert in {changed} Datei(en).")


if __name__ == "__main__":
    main()
