/* ============================================================================
   概念寓言机 · 引擎
   ---------------------------------------------------------------------------
   内容全部来自概念模块（concepts/*.js）。引擎负责：
     抽一组（概念 × 故事）→ 解析槽位 → 排队 → 逐条渲染 → 判题 → 揭示 → 拆解

   为手机自用做的四件事：
     1. 进度记忆   —— localStorage 记住这一则读到第几幕、哪几题答过，切出去再回来接着读
     2. 拇指操作   —— 手机上「继续」是底部固定条，不用去正文末尾找
     3. 字号三档   —— 小/中/大，记在本地
     4. 抽签历史   —— 优先抽没读过的；全读完再按最久没读的轮换

   排版标记（只作用于故事正文）：
     段落以 {hl} 开头 → 强调行；以 〔引〕 开头 → 引文行
   ========================================================================== */
(function () {
"use strict";

var CONCEPTS = (window.CONCEPTS || []).slice();
var stage = document.getElementById("stage");
var prog = document.getElementById("prog");
var kleft = document.getElementById("kleft");
var kright = document.getElementById("kright");
var foot = document.getElementById("foot");
var shuffleBtn = document.getElementById("shuffle");
var fontBtn = document.getElementById("fontbtn");
var fsLabel = document.getElementById("fslabel");
var themeBtn = document.getElementById("themebtn");
var barEl = document.getElementById("actionbar");
var barBtn = document.getElementById("actionbtn");

if (!CONCEPTS.length) {
  stage.innerHTML = '<div class="panel" style="margin-top:18vh"><h3>没有读到任何概念模块</h3>' +
    '<p>请确认 <code>concepts/</code> 下的 .js 文件已经在这个页面里用 <code>&lt;script src&gt;</code> 引入。' +
    '用 file:// 直接打开、或者用本地服务器访问都可以。</p></div>';
  return;
}

/* ------------------------------------------------------------------ 工具 */
function el(tag, cls, html) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}
function pick(v) { return Array.isArray(v) ? v[Math.floor(Math.random() * v.length)] : v; }
function fill(s, slots) {
  return String(s == null ? "" : s).replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, function (m, k) {
    return slots[k] === undefined ? m : slots[k];
  });
}
function fillNode(node, slots) {
  var walk = function (x) {
    if (x.nodeType === 3) {
      if (x.nodeValue.indexOf("{") >= 0) x.nodeValue = fill(x.nodeValue, slots);
    } else if (x.nodeType === 1 && x.tagName !== "SCRIPT" && x.tagName !== "STYLE") {
      Array.prototype.forEach.call(x.childNodes, walk);
    }
  };
  Array.prototype.forEach.call(node.childNodes, walk);
}

/* ------------------------------------------------------- 本地存储 */
var KEY = { sess: "cf:session", hist: "cf:history", font: "cf:font", theme: "cf:theme", last: "cf:last" };
var SESSION_V = 2;   // 存档格式版本：幕的切分方式变了就 +1，旧存档会被忽略
var LS = {
  get: function (k, d) {
    try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }
    catch (e) { return d; }
  },
  set: function (k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  },
  del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
};

/* ------------------------------------------------- 1 · 字号（小/中/大） */
var FS = ["0", "1", "2"], FSNAME = ["小", "中", "大"];
var fsIdx = FS.indexOf(String(LS.get(KEY.font, "1")));
if (fsIdx < 0) fsIdx = 1;
function applyFont() {
  document.documentElement.setAttribute("data-fs", FS[fsIdx]);
  if (fsLabel) fsLabel.textContent = FSNAME[fsIdx];
  if (fontBtn) fontBtn.title = "字号：" + FSNAME[fsIdx] + "（点一下换下一档）";
}
if (fontBtn) fontBtn.addEventListener("click", function () {
  fsIdx = (fsIdx + 1) % 3;
  LS.set(KEY.font, FS[fsIdx]);
  applyFont();
});
applyFont();

