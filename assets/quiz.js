/* ═══════════════════════════════════════════════════════════════
   题库刷题引擎 · quiz.js
   数据：assets/data/quiz.js（window.QUIZ / window.QUIZ_META）
   记录：localStorage['db-quiz']
   题型：single 单选 · multi 多选 · judge 判断 · fill 填空 · short 简答
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var QUIZ = window.QUIZ || [];
var META = window.QUIZ_META || {};
var KEY = 'db-quiz';
var LETTER = 'ABCDEFGH';

/* ── 存取 ─────────────────────────────────────────────── */
function load() {
  try {
    var o = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (!o.stat) o.stat = {};
    if (!o.self) o.self = {};
    return o;
  } catch (e) { return { stat: {}, self: {} }; }
}
var store = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }

/* ── 工具 ─────────────────────────────────────────────── */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}
function fmt(s) { return esc(s).replace(/\n/g, '<br>'); }
function norm(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, '').replace(/[。；;，,、]$/g, '');
}
function isRight(q, given) {
  if (q.type === 'single') return given === q.a[0];
  if (q.type === 'multi') return given.slice().sort().join(',') === q.a.slice().sort().join(',');
  if (q.type === 'judge') return given === q.a;
  if (q.type === 'fill') {
    var g = norm(given);
    return q.a.some(function (x) { return norm(x) === g; });
  }
  return false;
}
function chapterTitle(n) { return (META[String(n)] || {}).title || ''; }
function stOf(id) { return store.stat[id] || null; }
function isWrong(id) {
  var s = stOf(id);
  return (s && s.ok === 0) || store.self[id] === 0;
}
function typeName(t) {
  return { single: '单选', multi: '多选', judge: '判断', fill: '填空', short: '简答' }[t] || t;
}
function stars(lv) { lv = lv || 1; return '★'.repeat(lv) + '☆'.repeat(Math.max(0, 3 - lv)); }

/* ── DOM ──────────────────────────────────────────────── */
var $ = function (s, r) { return (r || document).querySelector(s); };
var card = $('#qzCard'), bar = $('#qzBar'), statsEl = $('#qzStats'), chProg = $('#chProg');
var chSel = $('#chSel'), typeSel = $('#typeSel'), doneBtn = $('#doneBtn');

var state = { ch: '', type: '', mode: 'seq', pool: [], i: 0, answered: false, given: null, showRef: false };

/* ── 入口：URL 参数 ───────────────────────────────────── */
try {
  var q = new URLSearchParams(location.search);
  var chq = q.get('ch');
  if (chq && META[chq]) state.ch = String(chq);
  var tq = q.get('type');
  if (tq) state.type = tq;
} catch (e) {}

/* ── 工具栏 ───────────────────────────────────────────── */
function buildToolbar() {
  var opts = '<option value="">全部章节</option>';
  Object.keys(META).forEach(function (k) {
    var cnt = QUIZ.filter(function (x) { return String(x.ch) === k; }).length;
    opts += '<option value="' + k + '">第 ' + k + ' 章 ' + esc(META[k].title) + '（' + cnt + '）</option>';
  });
  if (chSel) { chSel.innerHTML = opts; chSel.value = state.ch; chSel.addEventListener('change', function () { state.ch = chSel.value; reset(); }); }
  if (typeSel) {
    typeSel.value = state.type;
    typeSel.addEventListener('change', function () { state.type = typeSel.value; reset(); });
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-mode]'), function (b) {
    b.setAttribute('aria-pressed', b.getAttribute('data-mode') === state.mode ? 'true' : 'false');
    b.addEventListener('click', function () {
      state.mode = b.getAttribute('data-mode');
      Array.prototype.forEach.call(document.querySelectorAll('[data-mode]'), function (x) {
        x.setAttribute('aria-pressed', x.getAttribute('data-mode') === state.mode ? 'true' : 'false');
      });
      reset();
    });
  });
  if (doneBtn) doneBtn.addEventListener('click', reset);
}

