/* ═══════════════════════════════════════════════════════════════
   模拟卷引擎 · exam.js
   数据：assets/data/exam.js（window.EXAMS）
   记录：localStorage['db-exam'] = {A:{best,last,ts,minutes}}
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var EXAMS = window.EXAMS || [];
var KEY = 'db-exam';
var LETTER = 'ABCDEFGH';
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}
function fmt(s) { return esc(s).replace(/\n/g, '<br>'); }
function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, '').replace(/[。；;，,、]$/g, ''); }

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; }
}
function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }

var tabs = $('#exTabs'), stage = $('#exStage'), sheet = $('#exSheet'), timerEl = $('#exTimer'), barEl = $('#exBar'), titleEl = $('#exTitle');
var cur = null, state = null, timer = null;

/* ── 组卷：把三种客观题和大题编号成 1..N ─────────────── */
function build(paper) {
  var out = [], k = 0;
  paper.choice.forEach(function (q) { out.push({ k: k++, type: 'single', q: q, score: paper.choiceScore || 2 }); });
  paper.judge.forEach(function (q) { out.push({ k: k++, type: 'judge', q: q, score: paper.judgeScore || 1 }); });
  paper.fill.forEach(function (q) { out.push({ k: k++, type: 'fill', q: q, score: paper.fillScore || 2 }); });
  paper.big.forEach(function (q) { out.push({ k: k++, type: 'big', q: q, score: q.score || 10 }); });
  return out;
}
function totalScore(items) { return items.reduce(function (s, x) { return s + x.score; }, 0); }

/* ── 标签页 ───────────────────────────────────────────── */
function renderTabs() {
  tabs.innerHTML = EXAMS.map(function (p) {
    var rec = load()[p.id];
    return '<button class="chip" type="button" data-paper="' + p.id + '" aria-pressed="false">' +
      p.id + ' · ' + esc(p.name) + (rec && rec.best != null ? '<span class="n">最好 ' + rec.best + '</span>' : '') + '</button>';
  }).join('');
  $$('[data-paper]', tabs).forEach(function (b) {
    b.addEventListener('click', function () { openPaper(b.getAttribute('data-paper')); });
  });
}
function markTab(id) {
  $$('[data-paper]', tabs).forEach(function (b) {
    b.setAttribute('aria-pressed', b.getAttribute('data-paper') === id ? 'true' : 'false');
  });
}

/* ── 卷面介绍 ─────────────────────────────────────────── */
function openPaper(id) {
  stopTimer();
  cur = EXAMS.filter(function (p) { return p.id === id; })[0];
  if (!cur) return;
  markTab(id);
  var items = build(cur);
  var rec = load()[id] || {};
  var cCnt = cur.choice.length, jCnt = cur.judge.length, fCnt = cur.fill.length, bCnt = cur.big.length;
  var obj = cCnt * (cur.choiceScore || 2) + jCnt * (cur.judgeScore || 1) + fCnt * (cur.fillScore || 2);
  stage.innerHTML = '<div class="exam-head"><div><h2>' + cur.id + ' 卷 · ' + esc(cur.name) + '</h2>' +
    '<p class="note">' + esc(cur.note) + '</p></div></div>' +
    '<div class="exam-meta"><span>限时 ' + cur.time + ' 分钟</span><span>满分 ' + totalScore(items) + ' 分</span>' +
    '<span>客观题 ' + (cCnt + jCnt + fCnt) + ' 道 / ' + obj + ' 分</span><span>大题 ' + bCnt + ' 道 / ' + (totalScore(items) - obj) + ' 分</span>' +
    (rec.best != null ? '<span>历史最好 ' + rec.best + ' 分</span>' : '') + '</div>' +
    '<div class="result"><div class="row"><div>' +
    '<p style="font-size:14px;color:var(--muted);margin:0 0 6px">卷一 · 单项选择题　' + cCnt + ' × ' + (cur.choiceScore || 2) + ' 分</p>' +
    '<p style="font-size:14px;color:var(--muted);margin:0 0 6px">卷二 · 判断题　' + jCnt + ' × ' + (cur.judgeScore || 1) + ' 分</p>' +
    '<p style="font-size:14px;color:var(--muted);margin:0 0 6px">卷三 · 填空题　' + fCnt + ' × ' + (cur.fillScore || 2) + ' 分</p>' +
    '<p style="font-size:14px;color:var(--muted);margin:0">卷四 · 综合题　' + bCnt + ' × 10 分</p></div></div>' +
    '<p class="hint">开始后计时不会暂停；交卷后客观题自动判分，综合题对照给分点自评。建议先做一套基础卷摸清薄弱章节，再回讲义补，最后做冲刺卷。</p>' +
    '<div class="row" style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap"><button class="btn" id="startBtn">开始答题</button>' +
    '<a class="btn ghost" href="cheatsheet.html">先去速查卡 ›</a></div></div>';
  sheet.hidden = true;
  document.body.classList.add('exam-intro');
  if (barEl) barEl.hidden = true;
  $('#startBtn').addEventListener('click', function () { startPaper(cur); });
}

