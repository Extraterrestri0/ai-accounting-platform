/* ============================================================================
   Счетоводство — Маркетинг сайт · Поведение / анимации
   Vanilla JS, no deps. Honors prefers-reduced-motion.
   ============================================================================ */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Don't let the browser restore a stale scroll position on reload — combined with
     smooth scrolling this could leave the page feeling "stuck". Always start at top. */
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) {}

  /* ---- Scroll progress + sticky shrink ----------------------------------- */
  var nav = document.querySelector('.nav');
  var progress = document.querySelector('.scroll-progress');
  var toTop = document.querySelector('.to-top');
  var mobileCta = document.querySelector('.mobile-cta');

  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.width = (h > 0 ? (y / h) * 100 : 0) + '%';
    if (nav) nav.classList.toggle('shrunk', y > 24);
    if (toTop) toTop.classList.toggle('show', y > 600);
    if (mobileCta) mobileCta.classList.toggle('show', y > 600);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (toTop) toTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });

  /* ---- Mobile menu ------------------------------------------------------- */
  var burger = document.querySelector('.nav-burger');
  var mmenu = document.querySelector('.mobile-menu');
  var mclose = document.querySelector('.mm-close');
  function closeMenu() { if (mmenu) { mmenu.classList.remove('open'); document.body.style.overflow = ''; } }
  if (burger) burger.addEventListener('click', function () { mmenu.classList.add('open'); document.body.style.overflow = 'hidden'; });
  if (mclose) mclose.addEventListener('click', closeMenu);
  if (mmenu) mmenu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeMenu); });

  /* ---- Scroll reveal ----------------------------------------------------- */
  /* Reveal is now a pure-CSS load animation (see .reveal in site.css). No JS is
     involved, so content is visible regardless of JS/scroll state. Nothing to do here. */

  /* ---- Counters ---------------------------------------------------------- */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var dec = parseInt(el.getAttribute('data-dec') || '0', 10);
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    if (reduce) { el.textContent = prefix + target.toLocaleString('bg-BG', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suffix; return; }
    var dur = 1600, start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = target * eased;
      el.textContent = prefix + val.toLocaleString('bg-BG', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suffix;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = prefix + target.toLocaleString('bg-BG', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suffix;
    }
    requestAnimationFrame(step);
  }
  var counters = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { animateCount(e.target); cio.unobserve(e.target); } });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { cio.observe(el); });
  } else {
    counters.forEach(animateCount);
  }

  /* ---- Pricing toggle ---------------------------------------------------- */
  var toggle = document.querySelector('.toggle-pill');
  if (toggle) {
    var btns = toggle.querySelectorAll('button');
    var thumb = toggle.querySelector('.thumb');
    function setThumb(btn) {
      thumb.style.width = btn.offsetWidth + 'px';
      thumb.style.transform = 'translateX(' + (btn.offsetLeft - 4) + 'px)';
    }
    function applyPlan(period) {
      document.querySelectorAll('[data-m]').forEach(function (el) {
        el.textContent = el.getAttribute('data-' + (period === 'year' ? 'y' : 'm'));
      });    }
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        setThumb(b);
        applyPlan(b.getAttribute('data-period'));
      });
    });
    var initial = toggle.querySelector('button.on') || btns[0];
    requestAnimationFrame(function () { setThumb(initial); });
    window.addEventListener('resize', function () { var on = toggle.querySelector('button.on'); if (on) setThumb(on); });
  }

  /* ---- Testimonials carousel --------------------------------------------- */
  var car = document.querySelector('.tcar');
  if (car) {
    var track = car.querySelector('.tcar-track');
    var slides = car.querySelectorAll('.tslide');
    var dotsWrap = car.querySelector('.tcar-dots');
    var prev = car.querySelector('.tcar-prev');
    var next = car.querySelector('.tcar-next');
    var idx = 0;
    function perView() { return window.innerWidth <= 640 ? 1 : window.innerWidth <= 980 ? 2 : 3; }
    function maxIdx() { return Math.max(0, slides.length - perView()); }
    function render() {
      idx = Math.min(idx, maxIdx());
      var slideW = slides[0].getBoundingClientRect().width + 22;
      track.style.transform = 'translateX(' + (-idx * slideW) + 'px)';
      if (dotsWrap) {
        dotsWrap.querySelectorAll('.tdot').forEach(function (d, i) { d.classList.toggle('on', i === idx); });
      }
    }
    function buildDots() {
      if (!dotsWrap) return;
      dotsWrap.innerHTML = '';
      for (var i = 0; i <= maxIdx(); i++) {
        var d = document.createElement('button');
        d.className = 'tdot' + (i === idx ? ' on' : '');
        d.setAttribute('aria-label', 'Слайд ' + (i + 1));
        (function (n) { d.addEventListener('click', function () { idx = n; render(); }); })(i);
        dotsWrap.appendChild(d);
      }
    }
    if (prev) prev.addEventListener('click', function () { idx = idx <= 0 ? maxIdx() : idx - 1; render(); });
    if (next) next.addEventListener('click', function () { idx = idx >= maxIdx() ? 0 : idx + 1; render(); });
    var resizeT;
    window.addEventListener('resize', function () { clearTimeout(resizeT); resizeT = setTimeout(function () { buildDots(); render(); }, 150); });
    buildDots(); render();
    if (!reduce) {
      var auto = setInterval(function () { idx = idx >= maxIdx() ? 0 : idx + 1; render(); }, 5500);
      car.addEventListener('mouseenter', function () { clearInterval(auto); });
    }
  }

  /* ---- Blog category filter (visual only) -------------------------------- */
  var bcats = document.querySelectorAll('.bcat');
  bcats.forEach(function (c) {
    c.addEventListener('click', function () {
      bcats.forEach(function (x) { x.classList.remove('on'); });
      c.classList.add('on');
    });
  });

  /* ---- Hero mockup staged reveal ----------------------------------------- */
  var stage = document.querySelector('.hero-stage');
  if (stage && !reduce) {
    var marks = stage.querySelectorAll('[data-stage-reveal]');
    marks.forEach(function (el, i) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      el.style.transition = 'opacity .5s var(--ease-standard), transform .5s var(--ease-standard)';
    });
    var started = false;
    function runStage() {
      if (started) return; started = true;
      marks.forEach(function (el, i) {
        setTimeout(function () { el.style.opacity = '1'; el.style.transform = 'none'; }, 500 + i * 260);
      });
    }
    if ('IntersectionObserver' in window) {
      var sio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { runStage(); sio.disconnect(); } });
      }, { threshold: 0.3 });
      sio.observe(stage);
    } else { runStage(); }
  }

  /* ---- Year ---- */
  var yr = document.querySelector('[data-year]'); if (yr) yr.textContent = new Date().getFullYear();

  /* ---- Cursor highlight (dot + trailing ring) — pointer devices only --------- */
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (finePointer && !reduce) {
    var dot = document.createElement('div'); dot.className = 'cursor-dot';
    var ring = document.createElement('div'); ring.className = 'cursor-ring';
    document.body.appendChild(dot); document.body.appendChild(ring);
    document.body.classList.add('has-cursor-fx');
    var mx = window.innerWidth / 2, my = window.innerHeight / 2, rx = mx, ry = my;
    window.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = 'translate(' + mx + 'px,' + my + 'px) translate(-50%,-50%)';
    }, { passive: true });
    (function loop() {            // ring trails the dot with easing
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px) translate(-50%,-50%)';
      requestAnimationFrame(loop);
    })();
    var hoverSel = 'a, button, summary, .bcat, .ws-item, .faq-q, input, .toggle-pill, [role="button"]';
    document.addEventListener('mouseover', function (e) { if (e.target.closest(hoverSel)) ring.classList.add('is-hover'); });
    document.addEventListener('mouseout', function (e) { if (e.target.closest(hoverSel)) ring.classList.remove('is-hover'); });
    document.addEventListener('mousedown', function () { ring.classList.add('is-down'); });
    document.addEventListener('mouseup', function () { ring.classList.remove('is-down'); });
    document.addEventListener('mouseleave', function () { dot.style.opacity = '0'; ring.style.opacity = '0'; });
    document.addEventListener('mouseenter', function () { dot.style.opacity = ''; ring.style.opacity = ''; });
  }

  /* ---- Header dropdowns: open on tap/click + keyboard (in addition to hover) -- */
  document.querySelectorAll('.has-dd').forEach(function (dd) {
    var link = dd.querySelector('.nav-link');
    if (!link) return;
    link.addEventListener('click', function (e) {
      // On touch/click, first tap opens the menu instead of jumping.
      if (window.matchMedia('(hover: none)').matches || !finePointer) {
        if (!dd.classList.contains('open')) { e.preventDefault(); }
      }
      document.querySelectorAll('.has-dd.open').forEach(function (o) { if (o !== dd) o.classList.remove('open'); });
      dd.classList.toggle('open');
    });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.has-dd')) document.querySelectorAll('.has-dd.open').forEach(function (o) { o.classList.remove('open'); });
  });
  /* Smooth-scroll for in-page anchors (covers dropdown items) + close menus. */
  document.querySelectorAll('a[href^="#"]:not([href="#"])').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href').slice(1);
      var target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      document.querySelectorAll('.has-dd.open').forEach(function (o) { o.classList.remove('open'); });
    });
  });

  /* ---- Scroll reveal · IntersectionObserver (bulletproof) ----------------- */
  /* Only enable the hide-then-reveal once we KNOW JS runs + motion is allowed.
     html.reveal-on gates the opacity:0 in CSS, so without JS content stays visible.
     A safety timeout force-reveals everything so nothing can ever get stuck hidden. */
  (function () {
    if (reduce || !('IntersectionObserver' in window)) return;
    var html = document.documentElement;
    html.classList.add('reveal-on');
    var els = [].slice.call(document.querySelectorAll('.reveal'));
    var rio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' });
    els.forEach(function (el) { rio.observe(el); });
    // Failsafe: anything still hidden after 3.5s gets SNAPPED visible (no transition).
    // Animating an off-screen element can leave a stale, unpainted layer in Chrome,
    // so we use .in-now (transition:none) rather than the animated .in here.
    setTimeout(function () {
      document.querySelectorAll('.reveal:not(.in)').forEach(function (el) { el.classList.add('in', 'in-now'); });
    }, 3500);
  })();

  /* ---- Hero parallax — float cards drift subtly with the cursor ----------- */
  (function () {
    if (reduce) return;
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!fine) return;
    var stageEl = document.querySelector('.hero-stage');
    if (!stageEl) return;
    var cards = stageEl.querySelectorAll('.float-card');
    if (!cards.length) return;
    var raf = 0;
    stageEl.addEventListener('mousemove', function (ev) {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        var r = stageEl.getBoundingClientRect();
        var dx = (ev.clientX - (r.left + r.width / 2)) / r.width;   // -0.5..0.5
        var dy = (ev.clientY - (r.top + r.height / 2)) / r.height;
        cards.forEach(function (c, i) {
          var depth = (i + 1) * 7;
          c.style.transform = 'translate(' + (dx * depth).toFixed(1) + 'px,' + (dy * depth).toFixed(1) + 'px)';
        });
      });
    });
    stageEl.addEventListener('mouseleave', function () {
      cards.forEach(function (c) { c.style.transform = ''; });
    });
  })();

  /* ---- Magnetic primary CTAs (large buttons only) ------------------------- */
  (function () {
    if (reduce) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    document.querySelectorAll('.btn-primary.btn-lg').forEach(function (btn) {
      btn.addEventListener('mousemove', function (e) {
        var r = btn.getBoundingClientRect();
        var mx = e.clientX - r.left - r.width / 2;
        var my = e.clientY - r.top - r.height / 2;
        btn.style.transform = 'translate(' + (mx * 0.18).toFixed(1) + 'px,' + (my * 0.28 - 3).toFixed(1) + 'px)';
      });
      btn.addEventListener('mouseleave', function () { btn.style.transform = ''; });
    });
  })();

  /* ---- Light/dark theme toggle ------------------------------------------------
     The initial theme is set before paint by the inline <head> script (reads
     localStorage 'mgi-theme', else the OS preference). Here we just flip + persist. */
  (function () {
    function current() { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var next = current() === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('mgi-theme', next); } catch (e) {}
      });
    });
  })();
})();
