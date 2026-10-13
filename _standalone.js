/* 把整个站点内联成一个自包含的 HTML 文件（手机上用）。
   用法：node _standalone.js   → 生成 standalone.html
   产物不依赖任何外部文件，也不发任何网络请求：可以直接丢进微信「文件传输助手」，
   或者在手机浏览器里打开、存成书签。 */
const fs = require("fs");
const path = require("path");

const root = __dirname;
let html = fs.readFileSync(path.join(root, "index.html"), "utf8");

const re = /<script src="([^"]+)"><\/script>/g;
let n = 0, missing = [];
html = html.replace(re, (m, src) => {
  const p = path.join(root, src);
  if (!fs.existsSync(p)) { missing.push(src); return m; }
  let code = fs.readFileSync(p, "utf8");
  if (code.indexOf("</script") >= 0) {
    throw new Error("内联失败：" + src + " 里含有 </script，需要先转义");
  }
  n++;
  return '<script>\n/* ==== ' + src + ' ==== */\n' + code + '\n</script>';
});

// 样式表也内联进去，整个站点就只剩这一个文件
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, href) => {
  const p = path.join(root, href);
  if (!fs.existsSync(p)) { missing.push(href); return m; }
  let css = fs.readFileSync(p, "utf8");
  if (css.indexOf("</style") >= 0) throw new Error("内联失败：" + href + " 里含有 </style");
  n++;
  return "<style>\n/* ==== " + href + " ==== */\n" + css + "\n</style>";
});

if (missing.length) {
  console.error("找不到这些文件：" + missing.join(", "));
  process.exit(1);
}

// 兜底：即使将来加了别的引用，也提醒一下。
// 例外：manifest 与图标是 PWA 元信息，单文件版（file:// 打开）不需要它们，
// 留在 <head> 里无害，所以不算「残留引用」。
const leftover = (html.match(/<(?:script|link)\b[^>]*(?:src|href)="(?!data:|#)[^"]+"[^>]*>/g) || [])
  .filter(tag => !/rel="(?:manifest|icon|apple-touch-icon|mask-icon)"/.test(tag))
  .map(tag => tag.match(/(?:src|href)="([^"]+)"/)[1]);
const out = path.join(root, "standalone.html");
fs.writeFileSync(out, html, "utf8");
const kb = (fs.statSync(out).size / 1024).toFixed(0);
console.log("已生成 standalone.html：" + n + " 个脚本已内联，共 " + kb + " KB");
if (leftover.length) console.log("仍存在外部引用（请检查）：" + leftover.join(" "));