function shuffle(a) {
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function reset() {
  var arr = QUIZ.filter(function (q) {
    if (state.ch && String(q.ch) !== state.ch) return false;
    if (state.type && q.type !== state.type) return false;
    if (state.mode === 'wrong' && !isWrong(q.id)) return false;
    if (state.mode === 'undone' && stOf(q.id)) return false;
    return true;
  });
  if (state.mode === 'random') shuffle(arr);
  state.pool = arr; state.i = 0; state.answered = false; state.given = null; state.showRef = false;
  render(); renderStats();
  try {
    var u = new URL(location.href);
    if (state.ch) u.searchParams.set('ch', state.ch); else u.searchParams.delete('ch');
    if (state.type) u.searchParams.set('type', state.type); else u.searchParams.delete('type');
    history.replaceState(null, '', u);
  } catch (e) {}
}

/* ── 渲染一张题卡 ─────────────────────────────────────── */
function render() {
  if (!state.pool.length) {
    card.innerHTML = '<div class="done"><p class="big" style="font-size:26px">这一组没有题目</p>' +
      '<p>换一个范围或模式试试（「只做错题」在还没有错题时是空的）。</p>' +
      '<div class="row"><button class="btn ghost" data-reset>回到全部题目</button></div></div>';
    bindReset();
    bar.style.width = '0%';
    if (statsEl) statsEl.hidden = true;
    return;
  }
  if (state.i >= state.pool.length) return renderDone();
  if (statsEl) statsEl.hidden = false;

  var q = state.pool[state.i];
  var s = stOf(q.id);
  var head = '<div class="qmeta">' +
    '<span class="idx">第 ' + (state.i + 1) + ' / ' + state.pool.length + ' 题</span>' +
    '<span class="pill gray">第 ' + q.ch + ' 章</span>' +
    '<span class="pill">' + typeName(q.type) + '</span>' +
    (q.tag ? '<span class="pill gray">' + esc(q.tag) + '</span>' : '') +
    '<span class="stars" title="难度 ' + (q.level || 1) + '/3">' + stars(q.level) + '</span>' +
    '<span class="sp"></span>' +
    (s ? '<span class="pill ' + (s.ok ? '' : 'hot') + '">' + (s.ok ? '上次答对' : '上次答错') + '</span>' : '') +
    '</div>';

  var body = '';
  if (q.type === 'single' || q.type === 'multi') {
    body = '<div class="opts" role="group">' + q.o.map(function (t, k) {
      return '<button type="button" class="opt" data-opt="' + k + '" aria-pressed="false"><span class="k">' + LETTER[k] + '</span><span>' + fmt(t) + '</span></button>';
    }).join('') + '</div>';
    if (q.type === 'multi') body += '<div class="qfoot" style="border:0;padding-top:4px;margin-top:6px"><button class="btn" data-submit disabled>提交答案（多选）</button><span class="kbd">1–6 选择</span><span class="kbd">Enter 提交</span></div>';
  } else if (q.type === 'judge') {
    body = '<div class="opts"><button type="button" class="opt" data-opt="true"><span class="k">√</span><span>正确</span></button><button type="button" class="opt" data-opt="false"><span class="k">×</span><span>错误</span></button></div>';
  } else if (q.type === 'fill') {
    body = '<div class="fillrow"><input class="fill" id="fillIn" type="text" autocomplete="off" placeholder="填写答案后回车"><button class="btn" data-submit>提交</button></div>';
  } else if (q.type === 'short') {
    body = '<div class="fillrow"><button class="btn ghost" data-showref>显示参考答案</button><span style="font-size:13px;color:var(--muted);align-self:center">先自己说一遍，再对照评分点</span></div>';
  }

  card.innerHTML = head + '<div class="qtext">' + fmt(q.q) + '</div>' + body + '<div id="fb"></div>' +
    '<div class="qfoot"><button class="btn ghost" data-prev>‹ 上一题</button>' +
    '<button class="btn ghost" data-next>跳过 / 下一题 ›</button><span class="sp"></span>' +
    '<a href="' + (META[String(q.ch)] ? String(META[String(q.ch)].url).split('/').pop() : '../db.html') + '" style="font-size:13px">看第 ' + q.ch + ' 章讲义 ›</a></div>';

  bar.style.width = (state.i / state.pool.length * 100) + '%';
  bindCard(q);
  state.answered = false; state.given = null; state.showRef = false;
}

function bindCard(q) {
  var fb = $('#fb');

  function paintOptions() {
    Array.prototype.forEach.call(card.querySelectorAll('.opt'), function (b) {
      b.setAttribute('aria-pressed', 'false');
    });
  }

  Array.prototype.forEach.call(card.querySelectorAll('[data-opt]'), function (btn) {
    btn.addEventListener('click', function () {
      if (state.answered) return;
      var raw = btn.getAttribute('data-opt');
      if (q.type === 'multi') {
        btn.setAttribute('aria-pressed', btn.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
        var sel = Array.prototype.filter.call(card.querySelectorAll('.opt'), function (b) { return b.getAttribute('aria-pressed') === 'true'; });
        var sub = card.querySelector('[data-submit]');
        if (sub) sub.disabled = sel.length === 0;
        return;
      }
      var given = q.type === 'judge' ? (raw === 'true') : parseInt(raw, 10);
      answer(q, given);
    });
  });

  var submit = card.querySelector('[data-submit]');
  if (submit && q.type === 'multi') {
    submit.addEventListener('click', function () {
      var sel = Array.prototype.filter.call(card.querySelectorAll('.opt'), function (b) { return b.getAttribute('aria-pressed') === 'true'; })
        .map(function (b) { return parseInt(b.getAttribute('data-opt'), 10); });
      if (!sel.length) return;
      answer(q, sel);
    });
  }
  if (submit && q.type === 'fill') {
    submit.addEventListener('click', sendFill);
    var inp = $('#fillIn');
    if (inp) {
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); sendFill(); } });
      setTimeout(function () { inp.focus(); }, 30);
    }
  }
  function sendFill() {
    var inp = $('#fillIn');
    if (!inp || !inp.value.trim()) return;
    answer(q, inp.value);
  }

  var refBtn = card.querySelector('[data-showref]');
  if (refBtn) {
    refBtn.addEventListener('click', function () {
      state.showRef = true;
      fb.innerHTML = '<div class="fb"><div class="hd">参考答案</div><div class="short-a">' + fmt(q.a || '') + '</div>' +
        (q.e ? '<div class="ansline"><b>评分点</b>：' + fmt(q.e) + '</div>' : '') +
        '<div class="fillrow" style="margin-top:12px"><button class="btn ghost" data-self="1">我答对了</button><button class="btn ghost" data-self="0">没答对，进错题本</button></div></div>';
      Array.prototype.forEach.call(fb.querySelectorAll('[data-self]'), function (b) {
        b.addEventListener('click', function () {
          var ok = b.getAttribute('data-self') === '1';
          store.self[q.id] = ok ? 1 : 0;
          store.stat[q.id] = { ok: ok ? 1 : 0, tries: ((stOf(q.id) || {}).tries || 0) + 1, ts: Date.now() };
          save();
          fb.innerHTML = '<div class="fb ' + (ok ? 'ok' : 'no') + '"><div class="hd">' + (ok ? '已记录：掌握' : '已记录：需要复习') + '</div>' +
            '<div class="ansline">参考答案：' + fmt(q.a || '') + '</div>' +
            (q.e ? '<div class="ansline"><b>评分点</b>：' + fmt(q.e) + '</div>' : '') + '</div>';
          state.answered = true; renderStats();
          paintOptions();
        });
      });
    });
  }

  Array.prototype.forEach.call(card.querySelectorAll('[data-prev]'), function (b) {
    b.addEventListener('click', function () { if (state.i > 0) { state.i--; render(); } });
  });
  Array.prototype.forEach.call(card.querySelectorAll('[data-next]'), function (b) {
    b.addEventListener('click', function () { state.i++; render(); renderStats(); });
  });
  bindReset();
}

