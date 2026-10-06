/* 重建 index.html 的外链：样式表 + concepts/*.js + engine.js。
   用法：node _wire.js   （在 concept-fable 目录下，可反复运行）

   脚本区用一对标记圈起来，避免误伤 <head> 里的引导脚本：
     <!-- SCRIPTS:BEGIN -->
     <script src="concepts/…"></script>
     <script src="engine.js"></script>
     <!-- SCRIPTS:END -->
   首次运行时会自动把 </body> 之前那一段连续的 <script> 包上标记。 */
const fs = require("fs");
const path = require("path");

const root = __dirname;
const htmlPath = path.join(root, "index.html");
let html = fs.readFileSync(htmlPath, "utf8");
const log = [];
const B = "<!-- SCRIPTS:BEGIN -->", E = "<!-- SCRIPTS:END -->";

/* ---------- 1. 样式：内联 → 外链 ---------- */
const s0 = html.indexOf("<style");
const s1 = html.indexOf("</style>", s0);
if (s0 >= 0 && s1 > s0) {
  html = html.slice(0, s0) + '<link rel="stylesheet" href="style.css">' + html.slice(s1 + 9);
  log.push('内联样式 → <link rel="stylesheet" href="style.css">');
} else {
  log.push("样式已是外链");
}

/* ---------- 2. 定位脚本区 ---------- */
let b = html.indexOf(B), e = html.indexOf(E);
if (b < 0 || e < 0) {
  const starts = [];
  const re = /<script\b[^>]*>/g;
  let m;
  while ((m = re.exec(html))) starts.push(m.index);
  const endsRe = /<\/script>/g, ends = [];
  while ((m = endsRe.exec(html))) ends.push(m.index + 9);
  if (!starts.length || starts.length !== ends.length) {
    console.error("脚本标签不成对，未改动。"); process.exit(1);
  }
  // 从最后一对开始，向前合并「中间只有空白」的相邻对
  let first = starts.length - 1;
  for (let i = starts.length - 2; i >= 0; i--) {
    const gap = html.slice(ends[i], starts[i + 1]);
    if (!/^\s*$/.test(gap)) break;
    first = i;
  }
  const regionStart = starts[first], regionEnd = ends[ends.length - 1];
  html = html.slice(0, regionStart) + B + "\n" + html.slice(regionStart, regionEnd) + "\n" + E + html.slice(regionEnd);
  b = html.indexOf(B); e = html.indexOf(E);
  log.push("已把 </body> 之前那段连续脚本包上标记（共 " + (starts.length - first) + " 个）");
}

/* ---------- 3. 写入外链 ---------- */
const files = fs.readdirSync(path.join(root, "concepts"))
  .filter(f => f.endsWith(".js") && !f.startsWith("_"))
  .sort();
const body = files.map(f => '<script src="concepts/' + f + '"></script>').join("\n") +
  "\n" + '<script src="engine.js"></script>';
html = html.slice(0, b + B.length) + "\n" + body + "\n" + html.slice(e);

fs.writeFileSync(htmlPath, html, "utf8");
console.log("index.html 已更新：");
log.forEach(l => console.log("  · " + l));
console.log("  · 脚本区：" + files.length + " 个概念模块 + engine.js");