/* ------------------------------------------------ 2 · 日间 / 夜间配色 */
function curTheme() {
  return document.documentElement.getAttribute("data-theme") === "night" ? "night" : "day";
}
function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  if (themeBtn) {
    themeBtn.innerHTML = t === "night"
      ? '<span class="gl">☀</span><span class="lbl">日间</span>'
      : '<span class="gl">☾</span><span class="lbl">夜间</span>';
    themeBtn.title = t === "night" ? "现在是夜间，点一下切回日间" : "现在是日间，点一下切到夜间";
  }
  var m = document.querySelector('meta[name="theme-color"]');
  if (!m) { m = document.createElement("meta"); m.setAttribute("name", "theme-color"); document.head.appendChild(m); }
  m.setAttribute("content", t === "night" ? "#191715" : "#e9e4d6");
  // 套在安卓 WebView 壳里时，把状态栏/导航栏一起换掉（浏览器里没有这个对象，静默跳过）
  try { if (window.AndroidApp && AndroidApp.setTheme) AndroidApp.setTheme(t); } catch (e) {}
}
if (themeBtn) themeBtn.addEventListener("click", function () {
  var t = curTheme() === "night" ? "day" : "night";
  LS.set(KEY.theme, t);
  applyTheme(t);
});
applyTheme(curTheme());

// 没手动选过就跟着系统走
try {
  if (window.matchMedia) {
    var mq = matchMedia("(prefers-color-scheme: dark)");
    var onSys = function (ev) {
      if (LS.get(KEY.theme, null) === null) applyTheme(ev.matches ? "night" : "day");
    };
    if (mq.addEventListener) mq.addEventListener("change", onSys);
    else if (mq.addListener) mq.addListener(onSys);
  }
} catch (e) {}

/* ---------------------------------------------------- 4 · 抽签与历史 */
function hist() { return LS.get(KEY.hist, {}) || {}; }
function skey(cid, si) { return cid + "#" + si; }
function totalStories() {
  return CONCEPTS.reduce(function (a, c) { return a + (c.stories || []).length; }, 0);
}
function readCount() {
  var h = hist(), n = 0;
  Object.keys(h).forEach(function (k) { if (h[k] && h[k].done) n++; });
  return n;
}
function markSeen(cid, si) {
  var h = hist(), k = skey(cid, si);
  if (!h[k]) h[k] = { t: Date.now(), n: 0, done: false };
  h[k].t = Date.now(); h[k].n = (h[k].n || 0) + 1;
  LS.set(KEY.hist, h);
}
function markDone(cid, si) {
  var h = hist(), k = skey(cid, si);
  if (!h[k]) h[k] = { t: Date.now(), n: 1, done: false };
  h[k].done = true;
  LS.set(KEY.hist, h);
}

function roll() {
  var h = hist(), last = LS.get(KEY.last, null);
  var all = [];
  CONCEPTS.forEach(function (c) {
    (c.stories || []).forEach(function (s, i) { all.push({ cid: c.id, si: i }); });
  });
  var unread = all.filter(function (x) { return !h[skey(x.cid, x.si)]; });
  var pool = unread.length ? unread : all.slice().sort(function (a, b) {
    var ea = h[skey(a.cid, a.si)] || { t: 0 }, eb = h[skey(b.cid, b.si)] || { t: 0 };
    return ea.t - eb.t;
  });
  var cand = pool.filter(function (x) {
    return !last || x.cid !== last.cid || x.si !== last.si;
  });
  if (!cand.length) cand = pool;
  var chosen = cand[Math.floor(Math.random() * cand.length)];
  LS.set(KEY.last, chosen);
  return chosen;
}

/* ----------------------------------------------------------- 构建一组 */
var G = null;          // 当前这一组
var action = null;     // 当前可点的动作（继续/下一节/…）
var actionWrap = null; // 正文里那个按钮的容器