function bindReset() {
  Array.prototype.forEach.call(card.querySelectorAll('[data-reset]'), function (b) {
    b.addEventListener('click', function () {
      state.ch = ''; state.type = ''; state.mode = 'seq';
      if (chSel) chSel.value = ''; if (typeSel) typeSel.value = '';
      Array.prototype.forEach.call(document.querySelectorAll('[data-mode]'), function (x) {
        x.setAttribute('aria-pressed', x.getAttribute('data-mode') === 'seq' ? 'true' : 'false');
      });
      reset();
    });
  });
}

function answer(q, given) {
  if (state.answered) return;
  state.answered = true; state.given = given;
  var ok = isRight(q, given);
  var s = stOf(q.id) || { tries: 0 };
  store.stat[q.id] = { ok: ok ? 1 : 0, tries: (s.tries || 0) + 1, ts: Date.now() };
  save();

  // 高亮选项
  Array.prototype.forEach.call(card.querySelectorAll('.opt'), function (b) {
    var raw = b.getAttribute('data-opt');
    var v = q.type === 'judge' ? (raw === 'true') : parseInt(raw, 10);
    b.disabled = true;
    var chosen = Array.isArray(given) ? given.indexOf(v) >= 0 : given === v;
    var correct = q.type === 'judge' ? (q.a === v) : q.a.indexOf(v) >= 0;
    if (chosen && !correct) b.classList.add('no');
    if (correct) b.classList.add('ok');
  });
  var inp = $('#fillIn'); if (inp) inp.disabled = true;
  var sub = card.querySelector('[data-submit]'); if (sub) sub.disabled = true;

  var shown = Array.isArray(given) ? given.map(function (i) { return LETTER[i]; }).join('') : given;
  var fb = $('#fb');
  fb.innerHTML = '<div class="fb ' + (ok ? 'ok' : 'no') + '"><div class="hd">' + (ok ? '回答正确' : '回答错误') + '</div>' +
    (q.type === 'fill' ? '<div class="ansline">你的答案：' + esc(shown) + '　·　标准答案：<b>' + esc(q.a[0]) + '</b></div>' : '') +
    (q.e ? '<div class="ansline">解析：' + fmt(q.e) + '</div>' : '') +
    '</div>';
  renderStats();
}

