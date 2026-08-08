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

// hyperfollow: DistroKid's "one link, every platform" page per RELEASE
// (not per track — an EP has one page covering all its tracks). Slugs are
// NOT reliably derivable from the file name (e.g. "4 Reasons" -> "4-reasons-2",
// not "4reasons"), so these have to be pasted in by hand, one at a time.
var RELEASES = [
  { type: "single", title: "Beast Mode", cover: "assets/covers/beast-mode.jpg", isNew: true,
    hyperfollow: "https://distrokid.com/hyperfollow/audiohabitat/beast-mode?ref=release",
    tracks: [{ title: "Beast Mode", file: "assets/tracks/beast-mode.m4a", wav: "assets/tracks/beast-mode.wav",
      spotify: "https://open.spotify.com/track/6WmG5SqwEU34HRMcfCRn9D",
      apple: "https://music.apple.com/us/album/beast-mode-single/6798421584" }] },
  { type: "single", title: "D-Chords", cover: "assets/covers/d-chords.jpg",
    hyperfollow: "https://distrokid.com/hyperfollow/audiohabitat/d-chords?ref=release",
    tracks: [{ title: "D-Chords", file: "assets/tracks/d-chords.m4a", wav: "assets/tracks/d-chords.wav",
      spotify: "https://open.spotify.com/track/6HXFc3ku2WIELla2tVRLaP",
      apple: "https://music.apple.com/us/album/d-chords-single/6797106496" }] },
  {
    type: "ep",
    title: "4 Reasons",
    cover: "assets/covers/4reasons.jpg",
    hyperfollow: "https://distrokid.com/hyperfollow/audiohabitat/4-reasons-2?ref=release",
    tracks: [
      { title: "The Reason", file: "assets/tracks/the-reason.m4a", wav: "assets/tracks/the-reason.wav",
        spotify: "https://open.spotify.com/track/7h3ik4iBz9xyRwyoal5Tk0",
        apple: "https://music.apple.com/us/song/the-reason/6793720234" },
      { title: "Nightfall", file: "assets/tracks/nightfall.m4a", wav: "assets/tracks/nightfall.wav",
        spotify: "https://open.spotify.com/track/2Mep8GGPcet3FoaqyR8QWK",
        apple: "https://music.apple.com/us/song/nightfall/6793720237" },
      { title: "Mind of Blank", file: "assets/tracks/mind-of-blank.m4a", wav: "assets/tracks/mind-of-blank.wav",
        spotify: "https://open.spotify.com/track/744RIxP3COz62e2IA3MPCt",
        apple: "https://music.apple.com/us/song/mind-of-blank/6793720236" },
      { title: "Nowhere to Hide", file: "assets/tracks/nowhere-to-hide.m4a", wav: "assets/tracks/nowhere-to-hide.wav",
        spotify: "https://open.spotify.com/track/4UmgkKO7hNO4FwpFlce6Dn",
        apple: "https://music.apple.com/us/song/nowhere-to-hide/6793720239" }
    ]
  },
  { type: "single", title: "Signal", cover: "assets/covers/signal.jpg",
    hyperfollow: "https://distrokid.com/hyperfollow/audiohabitat/signal-2?ref=release",
    tracks: [{ title: "Signal", file: "assets/tracks/signal.m4a", wav: "assets/tracks/signal.wav",
      spotify: "https://open.spotify.com/track/4fkFG2P9mxJsnV91Iv5NkD",
      apple: "https://music.apple.com/de/album/signal-single/6789963854" }] },
  { type: "single", title: "Dope Bass", cover: "assets/covers/dope-bass.jpg",
    hyperfollow: "https://distrokid.com/hyperfollow/audiohabitat/dope-bass?ref=release",
    tracks: [{ title: "Dope Bass", file: "assets/tracks/dope-bass.m4a", wav: "assets/tracks/dope-bass.wav",
      spotify: "https://open.spotify.com/track/6pNj6jkdnTumGzLg6B8fNa",
      apple: "https://music.apple.com/us/album/dope-bass-single/6784020123" }] },
  { type: "single", title: "Reece Drop", cover: "assets/covers/reece-drop.jpg",
    hyperfollow: "https://distrokid.com/hyperfollow/audiohabitat/reece-drop?ref=release",
    tracks: [{ title: "Reece Drop", file: "assets/tracks/reece-drop.m4a", wav: "assets/tracks/reece-drop.wav",
      spotify: "https://open.spotify.com/track/2NNV6mInR2M5k0JSiu8XKu",
      apple: "https://music.apple.com/us/album/reece-drop-single/6793791594" }] },
  { type: "single", title: "Cold Static", cover: "assets/covers/cold-static.jpg",
    hyperfollow: "https://distrokid.com/hyperfollow/audiohabitat/cold-static?ref=release",
    // No wav: field — the WAV master is ~110MB, over GitHub's 100MB file
    // limit, so this one falls back to the M4A for downloads (see app.js).
    tracks: [{ title: "Cold Static", file: "assets/tracks/cold-static.m4a",
      spotify: "https://open.spotify.com/track/5vcPbqgJistclbRZMwJTam",
      apple: "https://music.apple.com/us/album/cold-static-single/6795362329" }] },
  { type: "single", title: "Shadow Pulse", cover: "assets/covers/shadow-pulse.jpg",
    hyperfollow: "https://distrokid.com/hyperfollow/audiohabitat/shadow-pulse?ref=release",
    tracks: [{ title: "Shadow Pulse", file: "assets/tracks/shadow-pulse.m4a", wav: "assets/tracks/shadow-pulse.wav",
      spotify: "https://open.spotify.com/track/06Voh8ezxV1SjB4VS7DUi7",
      apple: "https://music.apple.com/us/album/shadow-pulse-single/6787561149" }] },
  { type: "single", title: "Pressure Rise", cover: "assets/covers/pressure-rise.jpg",
    hyperfollow: "https://distrokid.com/hyperfollow/audiohabitat/pressure-rise?ref=release",
    tracks: [{ title: "Pressure Rise", file: "assets/tracks/pressure-rise.m4a", wav: "assets/tracks/pressure-rise.wav",
      spotify: "https://open.spotify.com/track/3LIGMXyVFWK2TSXEX8smL1",
      apple: "https://music.apple.com/us/album/pressure-rise-single/6788316320" }] },
  { type: "single", title: "Silent Hunter", cover: "assets/covers/silent-hunter.jpg",
    hyperfollow: "https://distrokid.com/hyperfollow/audiohabitat/silent-hunter-2?ref=release",
    tracks: [{ title: "Silent Hunter", file: "assets/tracks/silent-hunter.m4a", wav: "assets/tracks/silent-hunter.wav",
      spotify: "https://open.spotify.com/track/3BsiXPZfDXE4SvTLcBxftI",
      apple: "https://music.apple.com/us/album/silent-hunter-single/6788456138" }] },
  { type: "single", title: "Step in the Rhythm", cover: "assets/covers/step-in-the-rhythm.jpg",
    hyperfollow: "https://distrokid.com/hyperfollow/audiohabitat/step-in-the-rhythm?ref=release",
    tracks: [{ title: "Step in the Rhythm", file: "assets/tracks/step-in-the-rhythm.m4a", wav: "assets/tracks/step-in-the-rhythm.wav",
      spotify: "https://open.spotify.com/track/2Yc0RSWciWu2wsGe2n8cbq",
      apple: "https://music.apple.com/us/album/step-in-the-rhythm-single/6792932598" }] },
  { type: "single", title: "Let's Go", cover: "assets/covers/lets-go.jpg",
    hyperfollow: "https://distrokid.com/hyperfollow/audiohabitat/lets-go?ref=release",
    tracks: [{ title: "Let's Go", file: "assets/tracks/lets-go.m4a", wav: "assets/tracks/lets-go.wav",
      spotify: "https://open.spotify.com/track/0Udjo38nhzJx7xQgFl9yLJ",
      apple: "https://music.apple.com/us/album/lets-go-single/6782704933" }] },
  { type: "single", title: "Change Your Mind", cover: "assets/covers/change-your-mind.jpg",
    hyperfollow: "https://distrokid.com/hyperfollow/audiohabitat/change-your-mind?ref=release",
    tracks: [{ title: "Change Your Mind", file: "assets/tracks/change-your-mind.m4a", wav: "assets/tracks/change-your-mind.wav",
      spotify: "https://open.spotify.com/track/0aJef1JkWMuyFtMGHTDEDb",
      apple: "https://music.apple.com/us/album/change-your-mind-single/6782477222" }] },
  { type: "single", title: "Face the Future", cover: DEFAULT_COVER,
    hyperfollow: "https://distrokid.com/hyperfollow/audiohabitat/face-the-future?ref=release",
    tracks: [{ title: "Face the Future", file: "assets/tracks/face-the-future.m4a", wav: "assets/tracks/face-the-future.wav",
      spotify: "https://open.spotify.com/track/60Kyr92drheOuOxbqIRPbQ",
      apple: "https://music.apple.com/us/album/face-the-future-single/6787701911" }] }
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
