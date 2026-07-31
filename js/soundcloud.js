(function () {
  var list = document.getElementById('soundcloudList');
  var pagerEl = document.getElementById('soundcloudPager');
  if (!list || typeof SOUNDCLOUD_ARCHIVE === 'undefined') return;

  var PER_PAGE = 5;
  var pages = [];
  for (var i = 0; i < SOUNDCLOUD_ARCHIVE.length; i += PER_PAGE) {
    pages.push(SOUNDCLOUD_ARCHIVE.slice(i, i + PER_PAGE));
  }

  function renderTrack(track) {
    var wrap = document.createElement('div');
    wrap.className = 'soundcloud-embed';

    var iframe = document.createElement('iframe');
    iframe.title = 'Audio Habitat – ' + track.title;
    iframe.width = '100%';
    iframe.height = '120';
    iframe.scrolling = 'no';
    iframe.frameBorder = 'no';
    iframe.loading = 'lazy';
    iframe.allow = 'autoplay';
    iframe.src = 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(track.url) +
      '&color=%23e0703f&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=false';

    wrap.appendChild(iframe);
    return wrap;
  }

  function showPage(pageIndex) {
    list.innerHTML = '';
    pages[pageIndex].forEach(function (track) {
      list.appendChild(renderTrack(track));
    });
    if (pagerEl) {
      Array.prototype.forEach.call(pagerEl.querySelectorAll('button'), function (btn, i) {
        btn.classList.toggle('is-active', i === pageIndex);
      });
    }
    list.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  if (pagerEl && pages.length > 1) {
    pages.forEach(function (_, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = String(i + 1);
      btn.addEventListener('click', function () { showPage(i); });
      pagerEl.appendChild(btn);
    });
  }

  showPage(0);
})();
