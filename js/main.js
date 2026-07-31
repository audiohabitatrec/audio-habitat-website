(function () {
  var root = document.documentElement;
  var buttons = document.querySelectorAll('[data-set-lang]');

  function applyLang(lang) {
    root.setAttribute('lang', lang);
    buttons.forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-set-lang') === lang);
    });
    try { localStorage.setItem('idsmh_lang', lang); } catch (e) {}
  }

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyLang(btn.getAttribute('data-set-lang'));
    });
  });

  var saved = null;
  try { saved = localStorage.getItem('idsmh_lang'); } catch (e) {}
  var browserLang = (navigator.language || 'de').toLowerCase().indexOf('de') === 0 ? 'de' : 'en';
  applyLang(saved || browserLang);

  var year = new Date().getFullYear();
  var yDe = document.getElementById('year-de');
  var yEn = document.getElementById('year-en');
  if (yDe) yDe.textContent = year;
  if (yEn) yEn.textContent = year;
})();
