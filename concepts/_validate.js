/* 概念模块校验器 —— 用法：node concepts/_validate.js
   检查：
     1. 每个文件能否被解析
     2. 每个模块的必填字段
     3. 每个故事是否提供了 lexicon 里的全部槽位
     4. 正文/讲解里用到的每个 {槽位} 是否都有定义
     5. 每道题是否恰好一个正确答案、选项 key 是否唯一
     6. 故事正文里有没有提前泄露概念名
     7. ledger 块格式、after 引用是否闭合
*/
const fs = require("fs");
const path = require("path");

global.window = {};
const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith(".js") && !f.startsWith("_"));

for (const f of files) {
  try {
    const code = fs.readFileSync(path.join(dir, f), "utf8");
    new Function("window", code)(global.window);
  } catch (e) {
    console.log(`\n=== ${f}\n  ✗ 语法错误：${e.message}`);
  }
}

const CONCEPTS = (global.window || {}).CONCEPTS || [];
if (!CONCEPTS.length) { console.log("\n没有读到任何概念模块。"); process.exit(1); }

// 正文里除了槽位，还允许这些保留标记（引擎会单独处理）
const RESERVED = new Set(["hl"]);
const slotsOf = (txt) => new Set(
  [...String(txt).matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)]
    .map(m => m[1]).filter(s => !RESERVED.has(s))
);

let bad = 0, soft = 0;
const warn = (m) => { console.log("  ✗ " + m); bad++; };
const note = (m) => { console.log("  ⚠ " + m); soft++; };

for (const c of CONCEPTS) {
  console.log(`\n=== ${c.id || "(无 id)"} — ${c.name || "?"} [${c.level || "?"}·${c.field || "?"}]`);
  const need = ["id","name","en","field","level","blurb","lexicon","stories","quiz","reveal","panels","table","closing"];
  for (const k of need) if (c[k] === undefined) warn(`缺少字段 ${k}`);
  if (!Array.isArray(c.stories) || c.stories.length < 2) warn("stories 至少要有 2 则");
  if (!Array.isArray(c.quiz) || c.quiz.length < 2) warn("quiz 至少要有 2 道");
  if (!Array.isArray(c.table) || c.table.length < 8) warn("对照表少于 8 条");
  if (c.table && c.table.some(r => !Array.isArray(r) || r.length !== 2)) warn("对照表每行必须是两项数组");

  const lex = new Set(c.lexicon || []);
  const teachJson = JSON.stringify({
    quiz: c.quiz, reveal: c.reveal, panels: c.panels, table: c.table, closing: c.closing
  });
  const teachSlots = slotsOf(teachJson);
  for (const s of teachSlots) if (!lex.has(s)) warn(`教学层用到 {${s}}，但 lexicon 里没有声明`);

  // 教学层是两则故事共用的：不能出现任何一则故事「独有的字面量」——
  // 那说明该处应该写成槽位，否则换一则故事就对不上。
  const owned = new Map();
  (c.stories || []).forEach((st, i) => {
    Object.keys(st.slots || {}).forEach(k => {
      const vals = [].concat(st.slots[k]);
      vals.forEach(v => {
        if (typeof v !== "string" || v.length < 2) return;
        if (!owned.has(v)) owned.set(v, new Set());
        owned.get(v).add(i);
      });
    });
  });
  owned.forEach((where, v) => {
    if (teachJson.indexOf(v) >= 0) {
      note(`教学层里出现了字面量「${v}」（第 ${[...where].map(i => i + 1).join("、")} 则故事的槽位值）——如果是特指那一则故事，应改成槽位；如果只是通用词，可以忽略`);
    }
  });

  (c.quiz || []).forEach((q, i) => {
    const opts = q.options || [];
    const ok = opts.filter(o => o.ok);
    if (ok.length !== 1) warn(`quiz[${i}] (${q.id}) 正确答案有 ${ok.length} 个，应为 1 个`);
    if (opts.length !== 4) warn(`quiz[${i}] 选项数为 ${opts.length}，应为 4`);
    if (new Set(opts.map(o => o.key)).size !== opts.length) warn(`quiz[${i}] 选项 key 重复`);
    opts.forEach(o => { if (!o.why) warn(`quiz[${i}] 选项 ${o.key} 缺少 why`); });
    if (!q.id) warn(`quiz[${i}] 缺少 id`);
  });

  (c.stories || []).forEach((st, si) => {
    const tag = `stories[${si}]《${st.title}》`;
    const slots = st.slots || {};
    for (const k of lex) if (slots[k] === undefined) warn(`${tag} 缺少槽位 {${k}}`);
    const used = slotsOf(JSON.stringify(st.beats || []));
    for (const s of used) if (slots[s] === undefined) warn(`${tag} 用到 {${s}}，但该故事没有提供`);
    if (c.name && JSON.stringify(st.beats).indexOf(c.name) >= 0) warn(`${tag} 正文里出现了概念名「${c.name}」，会提前剧透`);
    if (c.en && JSON.stringify(st.beats).indexOf(c.en) >= 0) warn(`${tag} 正文里出现了英文名`);

    (st.beats || []).forEach((b, bi) => {
      if (!b.p && !b.ledger) warn(`${tag} beat[${bi}] 既没有 p 也没有 ledger`);
      if (b.p && !Array.isArray(b.p)) warn(`${tag} beat[${bi}] 的 p 必须是数组`);
      if (b.ledger) {
        if (!Array.isArray(b.ledger)) warn(`${tag} beat[${bi}] 的 ledger 必须是数组`);
        else if (b.ledger.some(x => typeof x === "string")) warn(`${tag} beat[${bi}] 的 ledger 项应为 {t, r} 对象`);
      }
    });

    const afters = (st.beats || []).filter(b => b.after).map(b => b.after);
    const ids = (c.quiz || []).map(q => q.id);
    for (const a of afters) if (ids.indexOf(a) < 0) warn(`${tag} 引用了不存在的题目 id「${a}」`);
    for (const id of ids) if (afters.indexOf(id) < 0) warn(`${tag} 缺：题目 ${id} 没有被任何 beat 的 after 引用`);
    if (afters.length !== ids.length) warn(`${tag} beat.after 数量(${afters.length}) 与题目数(${ids.length}) 不一致`);
  });

  console.log(`  故事 ${(c.stories||[]).length} 则 · 题目 ${(c.quiz||[]).length} 道 · 讲解 ${(c.panels||[]).length} 节 · 对照 ${(c.table||[]).length} 条 · 槽位 ${lex.size} 个`);
}

console.log(bad ? `\n共 ${bad} 处问题。` : "\n全部通过。");
process.exit(bad ? 1 : 0);