function build(opt) {
  var c, si, slots, i0 = 0, answers = {};
  if (opt && opt.resume) {
    c = CONCEPTS.filter(function (x) { return x.id === opt.resume.cid; })[0];
    if (!c) { opt = null; }
    else {
      si = Math.min(opt.resume.si, c.stories.length - 1);
      slots = opt.resume.slots || {};
      i0 = opt.resume.i || 0;
      answers = opt.resume.answers || {};
    }
  }
  if (!c) {
    var r = roll();
    c = CONCEPTS.filter(function (x) { return x.id === r.cid; })[0];
    si = r.si;
    slots = {};
    var st0 = c.stories[si];
    for (var k in st0.slots) slots[k] = pick(st0.slots[k]);
  }

  var story = c.stories[si];
  // 一幕 = 连续的若干个 beat，遇到分幕标题或题目就断开
  var plan = [{ kind: "cover" }];
  var scene = null;
  (story.beats || []).forEach(function (b) {
    if (!scene || b.chapter) {
      scene = { kind: "scene", beats: [], chapter: b.chapter };
      plan.push(scene);
    }
    scene.beats.push(b);
    if (b.after) {
      var q = (c.quiz || []).filter(function (x) { return x.id === b.after; })[0];
      if (q) { plan.push({ kind: "quiz", q: q }); scene = null; }
    }
  });
  plan.push({ kind: "reveal" });
  // 讲解 + 对照表合成一篇，一次给出，读者自己往下滚
  plan.push({ kind: "article", panels: (c.panels || []).slice(), table: !!c.table });
  plan.push({ kind: "finish" });

  G = {
    c: c, si: si, story: story, slots: slots, plan: plan,
    i: Math.min(i0, plan.length - 1),
    answers: answers,
    quizTotal: 0,
    quizFirst: 0,
    instant: false
  };
  Object.keys(answers).forEach(function (qid) {
    if (answers[qid] && answers[qid].done) {
      G.quizTotal++;
      if (answers[qid].first) G.quizFirst++;
    }
  });
  markSeen(c.id, si);
  return G;
}

function saveSession() {
  if (!G) return;
  // 记「当前正在看的是哪一条」：next() 里已经 ++ 过，所以减一
  var at = G.i - 1;
  if (at <= 0) return;                 // 还在封面，不必记
  LS.set(KEY.sess, {
    v: SESSION_V, cid: G.c.id, si: G.si, slots: G.slots, i: at, answers: G.answers
  });
}

/* -------------------------------------------------------------- 动作条 */
function syncBar() {
  if (!barEl) return;
  if (action) { barEl.classList.add("on"); if (barBtn) barBtn.innerHTML = '<span>' + action.label + '</span><span class="arw">→</span>'; }
  else barEl.classList.remove("on");
}
function placeAction(container, label, fn) {
  clearAction(true);
  action = { label: label, fn: fn };
  if (container) {
    actionWrap = el("div", "actwrap");
    var b = el("button", "go inline-go", '<span>' + label + '</span><span class="arw">→</span>');
    b.type = "button";
    b.addEventListener("click", fireAction);
    actionWrap.appendChild(b);
    container.appendChild(actionWrap);
  }
  syncBar();
}
function clearAction(silent) {
  if (actionWrap && actionWrap.parentNode) actionWrap.parentNode.removeChild(actionWrap);
  actionWrap = null; action = null;
  if (!silent) syncBar();
}
function fireAction() {
  if (!action) return;
  var fn = action.fn;
  clearAction();
  fn();
}
if (barBtn) barBtn.addEventListener("click", fireAction);

/* ---------------------------------------------------------------- 渲染 */
function mount(node, scroll, instant) {
  node.classList.add("beat");
  stage.appendChild(node);
  if (instant) {
    node.classList.add("in");
    node.style.transition = "none";
    return node;
  }
  requestAnimationFrame(function () { requestAnimationFrame(function () { node.classList.add("in"); }); });
  if (scroll !== false) setTimeout(function () {
    var top = node.getBoundingClientRect().top + window.pageYOffset - 150;
    window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
  }, 60);
  return node;
}
function setProgress() {
  var n = Math.min(G.i, G.plan.length);
  prog.style.width = (n / G.plan.length * 100).toFixed(1) + "%";
  var cnt = document.querySelector("#bar .cnt");
  if (cnt) cnt.innerHTML = "<b>" + n + "</b> / " + G.plan.length;
}
function setChapter(t) { kleft.textContent = t; }

