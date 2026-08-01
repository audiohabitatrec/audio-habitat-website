/*
  Releases für den Player auf der Startseite.

  Ein Release ist entweder:
  - type: "single"  → genau 1 Track, eigenes Cover
  - type: "ep"       → mehrere Tracks, TEILEN sich ein gemeinsames Cover

  So fügst du einen neuen Song hinzu:
  1. MP3/M4A-Datei in assets/tracks/ legen
  2. Optional: Cover (quadratisch) in assets/covers/ legen
  3. Unten einen neuen Eintrag in RELEASES ergänzen

  Wird "spotify" / "apple" / "soundcloud" bei einem Track weggelassen,
  verlinkt das Icon automatisch auf das allgemeine Artist-Profil.
*/

var DEFAULT_COVER = "assets/covers/cover-singles.jpg";

var RELEASES = [
  {
    type: "ep",
    title: "4 Reasons",
    cover: "assets/covers/4reasons.jpg",
    tracks: [
      { title: "The Reason", file: "assets/tracks/the-reason.m4a", wav: "assets/tracks/the-reason.wav" },
      { title: "Nightfall", file: "assets/tracks/nightfall.m4a", wav: "assets/tracks/nightfall.wav" },
      { title: "Mind of Blank", file: "assets/tracks/mind-of-blank.m4a", wav: "assets/tracks/mind-of-blank.wav" },
      { title: "Nowhere to Hide", file: "assets/tracks/nowhere-to-hide.m4a", wav: "assets/tracks/nowhere-to-hide.wav" }
    ]
  },
  { type: "single", title: "Signal", cover: "assets/covers/signal.jpg",
    tracks: [{ title: "Signal", file: "assets/tracks/signal.m4a", wav: "assets/tracks/signal.wav",
      apple: "https://music.apple.com/de/album/signal-single/6789963854" }] },
  { type: "single", title: "Dope Bass", cover: "assets/covers/dope-bass.jpg",
    tracks: [{ title: "Dope Bass", file: "assets/tracks/dope-bass.m4a", wav: "assets/tracks/dope-bass.wav" }] },
  { type: "single", title: "Reece Drop", cover: "assets/covers/reece-drop.jpg",
    tracks: [{ title: "Reece Drop", file: "assets/tracks/reece-drop.m4a", wav: "assets/tracks/reece-drop.wav" }] },
  { type: "single", title: "Cold Static", cover: "assets/covers/cold-static.jpg",
    // No wav: field — the WAV master is ~110MB, over GitHub's 100MB file
    // limit, so this one falls back to the M4A for downloads (see app.js).
    tracks: [{ title: "Cold Static", file: "assets/tracks/cold-static.m4a" }] },
  { type: "single", title: "Shadow Pulse", cover: "assets/covers/shadow-pulse.jpg",
    tracks: [{ title: "Shadow Pulse", file: "assets/tracks/shadow-pulse.m4a", wav: "assets/tracks/shadow-pulse.wav" }] },
  { type: "single", title: "Pressure Rise", cover: "assets/covers/pressure-rise.jpg",
    tracks: [{ title: "Pressure Rise", file: "assets/tracks/pressure-rise.m4a", wav: "assets/tracks/pressure-rise.wav" }] },
  { type: "single", title: "Silent Hunter", cover: "assets/covers/silent-hunter.jpg",
    tracks: [{ title: "Silent Hunter", file: "assets/tracks/silent-hunter.m4a", wav: "assets/tracks/silent-hunter.wav" }] },
  { type: "single", title: "Step in the Rhythm", cover: "assets/covers/step-in-the-rhythm.jpg",
    tracks: [{ title: "Step in the Rhythm", file: "assets/tracks/step-in-the-rhythm.m4a", wav: "assets/tracks/step-in-the-rhythm.wav" }] },
  { type: "single", title: "Let's Go", cover: "assets/covers/lets-go.jpg",
    tracks: [{ title: "Let's Go", file: "assets/tracks/lets-go.m4a", wav: "assets/tracks/lets-go.wav" }] },
  { type: "single", title: "Change Your Mind", cover: "assets/covers/change-your-mind.jpg",
    tracks: [{ title: "Change Your Mind", file: "assets/tracks/change-your-mind.m4a", wav: "assets/tracks/change-your-mind.wav" }] },
  { type: "single", title: "Face the Future", cover: DEFAULT_COVER,
    tracks: [{ title: "Face the Future", file: "assets/tracks/face-the-future.m4a", wav: "assets/tracks/face-the-future.wav" }] }
];

/*
  Eigene Plattform-Links pro Song? Einfach im jeweiligen Track-Objekt ergänzen:
  { title: "Signal", file: "assets/tracks/signal.m4a",
    spotify: "https://open.spotify.com/track/XXXXXXXXXXXX",
    apple: "https://music.apple.com/de/song/signal/XXXXXXXXXX",
    soundcloud: "https://soundcloud.com/audiohabitat/signal" }
*/

var ARTIST_LINKS = {
  spotify: "https://open.spotify.com/artist/2eo8TqrCseukiJaOIK2rhc",
  apple: "https://music.apple.com/us/artist/audio-habitat/4291320",
  soundcloud: "https://soundcloud.com/audiohabitatrec"
};

var PAYPAL_EMAIL = "audiohabitatrec@googlemail.com";
