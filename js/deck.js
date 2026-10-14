/*
  Painted turntable for the "Jetzt läuft" player and the release pages.

  AHDeck.mount(hostEl, { label, onToggle }) draws a silver deck into hostEl and
  returns a small controller:

    setPlaying(bool)    tonearm swings onto the record / back to its rest, the
                        platter spins up or coasts down, lights come on
    setProgress(0..1)   while playing, the tonearm creeps from the outer groove
                        toward the label like on a real record
    setCover(url)       cover image shown as the record's label
    setLabel(text)      accessible name of the play/pause pad ("Play/Pause: <title>")
    setGlow(cssColor)   colour of the soft glow behind the deck
    isPlaying()

  AHDeck.dominantColor(imgEl) -> "rgb(r,g,b)" | null  (for the glow, from the cover)

  Playback helpers (use these instead of audio.play()/audio.pause() wherever a
  deck is on the page):
    AHDeck.play(audio)   sound starts when the tonearm has landed — play() runs
                         inside the click, muted, and is unmuted after the swing
    AHDeck.pause(audio)  the record winds down: speed and pitch fall over ~1 s,
                         then it pauses (like stopping a real platter)
    AHDeck.isBraking(audio)
  The pitch fader (±8 %) changes playbackRate with pitch correction off, so
  speed and pitch move together like on a real deck.

  Layers (each its own <svg>, same 600x600 viewBox) so the spinning record and
  the swinging arm are moved with CSS transforms on the GPU instead of
  repainting one big SVG every frame:
      base (body, platter housing, fader, LED, pivot) · spin (record + label) ·
      glare + spindle · arm · top (start/stop pad, grain)
  The pad is the keyboard-focusable play/pause control (role="button").
*/
(function () {
  var C = { x: 268, y: 304 };        // platter centre
  var P = { x: 530, y: 104 };        // tonearm pivot
  var STYLUS = { x: 311, y: 52 };    // stylus tip in arm-local coordinates
  var SLEN = Math.hypot(STYLUS.x, STYLUS.y);
  var ALPHA = Math.atan2(STYLUS.y, STYLUS.x) * 180 / Math.PI;
  var R_OUTER = 188, R_INNER = 86, R_REST = 270;   // stylus radius: first groove, last groove, parked

  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var uid = 0;

  var DROP_MS = 1100;     // tonearm swing: the sound starts when the needle has landed
  var BRAKE_MS = 950;     // how long the record takes to wind down on stop
  var PITCH_RANGE = 8;    // ± percent
  var pitch = 0;          // current fader position in percent (+ = faster)

  function rate() { return 1 + pitch / 100; }
  function turntableSpeed(a) { a.preservesPitch = false; a.mozPreservesPitch = false; a.webkitPreservesPitch = false; }
  function applyRate(a) {
    if (!a || a.__ahBraking) return;
    try { a.defaultPlaybackRate = rate(); a.playbackRate = rate(); } catch (e) {}
    turntableSpeed(a);
  }

  function dropPlay(audio, instant) {
    var resumed = false;
    if (audio.__ahBraking) { audio.__ahBraking = false; resumed = true; }   // pressed play again while winding down: just carry on
    applyRate(audio);
    audio.__ahToken = (audio.__ahToken || 0) + 1;
    var token = audio.__ahToken;
    if (resumed) { audio.dispatchEvent(new Event('play')); }          // lets the page re-light its buttons and lower the arm again
    if (reduceMotion || instant || !audio.paused) { audio.muted = false; return audio.play(); }   // instant: arm is already on the record (track change)
    var t0 = audio.currentTime;
    audio.muted = true;                    // starts inside the user's click (required), but silent until the arm has landed
    var p = audio.play();
    setTimeout(function () {
      if (token !== audio.__ahToken) return;                // stopped again before the needle landed
      if (Math.abs(audio.currentTime - t0) > 0.05) { try { audio.currentTime = t0; } catch (e) {} }
      audio.muted = false;
    }, DROP_MS);
    if (p && p.catch) p.catch(function () { if (token === audio.__ahToken) audio.muted = false; });
    return p;
  }

  function brakePause(audio) {
    if (audio.paused || audio.__ahBraking) return;
    audio.__ahToken = (audio.__ahToken || 0) + 1;           // cancels a pending needle-drop unmute
    if (reduceMotion || audio.muted) { audio.muted = false; audio.pause(); return; }   // not audible yet: stop at once
    audio.__ahBraking = true;
    audio.dispatchEvent(new Event('ahbrake'));
    turntableSpeed(audio);
    var r0 = audio.playbackRate || 1, t0 = Date.now();
    var timer = setInterval(function () {
      if (!audio.__ahBraking) { clearInterval(timer); return; }   // play was pressed again
      var k = Math.min(1, (Date.now() - t0) / BRAKE_MS);
      if (k < 1) { try { audio.playbackRate = Math.max(0.08, r0 * Math.pow(1 - k, 1.15)); } catch (e) {} return; }
      clearInterval(timer);
      audio.pause();
      audio.__ahBraking = false;
      applyRate(audio);
    }, 25);
  }

  // circle(P, SLEN) ∩ circle(C, r) — the lower of the two solutions
  function intersect(r) {
    var dx = C.x - P.x, dy = C.y - P.y, d = Math.hypot(dx, dy);
    var a = (SLEN * SLEN - r * r + d * d) / (2 * d);
    var h = Math.sqrt(Math.max(0, SLEN * SLEN - a * a));
    var xm = P.x + a * dx / d, ym = P.y + a * dy / d;
    var p1 = { x: xm - dy * h / d, y: ym + dx * h / d };
    var p2 = { x: xm + dy * h / d, y: ym - dx * h / d };
    return p1.y > p2.y ? p1 : p2;
  }
  function armAngle(r) {
    var T = intersect(r);
    return Math.atan2(T.y - P.y, T.x - P.x) * 180 / Math.PI - ALPHA;
  }

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function svg(cls, inner) {
    return '<svg class="deck__layer deck__layer--' + cls + '" viewBox="0 0 600 600" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
  }

  function buildLayers(id) {
    var cx = C.x, cy = C.y;

    // ---- base (static) ----
    var base = '<defs>' +
      '<linearGradient id="' + id + 'body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3e5e9"/><stop offset=".55" stop-color="#c3c7ce"/><stop offset="1" stop-color="#a3a8b1"/></linearGradient>' +
      '<linearGradient id="' + id + 'rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1f2f4"/><stop offset="1" stop-color="#8c919a"/></linearGradient>' +
      '<linearGradient id="' + id + 'metal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9aa0a9"/><stop offset=".35" stop-color="#f4f5f7"/><stop offset=".7" stop-color="#b8bdc5"/><stop offset="1" stop-color="#808690"/></linearGradient>' +
      '<radialGradient id="' + id + 'platter" cx=".5" cy=".5" r=".5"><stop offset=".86" stop-color="#2a2d33"/><stop offset="1" stop-color="#14161a"/></radialGradient>' +
      '<radialGradient id="' + id + 'glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff8a4d" stop-opacity=".9"/><stop offset="1" stop-color="#ff8a4d" stop-opacity="0"/></radialGradient>' +
      '<filter id="' + id + 'soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>' +
    '</defs>' +
    '<rect x="34" y="52" width="548" height="530" rx="30" fill="#000" opacity=".28" filter="url(#' + id + 'soft)"/>' +
    '<rect x="22" y="34" width="556" height="532" rx="30" fill="url(#' + id + 'body)"/>' +
    '<rect x="22.5" y="34.5" width="555" height="531" rx="29.5" fill="none" stroke="#fff" stroke-opacity=".75"/>' +
    '<ellipse cx="170" cy="80" rx="190" ry="46" fill="#fff" opacity=".35" filter="url(#' + id + 'soft)"/>' +
    '<circle cx="' + cx + '" cy="' + cy + '" r="238" fill="url(#' + id + 'rim)"/>' +
    '<circle cx="' + cx + '" cy="' + cy + '" r="231" fill="url(#' + id + 'platter)"/>' +
    // 33/45 + LED
    // quartz LED sits above the 33 key, clear of the platter rim
    '<circle class="deck__led-glow" cx="165" cy="526" r="17" fill="url(#' + id + 'glow)"/>' +
    '<circle cx="165" cy="526" r="4.5" fill="#53433a"/><circle class="deck__led-on" cx="165" cy="526" r="4.5" fill="#ff7a3d"/>' +
    // 33 / 45 rpm keys: below the platter rim (its edge is at y≈536 here), right of the start/stop pad
    '<rect x="150" y="538" width="30" height="18" rx="5" fill="#20232a"/><rect x="150.5" y="538.5" width="29" height="17" rx="4.5" fill="none" stroke="#fff" stroke-opacity=".18"/>' +
    '<text x="165" y="550.4" font-size="9.5" font-family="Helvetica,Arial,sans-serif" font-weight="700" fill="#eceff3" text-anchor="middle">33</text>' +
    '<rect x="186" y="538" width="30" height="18" rx="5" fill="#d3d7dd" stroke="#8c919a" stroke-opacity=".75"/>' +
    '<text x="201" y="550.4" font-size="9.5" font-family="Helvetica,Arial,sans-serif" font-weight="700" fill="#5a5f68" text-anchor="middle">45</text>' +
    // pitch fader
    '<rect x="540" y="338" width="14" height="186" rx="7" fill="#20232a"/>' + (function () {
      var t = ''; for (var i = 0; i <= 10; i++) t += '<rect x="560" y="' + (342 + i * 17.6).toFixed(1) + '" width="' + (i % 5 === 0 ? 14 : 8) + '" height="1.4" fill="#5d626b"/>'; return t;
    })() +
    '<text x="528" y="352" font-size="13" font-family="Helvetica,Arial,sans-serif" font-weight="700" fill="#5d626b" text-anchor="middle">+</text>' +
    '<text x="528" y="523" font-size="13" font-family="Helvetica,Arial,sans-serif" font-weight="700" fill="#5d626b" text-anchor="middle">−</text>' +
    // arm rest post (placed where the parked arm lies)
    (function () {
      var a = armAngle(R_REST), rad = a * Math.PI / 180;
      var x = P.x + Math.cos(rad) * 205, y = P.y + Math.sin(rad) * 205;
      return '<g transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + (a + 90).toFixed(1) + ')"><rect x="-10" y="-5" width="20" height="10" rx="4" fill="#2a2d33"/></g>';
    })() +
    // pivot base
    '<circle cx="' + P.x + '" cy="' + P.y + '" r="46" fill="url(#' + id + 'rim)"/><circle cx="' + P.x + '" cy="' + P.y + '" r="36" fill="#d4d7dc"/>';

    // ---- spin (record, strobe ring, plain handwritten label) ----
    var spin = '<defs><clipPath id="' + id + 'rec"><circle cx="' + cx + '" cy="' + cy + '" r="190"/></clipPath></defs>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="226" fill="#1b1d22"/>';
    for (var i = 0; i < 90; i++) {
      var a = i / 90 * Math.PI * 2;
      spin += '<circle cx="' + (cx + Math.cos(a) * 213).toFixed(1) + '" cy="' + (cy + Math.sin(a) * 213).toFixed(1) + '" r="' + (i % 3 === 0 ? 2.1 : 1.4) + '" fill="#9a9fa8" fill-opacity=".85"/>';
    }
    spin += '<circle cx="' + cx + '" cy="' + cy + '" r="198" fill="#0e0f12"/><g clip-path="url(#' + id + 'rec)">';
    for (var r = 76; r < 192; r += 4.5) spin += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#fff" stroke-opacity="' + (r % 18 < 4.5 ? .11 : .045) + '" stroke-width=".9"/>';
    spin += '<circle cx="' + cx + '" cy="' + cy + '" r="168" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="3"/></g>' +
      // label = the cover (cream circle underneath as a fallback while it loads)
      '<circle cx="' + cx + '" cy="' + cy + '" r="68" fill="#efe9dd"/>' +
      '<clipPath id="' + id + 'lbl"><circle cx="' + cx + '" cy="' + cy + '" r="68"/></clipPath>' +
      '<image class="deck__cover" x="' + (cx - 68) + '" y="' + (cy - 68) + '" width="136" height="136" preserveAspectRatio="xMidYMid slice" clip-path="url(#' + id + 'lbl)"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="68" fill="none" stroke="#050505" stroke-opacity=".55" stroke-width="2"/>';

    // ---- glare (fixed while the record turns) + spindle ----
    var glare = '<defs>' +
      '<radialGradient id="' + id + 'sheen" gradientUnits="userSpaceOnUse" cx="' + cx + '" cy="' + cy + '" r="200"><stop offset=".12" stop-color="#fff" stop-opacity="0"/><stop offset=".55" stop-color="#fff" stop-opacity=".2"/><stop offset="1" stop-color="#fff" stop-opacity=".02"/></radialGradient>' +
      '<filter id="' + id + 'blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="9"/></filter>' +
      '<clipPath id="' + id + 'rec2"><circle cx="' + cx + '" cy="' + cy + '" r="190"/></clipPath>' +
      '<linearGradient id="' + id + 'metal2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9aa0a9"/><stop offset=".35" stop-color="#f4f5f7"/><stop offset=".7" stop-color="#b8bdc5"/><stop offset="1" stop-color="#808690"/></linearGradient>' +
    '</defs>' +
    '<g clip-path="url(#' + id + 'rec2)"><g filter="url(#' + id + 'blur)" style="mix-blend-mode:screen">' + (function () {
      function wedge(a1, a2) {
        var R = 200, p = function (a) { var t = a * Math.PI / 180; return (cx + Math.cos(t) * R).toFixed(1) + ' ' + (cy + Math.sin(t) * R).toFixed(1); };
        return '<path fill="url(#' + id + 'sheen)" d="M' + cx + ' ' + cy + ' L' + p(a1) + ' A' + R + ' ' + R + ' 0 0 1 ' + p(a2) + ' Z"/>';
      }
      return wedge(-50, -38) + wedge(130, 142);
    })() + '</g></g>' +
    '<circle cx="' + cx + '" cy="' + cy + '" r="7" fill="url(#' + id + 'metal2)"/><circle cx="' + cx + '" cy="' + cy + '" r="2.4" fill="#4b4f57"/>';

    // ---- arm (rotates about the pivot) ----
    var arm = '<defs>' +
      '<linearGradient id="' + id + 'metal3" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9aa0a9"/><stop offset=".35" stop-color="#f4f5f7"/><stop offset=".7" stop-color="#b8bdc5"/><stop offset="1" stop-color="#808690"/></linearGradient>' +
      '<radialGradient id="' + id + 'spot" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffb27d" stop-opacity=".95"/><stop offset=".45" stop-color="#e0703f" stop-opacity=".38"/><stop offset="1" stop-color="#e0703f" stop-opacity="0"/></radialGradient>' +
    '</defs><g transform="translate(' + P.x + ' ' + P.y + ')">' +
      '<circle class="deck__spot" cx="' + STYLUS.x + '" cy="' + STYLUS.y + '" r="52" fill="url(#' + id + 'spot)"/>' +
      '<rect x="-100" y="-18" width="62" height="36" rx="8" fill="#23262c"/><rect x="-100" y="-18" width="62" height="36" rx="8" fill="none" stroke="#fff" stroke-opacity=".18"/><rect x="-86" y="-18" width="5" height="36" fill="#9aa0a9"/><rect x="-62" y="-18" width="5" height="36" fill="#9aa0a9"/>' +
      '<path d="M-40 0 L212 0 C242 0 266 12 284 31" fill="none" stroke="#7d828b" stroke-width="13" stroke-linecap="round"/>' +
      '<path d="M-40 0 L212 0 C242 0 266 12 284 31" fill="none" stroke="url(#' + id + 'metal3)" stroke-width="9" stroke-linecap="round"/>' +
      '<g transform="translate(284 31) rotate(38)"><rect x="-6" y="-11" width="42" height="22" rx="5" fill="#1b1d22"/><rect x="2" y="-11" width="6" height="22" fill="#e0703f"/><rect x="26" y="-7" width="10" height="14" rx="2" fill="#3a3e46"/></g>' +
      '<circle cx="' + STYLUS.x + '" cy="' + STYLUS.y + '" r="2.2" fill="#fff"/>' +
      '<circle cx="0" cy="0" r="22" fill="url(#' + id + 'metal3)" stroke="#fff" stroke-opacity=".5"/><circle cx="0" cy="0" r="9" fill="#4b4f57"/>' +
    '</g>';

    // ---- pitch fader: its own layer *under* the tonearm, so the arm always passes over it ----
    var fader = '<defs><linearGradient id="' + id + 'metal5" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9aa0a9"/><stop offset=".35" stop-color="#f4f5f7"/><stop offset=".7" stop-color="#b8bdc5"/><stop offset="1" stop-color="#808690"/></linearGradient></defs>' +
    '<text class="deck__pitch-read" x="547" y="326" font-size="8.5" font-family="Helvetica,Arial,sans-serif" font-weight="700" fill="#3b4048" text-anchor="middle">0.0%</text>' +
    '<g class="deck__fader" role="slider" tabindex="0" aria-label="Pitch" aria-orientation="vertical" aria-valuemin="-' + PITCH_RANGE + '" aria-valuemax="' + PITCH_RANGE + '" aria-valuenow="0" aria-valuetext="0 %">' +
      '<rect x="514" y="332" width="68" height="204" fill="transparent"/>' +
      '<g class="deck__cap">' +
        '<rect x="531" y="408" width="32" height="46" rx="6" fill="url(#' + id + 'metal5)" stroke="#fff" stroke-opacity=".6"/>' +
        '<rect x="531" y="428" width="32" height="6" fill="#e0703f"/>' +
      '</g>' +
    '</g>';

    // ---- top: start/stop pad (the control) + painterly grain ----
    var top = '<defs>' +
      '<linearGradient id="' + id + 'metal4" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9aa0a9"/><stop offset=".35" stop-color="#f4f5f7"/><stop offset=".7" stop-color="#b8bdc5"/><stop offset="1" stop-color="#808690"/></linearGradient>' +
      '<filter id="' + id + 'grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="4"/><feColorMatrix type="matrix" values="0 0 0 0 .1  0 0 0 0 .08  0 0 0 0 .06  0 0 0 .16 0"/></filter>' +
    '</defs>' +
    '<rect x="22" y="34" width="556" height="532" rx="30" filter="url(#' + id + 'grain)" opacity=".55" style="mix-blend-mode:multiply"/>' +
    '<g class="deck__pad-hit" role="button" tabindex="0" aria-label="Play/Pause" aria-pressed="false">' +
      '<rect x="30" y="466" width="120" height="94" fill="transparent"/>' +
      '<rect x="44" y="478" width="96" height="70" rx="12" fill="#8f949d" opacity=".5"/>' +
      '<rect class="deck__pad" x="48" y="480" width="88" height="62" rx="10" fill="url(#' + id + 'metal4)" stroke="#fff" stroke-opacity=".6"/>' +
      '<g class="deck__icon deck__icon--play"><path d="M83 495 L83 527 L109 511 Z" fill="#23262c" stroke="#23262c" stroke-width="5" stroke-linejoin="round"/></g>' +
      '<g class="deck__icon deck__icon--pause"><rect x="78" y="496" width="11" height="30" rx="3" fill="#e0703f"/><rect x="95" y="496" width="11" height="30" rx="3" fill="#e0703f"/></g>' +
    '</g>';

    return { base: svg('base', base), spin: svg('spin', spin), glare: svg('glare', glare), fader: svg('fader', fader), arm: svg('arm', arm), top: svg('top', top) };
  }

  function mount(host, opts) {
    opts = opts || {};
    var id = 'ahd' + (++uid) + '-';
    var layers = buildLayers(id);
    host.classList.add('deck-host');

    var root = document.createElement('div');
    root.className = 'deck';
    root.innerHTML = '<div class="deck__glow"></div><div class="deck__stage">' + layers.base + layers.spin + layers.glare + layers.fader + layers.arm + layers.top + '</div>';
    host.insertBefore(root, host.firstChild);

    var spinEl = root.querySelector('.deck__layer--spin');
    var armEl = root.querySelector('.deck__layer--arm');
    var pad = root.querySelector('.deck__pad-hit');
    var coverEl = root.querySelector('.deck__cover');
    var fader = root.querySelector('.deck__fader'), cap = root.querySelector('.deck__cap');
    var readout = root.querySelector('.deck__pitch-read'), topSvg = root.querySelector('.deck__layer--fader');
    var audio = opts.audio || null;
    var st = { playing: false, omega: 0, angle: 0, progress: 0, last: 0, raf: 0, liftTimer: 0 };

    function radius() { return R_OUTER - (R_OUTER - R_INNER) * st.progress; }
    function armTo(r) { armEl.style.transform = 'rotate(' + armAngle(r).toFixed(2) + 'deg)'; }

    function frame(ts) {
      var dt = Math.min(0.05, (ts - st.last) / 1000 || 0); st.last = ts;
      var target = st.playing ? 200 * rate() : 0, tau = st.playing ? 0.45 : 0.9;     // 33⅓ rpm; spin-up / coast-down
      st.omega += (target - st.omega) * (1 - Math.exp(-dt / tau));
      st.angle = (st.angle + st.omega * dt) % 360;
      spinEl.style.transform = 'rotate(' + st.angle.toFixed(2) + 'deg)';
      st.raf = (st.playing || st.omega > 0.4) ? requestAnimationFrame(frame) : 0;
    }
    function kick() {
      if (reduceMotion || st.raf) return;
      st.last = performance.now();
      st.raf = requestAnimationFrame(frame);
    }

    function setPlaying(p, instant) {
      p = !!p;
      if (p === st.playing && !instant) return;
      st.playing = p;
      host.classList.toggle('is-playing', p);
      pad.setAttribute('aria-pressed', String(p));
      root.classList.remove('is-tracking');
      root.classList.add('is-lifting');
      clearTimeout(st.liftTimer);
      st.liftTimer = setTimeout(function () {
        root.classList.remove('is-lifting');
        if (st.playing) root.classList.add('is-tracking');
      }, instant || reduceMotion ? 0 : 1150);
      armTo(p ? radius() : R_REST);
      kick();
    }

    function setProgress(f) {
      f = Math.min(1, Math.max(0, +f || 0));
      st.progress = f;
      if (st.playing) armTo(radius());
    }

    function setCover(url) {
      if (!url) return;
      coverEl.setAttribute('href', url);
      coverEl.setAttributeNS('http://www.w3.org/1999/xlink', 'href', url);
    }

    function setLabel(text) {
      pad.setAttribute('aria-label', text ? 'Play/Pause: ' + text : 'Play/Pause');
    }

    function setGlow(color) { if (color) root.style.setProperty('--deck-glow', color); }

    function toggle() { if (opts.onToggle) opts.onToggle(); else setPlaying(!st.playing); }
    // Mouse/touch presses must not take focus (that is what drew the orange box); keyboard still can
    pad.addEventListener('mousedown', function (e) { e.preventDefault(); });
    pad.addEventListener('click', toggle);
    pad.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });

    // ---- pitch fader: drag, wheel-free; double-click or 0 resets; arrows nudge ----
    var CAP_CENTER = 431, CAP_TRAVEL = 70;          // viewBox units; top = +8 %, bottom = -8 %
    function setPitch(p) {
      p = Math.max(-PITCH_RANGE, Math.min(PITCH_RANGE, p));
      if (Math.abs(p) < 0.25) p = 0;                // detent at zero
      p = Math.round(p * 10) / 10;
      pitch = p;
      cap.setAttribute('transform', 'translate(0 ' + (-(p / PITCH_RANGE) * CAP_TRAVEL).toFixed(2) + ')');
      var txt = (p > 0 ? '+' : p < 0 ? '−' : '') + Math.abs(p).toFixed(1) + '%';
      readout.textContent = txt;
      fader.setAttribute('aria-valuenow', p);
      fader.setAttribute('aria-valuetext', txt.replace('−', 'minus '));
      if (audio) applyRate(audio);
      kick();
    }
    function pitchFromEvent(e) {
      var r = topSvg.getBoundingClientRect();
      var y = (e.clientY - r.top) / r.height * 600;
      return (CAP_CENTER - y) / CAP_TRAVEL * PITCH_RANGE;
    }
    var dragging = false;
    fader.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      dragging = true;
      try { fader.setPointerCapture(e.pointerId); } catch (err) {}
      setPitch(pitchFromEvent(e));
    });
    fader.addEventListener('pointermove', function (e) { if (dragging) setPitch(pitchFromEvent(e)); });
    function endDrag() { dragging = false; }
    fader.addEventListener('pointerup', endDrag);
    fader.addEventListener('pointercancel', endDrag);
    fader.addEventListener('dblclick', function () { setPitch(0); });
    fader.addEventListener('keydown', function (e) {
      var d = { ArrowUp: 0.5, ArrowRight: 0.5, ArrowDown: -0.5, ArrowLeft: -0.5 }[e.key];
      if (d !== undefined) { e.preventDefault(); setPitch(pitch + d); }
      else if (e.key === 'Home') { e.preventDefault(); setPitch(-PITCH_RANGE); }
      else if (e.key === 'End') { e.preventDefault(); setPitch(PITCH_RANGE); }
      else if (e.key === '0') { e.preventDefault(); setPitch(0); }
    });
    setPitch(pitch);                                 // pick up a value set earlier on another deck/page load

    // stopping starts the wind-down: arm and lights react right away, the sound follows the platter
    if (audio) audio.addEventListener('ahbrake', function () { setPlaying(false); });

    var seedImg = host.querySelector('img');
    setCover(opts.cover || (seedImg && (seedImg.currentSrc || seedImg.src)));
    setLabel(opts.label || '');
    armTo(R_REST);
    if (opts.glow) setGlow(opts.glow);

    return { setPlaying: setPlaying, setProgress: setProgress, setCover: setCover, setLabel: setLabel, setGlow: setGlow, setPitch: setPitch, getPitch: function () { return pitch; }, isPlaying: function () { return st.playing; } };
  }

  // Average cover colour, pushed toward a vivid mid-tone so it reads as a glow
  function dominantColor(img) {
    try {
      var c = document.createElement('canvas'); c.width = c.height = 24;
      var ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, 24, 24);
      var d = ctx.getImageData(0, 0, 24, 24).data, r = 0, g = 0, b = 0, w = 0;
      for (var i = 0; i < d.length; i += 4) {
        var mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
        var wt = 0.15 + (mx - mn) / 255 * (0.4 + mx / 255);       // favour saturated, brighter pixels
        r += d[i] * wt; g += d[i + 1] * wt; b += d[i + 2] * wt; w += wt;
      }
      r /= w; g /= w; b /= w;
      // boost saturation, fix lightness
      var mx2 = Math.max(r, g, b), mn2 = Math.min(r, g, b), l = (mx2 + mn2) / 510, s = 0;
      if (mx2 !== mn2) s = (mx2 - mn2) / 255 / (1 - Math.abs(2 * l - 1) || 1);
      s = Math.min(1, Math.max(0.55, s * 1.25)); l = Math.min(0.62, Math.max(0.5, l * 1.4));
      var h = 0;
      if (mx2 !== mn2) {
        var dd = mx2 - mn2;
        if (mx2 === r) h = ((g - b) / dd) % 6; else if (mx2 === g) h = (b - r) / dd + 2; else h = (r - g) / dd + 4;
        h *= 60; if (h < 0) h += 360;
      }
      return 'hsla(' + Math.round(h) + ',' + Math.round(s * 100) + '%,' + Math.round(l * 100) + '%,.62)';
    } catch (e) { return null; }
  }

  window.AHDeck = {
    mount: mount, dominantColor: dominantColor,
    play: dropPlay, pause: brakePause,
    isBraking: function (audio) { return !!(audio && audio.__ahBraking); },
    on: function (audio) { return !audio.paused && !audio.__ahBraking; }
  };
})();