/* 安卓返回键 / 浏览器后退：回到上一幕，而不是退出 */
function pushHistory(at) {
  if (at > 0) { try { history.pushState({ cf: at }, ""); } catch (e) {} }
}
function jumpTo(at) {
  if (!G) return;
  start({ resume: { cid: G.c.id, si: G.si, slots: G.slots, i: at, answers: G.answers } });
}
window.addEventListener("popstate", function (ev) {
  if (!G) return;
  var st = ev.state, at = (st && typeof st.cf === "number") ? st.cf : 0;
  if (at < G.i) jumpTo(at);
});

function next() {
  if (!G || G.i >= G.plan.length) return;
  var item = G.plan[G.i++];
  setProgress();
  saveSession();
  pushHistory(G.i - 1);
  render(item);
}

function renderLedger(items, slots) {
  var box = el("div", "ledger"), titled = false;
  items.forEach(function (it) {
    if (it.t && !titled) { box.appendChild(el("div", "t", fill(it.t, slots))); titled = true; }
    if (it.r) box.appendChild(el("div", "r", fill(it.r, slots)));
  });
  return box;
}

function renderScene(item) {
  var slots = G.slots;
  var box = el("div", "story scene");
  if (item.chapter) {
    setChapter("《" + G.story.title + "》 · " + fill(item.chapter, slots));
    box.appendChild(el("div", "scenetag", fill(item.chapter, slots)));
  }
  item.beats.forEach(function (b) {
    (b.p || []).forEach(function (raw) {
      var txt = String(raw), cls = "";
      if (txt.indexOf("{hl}") === 0) { cls = "hl-line"; txt = txt.slice(4); }
      else if (txt.indexOf("〔引〕") === 0) { cls = "quote-line"; txt = txt.slice(3); }
      box.appendChild(el("p", cls, fill(txt, slots)));
    });
    if (b.ledger) box.appendChild(renderLedger(b.ledger, slots));
  });
  mount(box, true, G.instant);
  if (!G.instant) placeAction(box, "继续读", next);
}

function renderCover() {
  var c = G.c, story = G.story;
  var n = el("div", "cover");
  n.appendChild(el("div", "ghost", String(story.title).slice(0, 1)));
  n.appendChild(el("h1", null, story.title));
  n.appendChild(el("p", "sub",
    fill(c.blurb || "", G.slots) +
    '<br>它一直在讲某个概念，但不会一开始就告诉你。中途有 <b>' + (c.quiz || []).length + '</b> 处停顿，每处一道题。' +
    '<br><span class="stamp">猜错了也没关系——猜错的地方，正是这个概念最常骗过人的地方。</span>'));
  var meta = el("p", "sub meta");
  meta.innerHTML = '已读 <b>' + readCount() + '</b> / ' + totalStories() + ' 则 · 收录 ' +
    CONCEPTS.length + ' 个概念 · 抽签会优先给没读过的' +
    '<br>右上角可以换一则、也可以调字号；读到一半退出，下次回来接着读';
  n.appendChild(meta);
  mount(n, false, G.instant);
  if (!G.instant) placeAction(n, "开始读", next);
  if (!G.instant) window.scrollTo({ top: 0 });
}

