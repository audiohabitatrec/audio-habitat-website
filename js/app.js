(function () {
  var releases = (typeof RELEASES !== 'undefined') ? RELEASES : [];
  if (!releases.length) return;

  var links = (typeof ARTIST_LINKS !== 'undefined') ? ARTIST_LINKS : {};
  var paypalEmail = (typeof PAYPAL_EMAIL !== 'undefined') ? PAYPAL_EMAIL : '';
  var DEEZER_FALLBACK = 'https://www.deezer.com/search/Audio%20Habitat';

  // Form submissions (booking/label inquiries, ratings) go straight to this
  // endpoint — no mail app, no backend of our own. Site stays static.
  var FORMSPREE_ENDPOINT = 'https://formspree.io/f/mykrrpqz';
  function submitToFormspree(fields) {
    return fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(fields)
    }).then(function (res) {
      if (!res.ok) throw new Error('Formspree ' + res.status);
      return res;
    });
  }

  // ---------- i18n for the bits that are rendered from JS ----------
  var I18N = {
    de: {
      epDesc: 'Vier Tracks, ein Bogen. Das aktuelle Release von Audio Habitat — hier direkt anhören.',
      singleDesc: 'Einzel-Release von Audio Habitat — hier direkt anhören.'
    },
    en: {
      epDesc: 'Four tracks, one arc. The current release from Audio Habitat — listen right here.',
      singleDesc: 'Single release from Audio Habitat — listen right here.'
    }
  };
  function currentLang() { return document.documentElement.lang === 'en' ? 'en' : 'de'; }

  // tracks.js paths are already written relative to the site root.
  function assetPath(p) { return p; }

  var audio = document.getElementById('audio');
  var featuredTracksEl = document.getElementById('featuredTracks');
  var featuredArt = document.getElementById('featuredArt');
  var featuredKicker = document.getElementById('featuredKicker');
  var featuredTitleEl = document.getElementById('featuredTitle');
  var featuredDescEl = document.getElementById('featuredDesc');
  var featuredPlayBtn = document.getElementById('featuredPlay');
  var railEl = document.getElementById('rail');

  var playerEl = document.getElementById('player');
  var playerToggle = document.getElementById('playerToggle');
  var playerArt = document.getElementById('playerArt');
  var playerTitle = document.getElementById('playerTitle');
  var playerTime = document.getElementById('playerTime');
  var playerSeek = document.getElementById('playerSeek');
  var playerFill = document.getElementById('playerFill');
  var playerKnob = document.getElementById('playerKnob');
  var playerActions = document.getElementById('playerActions');

  var supportLink = document.getElementById('supportLink');

  function formatTime(sec) {
    if (!isFinite(sec) || isNaN(sec)) return '0:00';
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  var ICONS = {
    play: '<svg class="icon-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg class="icon-pause" viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>',
    spotify: '<svg viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.52 17.34a.75.75 0 0 1-1.03.25c-2.82-1.72-6.37-2.11-10.55-1.16a.75.75 0 1 1-.33-1.46c4.58-1.04 8.5-.59 11.66 1.34.36.22.47.68.25 1.03zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.23-1.99-8.15-2.56-11.97-1.4a.94.94 0 1 1-.55-1.8c4.36-1.32 9.78-.68 13.5 1.6.44.27.58.85.31 1.29zm.13-3.41C15.9 8.36 9.7 8.14 6.11 9.24a1.13 1.13 0 1 1-.66-2.16c4.12-1.25 11-.99 15.34 1.6a1.13 1.13 0 1 1-1.17 1.93z"/></svg>',
    apple: '<svg viewBox="0 0 24 24"><path d="M17.5 2h-11A4.5 4.5 0 0 0 2 6.5v11A4.5 4.5 0 0 0 6.5 22h11a4.5 4.5 0 0 0 4.5-4.5v-11A4.5 4.5 0 0 0 17.5 2zM16 8.02v6.53a2.1 2.1 0 0 1-1.66 2.08l-.9.2a1.6 1.6 0 1 1-.69-3.12l1.4-.3a.4.4 0 0 0 .32-.4V8.9l-4.8 1.03v6.1a2.1 2.1 0 0 1-1.66 2.08l-.9.2a1.6 1.6 0 1 1-.69-3.12l1.4-.3a.4.4 0 0 0 .32-.4V6.9a.9.9 0 0 1 .7-.88l6.6-1.42a.9.9 0 0 1 1.1.88z"/></svg>',
    soundcloud: '<svg viewBox="0 0 24 24"><path d="M9 17h9.5a3.5 3.5 0 0 0 .4-6.98 5 5 0 0 0-9.62-1.7A3.5 3.5 0 0 0 5.5 14.4 3.5 3.5 0 0 0 9 17zM3.5 12.2c.14 0 .25.1.27.24l.4 4.3-.4 4.15a.27.27 0 0 1-.54 0l-.35-4.15.35-4.3a.27.27 0 0 1 .27-.24zm2 1.05c.16 0 .28.12.3.28l.32 3.2-.32 3.14a.3.3 0 0 1-.6 0l-.28-3.14.28-3.2c.02-.16.14-.28.3-.28z"/></svg>',
    deezer: '<svg viewBox="0 0 24 24"><rect x="2" y="15" width="4" height="3" rx="0.6"/><rect x="7.3" y="11.5" width="4" height="6.5" rx="0.6"/><rect x="12.6" y="8" width="4" height="10" rx="0.6"/><rect x="17.9" y="4.5" width="4" height="13.5" rx="0.6"/></svg>',
    pwyw: '<svg viewBox="0 0 24 24"><path d="M12 21s-6.7-4.35-9.33-8.2C.9 10.1 1.4 6.6 4.2 5.1c2.2-1.2 4.6-.5 5.8 1.2 1.2-1.7 3.6-2.4 5.8-1.2 2.8 1.5 3.3 5 1.53 7.7C18.7 16.65 12 21 12 21z"/></svg>',
    stream: '<svg viewBox="0 0 24 24"><path d="M4 11a8 8 0 0 1 16 0M7 11a5 5 0 0 1 10 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="18" r="2.2"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.3 5.1 5.6.6-4.2 3.8 1.2 5.5L12 15.8l-5 2.7 1.2-5.5-4.2-3.8 5.6-.6z"/></svg>'
  };

  function platformIconsHtml(track, title, key) {
    var spotifyHref = track.spotify || links.spotify;
    var appleHref = track.apple || links.apple;
    var soundcloudHref = track.soundcloud || links.soundcloud;
    var deezerHref = track.deezer || links.deezer || DEEZER_FALLBACK;
    return (
      '<span class="track-icons">' +
        (spotifyHref ? '<a href="' + spotifyHref + '" target="_blank" rel="noopener" aria-label="Spotify" onclick="event.stopPropagation()">' + ICONS.spotify + '</a>' : '') +
        (appleHref ? '<a href="' + appleHref + '" target="_blank" rel="noopener" aria-label="Apple Music" onclick="event.stopPropagation()">' + ICONS.apple + '</a>' : '') +
        (soundcloudHref ? '<a href="' + soundcloudHref + '" target="_blank" rel="noopener" aria-label="SoundCloud" onclick="event.stopPropagation()">' + ICONS.soundcloud + '</a>' : '') +
        (deezerHref ? '<a href="' + deezerHref + '" target="_blank" rel="noopener" aria-label="Deezer" onclick="event.stopPropagation()">' + ICONS.deezer + '</a>' : '') +
        (paypalEmail ? '<a class="track-icons__support" href="#" data-support-key="' + key + '" aria-label="Zahl was du willst">' + ICONS.pwyw + '</a>' : '') +
      '</span>'
    );
  }

  // Three large, labeled buttons — used on the featured "Jetzt läuft" track
  // row instead of the small icon strip. Rail cards keep platformIconsHtml.
  function trackActionsHtml(key) {
    return (
      '<span class="track-actions">' +
        '<button class="track-action track-action--stream" type="button" data-action="stream" data-key="' + key + '">' +
          ICONS.stream + '<span data-lang="de">Streaming</span><span data-lang="en">Streaming</span>' +
        '</button>' +
        '<button class="track-action track-action--buy" type="button" data-action="buy" data-key="' + key + '">' +
          ICONS.pwyw + '<span data-lang="de">Kaufen</span><span data-lang="en">Buy</span>' +
        '</button>' +
        '<button class="track-action track-action--rate" type="button" data-action="rate" data-key="' + key + '">' +
          ICONS.star + '<span data-lang="de">Bewerten</span><span data-lang="en">Rate</span>' +
        '</button>' +
      '</span>'
    );
  }

  var registry = {}; // key -> entry
  var currentFeaturedIndex = -1;
  var activeKey = null;

  function makeKey(ri, ti) { return ri + '-' + ti; }

  function ensureEntry(ri, ti, release, track) {
    var key = makeKey(ri, ti);
    if (!registry[key]) {
      registry[key] = {
        key: key,
        file: assetPath(track.file),
        title: track.title,
        releaseTitle: release.title,
        displayTitle: release.type === 'ep' ? (release.title + ' — ' + track.title) : release.title,
        cover: assetPath(release.cover),
        releaseIndex: ri,
        railEl: null,
        featuredLi: null
      };
    }
    return registry[key];
  }

  function setActiveVisuals() {
    Object.keys(registry).forEach(function (key) {
      var entry = registry[key];
      var on = key === activeKey && !audio.paused;
      if (entry.railEl) entry.railEl.classList.toggle('is-active', on);
      if (entry.featuredLi) entry.featuredLi.classList.toggle('is-active', on);
    });
    featuredPlayBtn.classList.toggle(
      'is-playing',
      !!(activeKey && registry[activeKey] && registry[activeKey].releaseIndex === currentFeaturedIndex && !audio.paused)
    );
  }

  function setPlayerProgress(ratio) {
    ratio = Math.min(1, Math.max(0, ratio || 0));
    playerFill.style.width = (ratio * 100) + '%';
    playerKnob.style.left = (ratio * 100) + '%';
  }

  function updatePlayerBar() {
    var entry = registry[activeKey];
    if (!entry) { playerEl.hidden = true; document.body.classList.remove('has-player'); return; }
    playerEl.hidden = false;
    document.body.classList.add('has-player');
    playerArt.src = entry.cover;
    playerTitle.textContent = entry.displayTitle;
    playerTime.textContent = formatTime(audio.currentTime) + ' / ' + formatTime(audio.duration);
    playerEl.classList.toggle('is-playing', !audio.paused);
    playerActions.querySelectorAll('.player__action').forEach(function (btn) {
      btn.setAttribute('data-key', activeKey);
    });
  }

  var NEW_TAG_HTML = '<span data-lang="de">Neu</span><span data-lang="en">New</span>';

  function applyFeaturedText() {
    if (currentFeaturedIndex < 0) return;
    var release = releases[currentFeaturedIndex];
    var t = I18N[currentLang()];
    var newTag = release.isNew ? '<span class="featured__new-tag">' + NEW_TAG_HTML + '</span>' : '';
    featuredKicker.innerHTML = newTag + (release.type === 'ep' ? 'EP' : 'Single') + ' · 2026';
    featuredDescEl.textContent = release.type === 'ep' ? t.epDesc : t.singleDesc;
  }

  function renderFeatured(ri) {
    if (ri === currentFeaturedIndex) return;
    Object.keys(registry).forEach(function (key) {
      if (registry[key].releaseIndex === currentFeaturedIndex) registry[key].featuredLi = null;
    });
    currentFeaturedIndex = ri;

    var release = releases[ri];
    featuredArt.src = assetPath(release.cover);
    featuredArt.alt = release.title;
    featuredTitleEl.textContent = release.title;
    applyFeaturedText();

    featuredTracksEl.innerHTML = '';
    release.tracks.forEach(function (track, ti) {
      var entry = ensureEntry(ri, ti, release, track);
      var li = document.createElement('li');
      li.innerHTML =
        '<span class="track-num">' + (ti + 1) + '</span>' +
        '<span class="track-title">' + track.title + '</span>' +
        trackActionsHtml(entry.key) +
        '<button class="track-play" type="button" aria-label="Play">' + ICONS.play + ICONS.pause + '</button>';
      entry.featuredLi = li;
      li.addEventListener('click', function () { play(entry.key); });
      featuredTracksEl.appendChild(li);
    });

    setActiveVisuals();
  }

  function play(key) {
    var entry = registry[key];
    if (!entry) return;

    if (entry.releaseIndex !== currentFeaturedIndex) {
      renderFeatured(entry.releaseIndex);
    }

    if (activeKey === key) {
      if (audio.paused) audio.play(); else audio.pause();
    } else {
      activeKey = key;
      audio.src = entry.file;
      audio.play();
    }

    updatePlayerBar();
    setActiveVisuals();

    var featuredSection = document.getElementById('featured');
    var rect = featuredSection.getBoundingClientRect();
    if (rect.top < 0 || rect.top > 120) {
      featuredSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ---------- Build the rail: one card per release (EP + singles) ----------
  releases.forEach(function (release, ri) {
    var track0 = release.tracks[0];
    var entry = ensureEntry(ri, 0, release, track0);

    if (release.type === 'ep') {
      release.tracks.forEach(function (track, ti) { ensureEntry(ri, ti, release, track); });
    }

    var card = document.createElement('div');
    card.className = 'rail-card';
    card.innerHTML =
      '<div class="rail-card__art">' +
        '<img src="' + assetPath(release.cover) + '" alt="' + release.title + '">' +
        '<div class="rail-card__play">' + ICONS.play + ICONS.pause + '</div>' +
      '</div>' +
      '<div class="rail-card__title">' + release.title +
        (release.isNew ? ' <span class="rail-card__tag rail-card__tag--new">' + NEW_TAG_HTML + '</span>' : '') +
        (release.type === 'ep' ? ' <span class="rail-card__tag">EP</span>' : '') +
      '</div>' +
      platformIconsHtml(track0, release.title, entry.key);
    railEl.appendChild(card);

    entry.railEl = card;
    card.querySelector('.rail-card__art').addEventListener('click', function () { play(entry.key); });
    card.querySelector('.rail-card__title').addEventListener('click', function () { play(entry.key); });
  });

  // trailing spacers so the first/last rail card can align/center nicely
  var spacerStart = document.createElement('div');
  spacerStart.className = 'rail__spacer';
  var spacerEnd = spacerStart.cloneNode();
  railEl.insertBefore(spacerStart, railEl.firstChild);
  railEl.appendChild(spacerEnd);

  // ---------- Initial featured render (EP, not playing) ----------
  renderFeatured(0);

  featuredPlayBtn.addEventListener('click', function () {
    var release = releases[currentFeaturedIndex];
    var firstKey = makeKey(currentFeaturedIndex, 0);
    if (activeKey && registry[activeKey] && registry[activeKey].releaseIndex === currentFeaturedIndex) {
      play(activeKey);
    } else {
      play(firstKey);
    }
  });

  playerToggle.addEventListener('click', function () {
    if (!activeKey) return;
    play(activeKey);
  });

  // Drag-to-scrub on the mini player — pointer events cover mouse, touch
  // and pen alike, so this works the same on a phone as on desktop.
  var seekDragging = false;

  function seekRatioFromEvent(e) {
    var rect = playerSeek.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  }

  playerSeek.addEventListener('pointerdown', function (e) {
    if (!audio.duration) return;
    seekDragging = true;
    playerEl.classList.add('is-dragging');
    if (playerSeek.setPointerCapture) playerSeek.setPointerCapture(e.pointerId);
    setPlayerProgress(seekRatioFromEvent(e));
  });

  playerSeek.addEventListener('pointermove', function (e) {
    if (!seekDragging) return;
    setPlayerProgress(seekRatioFromEvent(e));
  });

  function finishSeekDrag(e) {
    if (!seekDragging) return;
    seekDragging = false;
    playerEl.classList.remove('is-dragging');
    if (audio.duration) audio.currentTime = seekRatioFromEvent(e) * audio.duration;
  }

  playerSeek.addEventListener('pointerup', finishSeekDrag);
  playerSeek.addEventListener('pointercancel', function () {
    seekDragging = false;
    playerEl.classList.remove('is-dragging');
  });

  var navLiveDot = document.getElementById('navLiveDot');
  function updateNavLiveDot() {
    if (navLiveDot) navLiveDot.classList.toggle('is-live', !audio.paused);
  }

  audio.addEventListener('play', function () { setActiveVisuals(); updatePlayerBar(); updateNavLiveDot(); });
  audio.addEventListener('pause', function () { setActiveVisuals(); updatePlayerBar(); updateNavLiveDot(); });
  audio.addEventListener('ended', function () { setActiveVisuals(); updatePlayerBar(); updateNavLiveDot(); });
  audio.addEventListener('timeupdate', function () {
    if (!audio.duration) return;
    if (!seekDragging) setPlayerProgress(audio.currentTime / audio.duration);
    playerTime.textContent = formatTime(audio.currentTime) + ' / ' + formatTime(audio.duration);
  });

  // ---------- Archive: expand in place, paginated SoundCloud embeds ----------
  var archiveToggle = document.getElementById('archiveToggle');
  var archivePanel = document.getElementById('archivePanel');
  var archiveList = document.getElementById('archiveList');
  var archivePager = document.getElementById('archivePager');
  var ARCHIVE_PER_PAGE = 6;
  var archivePages = [];
  var archiveCurrentPage = 0;

  function buildArchiveEmbed(track) {
    var wrap = document.createElement('div');
    wrap.className = 'archive-embed';
    var iframe = document.createElement('iframe');
    iframe.title = 'Audio Habitat – ' + track.title;
    iframe.width = '100%';
    iframe.height = '104';
    iframe.scrolling = 'no';
    iframe.frameBorder = 'no';
    iframe.loading = 'lazy';
    iframe.allow = 'autoplay';
    iframe.src = 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(track.url) +
      '&color=%23e0703f&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=false';
    wrap.appendChild(iframe);
    return wrap;
  }

  function showArchivePage(i) {
    archiveCurrentPage = i;
    archiveList.innerHTML = '';
    archivePages[i].forEach(function (track) { archiveList.appendChild(buildArchiveEmbed(track)); });
    archivePager.querySelectorAll('button').forEach(function (btn, idx) {
      btn.classList.toggle('is-active', idx === i);
    });
  }

  function buildArchive() {
    if (archivePages.length || typeof SOUNDCLOUD_ARCHIVE === 'undefined') return;
    for (var i = 0; i < SOUNDCLOUD_ARCHIVE.length; i += ARCHIVE_PER_PAGE) {
      archivePages.push(SOUNDCLOUD_ARCHIVE.slice(i, i + ARCHIVE_PER_PAGE));
    }
    if (archivePages.length > 1) {
      archivePages.forEach(function (_, i) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = String(i + 1);
        btn.addEventListener('click', function () { showArchivePage(i); });
        archivePager.appendChild(btn);
      });
    }
    showArchivePage(0);
  }

  function updateArchiveLabel(isOpen) {
    archiveToggle.querySelectorAll('span[data-lang]').forEach(function (span) {
      span.textContent = isOpen ? span.getAttribute('data-open') : span.getAttribute('data-closed');
    });
  }

  archiveToggle.addEventListener('click', function () {
    var isOpen = archivePanel.classList.toggle('is-open');
    archiveToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    updateArchiveLabel(isOpen);
    if (isOpen) buildArchive();
  });

  // ---------- Support modal: pick tracks → set a price each → PayPal → download ----------
  var DEFAULT_PRICE = 2;

  var supportModal = document.getElementById('supportModal');
  var supportBackdrop = document.getElementById('supportBackdrop');
  var supportClose = document.getElementById('supportClose');
  var supportStepSelect = document.getElementById('supportStepSelect');
  var supportStepDownload = document.getElementById('supportStepDownload');
  var supportListEl = document.getElementById('supportList');
  var supportTotalEl = document.getElementById('supportTotal');
  var supportProceedBtn = document.getElementById('supportProceed');
  var supportDownloadsEl = document.getElementById('supportDownloads');
  var supportWaiver = document.getElementById('supportWaiver');
  var supportWaiverCheckbox = document.getElementById('supportWaiverCheckbox');

  // Flatten every audible track once, in catalogue order.
  var allTracks = [];
  releases.forEach(function (release, ri) {
    release.tracks.forEach(function (track, ti) {
      allTracks.push({
        key: makeKey(ri, ti),
        title: release.type === 'ep' ? (release.title + ' — ' + track.title) : release.title,
        trackTitle: track.title,
        cover: assetPath(release.cover),
        file: assetPath(track.file),
        wav: track.wav ? assetPath(track.wav) : assetPath(track.file)
      });
    });
  });

  function buildSupportList() {
    supportListEl.innerHTML = '';
    allTracks.forEach(function (track, i) {
      var row = document.createElement('label');
      row.className = 'support__row';
      row.innerHTML =
        '<input type="checkbox" data-i="' + i + '">' +
        '<img src="' + track.cover + '" alt="">' +
        '<span class="support__row-main">' +
          '<span class="support__row-title">' + track.title + '</span>' +
        '</span>' +
        '<span class="support__price">' +
          '<span>€</span>' +
          '<input type="number" min="0" step="0.5" value="' + DEFAULT_PRICE + '" data-i="' + i + '">' +
        '</span>';
      supportListEl.appendChild(row);
    });
  }

  function updateSupportTotal() {
    var total = 0;
    var anyChecked = false;
    supportListEl.querySelectorAll('.support__row').forEach(function (row) {
      var checked = row.querySelector('input[type="checkbox"]').checked;
      row.classList.toggle('is-checked', checked);
      if (checked) {
        anyChecked = true;
        var price = parseFloat(row.querySelector('input[type="number"]').value) || 0;
        total += Math.max(0, price);
      }
    });
    supportTotalEl.textContent = '€' + total.toFixed(2).replace(/\.00$/, '');

    // A price > 0 makes this a purchase, not a donation — the statutory 14-day
    // right of withdrawal only lapses once the buyer explicitly waives it
    // (§ 356 Abs. 5 BGB), since the download unlocks immediately.
    var needsWaiver = total > 0;
    supportWaiver.hidden = !needsWaiver;
    supportProceedBtn.disabled = !anyChecked || (needsWaiver && !supportWaiverCheckbox.checked);

    var mode = total > 0 ? 'paid' : 'free';
    document.querySelectorAll('#supportProceed span[data-lang], #supportHint span[data-lang]').forEach(function (span) {
      span.textContent = span.getAttribute('data-' + mode);
    });

    return total;
  }

  supportListEl.addEventListener('change', updateSupportTotal);
  supportListEl.addEventListener('input', updateSupportTotal);
  supportWaiverCheckbox.addEventListener('change', updateSupportTotal);

  function openSupportModal(preselectKey) {
    buildSupportList();
    supportWaiverCheckbox.checked = false;
    if (preselectKey) {
      var idx = allTracks.findIndex(function (t) { return t.key === preselectKey; });
      if (idx > -1) {
        var checkbox = supportListEl.querySelector('input[type="checkbox"][data-i="' + idx + '"]');
        if (checkbox) checkbox.checked = true;
      }
    }
    updateSupportTotal();
    supportStepSelect.hidden = false;
    supportStepDownload.hidden = true;
    supportModal.hidden = false;
  }

  function closeSupportModal() { supportModal.hidden = true; }

  supportLink.addEventListener('click', function () { openSupportModal(); });
  supportClose.addEventListener('click', closeSupportModal);
  supportBackdrop.addEventListener('click', closeSupportModal);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !supportModal.hidden) closeSupportModal();
  });

  // Per-track "Zahl was du willst" icons open the same modal, pre-checked
  // for that track. Capture phase so it wins over the row/card's own click
  // handler (which otherwise starts playback for that track).
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.track-icons__support');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    openSupportModal(btn.getAttribute('data-support-key'));
  }, true);

  // key looks like "<releaseIndex>-<trackIndex>" (see makeKey) — both are
  // plain integers, so splitting on '-' is safe.
  function releaseAndTrackFromKey(key) {
    var parts = key.split('-');
    var release = releases[Number(parts[0])];
    var track = release ? release.tracks[Number(parts[1])] : null;
    return { release: release, track: track };
  }

  // ---------- Streaming popup: big Spotify/Apple/SoundCloud buttons up   ----------
  // top, plus a clickable "band" linking out to the release's DistroKid   ----------
  // HyperFollow page for every other platform (Tidal, Amazon Music, etc.) ----------
  var streamModal = document.getElementById('streamModal');
  var streamBackdrop = document.getElementById('streamBackdrop');
  var streamClose = document.getElementById('streamClose');
  var streamTitle = document.getElementById('streamTitle');
  var streamPrimary = document.getElementById('streamPrimary');
  var streamBand = document.getElementById('streamBand');

  function openStreamModal(key) {
    var pair = releaseAndTrackFromKey(key);
    if (!pair.release || !pair.track) return;
    var release = pair.release, track = pair.track;
    streamTitle.textContent = release.type === 'ep' ? release.title + ' — ' + track.title : release.title;

    // SoundCloud is intentionally excluded here — that's where self-
    // uploaded, non-distributed material lives (see the Archive section),
    // not an official release platform for this track.
    var spotifyHref = track.spotify || links.spotify;
    var appleHref = track.apple || links.apple;
    var primary = [];
    if (spotifyHref) primary.push('<a href="' + spotifyHref + '" target="_blank" rel="noopener">' + ICONS.spotify + '<span>Spotify</span></a>');
    if (appleHref) primary.push('<a href="' + appleHref + '" target="_blank" rel="noopener">' + ICONS.apple + '<span>Apple Music</span></a>');
    streamPrimary.innerHTML = primary.join('');

    if (release.hyperfollow) {
      streamBand.href = release.hyperfollow;
      streamBand.hidden = false;
    } else {
      streamBand.hidden = true;
    }

    streamModal.hidden = false;
  }

  function closeStreamModal() { streamModal.hidden = true; }

  streamClose.addEventListener('click', closeStreamModal);
  streamBackdrop.addEventListener('click', closeStreamModal);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !streamModal.hidden) closeStreamModal();
  });

  // ---------- Rating popup: stars + optional comment, sent by mailto —  ----------
  // no backend, mirrors the existing booking/label inquiry form pattern. ----------
  var rateModal = document.getElementById('rateModal');
  var rateBackdrop = document.getElementById('rateBackdrop');
  var rateClose = document.getElementById('rateClose');
  var rateTitle = document.getElementById('rateTitle');
  var rateStarsEl = document.getElementById('rateStars');
  var rateComment = document.getElementById('rateComment');
  var rateSubmit = document.getElementById('rateSubmit');
  var rateStepForm = document.getElementById('rateStepForm');
  var rateStepDone = document.getElementById('rateStepDone');
  var rateErrorMsg = document.getElementById('rateErrorMsg');
  var rateErrorFallbackDe = document.getElementById('rateErrorFallbackDe');
  var rateErrorFallbackEn = document.getElementById('rateErrorFallbackEn');
  var currentRateKey = null;
  var currentRateValue = 0;

  function setRateStars(val) {
    currentRateValue = val;
    rateStarsEl.querySelectorAll('.rate-star').forEach(function (star) {
      star.classList.toggle('is-active', Number(star.getAttribute('data-val')) <= val);
    });
    rateSubmit.disabled = val < 1;
  }

  rateStarsEl.querySelectorAll('.rate-star').forEach(function (star) {
    star.addEventListener('click', function () { setRateStars(Number(star.getAttribute('data-val'))); });
  });

  function openRateModal(key) {
    var pair = releaseAndTrackFromKey(key);
    if (!pair.track) return;
    currentRateKey = key;
    rateTitle.textContent = pair.track.title;
    rateComment.value = '';
    setRateStars(0);
    rateErrorMsg.hidden = true;
    rateStepForm.hidden = false;
    rateStepDone.hidden = true;
    rateModal.hidden = false;
  }

  function closeRateModal() { rateModal.hidden = true; }

  rateClose.addEventListener('click', closeRateModal);
  rateBackdrop.addEventListener('click', closeRateModal);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !rateModal.hidden) closeRateModal();
  });

  rateSubmit.addEventListener('click', function () {
    if (currentRateValue < 1) return;
    var pair = releaseAndTrackFromKey(currentRateKey);
    if (!pair.track) return;

    var stars = new Array(currentRateValue + 1).join('★') + new Array(5 - currentRateValue + 1).join('☆');
    var comment = rateComment.value.trim();
    var fields = {
      _subject: 'Bewertung: ' + pair.track.title,
      track: pair.track.title,
      rating: currentRateValue + '/5 (' + stars + ')',
      comment: comment
    };

    // Kept only as a fallback if the direct send fails — not the primary path anymore.
    var lines = ['Track: ' + pair.track.title, 'Bewertung: ' + stars + ' (' + currentRateValue + '/5)'];
    if (comment) lines.push('Kommentar: ' + comment);
    var mailtoFallback = 'mailto:' + encodeURIComponent(paypalEmail) +
      '?subject=' + encodeURIComponent('Bewertung: ' + pair.track.title) +
      '&body=' + encodeURIComponent(lines.join('\n'));

    rateErrorMsg.hidden = true;
    rateSubmit.disabled = true;
    var originalLabel = rateSubmit.innerHTML;
    rateSubmit.innerHTML = '<span data-lang="de">Sende …</span><span data-lang="en">Sending …</span>';

    submitToFormspree(fields).then(function () {
      rateStepForm.hidden = true;
      rateStepDone.hidden = false;
    }).catch(function () {
      rateErrorFallbackDe.href = mailtoFallback;
      rateErrorFallbackEn.href = mailtoFallback;
      rateErrorMsg.hidden = false;
    }).then(function () {
      rateSubmit.innerHTML = originalLabel;
      rateSubmit.disabled = currentRateValue < 1;
    });
  });

  // Routes clicks on the three Streaming/Kaufen/Bewerten buttons to their
  // popups — both the big labeled ones on the featured track row
  // (.track-action) and the compact icon-only ones on the mini player
  // (.player__action). Capture phase + stopPropagation so a click never
  // also starts/stops playback via the row's own click handler.
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.track-action, .player__action');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    var key = btn.getAttribute('data-key');
    var action = btn.getAttribute('data-action');
    if (action === 'stream') openStreamModal(key);
    else if (action === 'buy') openSupportModal(key);
    else if (action === 'rate') openRateModal(key);
  }, true);

  supportProceedBtn.addEventListener('click', function () {
    var total = updateSupportTotal();
    if (total > 0 && !supportWaiverCheckbox.checked) return;

    var selected = [];
    supportListEl.querySelectorAll('.support__row').forEach(function (row, i) {
      if (row.querySelector('input[type="checkbox"]').checked) selected.push(allTracks[i]);
    });
    if (!selected.length) return;

    // A price of €0 skips PayPal entirely — downloads unlock right away.
    if (total > 0 && paypalEmail) {
      var itemName = selected.length === 1 ? selected[0].title : selected.length + ' Tracks – Audio Habitat';
      // "return" is best-effort: it's honored by PayPal's classic Payments
      // Standard flow, which this donate link is built on, but PayPal
      // doesn't document it for the current hosted /donate/ page, so this
      // doesn't always fire. Harmless to include either way — worst case
      // PayPal just ignores it and shows its own confirmation screen.
      var url = 'https://www.paypal.com/donate/?business=' + encodeURIComponent(paypalEmail) +
        '&currency_code=EUR&no_recurring=0&amount=' + total.toFixed(2) +
        '&item_name=' + encodeURIComponent('Audio Habitat – ' + itemName) +
        '&return=' + encodeURIComponent('https://audiohabitatrec.com/');
      window.open(url, '_blank', 'noopener');
    }

    supportDownloadsEl.innerHTML = '';
    selected.forEach(function (track) {
      var a = document.createElement('a');
      a.className = 'support__download-item';
      // track.wav falls back to the M4A for the one track whose WAV master
      // is too large for a normal (non-LFS) file on GitHub Pages.
      var fileUrl = track.wav;
      var fileName = 'Audio Habitat - ' + track.trackTitle + fileUrl.slice(fileUrl.lastIndexOf('.'));
      a.href = fileUrl;
      a.download = fileName;
      var labelHtml = '<span>' + track.title + '</span>';
      a.innerHTML =
        '<img src="' + track.cover + '" alt="">' +
        '<span class="support__download-title">' + labelHtml + '</span>' +
        '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 3v12M7 10l5 5 5-5M5 20h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

      // Plain `download="..."` is unreliable on iOS Safari for larger
      // files — it silently falls back to the URL's own filename. Fetching
      // the file ourselves and saving it as a blob forces the browser to
      // use our filename instead.
      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (a.classList.contains('is-loading')) return;
        a.classList.add('is-loading');
        var titleEl = a.querySelector('.support__download-title');
        var originalLabel = titleEl.innerHTML;
        titleEl.innerHTML = '<span data-lang="de">Lädt …</span><span data-lang="en">Loading …</span>';
        fetch(fileUrl)
          .then(function (res) { return res.blob(); })
          .then(function (blob) {
            var blobUrl = URL.createObjectURL(blob);
            var tempA = document.createElement('a');
            tempA.href = blobUrl;
            tempA.download = fileName;
            document.body.appendChild(tempA);
            tempA.click();
            tempA.remove();
            setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 30000);
          })
          .catch(function () {
            // Fetch failed (offline, etc.) — fall back to a normal
            // navigation, which still downloads the file, just possibly
            // under its raw filename.
            window.location.href = fileUrl;
          })
          .finally(function () {
            a.classList.remove('is-loading');
            titleEl.innerHTML = originalLabel;
          });
      });

      supportDownloadsEl.appendChild(a);
    });

    supportStepSelect.hidden = true;
    supportStepDownload.hidden = false;
  });

  // ---------- Inquiry modals: Booking & For Labels — form stays in-page, ----------
  // ---------- submit opens the user's email app pre-filled, page never navigates. ----------
  var INQUIRY_FORMS = {
    booking: {
      subject: 'Booking-Anfrage',
      eyebrow: { de: 'Booking', en: 'Booking' },
      title: { de: 'Booking-Anfrage', en: 'Booking request' },
      desc: {
        de: 'Erzähl uns von deinem Event — wir melden uns so schnell wie möglich zurück.',
        en: "Tell us about your event — we'll get back to you as soon as possible."
      },
      fields: [
        { name: 'name', label: { de: 'Name', en: 'Name' }, type: 'text', required: true },
        { name: 'email', label: { de: 'E-Mail', en: 'Email' }, type: 'email', required: true },
        { name: 'date', label: { de: 'Datum / Ort (optional)', en: 'Date / location (optional)' }, type: 'text' },
        { name: 'message', label: { de: 'Nachricht', en: 'Message' }, type: 'textarea', required: true }
      ]
    },
    label: {
      subject: 'Label / Remix / Kollaboration',
      eyebrow: { de: 'Für Labels', en: 'For labels' },
      title: { de: 'Label-Anfrage', en: 'Label request' },
      desc: {
        de: 'Lizenzierung, Remix oder Kollaboration — sag uns, worum es geht. GEMA-Mitglied.',
        en: 'Licensing, remix or collaboration — tell us what you have in mind. GEMA member.'
      },
      fields: [
        { name: 'name', label: { de: 'Name / Label', en: 'Name / label' }, type: 'text', required: true },
        { name: 'email', label: { de: 'E-Mail', en: 'Email' }, type: 'email', required: true },
        {
          name: 'type', label: { de: 'Art der Anfrage', en: 'Request type' }, type: 'select',
          options: [
            { value: 'Lizenzierung / Release', label: { de: 'Lizenzierung / Release', en: 'Licensing / release' } },
            { value: 'Remix', label: { de: 'Remix', en: 'Remix' } },
            { value: 'Kollaboration', label: { de: 'Kollaboration', en: 'Collaboration' } }
          ]
        },
        { name: 'budget', label: { de: 'Was möchtest du zahlen? (optional)', en: "What would you like to pay? (optional)" }, type: 'text' },
        { name: 'message', label: { de: 'Nachricht', en: 'Message' }, type: 'textarea', required: true }
      ]
    }
  };

  var inquiryModal = document.getElementById('inquiryModal');
  var inquiryBackdrop = document.getElementById('inquiryBackdrop');
  var inquiryClose = document.getElementById('inquiryClose');
  var inquiryEyebrow = document.getElementById('inquiryEyebrow');
  var inquiryTitleEl = document.getElementById('inquiryTitle');
  var inquiryDescEl = document.getElementById('inquiryDesc');
  var inquiryFieldsEl = document.getElementById('inquiryFields');
  var inquiryForm = document.getElementById('inquiryForm');
  var inquiryStepForm = document.getElementById('inquiryStepForm');
  var inquiryStepDone = document.getElementById('inquiryStepDone');
  var inquirySubmit = document.getElementById('inquirySubmit');
  var inquiryErrorMsg = document.getElementById('inquiryErrorMsg');
  var inquiryErrorFallbackDe = document.getElementById('inquiryErrorFallbackDe');
  var inquiryErrorFallbackEn = document.getElementById('inquiryErrorFallbackEn');
  var currentInquiryKey = null;

  function fieldHtml(field) {
    var lang = currentLang();
    var label = '<label for="inq-' + field.name + '">' + field.label[lang] + '</label>';
    var attrs = 'id="inq-' + field.name + '" name="' + field.name + '"' + (field.required ? ' required' : '');
    var control;
    if (field.type === 'textarea') {
      control = '<textarea ' + attrs + '></textarea>';
    } else if (field.type === 'select') {
      var opts = field.options.map(function (o) {
        return '<option value="' + o.value + '">' + o.label[lang] + '</option>';
      }).join('');
      control = '<select ' + attrs + '>' + opts + '</select>';
    } else {
      control = '<input type="' + field.type + '" ' + attrs + '>';
    }
    return '<div class="inquiry-field">' + label + control + '</div>';
  }

  function renderInquiry(key) {
    var config = INQUIRY_FORMS[key];
    if (!config) return;
    var lang = currentLang();
    inquiryEyebrow.textContent = config.eyebrow[lang];
    inquiryTitleEl.textContent = config.title[lang];
    inquiryDescEl.textContent = config.desc[lang];

    // Preserve whatever the visitor already typed while re-rendering for a language switch.
    var previousValues = {};
    if (currentInquiryKey === key) {
      inquiryFieldsEl.querySelectorAll('input, select, textarea').forEach(function (el) {
        previousValues[el.name] = el.value;
      });
    }

    inquiryFieldsEl.innerHTML = config.fields.map(fieldHtml).join('');
    currentInquiryKey = key;

    Object.keys(previousValues).forEach(function (name) {
      var el = inquiryFieldsEl.querySelector('[name="' + name + '"]');
      if (el) el.value = previousValues[name];
    });
  }

  function openInquiry(key) {
    renderInquiry(key);
    inquiryErrorMsg.hidden = true;
    inquiryStepForm.hidden = false;
    inquiryStepDone.hidden = true;
    inquiryModal.hidden = false;
  }

  function closeInquiry() { inquiryModal.hidden = true; }

  document.querySelectorAll('[data-open-inquiry]').forEach(function (btn) {
    btn.addEventListener('click', function () { openInquiry(btn.getAttribute('data-open-inquiry')); });
  });

  inquiryClose.addEventListener('click', closeInquiry);
  inquiryBackdrop.addEventListener('click', closeInquiry);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !inquiryModal.hidden) closeInquiry();
  });

  // ---------- Hero easter egg: small glass manifesto card ----------
  var heroHintBtn = document.getElementById('heroHintBtn');
  var manifestoModal = document.getElementById('manifestoModal');
  var manifestoBackdrop = document.getElementById('manifestoBackdrop');
  var manifestoClose = document.getElementById('manifestoClose');

  function openManifesto() { manifestoModal.hidden = false; }
  function closeManifesto() { manifestoModal.hidden = true; }

  if (heroHintBtn && manifestoModal) {
    heroHintBtn.addEventListener('click', openManifesto);
    manifestoClose.addEventListener('click', closeManifesto);
    manifestoBackdrop.addEventListener('click', closeManifesto);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !manifestoModal.hidden) closeManifesto();
    });
  }

  inquiryForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var config = INQUIRY_FORMS[currentInquiryKey];
    if (!config) return;

    var fields = { _subject: config.subject, formType: currentInquiryKey };
    var lines = [];
    config.fields.forEach(function (field) {
      var el = inquiryFieldsEl.querySelector('[name="' + field.name + '"]');
      var value = el ? el.value.trim() : '';
      fields[field.name] = value;
      if (value) lines.push(field.label[currentLang()] + ': ' + value);
    });

    // Kept only as a fallback if the direct send fails — not the primary path anymore.
    var mailtoFallback = 'mailto:' + encodeURIComponent(paypalEmail) +
      '?subject=' + encodeURIComponent(config.subject) +
      '&body=' + encodeURIComponent(lines.join('\n'));

    inquiryErrorMsg.hidden = true;
    inquirySubmit.disabled = true;
    var originalLabel = inquirySubmit.innerHTML;
    inquirySubmit.innerHTML = '<span data-lang="de">Sende …</span><span data-lang="en">Sending …</span>';

    submitToFormspree(fields).then(function () {
      inquiryStepForm.hidden = true;
      inquiryStepDone.hidden = false;
    }).catch(function () {
      inquiryErrorFallbackDe.href = mailtoFallback;
      inquiryErrorFallbackEn.href = mailtoFallback;
      inquiryErrorMsg.hidden = false;
    }).then(function () {
      inquirySubmit.innerHTML = originalLabel;
      inquirySubmit.disabled = false;
    });
  });

  // ---------- Language toggle ----------
  var langToggle = document.getElementById('langToggle');

  function setLang(lang) {
    document.documentElement.lang = lang;
    langToggle.querySelectorAll('button').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-set-lang') === lang);
    });
    applyFeaturedText();
    updateArchiveLabel(archivePanel.classList.contains('is-open'));
    if (currentInquiryKey && !inquiryModal.hidden) renderInquiry(currentInquiryKey);
  }

  langToggle.querySelectorAll('button').forEach(function (btn) {
    btn.addEventListener('click', function () { setLang(btn.getAttribute('data-set-lang')); });
  });

  setLang(document.documentElement.lang === 'en' ? 'en' : 'de');

  // ---------- Nav: always pinned top-left, solidifies once scrolled ----------
  var nav = document.getElementById('nav');
  var scrollHint = document.getElementById('scrollHint');
  var heroSun = document.getElementById('heroSun');
  var heroBgWrap = document.getElementById('heroBgWrap');
  var heroMarkWrap = document.getElementById('heroMarkWrap');
  var heroEl = document.querySelector('.hero');
  // Scoped to heroEl on purpose: .hero__cta is reused as a generic button
  // style all over the page (contact cards, PayPal, inquiry forms), so an
  // unscoped document-wide query here was fading out and disabling every
  // button on the site once scrolled past ~60% of the hero's height.
  var heroTextEls = heroEl ? heroEl.querySelectorAll('.hero__eyebrow, .hero__line, .hero__slogan, .hero__cta') : [];
  var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    nav.classList.toggle('is-solid', y > 40);
    if (scrollHint) scrollHint.classList.toggle('is-hidden', y > 40);

    if (heroEl && !prefersReducedMotion) {
      var heroHeight = heroEl.offsetHeight;
      var progress = Math.min(1, y / heroHeight);

      // Sun drifts gently right-to-left as you scroll past the hero.
      if (heroSun) heroSun.style.transform = 'translate(-50%, -50%) translateX(' + (progress * -60) + 'px)';

      // Faint parallax + a hint of zoom: the photo lags a beat behind the
      // actual scroll and creeps in slightly, like a slow dolly-in.
      if (heroBgWrap) {
        heroBgWrap.style.transform = 'translateY(' + Math.min(48, y * 0.12) + 'px) scale(' + (1 + progress * 0.05) + ')';
      }

      // Logo shrinks a touch — stays put, just settles back a little.
      if (heroMarkWrap) heroMarkWrap.style.transform = 'scale(' + (1 - progress * 0.08) + ')';

      // Eyebrow/tagline/slogan/button dissolve well before the hero is
      // fully scrolled past, so the fade reads as intentional, not abrupt.
      var textOpacity = 1 - Math.min(1, y / (heroHeight * 0.6));
      heroTextEls.forEach(function (el) {
        el.style.opacity = String(textOpacity);
        el.style.pointerEvents = textOpacity < 0.05 ? 'none' : '';
      });
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- A few drifting dust motes over the hero photo ----------
  var heroDust = document.getElementById('heroDust');
  if (heroDust && !prefersReducedMotion) {
    var DUST_COUNT = 12;
    for (var di = 0; di < DUST_COUNT; di++) {
      var mote = document.createElement('span');
      mote.className = 'dust-mote';
      var moteSize = 2 + Math.random() * 2.5;
      mote.style.width = moteSize + 'px';
      mote.style.height = moteSize + 'px';
      mote.style.left = Math.random() * 100 + '%';
      mote.style.animationDuration = (16 + Math.random() * 12) + 's';
      mote.style.animationDelay = (Math.random() * -26) + 's';
      heroDust.appendChild(mote);
    }
  }

  // ---------- Reveal-on-scroll ----------
  // Rail cards are excluded on purpose: sliding them in while the visitor
  // may also be swiping the row horizontally read as "cards moving around"
  // rather than a static grid, especially on mobile.
  document.querySelectorAll(
    '.featured__card, .archive__card, .contact .eyebrow, .contact .section-title, .contact__text, .contact__actions'
  ).forEach(function (el) { el.classList.add('reveal'); });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
})();
