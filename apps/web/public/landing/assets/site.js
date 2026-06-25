/* Marketing site behaviour: scroll-reveal, count-up stats, mega-menu (touch),
   language toggle (BG/EN via i18n.js). Vanilla JS, honours reduced-motion. */
(function () {
  'use strict';
  var d = document, dl = d.documentElement;
  dl.classList.add('js');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- scroll reveal ---- */
  var SEL = '.sec-head,.hcard,.svc,.bene,.ba-col,.metric,.plan,.bcard,.rcard,.quote,.logo-row';
  var els = [].slice.call(d.querySelectorAll(SEL));
  if (reduce || !('IntersectionObserver' in window)) {
    els.forEach(function (e) { e.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach(function (e) { io.observe(e); });
    setTimeout(function () { els.forEach(function (e) { e.classList.add('is-in'); }); }, 2500);
  }

  /* ---- count-up stats ---- */
  function fmt(v, dec) { return dec > 0 ? v.toFixed(dec) : Math.round(v).toLocaleString('bg-BG'); }
  function countUp(el) {
    var raw = el.getAttribute('data-count'), suffix = el.getAttribute('data-suffix') || '', dec = +(el.getAttribute('data-dec') || 0);
    var target = parseFloat(raw);
    if (isNaN(target)) { return; }
    if (reduce) { el.textContent = fmt(target, dec) + suffix; return; }
    var start = null, dur = 1200;
    function step(ts) { if (!start) start = ts; var p = Math.min((ts - start) / dur, 1); el.textContent = fmt(target * (1 - Math.pow(1 - p, 3)), dec) + suffix; if (p < 1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
  }
  var nums = [].slice.call(d.querySelectorAll('[data-count]'));
  if ('IntersectionObserver' in window && !reduce) {
    var io2 = new IntersectionObserver(function (ents) { ents.forEach(function (en) { if (en.isIntersecting) { countUp(en.target); io2.unobserve(en.target); } }); }, { threshold: 0.4 });
    nums.forEach(function (e) { io2.observe(e); });
  } else { nums.forEach(countUp); }

  /* ---- mega menu (hover = CSS; click toggle for touch) ---- */
  [].slice.call(d.querySelectorAll('.has-mega')).forEach(function (m) {
    var t = m.querySelector('.mtrig');
    if (t) t.addEventListener('click', function (e) { e.preventDefault(); m.classList.toggle('open'); });
  });
  d.addEventListener('click', function (e) {
    if (!e.target.closest('.has-mega')) [].slice.call(d.querySelectorAll('.has-mega.open')).forEach(function (m) { m.classList.remove('open'); });
  });

  /* ---- language toggle (BG default; EN via i18n.js text-node map) ---- */
  var KEY = 'mgi-lang';
  function invert(map) { var o = {}; for (var k in map) o[map[k]] = k; return o; }
  function walk(node, map) {
    for (var i = 0; i < node.childNodes.length; i++) {
      var c = node.childNodes[i];
      if (c.nodeType === 3) { var t = c.nodeValue.trim(); if (t && map[t] !== undefined) c.nodeValue = c.nodeValue.replace(t, map[t]); }
      else if (c.nodeType === 1 && c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE') walk(c, map);
    }
  }
  function applyLang(lang) {
    dl.setAttribute('lang', lang);
    [].slice.call(d.querySelectorAll('.lang button')).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-lang') === lang); });
    if (!window.I18N) return;
    if (lang === 'en') walk(d.body, window.I18N);
    else walk(d.body, invert(window.I18N));
  }
  [].slice.call(d.querySelectorAll('.lang button')).forEach(function (b) {
    b.addEventListener('click', function () { var l = b.getAttribute('data-lang'); try { localStorage.setItem(KEY, l); } catch (e) {} applyLang(l); });
  });
  try { if (localStorage.getItem(KEY) === 'en') applyLang('en'); } catch (e) {}
})();