function renderQuiz(item) {
  var q = item.q, slots = G.slots;
  var saved = G.answers[q.id];
  var n = el("div", "quiz");
  n.appendChild(el("div", "qtag", fill(q.qtag || "停顿", slots)));
  if (q.intro) n.appendChild(el("div", "fb", fill(q.intro, slots)));
  n.appendChild(el("div", "qtext", fill(q.q, slots)));
  var box = el("div", "opts"), fbBox = el("div"), solved = false;

  q.options.forEach(function (o) {
    var btn = el("button", "opt", '<span class="key">' + o.key + '</span><span>' + fill(o.text, slots) + '</span>');
    btn.type = "button";

    // —— 上次已经答对的题：静态呈现当时的结果，不重答
    if (saved && saved.done) {
      btn.disabled = true;
      if (o.ok) {
        btn.classList.add("ok");
        solved = true;
        fbBox.innerHTML = "";
        fbBox.appendChild(el("div", "fb ok", "<b>这道题上次答对了。</b>" + fill(o.why, slots)));
      } else if (saved.wrong && saved.wrong.indexOf(o.key) >= 0) {
        btn.classList.add("no");
      }
      box.appendChild(btn);
      return;
    }
    // —— 这道题上次没答完：点错的划掉；回放时整体只作展示，
    //    但如果它就是当前这一条，剩下的选项保持可点，接着答
    if (saved && !saved.done) {
      var wasWrong = saved.wrong && saved.wrong.indexOf(o.key) >= 0;
      if (wasWrong) btn.classList.add("no");
      if (wasWrong || G.instant) {
        btn.disabled = true;
        box.appendChild(btn);
        return;
      }
    }

    btn.addEventListener("click", function () {
      if (solved || btn.disabled) return;
      if (o.ok) {
        solved = true;
        btn.classList.add("ok");
        Array.prototype.forEach.call(box.querySelectorAll(".opt"), function (x) { if (x !== btn) x.disabled = true; });
        fbBox.innerHTML = "";
        fbBox.appendChild(el("div", "fb ok", "<b>答对了。</b>" + fill(o.why, slots)));
        var rec = G.answers[q.id] || { wrong: [], first: true };
        rec.first = !rec.wrong.length;
        rec.done = true;
        G.answers[q.id] = rec;
        saveSession();
        placeAction(n, "带着这个继续读", next);
        setTimeout(function () {
          var top = fbBox.getBoundingClientRect().top + window.pageYOffset - 200;
          window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
        }, 80);
      } else {
        btn.classList.add("no");
        btn.disabled = true;
        var rec = G.answers[q.id] || { wrong: [], first: true };
        if (rec.wrong.indexOf(o.key) < 0) rec.wrong.push(o.key);
        rec.first = false;
        G.answers[q.id] = rec;
        saveSession();
        fbBox.innerHTML = "";
        fbBox.appendChild(el("div", "fb no", "<b>再想想。</b>" + fill(o.why, slots)));
      }
    });
    box.appendChild(btn);
  });

  n.appendChild(box);
  n.appendChild(fbBox);
  // 上次就答对的题：这次不用再答，直接给「继续」
  if (solved && !G.instant && !action) placeAction(n, "带着这个继续读", next);
  mount(n, true, G.instant);
}

function renderReveal() {
  var c = G.c, sub = G.story;
  var n = el("div", "reveal");
  n.appendChild(el("div", "pre", fill(c.reveal.pre || "所以，这个故事讲的是", G.slots)));
  n.appendChild(el("h2", "name", c.name));
  var chips = el("div", "chips");
  chips.appendChild(el("span", "chip", c.field));
  chips.appendChild(el("span", "chip", c.level));
  if (c.en) chips.appendChild(el("span", "chip en", c.en));
  chips.appendChild(el("span", "chip ghostchip", "《" + sub.title + "》"));
  n.appendChild(chips);
  n.appendChild(el("div", "quote", fill(c.reveal.quote || "", G.slots)));
  mount(n, true, G.instant);
  if (!G.instant) placeAction(n, "拆开看", next);
}

function panelNode(p) {
  var n = el("div", "panel");
  n.appendChild(el("h2", null, p.tag || "讲解"));
  n.appendChild(el("h3", null, p.h3));
  if (p.kind === "rig") {
    var intro = el("p", "intro");
    intro.innerHTML = fill(p.intro || "", G.slots);
    n.appendChild(intro);
    buildRig(n, { good: G.slots.goodAct || "夸", bad: G.slots.badAct || "骂" });
  } else {
    n.appendChild(el("div", null, (p.html || []).join("")));
    fillNode(n, G.slots);
  }
  return n;
}

