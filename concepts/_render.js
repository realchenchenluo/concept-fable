/* 把故事 / 教学层填好槽位后打印出来，用来肉眼检查。
   用法：node concepts/_render.js                      → 全部模块的全部故事
        node concepts/_render.js mean-reversion 1      → 该模块第 2 则故事
        node concepts/_render.js mean-reversion --teach → 该模块的教学层（用第 1 则的槽位）
        node concepts/_render.js --teach                → 全部模块的教学层
   加 --rand 会真的随机取值（默认取每组第一个，便于比对） */
const fs = require("fs");
const path = require("path");

global.window = {};
const dir = __dirname;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".js") && !f.startsWith("_")))
  new Function("window", fs.readFileSync(path.join(dir, f), "utf8"))(global.window);

const CONCEPTS = global.window.CONCEPTS || [];
const argv = process.argv.slice(2);
const rand = argv.indexOf("--rand") >= 0;
const teach = argv.indexOf("--teach") >= 0;
const pos = argv.filter(a => !a.startsWith("--"));
const id = pos[0], si = pos[1];

const pick = (v) => Array.isArray(v) ? (rand ? v[Math.floor(Math.random() * v.length)] : v[0]) : v;
const fill = (s, slots) => String(s).replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (m, k) =>
  slots[k] === undefined ? m : pick(slots[k]));
const strip = (h) => String(h).replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ");

function printStory(c, st) {
  console.log(`\n----- 《${st.title}》 -----`);
  st.beats.forEach(b => {
    if (b.chapter) console.log(`\n【${fill(b.chapter, st.slots)}】`);
    if (b.p) b.p.forEach(p => console.log(fill(p, st.slots)));
    if (b.ledger) b.ledger.forEach(l =>
      console.log((l.t ? "〔" + fill(l.t, st.slots) + "〕 " : "") + fill(l.r, st.slots)));
    if (b.after) console.log(`  >>> 此处插题：${b.after}`);
  });
}

function printTeach(c, slots) {
  console.log("\n===== 教学层 =====");
  (c.quiz || []).forEach(q => {
    console.log(`\n[${q.id}] ${fill(q.qtag, slots)}`);
    if (q.intro) console.log("  " + strip(fill(q.intro, slots)));
    console.log("  " + fill(q.q, slots));
    q.options.forEach(o => {
      console.log(`  ${o.key}${o.ok ? "（对）" : "　　"} ${fill(o.text, slots)}`);
      console.log(`      → ${strip(fill(o.why, slots))}`);
    });
  });
  console.log("\n[揭示] " + fill(c.reveal.pre, slots) + " " + c.name);
  console.log("  " + strip(fill(c.reveal.quote, slots)));
  (c.panels || []).forEach(p => {
    console.log(`\n[讲解] ${p.h3}${p.kind === "rig" ? "（小实验）" : ""}`);
    if (p.html) p.html.forEach(h => console.log("  " + strip(fill(h, slots))));
    if (p.intro) console.log("  " + strip(fill(p.intro, slots)));
  });
  console.log("\n[对照表] " + (c.tableTitle || ""));
  (c.table || []).forEach(r => console.log("  " + fill(r[0], slots) + "  ⇄  " + fill(r[1], slots)));
  console.log("\n[收尾] " + strip(fill(c.closing, slots)));
}

for (const c of CONCEPTS) {
  if (id && c.id !== id) continue;
  console.log(`\n########## ${c.name}（${c.field}·${c.level}） ##########`);
  if (teach) { printTeach(c, c.stories[0].slots); continue; }
  c.stories.forEach((st, i) => { if (si === undefined || String(i) === String(si)) printStory(c, st); });
}