function renderStats() {
  if (!statsEl) return;
  var done = 0, ok = 0, wrong = 0, total = QUIZ.length;
  QUIZ.forEach(function (q) {
    var s = stOf(q.id);
    if (s) { done++; if (s.ok) ok++; }
    if (isWrong(q.id)) wrong++;
  });
  var acc = done ? Math.round(ok / done * 100) : 0;
  statsEl.innerHTML =
    '<div class="stat"><b>' + done + '<small style="font-size:12px;color:var(--muted);font-weight:400">/' + total + '</small></b><span>已做题目</span></div>' +
    '<div class="stat ok"><b>' + acc + '%</b><span>正确率</span></div>' +
    '<div class="stat no"><b>' + wrong + '</b><span>错题本</span></div>' +
    '<div class="stat"><b>' + (state.pool.length ? (state.i + (state.answered ? 1 : 0)) + '<small style="font-size:12px;color:var(--muted);font-weight:400">/' + state.pool.length + '</small>' : '0') + '</b><span>本轮进度</span></div>';

  if (chProg) {
    var by = {};
    QUIZ.forEach(function (q) {
      var k = String(q.ch);
      by[k] = by[k] || { n: 0, d: 0, r: 0 };
      by[k].n++;
      var s = stOf(q.id);
      if (s) { by[k].d++; if (s.ok) by[k].r++; }
    });
    chProg.innerHTML = Object.keys(by).sort(function (a, b) { return a - b; }).map(function (k) {
      var o = by[k];
      return '<a href="?ch=' + k + '" data-chprog="' + k + '"><span class="nm">' + k + '</span><span class="t">' + esc(chapterTitle(k)) + '</span>' +
        '<span class="b"><i style="width:' + (o.d / o.n * 100) + '%"></i></span><span class="v">' + o.d + '/' + o.n + '　' + (o.d ? Math.round(o.r / o.d * 100) : 0) + '%</span></a>';
    }).join('');
    Array.prototype.forEach.call(chProg.querySelectorAll('[data-chprog]'), function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        state.ch = a.getAttribute('data-chprog');
        if (chSel) chSel.value = state.ch;
        reset();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }
}

function renderDone() {
  var total = state.pool.length;
  var ok = 0;
  state.pool.forEach(function (q) { var s = stOf(q.id); if (s && s.ok) ok++; });
  var acc = total ? Math.round(ok / total * 100) : 0;
  card.innerHTML = '<div class="done"><p class="big">' + acc + '%</p>' +
    '<p>本轮 ' + total + ' 题，答对 ' + ok + ' 题。' +
    (acc >= 85 ? '这一组可以过了，去开模拟卷吧。' : acc >= 60 ? '及格线以上，把错题再过一遍。' : '建议回到对应章节精读后再来。') + '</p>' +
    '<div class="row"><button class="btn" data-again>再来一轮</button>' +
    '<button class="btn ghost" data-mode2="wrong">只做本组错题</button>' +
    '<a class="btn ghost" href="exam.html">去做模拟卷 ›</a></div></div>';
  bar.style.width = '100%';
  var again = card.querySelector('[data-again]');
  if (again) again.addEventListener('click', reset);
  var w = card.querySelector('[data-mode2]');
  if (w) w.addEventListener('click', function () { state.mode = 'wrong'; reset(); });
  renderStats();
}

/* ── 键盘 ─────────────────────────────────────────────── */
document.addEventListener('keydown', function (e) {
  if (!state.pool.length || state.i >= state.pool.length) return;
  var q = state.pool[state.i];
  if (e.target && /input|textarea|select/i.test(e.target.tagName)) {
    if (e.key === 'Enter' && state.answered) { state.i++; render(); }
    return;
  }
  var n = parseInt(e.key, 10);
  if ((q.type === 'single' || q.type === 'multi') && n >= 1 && n <= q.o.length) {
    e.preventDefault();
    var btn = card.querySelectorAll('.opt')[n - 1];
    if (btn) btn.click();
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    if (!state.answered) {
      var sub = card.querySelector('[data-submit]');
      if (sub && !sub.disabled) sub.click();
    } else { state.i++; render(); renderStats(); }
  }
  if (e.key === 'ArrowRight') { state.i++; render(); }
  if (e.key === 'ArrowLeft' && state.i > 0) { state.i--; render(); }
});

/* ── 启动 ─────────────────────────────────────────────── */
if (!QUIZ.length) {
  card.innerHTML = '<p>题库数据未加载：请确认 <code>assets/data/quiz.js</code> 存在。</p>';
} else {
  buildToolbar();
  reset();
}
})();
