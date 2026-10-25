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
    return level * (.25 + .75 * Math.pow(1 - phase, 3));
  }

  // ---- canvas ----
  var W = 0, H = 0, horizonY = 0;
  // ---- the dancer ----
  // The man in front of the monolith is real footage: a short loop generated from this very
  // photo (camera locked, only he moves), cropped to him (assets/hero/dancer.mp4). Each frame is
  // keyed by brightness — he is a dark silhouette against the light — and drawn on top of
  // everything, so the light line, the signal and the rings pass behind him. He dances while
  // the music plays and stands still (first frame = the photo's pose) when it stops. The photo
  // itself has him removed, so nothing doubles up.
  var photo = hero.querySelector('.hero__photo'), PHOTO_HORIZON = .792;
  var DANCER_BOX = [.46648, .71237, .05834, .1175];                       // crop's place in the photo: x, y, w, h (fractions)
  var DANCER_FEET = .89;                                                   // where his feet are in the crop (for the reflection)
  var KEY_LO = 14, KEY_HI = 30;                                            // luminance: ≤ LO fully him, ≥ HI fully background
  var man = null;
  var dv = document.createElement('video');
  dv.muted = true; dv.loop = true; dv.playsInline = true; dv.setAttribute('playsinline', ''); dv.preload = 'auto';
  dv.src = 'assets/hero/dancer.mp4';
  var keyC = document.createElement('canvas'), kg = keyC.getContext('2d', { willReadFrequently: true });
  var still = new Image(); still.src = 'assets/hero/dancer-still.png';      // keyed first frame, until the video can show
  function place(ctx, src) {
    ctx.drawImage(src, man.x, man.y, man.w, man.h);
    // his reflection in the wet floor
    var fy = man.y + man.h * DANCER_FEET;
    ctx.save(); ctx.globalAlpha = .3; ctx.translate(0, fy * 2); ctx.scale(1, -1);
    var sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
    ctx.drawImage(src, 0, 0, sw, sh * DANCER_FEET, man.x, man.y, man.w, man.h * DANCER_FEET);
    ctx.restore();
  }
  function drawMan(ctx) {
    if (!man) return;
    if (dv.readyState < 2) { if (still.complete && still.naturalWidth) place(ctx, still); return; }
    var w = dv.videoWidth, h = dv.videoHeight;
    if (keyC.width !== w || keyC.height !== h) { keyC.width = w; keyC.height = h; }
    kg.drawImage(dv, 0, 0, w, h);
    var img = kg.getImageData(0, 0, w, h), d = img.data, span = KEY_HI - KEY_LO;
    for (var i = 0; i < d.length; i += 4) {
      var lum = .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2];
      var al = Math.max(0, Math.min(1, (KEY_HI - lum) / span));
      d[i + 3] = al * al * (3 - 2 * al) * 255;                              // smoothstep edge
    }
    kg.putImageData(img, 0, 0);
    place(ctx, keyC);
  }
  // ---- far-off party behind the monolith (canvas inside the photo box, see .hero__party) ----
  // Strobes flash on the kicks (at most ~3 per second, soft and dim — and none at all with
  // reduced motion), a few coloured beams sweep up through the haze and swell with the bass,
  // and a crowd glow sits on the horizon. All of it only while the monolith is lit.
  var party = document.getElementById('heroParty'), pg = party && party.getContext('2d'), PW = 0, PH = 0;
  var BEAMS = [{ x: .16, c: '255,40,90', ph: 0 }, { x: .3, c: '130,80,255', ph: 2.1 }, { x: .38, c: '255,70,150', ph: 4.2 },
               { x: .62, c: '80,140,255', ph: 1.3 }, { x: .7, c: '255,40,90', ph: 3.4 }, { x: .84, c: '130,80,255', ph: 5.1 }];
  var flashes = [], lastFlash = 0, partyClear = true;
  // a few hundred people in rows towards the horizon (further back = smaller and a bit higher)
  var CROWD = [];
  for (var cr = 0; cr < 3; cr++) {
    for (var ci = 0; ci < 150; ci++) {
      var cx0 = .02 + Math.random() * .96;
      if (cx0 > .455 && cx0 < .545) continue;                                  // right behind the monolith: hidden anyway
      CROWD.push({ x: cx0, d: .002 + cr * .006 + Math.random() * .003, h: (.03 - cr * .007) * (.85 + Math.random() * .3), ph: Math.random() * 6.28, arms: Math.random() < .28 });
    }
  }
  CROWD.sort(function (a, b) { return b.d - a.d; });
  function flash(strength) {
    var side = Math.random() < .5 ? .08 + Math.random() * .34 : .58 + Math.random() * .34;   // never right behind the monolith
    flashes.push({ x: side, a: .45 + .55 * Math.min(1, strength) });
  }
  function drawParty(t) {
    if (!pg || !PW) return;
    if (ign < .02 && !flashes.length) { if (!partyClear) { pg.clearRect(0, 0, PW, PH); partyClear = true; } return; }
    partyClear = false;
    pg.clearRect(0, 0, PW, PH);
    pg.globalCompositeOperation = 'lighter';
    pg.filter = 'blur(' + Math.max(2, PH * .008).toFixed(1) + 'px)';           // the lights sit deep in the haze
    var hy = PH * PHOTO_HORIZON;
    // crowd glow on the horizon
    var k = (.03 + .14 * e) * ign, cg = pg.createLinearGradient(0, hy - PH * .16, 0, hy + PH * .02);
    cg.addColorStop(0, 'rgba(255,60,130,0)'); cg.addColorStop(.85, 'rgba(255,60,130,' + k.toFixed(3) + ')'); cg.addColorStop(1, 'rgba(255,60,130,0)');
    pg.fillStyle = cg; pg.fillRect(0, hy - PH * .16, PW, PH * .18);
    // beams sweeping up through the haze
    var L = PH * .8, tipW = PW * .045;
    for (var b = 0; b < BEAMS.length; b++) {
      var bm = BEAMS[b], ang = reduce ? (bm.x - .5) * .6 : Math.sin(t * .32 + bm.ph) * .5;
      var bx = bm.x * PW, tx = bx + Math.sin(ang) * L, ty = hy - Math.cos(ang) * L;
      var al = (.02 + .13 * e) * ign;
      var gr = pg.createLinearGradient(bx, hy, tx, ty);
      gr.addColorStop(0, 'rgba(' + bm.c + ',' + al.toFixed(3) + ')'); gr.addColorStop(1, 'rgba(' + bm.c + ',0)');
      pg.fillStyle = gr;
      pg.beginPath(); pg.moveTo(bx - 1.5, hy); pg.lineTo(tx - tipW * Math.cos(ang), ty - tipW * Math.sin(ang)); pg.lineTo(tx + tipW * Math.cos(ang), ty + tipW * Math.sin(ang)); pg.lineTo(bx + 1.5, hy); pg.fill();
    }
    // strobes: soft cold flashes far back on the horizon
    for (var f = flashes.length - 1; f >= 0; f--) {
      var fl = flashes[f], fx = fl.x * PW, fy = hy - PH * .05, fr = PH * .32;
      var sg = pg.createRadialGradient(fx, fy, 0, fx, fy, fr);
      sg.addColorStop(0, 'rgba(225,235,255,' + (fl.a * .5 * ign).toFixed(3) + ')'); sg.addColorStop(1, 'rgba(225,235,255,0)');
      pg.fillStyle = sg; pg.fillRect(fx - fr, fy - fr, fr * 2, fr * 2);
      fl.a *= .8; if (fl.a < .02) flashes.splice(f, 1);
    }
    pg.filter = 'none';

    // the crowd: tiny silhouettes cut out of the light, so they only show where it's lit behind
    // them — bobbing to the beat, some with their arms up, jumping higher with the bass
    pg.globalCompositeOperation = 'destination-out';
    pg.fillStyle = '#000'; pg.strokeStyle = '#000'; pg.lineCap = 'round';
    var beat = t * Math.PI * 2 * fb.bpm / 120;                                   // half-time bounce
    pg.beginPath();
    var arms = [];
    for (var c = 0; c < CROWD.length; c++) {
      var pp = CROWD[c], ph2 = PH * pp.h, x = pp.x * PW;
      var jump = reduce ? 0 : Math.abs(Math.sin(beat + pp.ph)) * ph2 * (.04 + .22 * e);
      var foot = hy - PH * pp.d - jump, head = ph2 * .16;
      var sh = ph2 * .3;                                                         // shoulder width
      pg.moveTo(x - sh / 2, foot); pg.lineTo(x - sh / 2, foot - ph2 * .62); pg.quadraticCurveTo(x, foot - ph2 * .78, x + sh / 2, foot - ph2 * .62); pg.lineTo(x + sh / 2, foot); pg.closePath();
      pg.moveTo(x + head, foot - ph2 * .84); pg.arc(x, foot - ph2 * .84, head, 0, Math.PI * 2);
      if (pp.arms) arms.push([x, foot - ph2 * .66, sh, ph2, pp.ph]);
    }
    pg.fill();
    pg.beginPath();
    for (var am = 0; am < arms.length; am++) {
      var A = arms[am], sway = reduce ? 0 : Math.sin(beat * .5 + A[4]) * .25 + e * .2;
      pg.lineWidth = Math.max(1, A[3] * .09);
      pg.moveTo(A[0] - A[2] * .4, A[1]); pg.lineTo(A[0] - A[2] * .7 - Math.sin(sway) * A[3] * .2, A[1] - A[3] * .48);
      pg.moveTo(A[0] + A[2] * .4, A[1]); pg.lineTo(A[0] + A[2] * .7 + Math.sin(sway) * A[3] * .2, A[1] - A[3] * .48);
    }
    pg.stroke();
    pg.globalCompositeOperation = 'source-over';
  }

  function size() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    horizonY = H * parseFloat(getComputedStyle(hero).getPropertyValue('--horizon')) / 100;
    if (party) {
      var pd = Math.min(1.5, dpr);
      PW = party.clientWidth; PH = party.clientHeight;
      party.width = Math.round(PW * pd); party.height = Math.round(PH * pd);
      pg.setTransform(pd, 0, 0, pd, 0, 0); partyClear = false;
    }
    // where the man stands in the photo, in canvas coordinates (the photo's horizon sits on ours)
    if (photo) {
      var pw = photo.offsetWidth, ph = photo.offsetHeight, pl = W / 2 - pw / 2, pt = horizonY - ph * PHOTO_HORIZON;
      man = { x: pl + pw * DANCER_BOX[0], y: pt + ph * DANCER_BOX[1], w: pw * DANCER_BOX[2], h: ph * DANCER_BOX[3] };
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
    if (audible && !reduce && e - slow > .22 && ts - lastKick > 220) {
      ripples.push({ r: 0, a: Math.min(1, (e - slow) * 2.2) }); lastKick = ts;
      if (ts - lastFlash > 340) { flash((e - slow) * 2); lastFlash = ts; }              // max ~3 flashes a second
    }
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

    // the track's signal standing on the horizon (calm while silent), with a faint reflection.
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
        // stands on the floor: flat on the horizon, swings only upwards
        pts.push(horizonY - Math.abs(v) * amp * edge * edge * 7 * scale);
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
    line(main, .02 + .08 * ign, 1, 8, true);                                   // faint reflection in the wet floor

    // dust in the light: rises slowly, sparkles with the highs
    for (var d = 0; d < dust.length; d++) {
      var m = dust[d]; m.y -= m.v * (1 + e * 2) / 60; if (m.y < 0) { m.y = 1; m.x = Math.random(); }
      var px = m.x * W, py = m.y * H, near = Math.max(0, 1 - Math.abs(px - cx) / (W * .45));
      var a = (.08 + .5 * near * ign) * (.6 + .4 * Math.sin(t * 2 + m.tw)) * (1 + Math.min(1, hi) * 1.5);
      g.fillStyle = 'rgba(220,232,255,' + Math.min(.9, a).toFixed(3) + ')';
      g.beginPath(); g.arc(px, py, m.s, 0, Math.PI * 2); g.fill();
    }

    drawParty(t);

    // the dancer: moves while the music plays, back to the standing pose when it stops
    if (audible && dv.paused && !reduce) { var pr = dv.play(); if (pr && pr.catch) pr.catch(function () {}); }
    else if (!audible && !dv.paused) { dv.pause(); try { dv.currentTime = 0; } catch (err) {} }
    drawMan(g);
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