/* ── 开始答题 ─────────────────────────────────────────── */
function startPaper(paper) {
  cur = paper;
  var items = build(paper);
  state = { items: items, ans: {}, done: false, left: paper.time * 60, started: Date.now(), self: {} };
  sheet.hidden = false;
  document.body.classList.remove('exam-intro');
  if (barEl) barEl.hidden = false;
  if (titleEl) titleEl.textContent = paper.id + ' 卷 · ' + paper.name;
  renderSheet();
  renderExam();
  stage.scrollIntoView({ block: 'start' });
  startTimer();
}

function renderSheet() {
  var grid = state.items.map(function (x) {
    return '<a href="#q' + x.k + '" data-jump="' + x.k + '">' + (x.k + 1) + '</a>';
  }).join('');
  sheet.innerHTML = '<h4>答题卡</h4><div class="qb-grid">' + grid + '</div>' +
    '<p style="margin:0 0 10px;font-size:12px">已答 <b id="ansCount">0</b> / ' + state.items.length + '</p>' +
    '<button class="btn" id="submitBtn" style="width:100%;font-size:13px">交卷</button>' +
    '<button class="btn ghost" id="quitBtn" style="width:100%;font-size:13px;margin-top:6px">退出本卷</button>';
  $('#submitBtn').addEventListener('click', function () {
    var left = state.items.filter(function (x) { return state.ans[x.k] == null || state.ans[x.k] === ''; }).length;
    if (left && !confirm('还有 ' + left + ' 道题未作答，确定交卷？')) return;
    submit();
  });
  $('#quitBtn').addEventListener('click', function () { stopTimer(); openPaper(cur.id); });
}

function renderExam() {
  var items = state.items, html = '', sec = '', k = 0;
  var cN = cur.choice.length, jN = cur.judge.length, fN = cur.fill.length;
  items.forEach(function (x) {
    if (x.k === 0) html += '<h3 class="sec-h">一、单项选择题<span class="sc">' + cN + ' 小题 × ' + (cur.choiceScore || 2) + ' 分，共 ' + cN * (cur.choiceScore || 2) + ' 分</span></h3>';
    if (x.k === cN) html += '<h3 class="sec-h">二、判断题<span class="sc">' + jN + ' 小题 × ' + (cur.judgeScore || 1) + ' 分，共 ' + jN * (cur.judgeScore || 1) + ' 分</span></h3>';
    if (x.k === cN + jN) html += '<h3 class="sec-h">三、填空题<span class="sc">' + fN + ' 小题 × ' + (cur.fillScore || 2) + ' 分，共 ' + fN * (cur.fillScore || 2) + ' 分</span></h3>';
    if (x.k === cN + jN + fN) html += '<h3 class="sec-h">四、综合题<span class="sc">' + cur.big.length + ' 小题 × 10 分，共 ' + cur.big.length * 10 + ' 分</span></h3>';

    html += '<div class="q" id="q' + x.k + '"><p class="qt"><span class="qno">' + (x.k + 1) + '.</span>' + fmt(x.q.q) + '</p>';
    if (x.q.schema) html += '<pre>' + esc(x.q.schema) + '</pre>';
    if (x.type === 'single') {
      html += '<div class="opts">' + x.q.o.map(function (t, i) {
        return '<button type="button" class="opt" data-k="' + x.k + '" data-v="' + i + '" aria-pressed="false"><span class="k">' + LETTER[i] + '</span><span>' + fmt(t) + '</span></button>';
      }).join('') + '</div>';
    } else if (x.type === 'judge') {
      html += '<div class="opts"><button type="button" class="opt" data-k="' + x.k + '" data-v="true" aria-pressed="false"><span class="k">√</span><span>正确</span></button>' +
        '<button type="button" class="opt" data-k="' + x.k + '" data-v="false" aria-pressed="false"><span class="k">×</span><span>错误</span></button></div>';
    } else if (x.type === 'fill') {
      html += '<div class="fillrow"><input class="fill" type="text" data-k="' + x.k + '" placeholder="填写答案" autocomplete="off"></div>';
    } else {
      html += '<div class="fillrow"><textarea class="fill" rows="4" data-k="' + x.k + '" placeholder="写下要点，再对照参考答案与给分点自评" style="min-height:6em;resize:vertical"></textarea></div>';
    }
    html += '<div class="fb" id="fb' + x.k + '" hidden></div></div>';
  });
  stage.innerHTML = html;
  bindInputs();
}

