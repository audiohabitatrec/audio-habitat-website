/*
  Painted turntable for the "Jetzt läuft" player and the release pages.

  AHDeck.mount(hostEl, { label, onToggle }) draws a matte black DJ-style deck into hostEl and
  returns a small controller:

    setPlaying(bool)    tonearm swings onto the record / back to its rest, the
                        platter spins up or coasts down, lights come on
    setProgress(0..1)   while playing, the tonearm creeps from the outer groove
                        toward the label like on a real record
    setCover(url)       cover image shown as the record's label
    setWave(trackUrl)   waveform under the deck for that track (found automatically from the
                        <audio> src; the home page passes it before anything has played)
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
  Scratching: while the needle is on the record it can be grabbed (mouse or finger) and moved
  back and forth; the sound follows the hand forwards and backwards (scratch engine below).
  The pitch fader (±8 %) changes playbackRate with pitch correction off, so
  speed and pitch move together like on a real deck.

  Layers (each its own <svg>, same 600x600 viewBox) so the spinning record and
  the swinging arm are moved with CSS transforms on the GPU instead of
  repainting one big SVG every frame:
      base (body, platter rim, knobs, keys, fader slot, arm base) · spin (strobe dots, slipmat, label) ·
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

  var SWING_MS = 1150;    // tonearm swing on/off the record (matches the CSS transition)
  var DROP_MS = 1300;     // the sound starts only once the needle sits in the groove (swing + a moment to settle)
  var BRAKE_MS = 950;     // how long the record takes to wind down on stop
  var PITCH_RANGE = 8;    // ± percent
  var pitch = 0;          // current fader position in percent (+ = faster)

  function rate() { return 1 + pitch / 100; }
  // Each change of playbackRate / preservesPitch makes mobile browsers rebuild their audio
  // output, which is heard as a dropout — so set pitch correction off only once, and the rate
  // only when it actually changes.
  function turntableSpeed(a) {
    if (a.__ahTT) return;
    a.preservesPitch = false; a.mozPreservesPitch = false; a.webkitPreservesPitch = false;
    a.__ahTT = true;
  }
  function applyRate(a) {
    if (!a || a.__ahBraking) return;
    turntableSpeed(a);
    var r = rate();
    try {
      if (Math.abs(a.playbackRate - r) > 1e-4) a.playbackRate = r;
      if (a.paused && Math.abs(a.defaultPlaybackRate - r) > 1e-4) a.defaultPlaybackRate = r;
    } catch (e) {}
  }

  // Silence the track without pausing it. `muted` alone isn't enough: once a page routes the
  // <audio> through Web Audio (the home page's hero analyser), Android Chrome and iOS Safari
  // ignore `muted` for that route — the music kept playing under a scratch. Such a page hangs a
  // GainNode on audio.__ahGate, and that is switched too.
  function mute(audio, m) {
    audio.muted = m;
    var gt = audio.__ahGate;
    if (gt) { try { var now = gt.context.currentTime; gt.gain.cancelScheduledValues(now); gt.gain.setTargetAtTime(m ? 0 : 1, now, .008); } catch (e) { gt.gain.value = m ? 0 : 1; } }
  }

  function dropPlay(audio, instant) {
    var resumed = false;
    if (audio.__ahBraking) { audio.__ahBraking = false; resumed = true; }   // pressed play again while winding down: just carry on
    applyRate(audio);
    audio.__ahToken = (audio.__ahToken || 0) + 1;
    var token = audio.__ahToken;
    if (resumed) { audio.dispatchEvent(new Event('play')); }          // lets the page re-light its buttons and lower the arm again
    // instant: the needle is already in the groove (track change, or play pressed again before the arm went back)
    if (reduceMotion || instant || audio.__ahNeedleDown || !audio.paused) { mute(audio, false); return audio.play(); }
    var t0 = audio.currentTime;
    mute(audio, true);                     // starts inside the user's click (required), but silent until the arm has landed
    var p = audio.play();
    setTimeout(function () {
      if (token !== audio.__ahToken) return;                // stopped again before the needle landed
      if (Math.abs(audio.currentTime - t0) > 0.05) { try { audio.currentTime = t0; } catch (e) {} }
      mute(audio, false);
    }, DROP_MS);
    if (p && p.catch) p.catch(function () { if (token === audio.__ahToken) mute(audio, false); });
    return p;
  }

  function brakePause(audio) {
    if (audio.paused || audio.__ahBraking) return;
    audio.__ahToken = (audio.__ahToken || 0) + 1;           // cancels a pending needle-drop unmute
    if (reduceMotion || audio.muted) { mute(audio, false); audio.pause(); return; }   // not audible yet: stop at once
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

  // ---- scratch engine ----
  // While a hand holds the record the <audio> keeps running muted (so the page's play state
  // doesn't change) and the sound comes from here instead: the track, decoded once per src
  // (mono, ~22 kHz to keep memory small on phones), read at whatever speed and direction the
  // hand moves the record — 200° of record = 1 s of music, like 33⅓ rpm. On release the
  // <audio> jumps to where the hand left the record and is unmuted.
  // cruise: instead of following a hand, play on at this speed (live pitch on iPhone, see the fader)
  var SCR = { ctx: null, node: null, gain: null, src: '', data: null, rate: 0, loading: '', pos: 0, target: 0, vel: 0, on: false, cruise: null };

  // iPhone/iPad (iPadOS reports itself as a Mac with touch)
  var IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function scratchCtx() {
    if (SCR.ctx) return SCR.ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    // a context at a rate the hardware doesn't run at makes iOS re-clock the whole page's audio
    // (the <audio> glitches or stops) — there it gets the native rate; elsewhere 22 kHz saves memory
    try { SCR.ctx = IOS ? new AC() : new AC({ sampleRate: 22050 }); } catch (e) { try { SCR.ctx = new AC(); } catch (e2) { return null; } }
    return SCR.ctx;
  }

  // Browsers (iOS Safari above all) only let an audio context start inside a tap/click that has
  // ended — a finger landing on the record (pointerdown) doesn't count, so scratching stayed
  // silent on phones. Unlock it on the first touchend/click anywhere (pressing play is one),
  // with a silent sample for iOS, and make it play even with the silent switch on.
  function scratchUnlock() {
    var ctx = scratchCtx();
    if (!ctx || ctx.state === 'running') return;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    if (ctx.resume) ctx.resume();
    try { var b = ctx.createBufferSource(); b.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); b.connect(ctx.destination); b.start(0); } catch (e) {}
  }
  ['touchend', 'click', 'keydown'].forEach(function (t) { document.addEventListener(t, scratchUnlock, true); });

  function scratchLoad(src) {
    if (!src || SCR.src === src || SCR.loading === src) return;
    var ctx = scratchCtx(); if (!ctx) return;
    // decode into a 22 kHz buffer (≈30 MB for a 6-minute track instead of ≈140 MB at 48 kHz
    // stereo) — the engine resamples to whatever rate its context plays at
    var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext, dec = ctx;
    try { if (OAC) dec = new OAC(1, 1, 22050); } catch (e) { dec = ctx; }
    SCR.loading = src;
    fetch(src).then(function (r) { return r.arrayBuffer(); }).then(function (ab) {
      return new Promise(function (ok, fail) { var p = dec.decodeAudioData(ab, ok, fail); if (p && p.then) p.then(ok, fail); });
    }).then(function (buf) {
      if (SCR.loading !== src) return;
      var n = buf.length, mono = new Float32Array(n), chs = buf.numberOfChannels;
      for (var c = 0; c < chs; c++) { var d = buf.getChannelData(c); for (var i = 0; i < n; i++) mono[i] += d[i] / chs; }
      SCR.data = mono; SCR.rate = buf.sampleRate; SCR.src = src; SCR.loading = '';
    }).catch(function () { if (SCR.loading === src) SCR.loading = ''; });
  }

  function scratchProcess(e) {
    var out = e.outputBuffer.getChannelData(0), d = SCR.data, sr = SCR.rate, osr = e.outputBuffer.sampleRate;
    if (!d) { out.fill(0); return; }
    // playhead chases the hand: velocity toward the target position, smoothed so it sounds like vinyl, not steps
    var cruise = SCR.cruise != null;
    var want = cruise ? SCR.cruise : Math.max(-6, Math.min(6, (SCR.target - SCR.pos) / 0.035));   // seconds of music per second
    for (var i = 0; i < out.length; i++) {
      SCR.vel += (want - SCR.vel) * 0.004;
      SCR.pos += SCR.vel / osr;
      var f = SCR.pos * sr, k = Math.floor(f), t = f - k;
      out[i] = (k >= 0 && k + 1 < d.length) ? (d[k] * (1 - t) + d[k + 1] * t) * (cruise ? 1 : Math.min(1, Math.abs(SCR.vel) * 1.5)) : 0;
    }
  }

  function scratchStart(pos, vel) {
    var ctx = scratchCtx(); if (!ctx) return false;
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    if (!SCR.node) {
      SCR.node = ctx.createScriptProcessor(512, 0, 1);
      SCR.node.onaudioprocess = scratchProcess;
      SCR.gain = ctx.createGain();
      SCR.node.connect(SCR.gain);
    }
    SCR.pos = SCR.target = pos; SCR.vel = vel || 0; SCR.on = true;
    SCR.gain.gain.cancelScheduledValues(ctx.currentTime);
    SCR.gain.gain.setValueAtTime(1, ctx.currentTime);
    SCR.gain.connect(ctx.destination);
    return true;
  }

  function scratchStop() {
    if (!SCR.on) return SCR.pos;
    SCR.on = false; SCR.cruise = null;
    var g = SCR.gain, ctx = SCR.ctx;
    g.gain.setTargetAtTime(0, ctx.currentTime, 0.008);           // short fade, no click
    setTimeout(function () { if (!SCR.on) { try { g.disconnect(); } catch (e) {} } }, 80);
    return SCR.pos;
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

  function svg(cls, inner, vb) {
    return '<svg class="deck__layer deck__layer--' + cls + '" viewBox="' + (vb || '0 0 600 600') + '" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
  }

  function buildLayers(id) {
    var cx = C.x, cy = C.y;

    // ---- base (static) ----
    // Matte black direct-drive deck in the style of the classic DJ turntable: no brand, no printed labels
    var base = '<defs>' +
      '<linearGradient id="' + id + 'body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a2b2f"/><stop offset=".45" stop-color="#1c1d20"/><stop offset="1" stop-color="#121315"/></linearGradient>' +
      '<linearGradient id="' + id + 'rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3f4f6"/><stop offset=".3" stop-color="#b9bdc4"/><stop offset=".55" stop-color="#e6e8eb"/><stop offset=".8" stop-color="#8f949c"/><stop offset="1" stop-color="#c9ccd1"/></linearGradient>' +
      '<linearGradient id="' + id + 'knob" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a4c52"/><stop offset=".5" stop-color="#1d1e21"/><stop offset="1" stop-color="#0b0b0c"/></linearGradient>' +
      '<radialGradient id="' + id + 'glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff3b2f" stop-opacity=".95"/><stop offset="1" stop-color="#ff3b2f" stop-opacity="0"/></radialGradient>' +
      '<filter id="' + id + 'soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>' +
    '</defs>' +
    '<rect x="34" y="52" width="548" height="530" rx="22" fill="#000" opacity=".45" filter="url(#' + id + 'soft)"/>' +
    '<rect x="22" y="34" width="556" height="532" rx="22" fill="url(#' + id + 'body)"/>' +
    '<rect x="22.5" y="34.5" width="555" height="531" rx="21.5" fill="none" stroke="#fff" stroke-opacity=".14"/>' +
    '<ellipse cx="200" cy="70" rx="220" ry="40" fill="#fff" opacity=".05" filter="url(#' + id + 'soft)"/>' +
    // platter: silver rim (static highlight; its strobe dots turn in the spin layer) sunk into the plinth
    '<circle cx="' + cx + '" cy="' + cy + '" r="241" fill="#08090a"/>' +
    '<circle cx="' + cx + '" cy="' + cy + '" r="237" fill="url(#' + id + 'rim)"/>' +
    // 45 adapter (top left) and a small dimple top right of the platter
    '<circle cx="62" cy="74" r="22" fill="#0b0b0c"/><circle cx="62" cy="74" r="19" fill="url(#' + id + 'knob)"/><circle cx="62" cy="74" r="19" fill="none" stroke="#fff" stroke-opacity=".12"/><circle cx="62" cy="74" r="6" fill="#0d0d0e"/>' +
    '<circle cx="420" cy="74" r="7" fill="#0b0b0c"/><circle cx="420" cy="74" r="5" fill="#26272b"/>' +
    // power / strobe knob with its red ring, and the strobe light falling on the platter rim
    '<circle class="deck__led-glow" cx="80" cy="436" r="34" fill="url(#' + id + 'glow)" style="mix-blend-mode:screen"/>' +
    '<circle cx="50" cy="458" r="18" fill="#0b0b0c"/><circle cx="50" cy="458" r="16" fill="#3a1714"/><circle class="deck__led-on" cx="50" cy="458" r="16" fill="#e2261b"/>' +
    '<circle cx="50" cy="458" r="12.5" fill="url(#' + id + 'knob)"/><rect x="49" y="447" width="2" height="7" rx="1" fill="#d7d9dc"/>' +
    // 33 / 45 keys with the speed LED between them (the LED lights while playing)
    '<rect x="116" y="546" width="38" height="11" rx="2" fill="#0d0d0e" stroke="#fff" stroke-opacity=".14"/>' +
    '<rect x="178" y="546" width="38" height="11" rx="2" fill="#0d0d0e" stroke="#fff" stroke-opacity=".14"/>' +
    '<rect x="160" y="549.5" width="12" height="4" rx="1" fill="#3a1714"/><rect class="deck__led-on" x="160" y="549.5" width="12" height="4" rx="1" fill="#ff3b2f"/>' +
    // pitch: readout window under the fader (clear of the arm at every angle), reset button, fader slot with tick marks
    '<rect x="522" y="535" width="50" height="21" rx="3" fill="#060607" stroke="#fff" stroke-opacity=".16"/>' +
    '<circle cx="497" cy="462" r="11" fill="#0b0b0c"/><circle cx="497" cy="462" r="9" fill="url(#' + id + 'knob)"/>' +
    '<rect x="538" y="334" width="18" height="194" rx="3" fill="#060607" stroke="#fff" stroke-opacity=".12"/><rect x="545" y="340" width="4" height="182" rx="2" fill="#000"/>' + (function () {
      var t = ''; for (var i = 0; i <= 16; i++) t += '<rect x="' + (i % 4 === 0 ? 522 : 526) + '" y="' + (360.6 + i * 8.8).toFixed(1) + '" width="' + (i % 4 === 0 ? 11 : 7) + '" height="1.2" fill="#8a8d93" fill-opacity=".7"/>'; return t;
    })() +
    '<circle cx="518" cy="431" r="2.4" fill="#e2261b"/>' +
    // arm rest post (placed where the parked arm lies)
    (function () {
      var a = armAngle(R_REST), rad = a * Math.PI / 180;
      var x = P.x + Math.cos(rad) * 205, y = P.y + Math.sin(rad) * 205;
      return '<g transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + (a + 90).toFixed(1) + ')"><rect x="-12" y="-6" width="24" height="12" rx="4" fill="#060607"/><rect x="-9" y="-3" width="18" height="6" rx="3" fill="#2a2b2f"/></g>';
    })() +
    // tonearm base: round black housing with its anti-skate dial
    '<circle cx="' + P.x + '" cy="' + P.y + '" r="47" fill="#060607"/><circle cx="' + P.x + '" cy="' + P.y + '" r="44" fill="url(#' + id + 'knob)"/>' +
    '<circle cx="' + P.x + '" cy="' + P.y + '" r="44" fill="none" stroke="#fff" stroke-opacity=".1"/><circle cx="' + P.x + '" cy="' + P.y + '" r="30" fill="#0d0d0e" stroke="#fff" stroke-opacity=".08"/>' +
    '<circle cx="' + (P.x + 32) + '" cy="' + (P.y + 40) + '" r="9" fill="#0b0b0c"/><circle cx="' + (P.x + 32) + '" cy="' + (P.y + 40) + '" r="7" fill="url(#' + id + 'knob)" stroke="#fff" stroke-opacity=".25"/>';

    // ---- spin (strobe dots on the platter rim, black felt slipmat, cover label) ----
    var spin = '<defs><clipPath id="' + id + 'rec"><circle cx="' + cx + '" cy="' + cy + '" r="200"/></clipPath>' +
      '<filter id="' + id + 'felt" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="9"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .07 0"/><feComposite operator="in" in2="SourceGraphic"/></filter></defs>';
    // four rows of strobe dots, alternating large/small like the real platter edge
    [[232, 1.5, 168], [225.5, 1.9, 168], [219, 1.5, 168], [212.5, 1.9, 168]].forEach(function (row, k) {
      for (var i = 0; i < row[2]; i++) {
        var a = (i + (k % 2) * 0.5) / row[2] * Math.PI * 2;
        spin += '<circle cx="' + (cx + Math.cos(a) * row[0]).toFixed(1) + '" cy="' + (cy + Math.sin(a) * row[0]).toFixed(1) + '" r="' + row[1] + '" fill="#2b2d31" fill-opacity=".8"/>';
      }
    });
    spin += '<circle cx="' + cx + '" cy="' + cy + '" r="206" fill="#0a0a0b"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="203" fill="#141517"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="203" filter="url(#' + id + 'felt)"/><g clip-path="url(#' + id + 'rec)">';
    for (var r = 76; r < 196; r += 4.5) spin += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#fff" stroke-opacity="' + (r % 18 < 4.5 ? .045 : .02) + '" stroke-width=".9"/>';
    spin += '</g>' +
      // the slipmat's thin silver ring
      '<circle cx="' + cx + '" cy="' + cy + '" r="186" fill="none" stroke="#a7abb2" stroke-opacity=".55" stroke-width="1.6"/>' +
      // label = the cover (cream circle underneath as a fallback while it loads)
      '<circle cx="' + cx + '" cy="' + cy + '" r="68" fill="#efe9dd"/>' +
      '<clipPath id="' + id + 'lbl"><circle cx="' + cx + '" cy="' + cy + '" r="68"/></clipPath>' +
      '<image class="deck__cover" x="' + (cx - 68) + '" y="' + (cy - 68) + '" width="136" height="136" preserveAspectRatio="xMidYMid slice" clip-path="url(#' + id + 'lbl)"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="68" fill="none" stroke="#050505" stroke-opacity=".55" stroke-width="2"/>';

    // ---- glare (fixed while the record turns) + spindle ----
    var glare = '<defs>' +
      '<radialGradient id="' + id + 'sheen" gradientUnits="userSpaceOnUse" cx="' + cx + '" cy="' + cy + '" r="200"><stop offset=".12" stop-color="#fff" stop-opacity="0"/><stop offset=".55" stop-color="#fff" stop-opacity=".09"/><stop offset="1" stop-color="#fff" stop-opacity=".02"/></radialGradient>' +
      '<filter id="' + id + 'blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="9"/></filter>' +
      '<clipPath id="' + id + 'rec2"><circle cx="' + cx + '" cy="' + cy + '" r="203"/></clipPath>' +
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
      '<linearGradient id="' + id + 'cyl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d929a"/><stop offset=".3" stop-color="#f6f7f8"/><stop offset=".62" stop-color="#b3b8bf"/><stop offset="1" stop-color="#6f747c"/></linearGradient>' +
      // counterweight: silver cylinder with a black ring, on the arm's rear stub
      '<rect x="-108" y="-5" width="70" height="10" fill="#26272b"/>' +
      '<rect x="-104" y="-19" width="56" height="38" rx="5" fill="url(#' + id + 'cyl)" stroke="#fff" stroke-opacity=".35"/>' +
      '<rect x="-70" y="-19.5" width="9" height="39" fill="#111214"/><rect x="-104" y="-19" width="4" height="38" rx="2" fill="#000" fill-opacity=".25"/>' +
      '<path d="M-40 0 L212 0 C242 0 266 12 284 31" fill="none" stroke="#7d828b" stroke-width="13" stroke-linecap="round"/>' +
      '<path d="M-40 0 L212 0 C242 0 266 12 284 31" fill="none" stroke="url(#' + id + 'metal3)" stroke-width="9" stroke-linecap="round"/>' +
      // headshell: silver plate with three holes and a finger lift, cartridge tip peeking out
      '<g transform="translate(284 31) rotate(38)">' +
        '<path d="M6 12 L13 27" stroke="url(#' + id + 'cyl)" stroke-width="3.4" stroke-linecap="round"/>' +
        '<rect x="30" y="-6" width="12" height="12" rx="2" fill="#141517"/>' +
        '<path d="M-6 -9 Q-6 -12 -3 -12 L34 -11 Q38 -11 38 -7 L38 7 Q38 11 34 11 L-3 12 Q-6 12 -6 9 Z" fill="url(#' + id + 'cyl)" stroke="#fff" stroke-opacity=".5"/>' +
        '<circle cx="9" cy="0" r="2.6" fill="#26272b"/><circle cx="18" cy="0" r="2.6" fill="#26272b"/><circle cx="27" cy="0" r="2.6" fill="#26272b"/>' +
      '</g>' +
      '<circle cx="' + STYLUS.x + '" cy="' + STYLUS.y + '" r="2.2" fill="#fff"/>' +
      '<circle cx="0" cy="0" r="22" fill="url(#' + id + 'metal3)" stroke="#fff" stroke-opacity=".5"/><circle cx="0" cy="0" r="13" fill="#141517"/><circle cx="0" cy="0" r="5" fill="url(#' + id + 'metal3)"/>' +
    '</g>';

    // ---- pitch fader: its own layer *under* the tonearm, so the arm always passes over it ----
    var fader = '' +
    '<text class="deck__pitch-read" x="547" y="549.5" font-size="10" font-family="ui-monospace,Menlo,Consolas,monospace" font-weight="700" fill="#ff3b2f" text-anchor="middle">0.0%</text>' +
    '<g class="deck__fader" role="slider" tabindex="0" aria-label="Pitch" aria-orientation="vertical" aria-valuemin="-' + PITCH_RANGE + '" aria-valuemax="' + PITCH_RANGE + '" aria-valuenow="0" aria-valuetext="0 %">' +
      '<rect x="514" y="332" width="68" height="204" fill="transparent"/>' +
      '<g class="deck__cap">' +
        '<rect x="531" y="414" width="32" height="34" rx="3" fill="#1a1b1e" stroke="#fff" stroke-opacity=".22"/>' +
        '<rect x="533" y="416" width="28" height="12" rx="2" fill="#2c2d31"/>' +
        '<rect x="531" y="430" width="32" height="2" fill="#e8e9eb"/>' +
      '</g>' +
    '</g>';

    // ---- top: start/stop pad (the control) + painterly grain ----
    var top = '<defs>' +
      '<filter id="' + id + 'grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="4"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .06 0"/><feComposite operator="in" in2="SourceGraphic"/></filter>' +
      '<linearGradient id="' + id + 'padg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e2f33"/><stop offset="1" stop-color="#131416"/></linearGradient>' +
    '</defs>' +
    // matte powder-coat texture over the plinth
    '<rect x="22" y="34" width="556" height="532" rx="22" filter="url(#' + id + 'grain)" style="mix-blend-mode:screen"/>' +
    // grab area for scratching (only takes the pointer while the needle is on the record, see CSS)
    '<circle class="deck__record-hit" cx="' + cx + '" cy="' + cy + '" r="206" fill="transparent"/>' +
    '<g class="deck__pad-hit" role="button" tabindex="0" aria-label="Play/Pause" aria-pressed="false">' +
      '<rect x="24" y="480" width="92" height="84" fill="transparent"/>' +
      '<rect x="30" y="488" width="76" height="64" rx="4" fill="#050506"/>' +
      '<rect class="deck__pad" x="33" y="491" width="70" height="58" rx="3" fill="url(#' + id + 'padg)" stroke="#fff" stroke-opacity=".16"/>' +
      '<g class="deck__icon deck__icon--play"><path d="M62 510 L62 530 L78 520 Z" fill="#c9ccd1" stroke="#c9ccd1" stroke-width="3" stroke-linejoin="round"/></g>' +
      '<g class="deck__icon deck__icon--pause"><rect x="58" y="510" width="7" height="20" rx="1.5" fill="#ff3b2f"/><rect x="71" y="510" width="7" height="20" rx="1.5" fill="#ff3b2f"/></g>' +
    '</g>';

    return { base: svg('base', base), spin: svg('spin', spin), glare: svg('glare', glare), fader: svg('fader', fader), arm: svg('arm', arm, '-300 -300 1200 1200'), top: svg('top', top) };
  }

  function mount(host, opts) {
    opts = opts || {};
    var id = 'ahd' + (++uid) + '-';
    var layers = buildLayers(id);
    host.classList.add('deck-host');

    var root = document.createElement('div');
    root.className = 'deck';
    root.innerHTML = '<div class="deck__glow"></div><div class="deck__stage">' + layers.base + layers.spin + layers.glare + layers.fader + layers.arm + layers.top + '<canvas class="deck__wave" aria-hidden="true"></canvas></div>';
    host.insertBefore(root, host.firstChild);

    var spinEl = root.querySelector('.deck__layer--spin');
    var armEl = root.querySelector('.deck__layer--arm');
    var pad = root.querySelector('.deck__pad-hit');
    var coverEl = root.querySelector('.deck__cover');
    var fader = root.querySelector('.deck__fader'), cap = root.querySelector('.deck__cap');
    var readout = root.querySelector('.deck__pitch-read'), topSvg = root.querySelector('.deck__layer--fader');
    var audio = opts.audio || null;
    var st = { playing: false, omega: 0, angle: 0, progress: 0, last: 0, raf: 0, liftTimer: 0, armOn: false, parking: false, held: false };
    var BRAKE_DECEL = 200 / (BRAKE_MS / 1000);   // deg/s²: the platter stops in the same time the sound winds down

    function radius() { return R_OUTER - (R_OUTER - R_INNER) * st.progress; }
    function armTo(r) { armEl.style.transform = 'rotate(' + armAngle(r).toFixed(2) + 'deg)'; }

    function frame(ts) {
      var dt = Math.min(0.05, (ts - st.last) / 1000 || 0); st.last = ts;
      if (st.held) { st.omega = 0; st.raf = requestAnimationFrame(frame); return; }          // the hand turns the record (see grab)
      if (st.playing) st.omega += (200 * rate() - st.omega) * (1 - Math.exp(-dt / 0.45));   // 33⅓ rpm spin-up
      else st.omega = Math.max(0, st.omega - BRAKE_DECEL * dt);                            // brake to a standstill
      st.angle = (st.angle + st.omega * dt) % 360;
      spinEl.style.transform = 'rotate(' + st.angle.toFixed(2) + 'deg)';
      if (!st.playing && st.omega === 0 && st.parking) { st.parking = false; swingArm(false); }   // platter stands: now the arm goes back
      st.raf = (st.playing || st.omega > 0) ? requestAnimationFrame(frame) : 0;
    }
    function kick() {
      if (reduceMotion || st.raf) return;
      st.last = performance.now();
      st.raf = requestAnimationFrame(frame);
    }

    function needle(down) { st.armOn = down; root.classList.toggle('is-needle-down', down); if (audio) audio.__ahNeedleDown = down; }

    // lift the arm and swing it onto the record (outer groove / current position) or back to its rest
    function swingArm(onRecord, instant) {
      root.classList.remove('is-tracking');
      root.classList.add('is-lifting');
      clearTimeout(st.liftTimer);
      if (!onRecord) needle(false);                  // lifted off the record right away
      st.liftTimer = setTimeout(function () {
        root.classList.remove('is-lifting');
        if (onRecord) { needle(true); root.classList.add('is-tracking'); }
      }, instant || reduceMotion ? 0 : SWING_MS);
      armTo(onRecord ? radius() : R_REST);
    }

    // Play: the arm swings onto the record (the sound waits for it, see dropPlay).
    // Stop: the motor is off at once, but the needle stays in the groove until the platter
    // has braked to a standstill — only then does the arm go back to its rest.
    function setPlaying(p, instant) {
      p = !!p;
      if (p && audio) scratchLoad(audio.currentSrc || audio.src);   // decode in the background, ready for the first scratch
      if (p === st.playing && !instant) return;
      st.playing = p;
      host.classList.toggle('is-playing', p);
      pad.setAttribute('aria-pressed', String(p));
      if (p) {
        st.parking = false;
        if (!st.armOn || instant) swingArm(true, instant);   // still on the record from the last stop: stays there
      } else if (instant || reduceMotion || !st.armOn || st.omega === 0) {
        st.parking = false;
        swingArm(false, instant);
      } else {
        st.parking = true;                           // frame() sends the arm back once the platter stands
      }
      kick();
    }

    function setProgress(f) {
      f = Math.min(1, Math.max(0, +f || 0));
      st.progress = f;
      if (st.playing) armTo(radius());
      drawWave(f);
    }

    // ---- waveform under the deck: the whole track's loudness, the played part tinted ----
    // Data: assets/waves/<slug>.json next to assets/tracks/<slug>.m4a (tools/make-waveforms.py)
    var waveEl = root.querySelector('.deck__wave'), wave = { url: '', data: null, drawn: '' };
    function waveUrlFor(src) {
      try { var m = /^(.*)\/tracks\/([^\/?#]+)\.m4a(?:[?#].*)?$/.exec(new URL(src, location.href).href); } catch (e) { return ''; }
      return m ? m[1] + '/waves/' + m[2] + '.json' : '';
    }
    function setWave(src) {
      var u = src ? waveUrlFor(src) : '';
      if (u === wave.url) return;
      wave.url = u; wave.data = null; wave.drawn = '';
      waveEl.classList.remove('is-ready');
      if (!u) return;
      fetch(u).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (wave.url !== u || !d || !d.length) return;
        wave.data = d; drawWave(st.progress);
        waveEl.classList.add('is-ready');
      }).catch(function () {});
    }
    function drawWave(f) {
      var d = wave.data; if (!d) return;
      var dpr = window.devicePixelRatio || 1, W = Math.round(waveEl.clientWidth * dpr), H = Math.round(waveEl.clientHeight * dpr);
      if (!W || !H) return;
      var n = d.length, played = f * n, key = W + 'x' + H + ':' + Math.round(played * 3);
      if (key === wave.drawn) return;                // only repaint when something visible changes
      wave.drawn = key;
      if (waveEl.width !== W || waveEl.height !== H) { waveEl.width = W; waveEl.height = H; }
      var g = waveEl.getContext('2d'), cs = getComputedStyle(waveEl);
      g.clearRect(0, 0, W, H);
      var step = W / n, bw = Math.max(1, step * 0.55), mid = H / 2;
      for (var i = 0; i < n; i++) {
        var h = Math.max(dpr * 1.5, d[i] / 100 * H);
        g.fillStyle = i < played ? cs.getPropertyValue('--wave-played') : cs.getPropertyValue('--wave-rest');
        g.fillRect(i * step + (step - bw) / 2, mid - h / 2, bw, h);
      }
    }
    if (window.ResizeObserver) new ResizeObserver(function () { wave.drawn = ''; drawWave(st.progress); }).observe(waveEl);
    if (audio) {
      audio.addEventListener('loadstart', function () { setWave(audio.currentSrc || audio.src); });
      setWave(audio.currentSrc || audio.getAttribute('src'));
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

    // ---- scratching: hold the record and move it back and forth ----
    var recordHit = root.querySelector('.deck__record-hit'), grab = null;
    function handAngle(e) {
      var r = topSvg.getBoundingClientRect();
      return Math.atan2((e.clientY - r.top) / r.height * 600 - C.y, (e.clientX - r.left) / r.width * 600 - C.x) * 180 / Math.PI;
    }
    recordHit.addEventListener('pointerdown', function (e) {
      if (!st.armOn || !audio || e.button > 0) return;
      e.preventDefault();
      try { recordHit.setPointerCapture(e.pointerId); } catch (err) {}
      var src = audio.currentSrc || audio.src;
      scratchLoad(src);
      var live = SCR.src === src && scratchStart(audio.currentTime);   // not decoded yet: the record still stops under the hand, silently
      grab = { last: handAngle(e), moved: 0, live: live };
      st.held = true;
      mute(audio, true);
      root.classList.add('is-scratching');
      kick();
    });
    recordHit.addEventListener('pointermove', function (e) {
      if (!grab) return;
      var a = handAngle(e), d = a - grab.last;
      if (d > 180) d -= 360; else if (d < -180) d += 360;          // across the ±180° seam
      grab.last = a; grab.moved += d;
      st.angle = (st.angle + d + 360) % 360;
      spinEl.style.transform = 'rotate(' + st.angle.toFixed(2) + 'deg)';
      if (grab.live) {
        SCR.target = Math.max(0, Math.min(audio.duration || 1e9, SCR.target + d / 200));
        if (audio.duration) drawWave(SCR.target / audio.duration);   // the wave follows the hand too
      }
    });
    function release() {
      if (!grab) return;
      var g = grab; grab = null;
      st.held = false;
      root.classList.remove('is-scratching');
      var pos = g.live ? scratchStop() : audio.currentTime;
      if (g.live) { try { audio.currentTime = Math.max(0, Math.min((audio.duration || pos) - 0.05, pos)); } catch (err) {} }
      if (st.armOn && !audio.__ahBraking) mute(audio, false);
      st.omega = st.playing ? 200 * rate() : 0;                   // let go: the motor has it again at once
      kick();
    }
    recordHit.addEventListener('pointerup', release);
    recordHit.addEventListener('pointercancel', release);
    recordHit.addEventListener('lostpointercapture', release);
    // iOS: keep the page from scrolling while a finger holds the record
    recordHit.addEventListener('touchstart', function (e) { if (st.armOn) e.preventDefault(); }, { passive: false });

    // ---- pitch fader: drag, wheel-free; double-click or 0 resets; arrows nudge ----
    var CAP_CENTER = 431, CAP_TRAVEL = 70;          // viewBox units; top = -8 % (slower), bottom = +8 % (faster)
    function setPitch(p) {
      p = Math.max(-PITCH_RANGE, Math.min(PITCH_RANGE, p));
      if (Math.abs(p) < 0.25) p = 0;                // detent at zero
      p = Math.round(p * 10) / 10;
      pitch = p;
      cap.setAttribute('transform', 'translate(0 ' + ((p / PITCH_RANGE) * CAP_TRAVEL).toFixed(2) + ')');
      var txt = (p > 0 ? '+' : p < 0 ? '−' : '') + Math.abs(p).toFixed(1) + '%';
      readout.textContent = txt;
      fader.setAttribute('aria-valuenow', p);
      fader.setAttribute('aria-valuetext', txt.replace('−', 'minus '));
      if (cruising) SCR.cruise = rate();                        // iPhone: the engine follows the fader live
      scheduleRate();
      kick();
    }
    // The cap and readout follow the finger at once; the sound changes speed at most ~6× a
    // second while dragging (each change costs mobile browsers a tiny dropout) and lands on the
    // exact value when the fader is let go.
    // iPhone: Safari copes badly with the rate changing under a running track, so there the speed
    // only changes once, when the fader is let go — and if Safari stops the track anyway, it is
    // started again right away (the deck still shows it playing).
    var RATE_EVERY = 160, rateLast = 0, rateTimer = 0;
    function flushRate() {
      clearTimeout(rateTimer); rateTimer = 0; rateLast = Date.now();
      if (!audio) return;
      var wasOn = !audio.paused && !audio.__ahBraking;
      applyRate(audio);
      if (wasOn) setTimeout(function () {
        if (audio.paused && st.playing && !audio.__ahBraking) { var pr = audio.play(); if (pr && pr.catch) pr.catch(function () {}); }
      }, 250);
    }
    function scheduleRate() {
      if (!audio || (IOS && dragging)) return;
      var wait = RATE_EVERY - (Date.now() - rateLast);
      if (wait <= 0) flushRate();
      else if (!rateTimer) rateTimer = setTimeout(flushRate, wait);
    }
    function pitchFromEvent(e) {
      var r = topSvg.getBoundingClientRect();
      var y = (e.clientY - r.top) / r.height * 600;
      return (y - CAP_CENTER) / CAP_TRAVEL * PITCH_RANGE;
    }
    var dragging = false;
    // iPhone: Safari can't change the <audio>'s speed live, so while the fader is held the track
    // plays on from the decoded copy in the scratch engine at the fader's speed (the <audio> is
    // muted meanwhile); on release the <audio> takes over at that spot with the new speed.
    var cruising = false;
    function startCruise() {
      if (!IOS || !audio || audio.paused || audio.__ahBraking) return;
      if (SCR.src !== (audio.currentSrc || audio.src) || !scratchStart(audio.currentTime, rate())) return;
      SCR.cruise = rate(); cruising = true; mute(audio, true);
    }
    function endCruise() {
      if (!cruising) return false;
      cruising = false;
      var pos = scratchStop();
      try { audio.currentTime = Math.max(0, Math.min((audio.duration || pos) - 0.05, pos)); } catch (err) {}
      flushRate();
      mute(audio, false);
      if (audio.paused && st.playing) { var pr = audio.play(); if (pr && pr.catch) pr.catch(function () {}); }   // inside the touch: allowed
      return true;
    }
    fader.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      dragging = true;
      try { fader.setPointerCapture(e.pointerId); } catch (err) {}
      startCruise();
      setPitch(pitchFromEvent(e));
    });
    fader.addEventListener('pointermove', function (e) { if (dragging) setPitch(pitchFromEvent(e)); });
    function endDrag() { if (dragging && !endCruise()) flushRate(); dragging = false; }
    fader.addEventListener('pointerup', endDrag);
    fader.addEventListener('pointercancel', endDrag);
    fader.addEventListener('dblclick', function () { setPitch(0); flushRate(); });
    // iOS: a vertical drag on the fader must not turn into page scrolling (that cancels the drag)
    fader.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
    fader.addEventListener('keydown', function (e) {
      var d = { ArrowUp: -0.5, ArrowLeft: -0.5, ArrowDown: 0.5, ArrowRight: 0.5 }[e.key];   // follows the cap: up = slower
      if (d !== undefined) { e.preventDefault(); setPitch(pitch + d); }
      else if (e.key === 'Home') { e.preventDefault(); setPitch(-PITCH_RANGE); }
      else if (e.key === 'End') { e.preventDefault(); setPitch(PITCH_RANGE); }
      else if (e.key === '0') { e.preventDefault(); setPitch(0); }
    });
    setPitch(0);                                     // always starts at 0 — only the visitor moves it (nothing is stored)

    // stopping starts the wind-down: arm and lights react right away, the sound follows the platter
    if (audio) audio.addEventListener('ahbrake', function () { setPlaying(false); });

    var seedImg = host.querySelector('img');
    setCover(opts.cover || (seedImg && (seedImg.currentSrc || seedImg.src)));
    setLabel(opts.label || '');
    armTo(R_REST);
    needle(false);
    if (opts.glow) setGlow(opts.glow);

    return { setPlaying: setPlaying, setProgress: setProgress, setCover: setCover, setLabel: setLabel, setGlow: setGlow, setPitch: setPitch, setWave: setWave, getPitch: function () { return pitch; }, isPlaying: function () { return st.playing; } };
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
