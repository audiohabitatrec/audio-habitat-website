/*
  Veröffentlichungen auf anderen Labels ("Discography"-Bereich).
  Kein eigener Player nötig — Klick/Tap führt zur Release-Seite (Beatport/Bandcamp).
  Beatport-Links brauchen die Release-Nummer am Ende (…/release/<slug>/<id>), sonst zeigt
  Beatport nur eine 404-Seite. Releases, die es dort nicht (mehr) gibt: url: null → nur Text.

  Cover optional: "cover": "assets/covers/discography/xyz.jpg"
  Ohne Cover wird ein generisches Vinyl-Icon angezeigt.
*/

var OTHER_LABELS = [
  {
    label: "T3K Recordings",
    releases: [
      { title: "Parameter EP", url: "https://www.beatport.com/release/parameter-ep/1397846", source: "Beatport" },
      { title: "District EP", url: "https://www.beatport.com/release/district-ep/1502304", source: "Beatport" },
      { title: "Welcome To Level 7", url: "https://www.beatport.com/release/welcome-to-level-7/1502289", source: "Beatport" },
      { title: "Election EP", url: "https://www.beatport.com/release/election-ep/1885972", source: "Beatport" },
      { title: "Gateway EP (VA)", url: "https://www.beatport.com/release/gateway-ep/1702939", source: "Beatport" },
      { title: "System Dwellers EP (VA)", url: "https://www.beatport.com/release/system-dwellers-ep/1791818", source: "Beatport" },
      { title: "The Halfstep Chronicles Vol. 3", url: "https://t3krecordings.bandcamp.com/album/the-halfstep-chronicles-vol-3", source: "Bandcamp" }
    ]
  },
  {
    label: "Director's Cut Recordings",
    releases: [
      { title: "Audio Connections Pt. 1", url: "https://www.beatport.com/release/audio-connections-pt-1/1595848", source: "Beatport" },
      { title: "Audio Connections Pt. 2", url: "https://www.beatport.com/release/audio-connections-pt-2/1595797", source: "Beatport" },
      { title: "Audio Connections Pt. 3", url: "https://www.beatport.com/release/audio-connections-ep-pt-3/2146384", source: "Beatport" },
      { title: "Audio Connections Pt. 4", url: "https://www.beatport.com/release/audio-connections-pt-4/2271964", source: "Beatport" },
      { title: "800 Mg EP", url: null }
    ]
  },
  {
    label: "Benefit Beats",
    releases: [
      { title: "Social Security Presents Audio Habitat", url: "https://www.beatport.com/release/social-security-presents-audio-habitat/1373096", source: "Beatport" },
      { title: "Social Security Presents The Social Classics Remix", url: "https://www.beatport.com/release/social-security-presents-the-social-classics-remix-genesis-audio-habitats-dna-remix-2016/1879803", source: "Beatport" },
      { title: "The Attack Of The Rollerz", url: "https://www.beatport.com/release/social-security-presents-the-attack-of-the-rollerz/1202354", source: "Beatport" }
    ]
  },
  {
    label: "Dispatch Recordings",
    releases: [
      { title: "Red Alert / A Message / Maintain", url: "https://www.beatport.com/release/red-alert-a-message-maintain/1491853", source: "Beatport" }
    ]
  },
  {
    label: "Function Records",
    releases: [
      { title: "Synthesis", url: null }
    ]
  },
  {
    label: "AutomAte Tech Recordings",
    releases: [
      { title: "Kabuki / Gasket", url: "https://www.beatport.com/release/kabuki-gasket/1780428", source: "Beatport" }
    ]
  },
  {
    label: "Silbarueckenbeatz Entertainment",
    releases: [
      { title: "Audio Habitat", url: "https://www.beatport.com/release/audio-habitat/1182817", source: "Beatport" },
      { title: "Ghost Army EP", url: "https://www.beatport.com/release/ghost-army-ep/1358895", source: "Beatport" },
      { title: "Ghost Army 2 - Defenders Of The Underworld", url: "https://www.beatport.com/release/ghost-army-2-defenders-of-the-underworld/1793901", source: "Beatport" }
    ]
  },
  {
    label: "Beatalistics Records",
    releases: [
      { title: "Echos E.P.", url: "https://www.beatport.com/release/echos-ep/1487751", source: "Beatport" }
    ]
  },
  {
    label: "Sidechain Music",
    releases: [
      { title: "The Raising", url: "https://www.beatport.com/release/the-raising/1065962", source: "Beatport" },
      { title: "Profiler", url: "https://www.beatport.com/release/profiler/1141835", source: "Beatport" },
      { title: "Confrontation / Conspiracy", url: "https://www.beatport.com/release/confrontation-conspiracy/1079713", source: "Beatport" }
    ]
  },
  {
    label: "SUNANDBASS Recordings",
    releases: [
      { title: "SUNANDBASS 10 Years Selection", url: "https://www.beatport.com/release/sunandbass-10-years-selection/1205867", source: "Beatport" }
    ]
  }
];