function tableNode() {
  var c = G.c;
  var n = el("div", "panel");
  n.appendChild(el("h2", null, "对照表"));
  n.appendChild(el("h3", null, c.tableTitle || "故事里的每一个东西，分别对应什么"));
  var tw = el("div", "tw"), t = el("table");
  t.innerHTML = "<thead><tr><th>故事里的东西</th><th>对应的概念</th></tr></thead><tbody>" +
    (c.table || []).map(function (r) {
      return "<tr><td>" + fill(r[0], G.slots) + "</td><td>" + fill(r[1], G.slots) + "</td></tr>";
    }).join("") + "</tbody>";
  tw.appendChild(t); n.appendChild(tw);
  return n;
}

// 讲解 + 对照表一次给出：这是一篇文章，读者自己往下滚，不必一节一节点
function renderArticle(item) {
  var wrap = el("div", "article");
  item.panels.forEach(function (p) { wrap.appendChild(panelNode(p)); });
  if (item.table) wrap.appendChild(tableNode());
  mount(wrap, true, G.instant);
  if (!G.instant) placeAction(wrap, "最后一句", next);
}

function renderFinish() {
  var c = G.c;
  markDone(G.c.id, G.si);
  LS.del(KEY.sess);                       // 这一则读完了，不再续读
  var n = el("div", "fin");
  n.appendChild(el("div", "seal", String(G.story.title).slice(0, 1)));
  n.appendChild(el("div", "closing", fill(c.closing || "", G.slots)));
  n.appendChild(el("div", "score",
    "这一则的 " + (G.c.quiz || []).length + " 处停顿，你一次答对了 <b>" + G.quizFirst + "</b> 处。" +
    "<br>已读 <b>" + readCount() + "</b> / " + totalStories() + " 则。" +
    "<br><br>「这次好不好」和「这个人怎么样」，是两个问题。<br>换一则故事，同一个概念会换一副面孔。"));
  var row = el("div", "rigbtns");
  row.style.justifyContent = "center";
  row.style.marginTop = "34px";
  var b1 = el("button", "go", '<span>再生成一个故事</span><span class="arw">↺</span>');
  b1.type = "button";
  b1.addEventListener("click", function () { restart(true); });
  var b2 = el("button", "btn ghost", "重读这一则");
  b2.type = "button";
  b2.addEventListener("click", function () { restart(false); });
  row.appendChild(b1); row.appendChild(b2);
  n.appendChild(row);
  mount(n, true, G.instant);
  if (foot) foot.style.display = "block";
}

function render(item, opt) {
  if (opt && opt.instant) G.instant = true;
  switch (item.kind) {
    case "cover":   renderCover(); break;
    case "scene":   renderScene(item); break;
    case "quiz":    renderQuiz(item); break;
    case "reveal":  renderReveal(); break;
    case "article": renderArticle(item); break;
    case "finish":  renderFinish(); break;
  }
  if (opt && opt.instant) G.instant = false;
}

