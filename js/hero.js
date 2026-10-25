/*
  Hero: the light monolith (index.html, css "Light monolith scene").

  Before anything plays the room is dim and the monolith's light line is covered. When the
  music actually starts — the deck's needle has landed and the sound is unmuted — the line
  ignites bottom → top, and the music moves the scene from then on: CSS vars on .hero (--e
  bass energy, --ign lit, --rev how far the line is revealed) drive the photo's brightness,
  the line's glow, halo, fog and logo glow; the canvas draws the track's signal on the
  horizon (denser with the bass), a light ring across the wet floor on every kick, and dust.

  Sound analysis: the shared <audio id="audio"> is routed through a Web Audio analyser,
  created on the visitor's first tap/click (browsers only allow audio contexts to start then).
  Exception: iPhones/iPads without navigator.audioSession — there Web Audio would obey the
  silent switch and the music could go quiet, so the <audio> is left alone and the scene
  pulses from the track's waveform data (assets/waves/) and its tempo instead.

  "Jetzt hören" starts the featured track on the deck (same as its start/stop pad).
*/
(function () {
  var hero = document.querySelector('.hero');
  var canvas = document.getElementById('heroFx');
  var audio = document.getElementById('audio');
  if (!hero || !canvas || !audio) return;

  var g = canvas.getContext('2d');
  var listen = document.getElementById('heroListen');
  var featuredPlay = document.getElementById('featuredPlay');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var on = function () { return window.AHDeck ? AHDeck.on(audio) : !audio.paused; };

  // ---- "Jetzt hören": play/pause the featured track right here instead of scrolling ----
  if (listen && featuredPlay) {
    listen.addEventListener('click', function (e) {
      e.preventDefault();
      featuredPlay.click();
    });
  }

  // ---- analyser (or the waveform fallback) ----
  var iOSLegacy = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  iOSLegacy = iOSLegacy && !('audioSession' in navigator);
  var ctx = null, an = null, freq = null, wave = null;
  function setupAnalyser() {
    if (ctx || iOSLegacy) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';   // play even with the silent switch on
      ctx = new AC();
      var src = ctx.createMediaElementSource(audio);
      an = ctx.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0.6;
      src.connect(an); an.connect(ctx.destination);
      freq = new Uint8Array(an.frequencyBinCount); wave = new Uint8Array(an.fftSize);
    } catch (err) { an = null; }
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }
  // created inside the visitor's first gesture, so the context is allowed to run
  ['pointerdown', 'keydown', 'touchend'].forEach(function (t) {
    document.addEventListener(t, function first() { setupAnalyser(); document.removeEventListener(t, first, true); }, true);
  });
  audio.addEventListener('play', function () { if (ctx && ctx.state !== 'running') ctx.resume(); });

  // fallback energy: the track's loudness curve (assets/waves/<slug>.json) × a kick at its tempo
  var fb = { url: '', data: null, bpm: 174 };
  function loadWave() {
    var src = audio.currentSrc || audio.src, m;
    try { m = /^(.*)\/tracks\/([^\/?#]+)\.m4a/.exec(new URL(src, location.href).href); } catch (err) { m = null; }
    var u = m ? m[1] + '/waves/' + m[2] + '.json' : '';
    if (!u || u === fb.url) return;
    fb.url = u; fb.data = null;
    fetch(u).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { if (fb.url === u) fb.data = d; }).catch(function () {});
  }
  audio.addEventListener('loadstart', loadWave);
  function fallbackEnergy() {
    var d = fb.data, t = audio.currentTime || 0, dur = audio.duration || 0;
    var level = d && dur ? d[Math.min(d.length - 1, Math.floor(t / dur * d.length))] / 100 : 0.7;
    var phase = (t * fb.bpm / 60) % 1;
    return level * Math.pow(1 - phase, 3);
  }

  // ---- canvas ----
  var W = 0, H = 0, horizonY = 0;
  // The man in the photo stands in front of the monolith, so the signal, rings and dust pass
  // behind him: his silhouette (cut from the photo, soft edge) is erased from the canvas.
  var photo = hero.querySelector('.hero__photo'), PHOTO_HORIZON = .792;
  var MAN = [.484375, .73289, .022693, .113158];                           // x, y, w, h as fractions of the photo
  var man = null, manMask = new Image();
  manMask.src = 'data:image/png;base64,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';
  function size() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    horizonY = H * parseFloat(getComputedStyle(hero).getPropertyValue('--horizon')) / 100;
    // where the man stands in the photo, in canvas coordinates (the photo's horizon sits on ours)
    if (photo) {
      var pw = photo.offsetWidth, ph = photo.offsetHeight, pl = W / 2 - pw / 2, pt = horizonY - ph * PHOTO_HORIZON;
      man = { x: pl + pw * MAN[0], y: pt + ph * MAN[1], w: pw * MAN[2], h: ph * MAN[3] };
    }
  }
  window.addEventListener('resize', size);
  size();

  var dust = [];
  for (var i = 0; i < (reduce ? 0 : 60); i++) dust.push({ x: Math.random(), y: Math.random(), s: .4 + Math.random() * 1.3, v: .004 + Math.random() * .012, tw: Math.random() * 6.28 });
  var ripples = [];
  var e = 0, hi = 0, slow = 0, ign = 0, rev = 0, dense = 0, ever = false, lit = false, lastKick = 0, raf = 0, t0 = performance.now();

  function frame(ts) {
    raf = 0;
    var t = (ts - t0) / 1000;
    var playing = on();
    // lit from the moment the needle has landed (sound unmuted) until the music stops — a hand
    // on the record (scratching mutes the <audio> for a moment) doesn't switch it off
    if (playing && !audio.muted) lit = ever = true; else if (!playing) lit = false;
    var audible = lit;
    hero.classList.toggle('is-playing', playing);

    // energy: bass for the light, highs for the dust
    var bass = 0, high = 0;
    if (audible && an) {
      an.getByteFrequencyData(freq);
      for (var b = 1; b <= 6; b++) bass += freq[b]; bass /= 6 * 255;            // ~20–140 Hz
      for (var h = 180; h < 420; h++) high += freq[h]; high /= 240 * 255;      // ~4–9 kHz
      bass = Math.pow(Math.max(0, (bass - .35) / .65), 1.4);                   // ignore the constant floor, keep the hits
    } else if (audible) {
      bass = fallbackEnergy(); high = bass * .25;
    }
    e += (bass - e) * (bass > e ? .55 : (reduce ? .05 : .12));                 // fast attack, slower release
    hi += (high * 3 - hi) * .2;
    slow += (e - slow) * .02;
    if (audible && !reduce && e - slow > .22 && ts - lastKick > 220) { ripples.push({ r: 0, a: Math.min(1, (e - slow) * 2.2) }); lastKick = ts; }
    // lit while the music plays; afterwards a faint afterglow stays
    var target = audible ? 1 : (ever ? .3 : 0);
    ign += (target - ign) * (ign < target ? .035 : .03);
    hero.style.setProperty('--e', e.toFixed(3));
    hero.style.setProperty('--ign', ign.toFixed(3));
    rev = Math.max(rev, ign);                                                  // once lit, the line stays revealed
    hero.style.setProperty('--rev', Math.min(1, rev * 1.05).toFixed(3));

    g.clearRect(0, 0, W, H);
    var cx = W / 2;

    // kick ripples on the floor around the monolith's base
    g.lineWidth = 1.5;
    for (var r = ripples.length - 1; r >= 0; r--) {
      var rp = ripples[r]; rp.r += 7 + rp.r * .035; rp.a *= .955;
      if (rp.a < .02) { ripples.splice(r, 1); continue; }
      g.strokeStyle = 'rgba(206,222,255,' + (rp.a * .5).toFixed(3) + ')';
      g.beginPath(); g.ellipse(cx, horizonY + 2, rp.r * 1.6, rp.r * .22, 0, 0, Math.PI * 2); g.stroke();
    }

    // the track's signal on the horizon (calm sine while silent), with its reflection.
    // It gets denser with the bass: more points and extra strands (the same signal, slightly
    // shifted in time), so a drop turns the thin line into a glowing bundle.
    dense += (e - dense) * (e > dense ? .3 : .04);
    var amp = H * (.012 + .07 * e) * ign, N = Math.round(140 + 380 * dense), strands = 1 + Math.floor(dense * 5.5);
    if (audible && an) an.getByteTimeDomainData(wave);
    function signal(shift, scale) {
      var pts = [];
      for (var p = 0; p <= N; p++) {
        var v = audible && an ? (wave[(Math.floor(p / N * (wave.length - 1 - 6 * shift)) + 6 * shift) % wave.length] - 128) / 128
              : audible ? Math.sin(p * 900 / N + t * 9 + shift) * (.1 + e * .5) * Math.sin(p * .13 * 160 / N + t * 2)
              : Math.sin(p * 56 / N + t * 1.6) * .08;
        var edge = Math.sin(Math.PI * p / N);
        pts.push(horizonY - v * amp * edge * edge * 6 * scale);
      }
      return pts;
    }
    function line(pts, alpha, width, blur, mirror) {
      g.save();
      g.lineWidth = width; g.shadowBlur = blur; g.shadowColor = 'rgba(224,112,63,.9)';
      g.strokeStyle = 'rgba(240,130,80,' + alpha.toFixed(3) + ')';
      g.beginPath();
      for (var q = 0; q <= N; q++) {
        var yy = mirror ? horizonY + (horizonY - pts[q]) * .6 : pts[q];
        if (q) g.lineTo(q / N * W, yy); else g.moveTo(0, yy);
      }
      g.stroke(); g.restore();
    }
    for (var sI = strands - 1; sI >= 1; sI--) line(signal(sI * 7, 1 - sI * .13), (.08 + .3 * ign) * (1 - sI / (strands + 1)), .8, 6, false);
    var main = signal(0, 1);
    line(main, .12 + .6 * ign, 1.4 + dense * .6, 12, false);
    line(main, .04 + .18 * ign, 1, 8, true);

    // dust in the light: rises slowly, sparkles with the highs
    for (var d = 0; d < dust.length; d++) {
      var m = dust[d]; m.y -= m.v * (1 + e * 2) / 60; if (m.y < 0) { m.y = 1; m.x = Math.random(); }
      var px = m.x * W, py = m.y * H, near = Math.max(0, 1 - Math.abs(px - cx) / (W * .45));
      var a = (.08 + .5 * near * ign) * (.6 + .4 * Math.sin(t * 2 + m.tw)) * (1 + Math.min(1, hi) * 1.5);
      g.fillStyle = 'rgba(220,232,255,' + Math.min(.9, a).toFixed(3) + ')';
      g.beginPath(); g.arc(px, py, m.s, 0, Math.PI * 2); g.fill();
    }

    if (man && manMask.complete) {
      g.globalCompositeOperation = 'destination-out';
      g.drawImage(manMask, man.x, man.y, man.w, man.h);
      g.globalCompositeOperation = 'source-over';
    }
    run();
  }

  // only animate while the hero is on screen and the tab is visible
  var visible = true;
  function run() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); }
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; run(); }).observe(hero);
  }
  document.addEventListener('visibilitychange', run);
  run();
})();
