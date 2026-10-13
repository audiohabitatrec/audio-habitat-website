/*
  Picks the UI language before first paint, so every page opens in the
  visitor's language instead of always German:

    1. the choice they made with the DE/EN toggle (kept in localStorage,
       so it also carries over to the release pages and back), else
    2. their browser language — German-speaking browsers get DE, everyone
       else gets EN.

  The pages' own toggle code still does the visible switching; it just
  starts from the language set here. Must be loaded synchronously in <head>.
*/
(function () {
  var KEY = 'ah-lang';
  var lang = null;
  try { lang = localStorage.getItem(KEY); } catch (e) {}

  if (lang !== 'de' && lang !== 'en') {
    var pref = (navigator.languages && navigator.languages[0]) || navigator.language || 'de';
    lang = /^de(\b|-|_)/i.test(pref) ? 'de' : 'en';
  }
  document.documentElement.lang = lang;

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-set-lang]');
    if (!btn) return;
    try { localStorage.setItem(KEY, btn.getAttribute('data-set-lang')); } catch (err) {}
  });
})();
