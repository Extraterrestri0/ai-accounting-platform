/* ============================================================================
   MGI-Delta — Admin panel (front-end prototype).
   Persists content in localStorage ('mgi.cms'). This is a demo/management UI;
   for production, replace the load/save functions with calls to the NestJS API
   and gate access behind real auth (tenant_admin role). The password check here
   is NOT security — it only hides the UI.
   ============================================================================ */
(function () {
  'use strict';
  var KEY = 'mgi.cms';
  var SESSION = 'mgi.admin.ok';
  var DEMO_PW = 'admin'; // TODO: replace with real backend auth.

  var $ = function (s) { return document.querySelector(s); };

  // ---- default seed content (mirrors the live landing) ----
  function seed() {
    return {
      hero: {
        title: 'Счетоводство, опростено. Без счетоводител.',
        sub: 'MGI-Delta автоматизира фактурите, ДДС, разходите и отчетите. AI разчита документите, а вие само одобрявате.',
        cta: 'Започнете безплатно'
      },
      posts: [
        { id: 1, title: 'ДДС за начинаещи: как да подадете първата си справка-декларация без грешки', cat: 'ДДС', read: '8 мин', img: '/landing/assets/img/blog-1.jpg', exc: 'Какво влиза в дневниците покупки и продажби и кои са най-честите грешки.' },
        { id: 2, title: 'Неизменяема главна книга: защо сторното е по-добро от изтриването', cat: 'Счетоводство', read: '5 мин', img: '/landing/assets/img/blog-2.jpg', exc: '' },
        { id: 3, title: '5 признака, че е време да автоматизирате счетоводството си', cat: 'Бизнес растеж', read: '6 мин', img: '/landing/assets/img/blog-3.jpg', exc: '' }
      ]
    };
  }
  function load() {
    try { var d = JSON.parse(localStorage.getItem(KEY)); if (d && d.posts) return d; } catch (e) {}
    return seed();
  }
  function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }

  var data = load();

  // ---- auth gate ----
  function showApp() { $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); render(); renderContent(); }
  if (sessionStorage.getItem(SESSION) === '1') showApp();
  $('#loginBtn').addEventListener('click', function () {
    if ($('#pw').value === DEMO_PW) { sessionStorage.setItem(SESSION, '1'); $('#pwerr').textContent = ''; showApp(); }
    else $('#pwerr').textContent = 'Грешна парола.';
  });
  $('#pw').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#loginBtn').click(); });
  $('#logout').addEventListener('click', function () { sessionStorage.removeItem(SESSION); location.reload(); });

  // ---- tabs ----
  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('on'); });
      t.classList.add('on');
      ['blog', 'content', 'data'].forEach(function (n) { $('#tab-' + n).classList.toggle('hidden', n !== t.dataset.tab); });
      if (t.dataset.tab === 'data') $('#json').value = JSON.stringify(data, null, 2);
    });
  });

  // ---- blog CRUD ----
  function render() {
    var list = $('#list'); list.innerHTML = '';
    $('#count').textContent = data.posts.length;
    data.posts.forEach(function (p) {
      var el = document.createElement('div'); el.className = 'post';
      el.innerHTML =
        '<img src="' + (p.img || '') + '" alt="" onerror="this.style.visibility=\'hidden\'"/>' +
        '<div class="meta"><b></b><span></span></div>' +
        '<div class="actions"><button class="btn ghost sm" data-edit>Редактирай</button>' +
        '<button class="btn danger sm" data-del>Изтрий</button></div>';
      el.querySelector('b').textContent = p.title;
      el.querySelector('span').textContent = p.cat + ' · ' + (p.read || '');
      el.querySelector('[data-edit]').addEventListener('click', function () { edit(p.id); });
      el.querySelector('[data-del]').addEventListener('click', function () {
        if (confirm('Изтриване на статията?')) { data.posts = data.posts.filter(function (x) { return x.id !== p.id; }); save(data); render(); }
      });
      list.appendChild(el);
    });
  }
  function fillForm(p) {
    $('#pid').value = p ? p.id : '';
    $('#ptitle').value = p ? p.title : '';
    $('#pcat').value = p ? p.cat : 'ДДС';
    $('#pread').value = p ? (p.read || '') : '';
    $('#pimg').value = p ? (p.img || '') : '';
    $('#pexc').value = p ? (p.exc || '') : '';
    $('#formTitle').textContent = p ? 'Редакция на статия' : 'Нова статия';
  }
  function edit(id) { fillForm(data.posts.find(function (p) { return p.id === id; })); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  $('#resetBtn').addEventListener('click', function () { fillForm(null); });
  $('#saveBtn').addEventListener('click', function () {
    var title = $('#ptitle').value.trim();
    if (!title) { alert('Въведете заглавие.'); return; }
    var id = $('#pid').value;
    var post = { title: title, cat: $('#pcat').value, read: $('#pread').value.trim(), img: $('#pimg').value.trim(), exc: $('#pexc').value.trim() };
    if (id) { var i = data.posts.findIndex(function (p) { return p.id === +id; }); post.id = +id; data.posts[i] = post; }
    else { post.id = Date.now(); data.posts.unshift(post); }
    save(data); fillForm(null); render();
  });

  // ---- content ----
  function renderContent() {
    $('#heroTitle').value = data.hero.title; $('#heroSub').value = data.hero.sub; $('#heroCta').value = data.hero.cta;
  }
  $('#saveContent').addEventListener('click', function () {
    data.hero = { title: $('#heroTitle').value, sub: $('#heroSub').value, cta: $('#heroCta').value };
    save(data); alert('Запазено локално.');
  });

  // ---- data export/import ----
  $('#exportBtn').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'mgi-cms.json'; a.click();
  });
  $('#importBtn').addEventListener('click', function () { $('#importFile').click(); });
  $('#importFile').addEventListener('change', function (e) {
    var f = e.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () { try { data = JSON.parse(r.result); save(data); render(); renderContent(); $('#json').value = JSON.stringify(data, null, 2); alert('Импортирано.'); } catch (err) { alert('Невалиден JSON.'); } };
    r.readAsText(f);
  });
})();
