/* ═══════════════════════════════════════════════════════════════
   讲义页增强 · study.js
   1) 小节「已掌握」勾选（localStorage: db-mastery）
   2) 目录高亮当前小节
   3) 顶部阅读进度条
   4) 章节首页 / 总览页的进度条（读取 db-mastery）
   全部是渐进增强：没有 JS 时正文与链接照常可用。
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var KEY = 'db-mastery';
var page = (document.body && document.body.getAttribute('data-ch')) || document.documentElement.getAttribute('data-ch'); // 章号，如 "6"

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
  catch (e) { return {}; }
}
function save(o) {
  try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
  document.dispatchEvent(new CustomEvent('db:mastery', { detail: o }));
}

/* ── 1) 小节勾选 ─────────────────────────────────────── */
var note = document.querySelector('.note');
var h2s = note ? Array.prototype.slice.call(note.querySelectorAll('h2[id]')) : [];

if (page && h2s.length && !document.body.hasAttribute('data-nomastery')) {
  var store = load();
  page = String(page);
  var done = store[page] || {};
  var tocLinks = {};
  Array.prototype.forEach.call(document.querySelectorAll('.toc-list a'), function (a) {
    var m = (a.getAttribute('href') || '').match(/#(.+)$/);
    if (m) tocLinks[m[1]] = a;
  });

  function refresh() {
    var n = 0;
    h2s.forEach(function (h) {
      var ok = !!done[h.id];
      if (ok) n++;
      h.classList.toggle('is-done', ok);
      var btn = h.querySelector('.m-btn');
      if (btn) {
        btn.setAttribute('aria-pressed', ok ? 'true' : 'false');
        btn.title = ok ? '已掌握（点击取消）' : '标记为已掌握';
        btn.textContent = ok ? '✓ 已掌握' : '标记掌握';
      }
      var link = tocLinks[h.id];
      if (link) link.classList.toggle('done', ok);
    });
    var out = document.querySelector('[data-mastery-count]');
    if (out) out.textContent = n + ' / ' + h2s.length;
    var bar = document.querySelector('[data-mastery-bar]');
    if (bar) bar.style.width = (n / h2s.length * 100) + '%';
  }

  h2s.forEach(function (h) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'm-btn';
    btn.setAttribute('aria-pressed', 'false');
    btn.textContent = '标记掌握';
    btn.addEventListener('click', function () {
      if (done[h.id]) delete done[h.id]; else done[h.id] = 1;
      store[page] = done;
      save(store);
      refresh();
    });
    h.appendChild(btn);
  });
  refresh();
  document.addEventListener('db:mastery', function (e) {
    var s = e.detail || load();
    done = s[page] || {};
    refresh();
  });
}

/* 窄屏默认收起目录，省掉一整屏 */
try {
  if (window.matchMedia && window.matchMedia('(max-width:980px)').matches) {
    Array.prototype.forEach.call(document.querySelectorAll('.toc-fold'), function (d) { d.removeAttribute('open'); });
  }
} catch (e) {}

/* ── 2) 目录高亮 ─────────────────────────────────────── */
if (h2s.length && 'IntersectionObserver' in window) {
  var byId = {};
  Array.prototype.forEach.call(document.querySelectorAll('.toc-list a'), function (a) {
    var m = (a.getAttribute('href') || '').match(/#(.+)$/);
    if (m) byId[m[1]] = a;
  });
  var current = null;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var a = byId[en.target.id];
      if (!a) return;
      if (current) current.removeAttribute('aria-current');
      a.setAttribute('aria-current', 'true');
      current = a;
    });
  }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 });
  h2s.forEach(function (h) { io.observe(h); });
}

/* ── 3) 阅读进度条 ───────────────────────────────────── */
var bar3 = document.getElementById('readbar');
if (bar3) {
  var tick = function () {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    bar3.style.width = max > 0 ? (h.scrollTop / max * 100) + '%' : '0';
  };
  document.addEventListener('scroll', tick, { passive: true });
  window.addEventListener('resize', tick);
  tick();
}

/* ── 4) 总览页进度 ───────────────────────────────────── */
var cards = document.querySelectorAll('[data-prog-ch]');
if (cards.length) {
  var read = function () {
    var s = load();
    Array.prototype.forEach.call(cards, function (card) {
      var ch = card.getAttribute('data-prog-ch');
      var total = parseInt(card.getAttribute('data-prog-total') || '0', 10);
      var d = s[ch] || {};
      var n = Object.keys(d).filter(function (k) { return d[k]; }).length;
      var pct = total ? Math.min(100, Math.round(n / total * 100)) : 0;
      var fill = card.querySelector('.pbar i');
      if (fill) fill.style.width = pct + '%';
      var lbl = card.querySelector('.prog');
      if (lbl && total) lbl.textContent = n + '/' + total + ' 节';
    });
    var all = document.querySelector('[data-prog-all]');
    if (all) {
      var s2 = load(), n2 = 0, t2 = 0;
      Array.prototype.forEach.call(cards, function (card) {
        var ch = card.getAttribute('data-prog-ch');
        var total = parseInt(card.getAttribute('data-prog-total') || '0', 10);
        var d = s2[ch] || {};
        n2 += Object.keys(d).filter(function (k) { return d[k]; }).length;
        t2 += total;
      });
      all.textContent = n2 + ' / ' + t2 + ' 小节已掌握';
    }
  };
  read();
  document.addEventListener('db:mastery', read);
  window.addEventListener('storage', read);
}
})();
