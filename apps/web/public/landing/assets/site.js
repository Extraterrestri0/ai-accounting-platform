/* Acco marketing site behaviour — vanilla JS, honours reduced-motion.
   sticky nav state · mobile menu · scroll-reveal. */
(function () {
  'use strict';
  var d = document, dl = d.documentElement;
  dl.classList.add('js');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var slice = function (n) { return [].slice.call(n); };

  /* sticky nav */
  var nav = d.getElementById('nav');
  function onScroll() {
    var y = window.scrollY || dl.scrollTop;
    if (nav) { if (y > 8) nav.setAttribute('data-stuck', '1'); else nav.removeAttribute('data-stuck'); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* mobile menu */
  var burger = d.getElementById('burger'), menu = d.getElementById('mobile-menu');
  if (burger && menu) {
    var setOpen = function (open) {
      if (open) menu.setAttribute('data-open', '1'); else menu.removeAttribute('data-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      d.body.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', function () { setOpen(!menu.hasAttribute('data-open')); });
    slice(menu.querySelectorAll('a')).forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.hasAttribute('data-open')) { setOpen(false); burger.focus(); } });
    window.addEventListener('resize', function () { if (window.innerWidth > 980 && menu.hasAttribute('data-open')) setOpen(false); });
  }

  /* scroll reveal */
  var reveals = slice(d.querySelectorAll('[data-reveal]'));
  if (reduce || !('IntersectionObserver' in window)) {
    reveals.forEach(function (e) { e.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    reveals.forEach(function (e) { io.observe(e); });
    setTimeout(function () { reveals.forEach(function (e) { e.classList.add('in'); }); }, 3000);
  }
})();
