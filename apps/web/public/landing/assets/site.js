/* Acco marketing site behaviour — vanilla JS, honours reduced-motion.
   scroll-reveal · magnetic buttons · sticky nav + parallax · hero spotlight ·
   count-up stats · mobile menu · FAQ accordion · billing toggle ·
   contact-form validation · BG/EN language toggle (via i18n.js). */
(function () {
  'use strict';
  var d = document, dl = d.documentElement;
  dl.classList.add('js');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var slice = function (n) { return [].slice.call(n); };

  /* capture the Bulgarian innerHTML of rich (markup-bearing) translatable nodes
     so the language toggle can swap whole headings, not just plain text nodes */
  slice(d.querySelectorAll('[data-ten]')).forEach(function (el) { if (!el.hasAttribute('data-tbg')) el.setAttribute('data-tbg', el.innerHTML); });

  /* ---- scroll reveal ---- */
  var reveals = slice(d.querySelectorAll('[data-reveal]'));
  if (reduce || !('IntersectionObserver' in window)) {
    reveals.forEach(function (e) { e.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (en.isIntersecting) {
          var delay = parseInt(en.target.getAttribute('data-reveal-delay') || '0', 10);
          var t = en.target;
          setTimeout(function () { t.classList.add('in'); }, delay);
          io.unobserve(t);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -7% 0px' });
    reveals.forEach(function (e) { io.observe(e); });
    setTimeout(function () { reveals.forEach(function (e) { e.classList.add('in'); }); }, 4500);
  }

  /* ---- magnetic buttons ---- */
  if (!reduce) {
    slice(d.querySelectorAll('[data-magnetic]')).forEach(function (btn) {
      btn.addEventListener('mousemove', function (e) {
        var r = btn.getBoundingClientRect();
        var mx = e.clientX - r.left - r.width / 2;
        var my = e.clientY - r.top - r.height / 2;
        btn.style.transform = 'translate(' + (mx * 0.25) + 'px,' + (my * 0.4) + 'px)';
      });
      btn.addEventListener('mouseleave', function () { btn.style.transform = 'translate(0,0)'; });
    });
  }

  /* ---- sticky nav + parallax ---- */
  var nav = d.getElementById('nav');
  var parallaxEls = slice(d.querySelectorAll('[data-parallax]'));
  function onScroll() {
    var y = window.scrollY || dl.scrollTop;
    if (nav) { if (y > 24) nav.setAttribute('data-stuck', '1'); else nav.removeAttribute('data-stuck'); }
    if (!reduce) {
      var vh = window.innerHeight;
      parallaxEls.forEach(function (el) {
        var sp = parseFloat(el.getAttribute('data-parallax'));
        var r = el.getBoundingClientRect();
        var off = (r.top + r.height / 2) - vh / 2;
        el.style.transform = 'translateY(' + (off * sp).toFixed(1) + 'px)';
      });
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- hero spotlight ---- */
  var spot = d.getElementById('hero-spot');
  var heroSec = d.getElementById('hero');
  if (spot && heroSec && !reduce) {
    heroSec.addEventListener('mousemove', function (e) {
      var r = heroSec.getBoundingClientRect();
      spot.style.left = (e.clientX - r.left) + 'px';
      spot.style.top = (e.clientY - r.top) + 'px';
    });
  }

  /* ---- count-up stats ---- */
  function runCounters() {
    slice(d.querySelectorAll('[data-count]')).forEach(function (el) {
      var target = parseFloat(el.getAttribute('data-count'));
      var dec = parseInt(el.getAttribute('data-dec') || '0', 10);
      var suffix = el.getAttribute('data-suffix') || '';
      var prefix = el.getAttribute('data-prefix') || '';
      if (isNaN(target)) return;
      var fmt = function (v) { return prefix + v.toLocaleString('bg-BG', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suffix; };
      if (reduce) { el.textContent = fmt(target); return; }
      var dur = 1500, start = null;
      var tick = function (now) {
        if (!start) start = now;
        var p = Math.min((now - start) / dur, 1);
        var e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(target * e);
        if (p < 1) requestAnimationFrame(tick); else el.textContent = fmt(target);
      };
      requestAnimationFrame(tick);
    });
  }
  var statsBand = d.querySelector('[data-stats], #stats');
  if (statsBand && 'IntersectionObserver' in window && !reduce) {
    var co = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) { if (en.isIntersecting) { runCounters(); co.disconnect(); } });
    }, { threshold: 0.4 });
    co.observe(statsBand);
  } else { runCounters(); }

  /* ---- mobile menu ---- */
  var menu = d.querySelector('[data-mobile-menu]');
  var openBtn = d.querySelector('[data-nav-menu]');
  var closeBtn = d.querySelector('[data-menu-close]');
  if (openBtn && menu) openBtn.addEventListener('click', function () { menu.style.display = 'flex'; });
  if (closeBtn && menu) closeBtn.addEventListener('click', function () { menu.style.display = 'none'; });
  if (menu) slice(menu.querySelectorAll('a')).forEach(function (a) { a.addEventListener('click', function () { menu.style.display = 'none'; }); });

  /* ---- FAQ accordion ---- */
  slice(d.querySelectorAll('[data-faq]')).forEach(function (item) {
    var q = item.querySelector('[data-faq-q]'), a = item.querySelector('[data-faq-a]'), ic = item.querySelector('[data-faq-ic]');
    if (!q || !a) return;
    q.addEventListener('click', function () {
      var open = item.getAttribute('data-open') === '1';
      if (open) { a.style.maxHeight = '0px'; a.style.opacity = '0'; item.setAttribute('data-open', '0'); if (ic) ic.style.transform = 'rotate(0deg)'; }
      else { a.style.maxHeight = a.scrollHeight + 'px'; a.style.opacity = '1'; item.setAttribute('data-open', '1'); if (ic) ic.style.transform = 'rotate(45deg)'; }
    });
  });

  /* ---- billing toggle ---- */
  function setBilling(period) {
    var annual = period === 'year';
    slice(d.querySelectorAll('[data-price]')).forEach(function (el) { el.textContent = el.getAttribute(annual ? 'data-a' : 'data-m'); });
    slice(d.querySelectorAll('[data-bill]')).forEach(function (b) {
      var on = b.getAttribute('data-bill') === period;
      b.style.background = on ? '#123A33' : 'transparent';
      b.style.color = on ? '#F4EFE4' : '#5a6a63';
    });
  }
  slice(d.querySelectorAll('[data-bill]')).forEach(function (b) { b.addEventListener('click', function () { setBilling(b.getAttribute('data-bill')); }); });

  /* ---- contact form ---- */
  var form = d.querySelector('[data-contact-form]');
  if (form) {
    var consentInput = form.querySelector('[data-field="consent"]');
    var box = form.querySelector('[data-checkbox]');
    var checkIcon = form.querySelector('[data-check-icon]');
    var syncBox = function () {
      if (consentInput && consentInput.checked) { box.style.background = '#16A463'; box.style.borderColor = '#16A463'; if (checkIcon) checkIcon.style.opacity = '1'; }
      else if (box) { box.style.background = '#FCFAF5'; box.style.borderColor = '#C9BCA1'; if (checkIcon) checkIcon.style.opacity = '0'; }
    };
    if (consentInput) consentInput.addEventListener('change', syncBox);
    var setErr = function (k, msg) {
      var e = form.querySelector('[data-err="' + k + '"]'), f = form.querySelector('[data-field="' + k + '"]');
      if (e) { e.textContent = msg || ''; e.style.display = msg ? 'block' : 'none'; }
      if (f && f.type !== 'checkbox') { f.style.borderColor = msg ? '#CB2A2A' : '#DCD2BE'; }
      if (k === 'consent' && box) box.style.borderColor = msg ? '#CB2A2A' : (consentInput && consentInput.checked ? '#16A463' : '#C9BCA1');
    };
    slice(form.querySelectorAll('[data-field]')).forEach(function (f) { f.addEventListener('input', function () { setErr(f.getAttribute('data-field'), ''); }); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = function (k) { var f = form.querySelector('[data-field="' + k + '"]'); return (f && f.value || '').trim(); };
      var ok = true;
      if (!v('name')) { setErr('name', 'Моля, въведи името си.'); ok = false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email'))) { setErr('email', 'Въведи валиден имейл адрес.'); ok = false; }
      if (v('phone').replace(/[^0-9]/g, '').length < 6) { setErr('phone', 'Въведи валиден телефонен номер.'); ok = false; }
      if (!v('message')) { setErr('message', 'Кажи ни с няколко думи как да помогнем.'); ok = false; }
      if (consentInput && !consentInput.checked) { setErr('consent', 'Необходимо е съгласие, за да продължим.'); ok = false; }
      if (!ok) return;
      form.style.display = 'none';
      var s = d.querySelector('[data-contact-success]'); if (s) s.style.display = 'block';
    });
  }

  /* ---- language toggle (BG default; EN via i18n.js text-node map) ---- */
  var KEY = 'mgi-lang';
  function invert(map) { var o = {}; for (var k in map) o[map[k]] = k; return o; }
  function walk(node, map) {
    for (var i = 0; i < node.childNodes.length; i++) {
      var c = node.childNodes[i];
      if (c.nodeType === 3) { var t = c.nodeValue.trim(); if (t && map[t] !== undefined) c.nodeValue = c.nodeValue.replace(t, map[t]); }
      else if (c.nodeType === 1 && c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE' && !c.hasAttribute('data-ten')) walk(c, map);
    }
  }
  function applyLang(lang) {
    dl.setAttribute('lang', lang);
    slice(d.querySelectorAll('[data-lang]')).forEach(function (b) {
      var on = b.getAttribute('data-lang') === lang;
      b.classList.toggle('on', on);
      b.style.background = on ? '#123A33' : 'transparent';
      b.style.color = on ? '#F4EFE4' : '#7c857f';
    });
    // rich headings (markup-bearing): swap whole innerHTML
    slice(d.querySelectorAll('[data-ten]')).forEach(function (el) {
      var bg = el.getAttribute('data-tbg');
      el.innerHTML = lang === 'en' ? (el.getAttribute('data-ten') || el.innerHTML) : (bg !== null ? bg : el.innerHTML);
    });
    // plain text nodes: swap via the dictionary
    if (window.I18N) walk(d.body, lang === 'en' ? window.I18N : invert(window.I18N));
  }
  slice(d.querySelectorAll('[data-lang]')).forEach(function (b) {
    b.addEventListener('click', function () { var l = b.getAttribute('data-lang'); try { localStorage.setItem(KEY, l); } catch (e) {} applyLang(l); });
  });
  try { if (localStorage.getItem(KEY) === 'en') applyLang('en'); } catch (e) {}
})();