/* --------------------------------------------------- 小实验：烧一窑 */
function buildRig(root, label) {
  var NAME = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
  // 真实手艺刻意排得几乎一样高：让「被夸的人手艺本来就好」这个解释没法成立，
  // 名次几乎全由运气决定，回归效应才看得干净。
  var skill = [55, 55.8, 56.6, 57.2, 57.8, 58.4, 59, 59.6, 60.2, 61];
  var N = skill.length, LUCK = 60, MAX = 128, TOP = 2;
  var prev = null, praisedPrev = [], scoldedPrev = [], lastPraise = [], rounds = 0;
  var acc = { p: { n: 0, sum: 0 }, s: { n: 0, sum: 0 }, o: { n: 0, sum: 0 } };

  var bars = el("div", "bars"), pots = [];
  for (var i = 0; i < N; i++) {
    var pot = el("div", "pot");
    var skillline = el("div", "skillline");
    skillline.style.bottom = (skill[i] / MAX * 100) + "%";
    var luck = el("div", "luck"), base = el("div", "base"), flag = el("div", "flag");
    pot.appendChild(skillline); pot.appendChild(luck); pot.appendChild(base);
    pot.appendChild(flag); pot.appendChild(el("div", "lbl", NAME[i]));
    bars.appendChild(pot);
    pots.push({ pot: pot, base: base, luck: luck, flag: flag });
  }

  var legend = el("div", "legend",
    '<span><i style="background:linear-gradient(180deg,var(--bar-a),var(--bar-b))"></i>真实水平（永不变）</span>' +
    '<span><i style="background:repeating-linear-gradient(90deg,var(--stripe-hi) 0 3px,var(--stripe-lo) 3px 7px)"></i>这一轮的运气（每次都重掷）</span>' +
    '<span><i style="border-top:1.6px dashed var(--line-dash);background:none;border-radius:0;height:0;width:14px;vertical-align:4px"></i>水平线</span>' +
    '<span><i style="background:var(--flag-g-bg);border:1px solid var(--flag-g-line);border-radius:999px"></i>这一轮被' + label.good + '的两位</span>' +
    '<span><i style="background:var(--flag-b-bg);border:1px solid var(--flag-b-line);border-radius:999px"></i>这一轮被' + label.bad + '的两位</span>');

  var btns = el("div", "rigbtns");
  var b1 = el("button", "btn", "摇一轮"), b3 = el("button", "btn", "连摇十轮"), b2 = el("button", "btn ghost", "重置");
  b1.type = b3.type = b2.type = "button";
  btns.appendChild(b1); btns.appendChild(b3); btns.appendChild(b2);
  var stats = el("div", "stats", "");
  root.appendChild(bars); root.appendChild(legend); root.appendChild(btns); root.appendChild(stats);

  var fmt = function (v) { return (v >= 0 ? "+" : "") + v.toFixed(1); };
  var avg = function (a) { return a.n ? a.sum / a.n : null; };

  function paint() {
    var p = avg(acc.p), s = avg(acc.s), o = avg(acc.o), v;
    if (rounds === 0) {
      stats.innerHTML = '<div class="verdict">点一下「摇一轮」。十个人的真实水平几乎一样，名次几乎全由运气决定——你马上会看到那位师傅看见了什么。</div>';
      return;
    }
    if (rounds === 1) {
      v = "看清楚：这一轮被" + label.good + "的是 <b>" + lastPraise.map(function (i) { return NAME[i]; }).join("、") +
          "</b>，可看他们的<b>水平线</b>——并不比别人高。他们靠的是这一轮的运气，而运气下一轮就没了。";
    } else if (acc.p.n < 10) {
      v = "三组数字现在还在一起跳：被" + label.good + "的 " + fmt(p) + " 分，被" + label.bad + "的 " + fmt(s) +
          " 分，其余人 " + fmt(o) + " 分。<b>它现在很可能是反的，也可能乱得什么都看不出来——这不是算错，" +
          "这正是那位师傅栽跟头的地方：</b>单次的结果几乎说明不了任何事。重复的次数够多，方向才会露出来。" +
          "再多点几次「摇一轮」，或者直接点「连摇十轮」。";
    } else {
      v = "被<b>" + label.good + "</b>过的（共 " + acc.p.n + " 人次）下一轮平均 <b>" + fmt(p) + "</b> 分；被<b>" + label.bad +
          "</b>过的（共 " + acc.s.n + " 人次）平均 <b>" + fmt(s) + "</b> 分；其余人（" + acc.o.n + " 人次）平均 <b>" + fmt(o) +
          "</b> 分。这三组人做的事完全一样，唯一的区别是：在上一轮里，他们被挑出来过。" +
          "<br><br>这就是那位师傅记了几十年的东西。他会把它记成规律，写成簿子，然后教一百年。";
    }
    stats.innerHTML = "已摇 <b>" + rounds + "</b> 轮　·　累计人次：被" + label.good + " <b>" + acc.p.n +
      "</b> ／ 被" + label.bad + " <b>" + acc.s.n + "</b> ／ 其余 <b>" + acc.o.n + "</b>" +
      '<div class="verdict">' + v + "</div>";
  }

  function fire() {
    rounds++;
    var res = skill.map(function (si) { return si + Math.random() * LUCK; });
    res.forEach(function (r, i) {
      pots[i].base.style.height = (skill[i] / MAX * 100) + "%";
      pots[i].luck.style.height = ((r - skill[i]) / MAX * 100) + "%";
    });
    if (prev) {
      res.forEach(function (r, i) {
        var d = r - prev[i];
        if (praisedPrev.indexOf(i) >= 0) { acc.p.n++; acc.p.sum += d; }
        else if (scoldedPrev.indexOf(i) >= 0) { acc.s.n++; acc.s.sum += d; }
        else { acc.o.n++; acc.o.sum += d; }
      });
    }
    var order = res.map(function (r, i) { return [r, i]; })
      .sort(function (a, b) { return b[0] - a[0]; })
      .map(function (x) { return x[1]; });
    praisedPrev = order.slice(0, TOP);
    scoldedPrev = order.slice(-TOP);
    lastPraise = praisedPrev;
    pots.forEach(function (p, i) {
      var isP = praisedPrev.indexOf(i) >= 0, isS = scoldedPrev.indexOf(i) >= 0;
      p.pot.classList.toggle("praised", isP);
      p.pot.classList.toggle("scolded", isS);
      p.flag.className = "flag " + (isP ? "q" : "m");
      p.flag.textContent = isP ? label.good : (isS ? label.bad : "");
      p.flag.style.opacity = (isP || isS) ? "1" : "0";
      p.flag.style.bottom = (res[i] / MAX * 100) + "%";
    });
    prev = res;
    paint();
  }

  b1.addEventListener("click", fire);
  b3.addEventListener("click", function () { for (var k = 0; k < 10; k++) fire(); });
  b2.addEventListener("click", function () {
    prev = null; praisedPrev = []; scoldedPrev = []; lastPraise = []; rounds = 0;
    acc.p.n = acc.p.sum = acc.s.n = acc.s.sum = acc.o.n = acc.o.sum = 0;
    pots.forEach(function (p) {
      p.luck.style.height = "0%";
      p.pot.classList.remove("praised");
      p.pot.classList.remove("scolded");
      p.flag.style.opacity = "0";
    });
    paint();
  });
  paint();
}

