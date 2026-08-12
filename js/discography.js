(function () {
  var root = document.getElementById('discography');
  if (!root || typeof OTHER_LABELS === 'undefined') return;

  var ICONS = {
    note: '<svg class="note" viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3z"/></svg>',
    external: '<svg viewBox="0 0 24 24"><path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3zM5 5h6V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6h-2v6H5z"/></svg>'
  };

  var PLATTER_IMG = 'assets/covers/platter.jpg';

  function coverMarkup(cover, title) {
    return '<img class="cover-disc__platter" src="' + PLATTER_IMG + '" alt="" aria-hidden="true">' +
      (cover ? '<img class="cover-art" src="' + cover + '" alt="' + title + '">' : ICONS.note);
  }

  OTHER_LABELS.forEach(function (group) {
    var section = document.createElement('div');
    section.className = 'discog-group';

    var heading = document.createElement('h3');
    heading.className = 'discog-group__label';
    heading.textContent = group.label;
    section.appendChild(heading);

    var grid = document.createElement('div');
    grid.className = 'discog-grid';

    group.releases.forEach(function (release) {
      var a = document.createElement('a');
      a.className = 'discog-card';
      a.href = release.url;
      a.target = '_blank';
      a.rel = 'noopener';

      var coverInner = coverMarkup(release.cover, release.title);

      a.innerHTML =
        '<div class="cover-wrap discog-card__cover">' +
          '<div class="cover-disc">' +
            coverInner +
            '<div class="cover-disc__overlay">' + ICONS.external + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="discog-card__title">' + release.title + '</div>' +
        '<div class="discog-card__source">' + release.source + '</div>';

      var disc = a.querySelector('.cover-disc');
      function setOn(on) {
        disc.classList.toggle('is-playing', on);
      }
      a.addEventListener('mouseenter', function () { setOn(true); });
      a.addEventListener('mouseleave', function () { setOn(false); });
      a.addEventListener('focus', function () { setOn(true); });
      a.addEventListener('blur', function () { setOn(false); });

      grid.appendChild(a);
    });

    section.appendChild(grid);
    root.appendChild(section);
  });
})();