function bindInputs() {
  $$('.opt[data-k]', stage).forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.getAttribute('data-k');
      var x = state.items[k];
      $$('.opt[data-k="' + k + '"]', stage).forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      var v = b.getAttribute('data-v');
      state.ans[k] = x.type === 'judge' ? (v === 'true') : parseInt(v, 10);
      tickSheet();
    });
  });
  $$('input.fill[data-k], textarea.fill[data-k]', stage).forEach(function (inp) {
    inp.addEventListener('input', function () {
      state.ans[inp.getAttribute('data-k')] = inp.value;
      tickSheet();
    });
  });
}

function tickSheet() {
  var n = 0;
  state.items.forEach(function (x) {
    var v = state.ans[x.k];
    if (v !== undefined && v !== '' && v !== null) n++;
    var a = sheet.querySelector('[data-jump="' + x.k + '"]');
    if (a) a.classList.toggle('ans', v !== undefined && v !== '' && v !== null);
  });
  var c = $('#ansCount'); if (c) c.textContent = n;
}

/* ── 计时 ─────────────────────────────────────────────── */
function startTimer() {
  stopTimer();
  tickTimer();
  timer = setInterval(function () {
    state.left--;
    tickTimer();
    if (state.left <= 0) { stopTimer(); submit(true); }
  }, 1000);
}
function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
function tickTimer() {
  if (!timerEl || !state) return;
  var s = Math.max(0, state.left), m = Math.floor(s / 60), r = s % 60;
  timerEl.textContent = (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
  timerEl.classList.toggle('warn', s <= 600);
}

/* ── 交卷与判分 ───────────────────────────────────────── */
function isRight(x, v) {
  if (v === undefined || v === null || v === '') return false;
  if (x.type === 'single') return v === x.q.a[0];
  if (x.type === 'judge') return v === x.q.a;
  if (x.type === 'fill') {
    var g = norm(v);
    return (x.q.a || []).some(function (a) { return norm(a) === g; });
  }
  return false;
}

function submit(auto) {
  if (!state || state.done) return;
  stopTimer();
  state.done = true;
  var objGet = 0, objTotal = 0, right = 0, objN = 0;
  state.items.forEach(function (x) {
    if (x.type === 'big') return;
    objN++; objTotal += x.score;
    var ok = isRight(x, state.ans[x.k]);
    if (ok) { objGet += x.score; right++; }
    // 高亮
    if (x.type === 'single' || x.type === 'judge') {
      $$('.opt[data-k="' + x.k + '"]', stage).forEach(function (b) {
        var v = b.getAttribute('data-v');
        var val = x.type === 'judge' ? (v === 'true') : parseInt(v, 10);
        var chosen = state.ans[x.k] === val;
        var correct = x.type === 'judge' ? (x.q.a === val) : (x.q.a.indexOf(val) >= 0);
        b.disabled = true;
        if (chosen && !correct) b.classList.add('no');
        if (correct) b.classList.add('ok');
      });
    }
    var fb = $('#fb' + x.k);
    if (fb) {
      fb.hidden = false;
      fb.className = 'fb ' + (ok ? 'ok' : 'no');
      fb.innerHTML = '<div class="hd">' + (ok ? '正确 +' + x.score : '错误 +0（本题 ' + x.score + ' 分）') + '</div>' +
        (x.type === 'fill' ? '<div class="ansline">你的答案：<b>' + esc(state.ans[x.k] || '（空）') + '</b>　标准答案：<b>' + esc(x.q.a[0]) + '</b></div>' : '') +
        (x.q.e ? '<div class="ansline">解析：' + fmt(x.q.e) + '</div>' : '');
    }
  });

  // 综合题：给参考答案
  $$('.q', stage).forEach(function (box) {
    var x = state.items.filter(function (y) { return 'q' + y.k === box.id; })[0];
    if (!x || x.type !== 'big') return;
    var fb = $('#fb' + x.k);
    fb.hidden = false;
    fb.innerHTML = '<div class="hd">参考答案（10 分）</div><div class="short-a">' + fmt(x.q.a || '') + '</div>' +
      (x.q.points ? '<div class="ansline"><b>给分点</b>：' + fmt(x.q.points) + '</div>' : '') +
      '<div class="selfscore"><label>自评得分 <input type="number" min="0" max="10" step="1" value="0" data-self="' + x.k + '"></label> 分（对照给分点）</div>';
  });
  $$('[data-self]', stage).forEach(function (inp) {
    inp.addEventListener('input', function () {
      var v = Math.min(10, Math.max(0, parseInt(inp.value, 10) || 0));
      state.self[inp.getAttribute('data-self')] = v;
      updateResult();
    });
  });

  state.items.forEach(function (x) {
    var a = sheet.querySelector('[data-jump="' + x.k + '"]');
    if (!a) return;
    a.classList.remove('ans');
    if (x.type === 'big') { a.classList.add(state.self[x.k] > 0 ? 'good' : 'bad'); return; }
    a.classList.add(isRight(x, state.ans[x.k]) ? 'good' : 'bad');
  });
  if (timerEl) { timerEl.textContent = '已交卷'; timerEl.classList.remove('warn'); }
  state.objGet = objGet; state.objTotal = objTotal; state.right = right; state.objN = objN;
  var used = Math.round((Date.now() - state.started) / 1000);
  var rec = load();
  var best = (rec[cur.id] && rec[cur.id].best) || 0;
  rec[cur.id] = { best: Math.max(best, objGet), last: objGet, ts: Date.now(), minutes: Math.round(used / 60) };
  save(rec);
  renderTabs(); markTab(cur.id);

  var mins = Math.floor(used / 60), secs = used % 60;
  var box = document.createElement('div');
  box.className = 'result';
  box.id = 'resultBox';
  box.innerHTML = '<div class="row"><div class="big" id="totalScore">' + objGet + '<small> / ' + totalScore(state.items) + '</small></div>' +
    '<p style="font-size:13.5px;color:var(--muted);margin:0 0 0 auto;text-align:right">用时 ' + mins + ' 分 ' + secs + ' 秒' +
    (auto ? '（到时自动交卷）' : '') + '<br>综合题请在下方逐题自评，总分会自动累加</p></div>' +
    '<div class="grid">' +
    '<div><b>' + objGet + ' / ' + objTotal + '</b>客观题得分</div>' +
    '<div><b>' + right + ' / ' + objN + '</b>客观题正确</div>' +
    '<div><b id="selfSum">0</b>综合题自评</div>' +
    '<div><b id="finalScore">' + objGet + '</b>换算后总分</div>' +
    '</div>' +
    '<p class="hint">客观题已达 ' + Math.round(objGet / objTotal * 100) + '%。若要复看解析，直接用浏览器的「打印 / 另存为 PDF」保存本页。</p>' +
    '<div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">' +
    '<button class="btn ghost" id="againBtn">再做一遍</button>' +
    '<a class="btn ghost" href="quiz.html">按错题回刷题库 ›</a>' +
    '<button class="btn ghost" id="printBtn">打印本卷</button></div>';
  stage.insertBefore(box, stage.firstChild);
  $('#againBtn').addEventListener('click', function () { startPaper(cur); });
  $('#printBtn').addEventListener('click', function () { window.print(); });
  if (!auto) box.scrollIntoView({ block: 'start' });
  document.body.classList.add('is-graded');
}

function updateResult() {
  var sum = 0;
  Object.keys(state.self).forEach(function (k) { sum += state.self[k]; });
  var s = $('#selfSum'), f = $('#finalScore');
  if (s) s.textContent = sum;
  if (f) f.textContent = state.objGet + sum;
}

/* ── 启动 ─────────────────────────────────────────────── */
if (!EXAMS.length) {
  stage.innerHTML = '<p>模拟卷数据未加载：请确认 <code>assets/data/exam.js</code> 存在。</p>';
} else {
  renderTabs();
  openPaper(EXAMS[0].id);
  try {
    var sp = new URLSearchParams(location.search);
    var qa = sp.get('paper');
    if (qa && EXAMS.some(function (p) { return p.id === qa; })) openPaper(qa);
    if (sp.get('start') === '1') {
      var b = $('#startBtn'); if (b) b.click();
    }
  } catch (e) {}
}
})();