/* ------------------------------------------------------------ 启动/重开 */
function start(opt) {
  stage.innerHTML = "";
  clearAction();
  if (foot) foot.style.display = "none";
  if (opt && opt.resume) {
    build({ resume: opt.resume });
    setChapter("《" + G.story.title + "》");
    // 回放已经读过的部分：不加动画、不滚屏、不再放动作按钮
    var upTo = G.i;
    G.instant = true;
    for (var k = 0; k < upTo; k++) render(G.plan[k]);
    G.instant = false;
    G.i = upTo;
    setProgress();
    saveSession();
    window.scrollTo({ top: 0 });
    setTimeout(function () {
      var last = stage.lastElementChild;
      if (last) {
        var top = last.getBoundingClientRect().top + window.pageYOffset - 110;
        window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
      }
    }, 120);
    if (G.i >= G.plan.length) return;
    render(G.plan[G.i++]);
    setProgress();
    return;
  }
  build(opt);
  setChapter("《" + G.story.title + "》");
  setProgress();
  window.scrollTo({ top: 0 });
  next();
}
function restart(again) {
  if (again) LS.del(KEY.sess);          // 换一则：丢掉续读点
  clearAction();
  start(again ? {} : { resume: { cid: G.c.id, si: G.si, slots: G.slots, i: 0, answers: {} } });
}
if (shuffleBtn) shuffleBtn.addEventListener("click", function () { restart(true); });

document.addEventListener("keydown", function (e) {
  if (e.key !== "Enter" && e.key !== " ") return;
  if (document.activeElement && document.activeElement.tagName === "BUTTON") return;
  if (action) { e.preventDefault(); fireAction(); }
});

/* 启动：有没读完的续读点就接着读，否则抽一则新的 */
(function boot() {
  var s = LS.get(KEY.sess, null);
  var ok = !!(s && s.v === SESSION_V && s.i > 0);
  if (ok) {
    var c = CONCEPTS.filter(function (x) { return x.id === s.cid; })[0];
    ok = !!c && !!(c.stories || [])[s.si];
  }
  if (ok) start({ resume: s }); else start({});
})();
})();
