(function () {
  var gridEl = document.getElementById('releaseGrid');
  var emptyEl = document.getElementById('tracklistEmpty');
  var audio = document.getElementById('audioPlayer');
  if (!gridEl || !audio) return;

  var ICONS = {
    play: '<svg class="icon-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg class="icon-pause" viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>',
    note: '<svg class="note" viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3z"/></svg>',
    spotify: '<svg class="brand-spotify" viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.52 17.34a.75.75 0 0 1-1.03.25c-2.82-1.72-6.37-2.11-10.55-1.16a.75.75 0 1 1-.33-1.46c4.58-1.04 8.5-.59 11.66 1.34.36.22.47.68.25 1.03zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.23-1.99-8.15-2.56-11.97-1.4a.94.94 0 1 1-.55-1.8c4.36-1.32 9.78-.68 13.5 1.6.44.27.58.85.31 1.29zm.13-3.41C15.9 8.36 9.7 8.14 6.11 9.24a1.13 1.13 0 1 1-.66-2.16c4.12-1.25 11-.99 15.34 1.6a1.13 1.13 0 1 1-1.17 1.93z"/></svg>',
    apple: '<svg class="brand-apple" viewBox="0 0 24 24"><path d="M17.5 2h-11A4.5 4.5 0 0 0 2 6.5v11A4.5 4.5 0 0 0 6.5 22h11a4.5 4.5 0 0 0 4.5-4.5v-11A4.5 4.5 0 0 0 17.5 2zM16 8.02v6.53a2.1 2.1 0 0 1-1.66 2.08l-.9.2a1.6 1.6 0 1 1-.69-3.12l1.4-.3a.4.4 0 0 0 .32-.4V8.9l-4.8 1.03v6.1a2.1 2.1 0 0 1-1.66 2.08l-.9.2a1.6 1.6 0 1 1-.69-3.12l1.4-.3a.4.4 0 0 0 .32-.4V6.9a.9.9 0 0 1 .7-.88l6.6-1.42a.9.9 0 0 1 1.1.88z"/></svg>',
    soundcloud: '<svg class="brand-soundcloud" viewBox="0 0 24 24"><path d="M9 17h9.5a3.5 3.5 0 0 0 .4-6.98 5 5 0 0 0-9.62-1.7A3.5 3.5 0 0 0 5.5 14.4 3.5 3.5 0 0 0 9 17zM3.5 12.2c.14 0 .25.1.27.24l.4 4.3-.4 4.15a.27.27 0 0 1-.54 0l-.35-4.15.35-4.3a.27.27 0 0 1 .27-.24zm2 1.05c.16 0 .28.12.3.28l.32 3.2-.32 3.14a.3.3 0 0 1-.6 0l-.28-3.14.28-3.2c.02-.16.14-.28.3-.28z"/></svg>',
    pwyw: '<svg class="brand-pwyw" viewBox="0 0 24 24"><path d="M12 21s-6.7-4.35-9.33-8.2C.9 10.1 1.4 6.6 4.2 5.1c2.2-1.2 4.6-.5 5.8 1.2 1.2-1.7 3.6-2.4 5.8-1.2 2.8 1.5 3.3 5 1.53 7.7C18.7 16.65 12 21 12 21z"/></svg>'
  };

  var releases = (typeof RELEASES !== 'undefined') ? RELEASES : [];
  var links = (typeof ARTIST_LINKS !== 'undefined') ? ARTIST_LINKS : {};
  var paypalEmail = (typeof PAYPAL_EMAIL !== 'undefined') ? PAYPAL_EMAIL : '';

  if (!releases.length) {
    if (emptyEl) emptyEl.hidden = false;
    return;
  }

  function waveformHtml() {
    return '<div class="waveform"><span></span><span></span><span></span><span></span><span></span></div>';
  }

  function hashKey(key) {
    var h = 0;
    for (var i = 0; i < key.length; i++) { h = (h * 31 + key.charCodeAt(i)) | 0; }
    return Math.abs(h) || 1;
  }

  function seededRandom(seed) {
    var s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  function barsHtml(seedKey, count) {
    var rnd = seededRandom(hashKey(seedKey));
    var out = '';
    for (var i = 0; i < count; i++) {
      var h = Math.round(22 + rnd() * 78);
      out += '<span style="height:' + h + '%"></span>';
    }
    return out;
  }

  function seekHtml(seedKey) {
    var bars = barsHtml(seedKey, 50);
    return '<div class="seek" role="slider" aria-label="Seek" tabindex="0">' +
      '<div class="seek__bars">' + bars + '</div>' +
      '<div class="seek__bars seek__bars--played">' + bars + '</div>' +
    '</div>';
  }

  var PLATTER_IMG = 'assets/covers/platter.jpg';
  var tonearmUid = 0;

  function tonearmSvg() {
    tonearmUid++;
    var gradId = 'tonearmChrome-' + tonearmUid;
    var blurId = 'tonearmSmudge-' + tonearmUid;
    return '<svg class="cover-disc__tonearm" viewBox="0 0 100 100" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="' + gradId + '" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0%" stop-color="#8f8f8f"/>' +
          '<stop offset="45%" stop-color="#f5f5f5"/>' +
          '<stop offset="60%" stop-color="#e8e8e8"/>' +
          '<stop offset="100%" stop-color="#767676"/>' +
        '</linearGradient>' +
        '<filter id="' + blurId + '" x="-50%" y="-50%" width="200%" height="200%">' +
          '<feGaussianBlur stdDeviation="3.2"/>' +
        '</filter>' +
      '</defs>' +
      '<path d="M78.7 27.1 Q76 47 74.35 67.2" stroke="#b7b2a9" stroke-width="7" ' +
        'stroke-linecap="round" fill="none" opacity="0.85" filter="url(#' + blurId + ')"/>' +
      '<g class="cover-disc__tonearm-group">' +
        '<line x1="78.7" y1="27.1" x2="74.35" y2="67.2" stroke="url(#' + gradId + ')" ' +
          'stroke-width="1.7" stroke-linecap="round"/>' +
        '<rect x="71.6" y="63.4" width="5.2" height="7.4" rx="1.1" fill="#171717" ' +
          'transform="rotate(-6.2 74.35 67.2)"/>' +
        '<circle cx="78.7" cy="27.1" r="3.1" fill="#181818" stroke="#5a5a5a" stroke-width="0.5"/>' +
      '</g>' +
    '</svg>';
  }

  function coverMarkup(cover) {
    return '<img class="cover-disc__platter" src="' + PLATTER_IMG + '" alt="" aria-hidden="true">' +
      (cover ? '<img class="cover-art" src="' + cover + '" alt="">' : ICONS.note) +
      tonearmSvg();
  }

  function pwywHref(title) {
    if (!paypalEmail) return '';
    return 'https://www.paypal.com/donate/?business=' + encodeURIComponent(paypalEmail) +
      '&currency_code=EUR&no_recurring=0&item_name=' + encodeURIComponent('Audio Habitat – ' + title);
  }

  function linksHtml(track) {
    var spotifyHref = track.spotify || links.spotify;
    var appleHref = track.apple || links.apple;
    var soundcloudHref = track.soundcloud || links.soundcloud;
    var supportHref = pwywHref(track.title);
    return '<div class="release-links">' +
      (spotifyHref ? '<a href="' + spotifyHref + '" target="_blank" rel="noopener" aria-label="Spotify">' + ICONS.spotify + '</a>' : '') +
      (appleHref ? '<a href="' + appleHref + '" target="_blank" rel="noopener" aria-label="Apple Music">' + ICONS.apple + '</a>' : '') +
      (soundcloudHref ? '<a href="' + soundcloudHref + '" target="_blank" rel="noopener" aria-label="SoundCloud">' + ICONS.soundcloud + '</a>' : '') +
      (supportHref ? '<a class="pwyw" href="' + supportHref + '" target="_blank" rel="noopener" aria-label="Zahl was du willst">' + ICONS.pwyw + '</a>' : '') +
      '</div>';
  }

  function formatTime(sec) {
    if (!isFinite(sec) || isNaN(sec)) return '--:--';
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  var registry = {}; // key -> entry
  var pendingSeekRatio = null;

  function makeEntry(key, track, opts) {
    var entry = {
      key: key,
      file: track.file,
      playToggleEls: opts.playToggleEls,
      cardEl: opts.cardEl,
      timeEl: opts.timeEl,
      seekEl: opts.seekEl,
      seekPlayedEl: opts.seekPlayedEl
    };
    registry[key] = entry;
    return entry;
  }

  // Playback intro: the record lands & spins first, then the tonearm swings
  // in, and only then does the audio actually start — see beginPlaybackSequence.
  var SPIN_UP_MS = 1100;
  var ARM_SWING_MS = 1100;
  var spinTimer = null;
  var armTimer = null;

  function clearSequenceTimers() {
    if (spinTimer) { clearTimeout(spinTimer); spinTimer = null; }
    if (armTimer) { clearTimeout(armTimer); armTimer = null; }
  }

  function setPlaying(entry, on) {
    entry.playToggleEls.forEach(function (el) { el.classList.toggle('is-playing', on); });
    entry.cardEl.classList.toggle('is-active-card', on);
  }

  function setArmActive(entry, on) {
    entry.playToggleEls.forEach(function (el) { el.classList.toggle('arm-active', on); });
  }

  function clearAllPlaying() {
    clearSequenceTimers();
    Object.keys(registry).forEach(function (k) {
      setPlaying(registry[k], false);
      setArmActive(registry[k], false);
    });
    gridEl.classList.remove('has-active');
  }

  function setSeekProgress(entry, ratio) {
    ratio = Math.min(1, Math.max(0, ratio || 0));
    entry.seekPlayedEl.style.clipPath = 'inset(0 ' + ((1 - ratio) * 100) + '% 0 0)';
  }

  function beginPlaybackSequence(entry) {
    clearSequenceTimers();
    gridEl.classList.add('has-active');
    setPlaying(entry, true);
    spinTimer = setTimeout(function () {
      spinTimer = null;
      setArmActive(entry, true);
      armTimer = setTimeout(function () {
        armTimer = null;
        audio.play();
      }, ARM_SWING_MS);
    }, SPIN_UP_MS);
  }

  function toggle(entry) {
    var isThis = audio.dataset.key === entry.key;
    var isBusy = isThis && (spinTimer || armTimer || !audio.paused);
    if (isBusy) {
      audio.pause();
      clearAllPlaying();
      return;
    }
    audio.pause();
    if (!isThis) {
      audio.src = entry.file;
      audio.dataset.key = entry.key;
      entry.timeEl.textContent = '0:00 / --:--';
      setSeekProgress(entry, 0);
    }
    clearAllPlaying();
    beginPlaybackSequence(entry);
  }

  function playFromRatio(entry, ratio) {
    clearSequenceTimers();
    var isActive = audio.dataset.key === entry.key;
    if (!isActive) {
      pendingSeekRatio = ratio;
      audio.src = entry.file;
      audio.dataset.key = entry.key;
      entry.timeEl.textContent = '0:00 / --:--';
    } else if (audio.duration) {
      audio.currentTime = ratio * audio.duration;
    } else {
      pendingSeekRatio = ratio;
    }
    clearAllPlaying();
    gridEl.classList.add('has-active');
    setPlaying(entry, true);
    setArmActive(entry, true);
    audio.play();
  }

  function wireSeek(seekEl, getEntry) {
    var dragging = false;

    function ratioFromEvent(e) {
      var rect = seekEl.getBoundingClientRect();
      return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    }

    seekEl.addEventListener('pointerdown', function (e) {
      var entry = getEntry();
      if (!entry) return;
      dragging = true;
      if (seekEl.setPointerCapture) seekEl.setPointerCapture(e.pointerId);
      setSeekProgress(entry, ratioFromEvent(e));
    });

    seekEl.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var entry = getEntry();
      if (!entry) return;
      setSeekProgress(entry, ratioFromEvent(e));
    });

    function finish(e) {
      if (!dragging) return;
      dragging = false;
      var entry = getEntry();
      if (entry) playFromRatio(entry, ratioFromEvent(e));
    }

    seekEl.addEventListener('pointerup', finish);
    seekEl.addEventListener('pointercancel', function () { dragging = false; });
  }

  releases.forEach(function (release, ri) {
    if (release.type === 'ep') {
      var card = document.createElement('div');
      card.className = 'release-card ep';

      var coverInner = coverMarkup(release.cover);
      var coverWrap = document.createElement('div');
      coverWrap.className = 'ep__cover-wrap';
      coverWrap.innerHTML =
        '<div class="cover-wrap">' +
          '<div class="cover-disc" role="button" aria-label="Play">' +
            coverInner +
            '<div class="cover-disc__overlay">' + ICONS.play + ICONS.pause + '</div>' +
          '</div>' +
        '</div>' +
        seekHtml('ep-' + ri) +
        '<span class="ep__badge">EP</span>' +
        '<div class="ep__title">' + release.title + '</div>';
      card.appendChild(coverWrap);

      var coverEl = coverWrap.querySelector('.cover-disc');
      var deckEl = coverWrap.querySelector('.cover-wrap');
      var epSeekEl = coverWrap.querySelector('.seek');
      var epSeekPlayedEl = coverWrap.querySelector('.seek__bars--played');

      var list = document.createElement('ul');
      list.className = 'ep__tracks';

      var epActiveKey = null;

      release.tracks.forEach(function (track, ti) {
        var key = ri + '-' + ti;
        var li = document.createElement('li');
        li.className = 'ep-track';
        li.innerHTML =
          '<button class="ep-track__play" type="button" aria-label="Play">' + ICONS.play + ICONS.pause + '</button>' +
          '<div class="ep-track__title">' + track.title + '</div>' +
          '<div class="release-card__row">' + waveformHtml() +
            '<div class="release-card__time">--:--</div>' +
          '</div>' +
          linksHtml(track);
        list.appendChild(li);

        var timeEl = li.querySelector('.release-card__time');
        var entry = makeEntry(key, track, {
          playToggleEls: [li, coverEl, deckEl],
          cardEl: card,
          timeEl: timeEl,
          seekEl: epSeekEl,
          seekPlayedEl: epSeekPlayedEl
        });

        if (ti === 0) epActiveKey = key;

        li.querySelector('.ep-track__play').addEventListener('click', function () {
          epActiveKey = key;
          toggle(entry);
        });
      });

      wireSeek(epSeekEl, function () { return registry[epActiveKey]; });

      coverEl.addEventListener('click', function () {
        if (epActiveKey && registry[epActiveKey]) toggle(registry[epActiveKey]);
      });

      card.appendChild(list);
      gridEl.appendChild(card);
    } else {
      var track = release.tracks[0];
      var key = ri + '-0';
      var card = document.createElement('div');
      card.className = 'release-card single';

      var coverInner = coverMarkup(release.cover);
      card.innerHTML =
        '<div class="cover-wrap">' +
          '<div class="cover-disc" role="button" aria-label="Play">' +
            coverInner +
            '<div class="cover-disc__overlay">' + ICONS.play + ICONS.pause + '</div>' +
          '</div>' +
        '</div>' +
        seekHtml(key) +
        '<div class="release-card__title">' + release.title + '</div>' +
        '<div class="release-card__row">' + waveformHtml() +
          '<div class="release-card__time">--:--</div>' +
        '</div>' +
        linksHtml(track);

      gridEl.appendChild(card);

      var coverEl = card.querySelector('.cover-disc');
      var deckEl = card.querySelector('.cover-wrap');
      var timeEl = card.querySelector('.release-card__time');
      var seekEl = card.querySelector('.seek');
      var seekPlayedEl = card.querySelector('.seek__bars--played');
      var entry = makeEntry(key, track, {
        playToggleEls: [card, coverEl, deckEl],
        cardEl: card,
        timeEl: timeEl,
        seekEl: seekEl,
        seekPlayedEl: seekPlayedEl
      });

      wireSeek(seekEl, function () { return entry; });
      coverEl.addEventListener('click', function () { toggle(entry); });
    }
  });

  audio.addEventListener('pause', clearAllPlaying);

  audio.addEventListener('loadedmetadata', function () {
    var entry = registry[audio.dataset.key];
    if (entry) entry.timeEl.textContent = formatTime(audio.currentTime) + ' / ' + formatTime(audio.duration);
    if (pendingSeekRatio != null && audio.duration) {
      audio.currentTime = pendingSeekRatio * audio.duration;
      pendingSeekRatio = null;
    }
  });

  audio.addEventListener('timeupdate', function () {
    var entry = registry[audio.dataset.key];
    if (!entry || !audio.duration) return;
    entry.timeEl.textContent = formatTime(audio.currentTime) + ' / ' + formatTime(audio.duration);
    setSeekProgress(entry, audio.currentTime / audio.duration);
  });

  audio.addEventListener('ended', function () {
    clearAllPlaying();
    var entry = registry[audio.dataset.key];
    if (entry) {
      entry.timeEl.textContent = '0:00 / ' + formatTime(audio.duration);
      setSeekProgress(entry, 0);
    }
  });
})();
