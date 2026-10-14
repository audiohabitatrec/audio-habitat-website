/*
  Painted turntable for the "Jetzt läuft" player and the release pages.

  AHDeck.mount(hostEl, { label, onToggle }) draws a silver deck into hostEl and
  returns a small controller:

    setPlaying(bool)    tonearm swings onto the record / back to its rest, the
                        platter spins up or coasts down, lights come on
    setProgress(0..1)   while playing, the tonearm creeps from the outer groove
                        toward the label like on a real record
    setLabel(text)      track name on the record label (handwritten)
    setGlow(cssColor)   colour of the soft glow behind the deck
    isPlaying()

  AHDeck.dominantColor(imgEl) -> "rgb(r,g,b)" | null  (for the glow, from the cover)

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
    // LED + 33/45
    '<circle class="deck__led-glow" cx="164" cy="496" r="20" fill="url(#' + id + 'glow)"/>' +
    '<circle cx="164" cy="496" r="6" fill="#53433a"/><circle class="deck__led-on" cx="164" cy="496" r="6" fill="#ff7a3d"/>' +
    '<rect x="152" y="518" width="26" height="14" rx="4" fill="#20232a"/><rect x="184" y="518" width="26" height="14" rx="4" fill="#cfd3d9" stroke="#8c919a" stroke-opacity=".6"/>' +
    '<text x="165" y="529" font-size="8" font-family="Helvetica,Arial,sans-serif" font-weight="700" fill="#d9dce1" text-anchor="middle">33</text>' +
    '<text x="197" y="529" font-size="8" font-family="Helvetica,Arial,sans-serif" font-weight="700" fill="#5d626b" text-anchor="middle">45</text>' +
    // pitch fader
    '<rect x="540" y="338" width="14" height="186" rx="7" fill="#20232a"/>' + (function () {
      var t = ''; for (var i = 0; i <= 10; i++) t += '<rect x="560" y="' + (342 + i * 17.6).toFixed(1) + '" width="' + (i % 5 === 0 ? 14 : 8) + '" height="1.4" fill="#5d626b"/>'; return t;
    })() +
    '<rect x="531" y="414" width="32" height="46" rx="6" fill="url(#' + id + 'metal)" stroke="#fff" stroke-opacity=".6"/><rect x="531" y="434" width="32" height="6" fill="#e0703f"/>' +
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
      // label
      '<circle cx="' + cx + '" cy="' + cy + '" r="68" fill="#efe9dd"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="63" fill="none" stroke="#17140f" stroke-opacity=".16" stroke-width="1"/>' +
      '<g transform="rotate(-5 ' + cx + ' ' + cy + ')" fill="#17140f" fill-opacity=".82" text-anchor="middle">' +
        '<text class="deck__title1" x="' + cx + '" y="' + (cy - 30) + '" font-family="Caveat,cursive" font-weight="600" font-size="20"></text>' +
        '<text class="deck__title2" x="' + cx + '" y="' + (cy - 11) + '" font-family="Caveat,cursive" font-weight="600" font-size="20"></text>' +
        '<text x="' + cx + '" y="' + (cy + 36) + '" font-family="Helvetica,Arial,sans-serif" font-weight="700" font-size="7.5" letter-spacing="1.6">AUDIO HABITAT · 33⅓</text>' +
      '</g>';

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
      '<rect x="62" y="496" width="60" height="30" rx="6" fill="#1b1d22" opacity=".12"/>' +
    '</g>';

    return { base: svg('base', base), spin: svg('spin', spin), glare: svg('glare', glare), arm: svg('arm', arm), top: svg('top', top) };
  }

  // two label lines around the spindle, font size from the longest line
  function labelLines(text) {
    text = String(text || '').trim();
    var words = text.split(/\s+/), best = [text, ''];
    if (words.length > 1) {
      var bestDiff = Infinity;
      for (var i = 1; i < words.length; i++) {
        var a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
        var diff = Math.abs(a.length - b.length);
        if (diff < bestDiff) { bestDiff = diff; best = [a, b]; }
      }
    }
    var longest = Math.max(best[0].length, best[1].length);
    var size = longest <= 9 ? 22 : longest <= 12 ? 19 : longest <= 15 ? 16 : 13;
    return { l1: best[0], l2: best[1], size: size };
  }

  function mount(host, opts) {
    opts = opts || {};
    var id = 'ahd' + (++uid) + '-';
    var layers = buildLayers(id);
    host.classList.add('deck-host');

    var root = document.createElement('div');
    root.className = 'deck';
    root.innerHTML = '<div class="deck__glow"></div><div class="deck__stage">' + layers.base + layers.spin + layers.glare + layers.arm + layers.top + '</div>';
    host.insertBefore(root, host.firstChild);

    var spinEl = root.querySelector('.deck__layer--spin');
    var armEl = root.querySelector('.deck__layer--arm');
    var pad = root.querySelector('.deck__pad-hit');
    var t1 = root.querySelector('.deck__title1'), t2 = root.querySelector('.deck__title2');
    var st = { playing: false, omega: 0, angle: 0, progress: 0, last: 0, raf: 0, liftTimer: 0 };

    function radius() { return R_OUTER - (R_OUTER - R_INNER) * st.progress; }
    function armTo(r) { armEl.style.transform = 'rotate(' + armAngle(r).toFixed(2) + 'deg)'; }

    function frame(ts) {
      var dt = Math.min(0.05, (ts - st.last) / 1000 || 0); st.last = ts;
      var target = st.playing ? 200 : 0, tau = st.playing ? 0.45 : 0.9;     // 33⅓ rpm; spin-up / coast-down
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

    function setLabel(text) {
      var l = labelLines(text);
      t1.textContent = l.l2 ? l.l1 : l.l1;
      t2.textContent = l.l2;
      t1.setAttribute('font-size', l.size); t2.setAttribute('font-size', l.size);
      // single line sits between the two slots
      t1.setAttribute('y', C.y - (l.l2 ? 30 : 22));
    }

    function setGlow(color) { if (color) root.style.setProperty('--deck-glow', color); }

    function toggle() { if (opts.onToggle) opts.onToggle(); else setPlaying(!st.playing); }
    pad.addEventListener('click', toggle);
    pad.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });

    setLabel(opts.label || '');
    armTo(R_REST);
    if (opts.glow) setGlow(opts.glow);

    return { setPlaying: setPlaying, setProgress: setProgress, setLabel: setLabel, setGlow: setGlow, isPlaying: function () { return st.playing; } };
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

  window.AHDeck = { mount: mount, dominantColor: dominantColor };
})();
