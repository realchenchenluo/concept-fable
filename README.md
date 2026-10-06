# 概念寓言机

每次打开都生成一则新的寓言故事。故事一直在讲某个概念，但不会一开始就告诉你；中途有几处停顿，每处一道选择题；故事快讲完时，才由读者自己给它命名。揭晓之后是概念拆解和隐喻对照表。

> 想了解"当初为什么是这么做的"——需求演进、每一步的产出、踩过的坑（包括那些只有真机跑起来才暴露的），见 [对话纪要.md](对话纪要.md)。

## 在线版

**https://realchenchenluo.github.io/concept-fable/** —— 部署在 GitHub Pages 上，手机、电脑都能直接打开。

手机浏览器里用「添加到主屏幕」，就能像 App 一样全屏使用（带 PWA 清单和图标，主题色跟着页面日夜走）。仓库只放网页部分：https://github.com/realchenchenluo/concept-fable

## 打开方式

直接双击 `index.html`。零依赖、无网络请求，`file://` 下正常工作（只用普通 `<script src>`，没有 ES module、没有 fetch）。

想用本地服务器预览（手机上同一个 WiFi 也能看）：

```bash
cd concept-fable
python -m http.server 8770 --bind 127.0.0.1
# 电脑上打开 http://127.0.0.1:8770/
```

## 手机上自用

引擎里为手机做了五件事（都存本地，不需要账号、不需要联网）：

1. **节奏** —— 故事按「幕」整块推进，不是一段一段挤牙膏：一幕大致一到一屏半，读完一则约 10 次点击（故事 4 幕 + 答题 3 次 + 揭示 + 讲解篇 + 收尾）。讲解与对照表合成**一篇**一次给出，读者自己往下滚。
2. **进度记忆** —— `localStorage` 记住当前读到哪一则、第几幕、哪几题答过。中途退出再回来会**接着上次那一幕**读；之前答过的题只作展示（点错的选项划着），没答完的题还能接着答。读完则自动清掉续读点。
3. **拇指操作** —— 手机上「继续」是底部固定条（`#actionbar`）；正在答题时它会自动收起，逼你看完题。桌面端仍然是正文下方那个按钮。
4. **字号三档 + 日夜两套配色** —— 右上角切换，都记在本地。配色按长时间阅读调过：不用纯白纸配纯黑字，对比压低一档；夜里是暖灰深色（不是纯黑），纸纹只在日间显示。第一次打开跟随系统，之后按你上次的选择。
5. **抽签历史** —— 优先抽**没读过**的那几则，全读完才按最久没读的轮换；封面显示「已读 N / 8 则」。

安卓返回键 / 浏览器后退已经接上：回到上一幕，回到封面再按才退出（`history.pushState`，不支持的环境会自动跳过）。

### 放到手机上

```bash
node _standalone.js      # 生成 standalone.html（约 187 KB，全部内容内联）
```

`standalone.html` 是一个自包含文件：发给微信「文件传输助手」，手机上点开就能读，不依赖任何服务器。安卓上如果浏览器能打开本地文件，也可以直接用文件管理器打开。

想要桌面图标和全屏体验：打开上面的在线版，在 Chrome 里「添加到主屏幕」即可——`manifest.webmanifest` 和图标（`icon-*.png`，与安卓版同一套设计，由 `make_icons.py` 生成）已经带上。

## 「每次不一样」是怎么做到的

`concepts/` 下每个 `.js` 是一个**概念模块**。引擎启动时随机抽一组（概念 × 故事），并保证不和上一组重复（换一次、刷新一次都会换）。抽到哪一则，讲解、题目、对照表里提到的人名器物就跟着换成那一则的。

```
index.html        外壳（只有结构，样式在 style.css，逻辑在 engine.js）
style.css         全部样式：日夜两套配色、手机布局、底部动作条
engine.js         引擎：抽签 → 解析槽位 → 排幕 → 渲染 → 判题 → 揭示 → 本地存档
concepts/*.js     内容。一个文件 = 一个概念，每则故事 11~13 幕
  mean-reversion.js        均值回归（本科 · 统计）《归》《翎》
  survivorship-bias.js     幸存者偏差（本科 · 统计）《补》《榜》
  symmetry-breaking.js     自发对称破缺（研究生 · 物理）《七度》《铁在夜里凉下来》
  information-entropy.js   信息熵（研究生 · 信息论）《灯语》《七问》
concepts/_validate.js   校验器
concepts/_render.js     把故事或教学层填好槽位打印出来，肉眼校句子
_wire.js                重建 index.html 的外链（加了新模块就跑一下）
_standalone.js          把整个站点内联成一个 standalone.html（手机上用 / 打包 APK 用）
manifest.webmanifest    PWA 清单；图标 icon-*.png / favicon.ico 由 make_icons.py 生成（在线版"添加到主屏幕"用）
```

## 加一个概念 / 加一则故事

概念模块的完整格式见 `concepts/mean-reversion.js`（它是参照模块，注释里写了约定）。要点：

```js
(window.CONCEPTS = window.CONCEPTS || []).push({
  id, name, en, field, level, blurb,
  lexicon: ["master","book", ...],   // 教学层用到的槽位
  stories: [ { title, slots:{...}, beats:[...] }, ... ],
  quiz: [...], reveal:{...}, panels:[...],
  tableTitle, table: [[左, 右], ...], closing
});
```

- **`beats` 是手写的纯散文**，不做槽位拼接。只有两种排版标记由引擎解析：段落以 `{hl}` 开头 → 强调行；以 `〔引〕` 开头 → 引文行。`ledger` 里的每一项是 `{t:"小标题", r:"内容"}`。
- **教学层（quiz / reveal / panels / table / closing）两则故事共用**，所以提到故事里的人名、器物时要写 `{master}`、`{book}` 这种槽位。`lexicon` 声明教学层用到的全部槽位，**每则故事都必须提供每一个键**（值可以是字符串或字符串数组，数组会随机取一个，所以名字、天数这类细节每次也会变）。
- 故事正文里**不能出现概念名**，否则剧透。校验器会检查这一条。

改完跑这两条：

```bash
node concepts/_validate.js            # 语法、槽位齐不齐、每题是否恰好一个正确答案、有没有剧透
node concepts/_render.js  <id>        # 把某则故事填好槽位打印出来，用来逐句读
node _wire.js                         # 加了新模块才需要，重建 index.html 的引用
```

引擎不认识具体内容，只认这套格式；新概念不需要改引擎。

## 小实验（只在均值回归里）

十个徒弟的真实手艺被**刻意设得几乎一样高**（看那十条虚线），这样「被夸的人手艺本来就好」这个替代解释就被提前排除了：名次几乎全由运气决定，回归效应无法用技能差异解释。

副作用是：只点一两次「烧一轮」时统计量还在抖，单侧约 7%~12% 的概率会出现反号。这个没有藏起来，而是写进了文案——「它现在很可能是反的……这正是那位师傅栽跟头的地方」。点三次两侧同时正确约 99%，点「连烧十轮」是 100%。一个小样本现象本身就是这一节要教的第二件事，把它藏起来反而可惜。

## APK（已经打好了）

产物：`android/out/concept-fable.apk`，**81 KB，零权限**，minSdk 26（Android 8.0 及以上），targetSdk 34。

**装到手机上**：把 apk 传过去（微信文件传输助手、数据线、网盘都行），点开安装，第一次要允许「安装未知应用」。或者用数据线：

```bash
adb install -r android/out/concept-fable.apk
```

**它是什么**：一个 WebView 壳，页面全部在 `assets/index.html`（就是 `standalone.html` 的副本）里，不联网、不申请任何权限。壳只做四件事：

- 打开本地页面，开 JS 和 DOM storage（进度、字号、主题都靠它记）
- **返回键先在页面里回上一幕**，退到封面再按才退出
- 状态栏 / 导航栏的颜色与图标明暗跟着页面主题走（页面通过 `AndroidApp.setTheme` 回调，这是两边唯一的联系；在浏览器里这个对象不存在，调用会被静默跳过）
- 关掉缩放和回弹，免得跟页面自己的手势打架

**改了网页内容之后重新构建**：

```bash
node _standalone.js          # 重新生成单文件
python android/build.py      # 编译 APK 到 android/out/
```

构建脚本不用 Gradle：直接调 SDK 里的 `aapt2`（编译资源、链接清单与 assets）、`javac`（编译 Activity）、`d8`（转 dex）、`zipalign`、`apksigner`，全部离线可跑。JDK 用机器上已有的（默认取 WebStorm 自带的 JBR 21，可用 `JBR_HOME` 覆盖），SDK 路径可用 `ANDROID_SDK` 覆盖。

**签名**：自签的本地密钥（`android/keystore/debug.keystore`，口令都是 `android`）。自用足够；以后要用新版覆盖安装，必须用同一个 keystore 签。

**已装到模拟器上跑过**（Android 14 / Pixel 5，截图在 `android/shots/`）：

- 首启进封面，正文排版、答题卡片、强调行、底部动作条全部正常
- 答题时底部动作条自动收起（点不进去下一步）
- 返回键逐幕回退：4/13 → 3/13 → 2/13 → 封面，章节标题跟着回退，退回封面再按才退出应用
- 切日间：状态栏和导航栏跟着换成日色、图标转深色；切回夜间同理
- **杀掉进程重开，进度接着上次那一幕**（3/13），主题也保持上次的选择

**已经静态验证过的**：包内结构（`resources.arsc` 未压缩、`assets/index.html` 与 `standalone.html` 逐字节一致、dex 魔数正确）、签名（v2 + v3 通过）、清单（包名 / 应用名 / 自适应图标 / 零权限）、dex 里的类齐全、以及网页本身在浏览器里的完整回归。

**两个实现细节**（都是踩过坑才这么写的）：

- 主题存了两份：页面里的 `localStorage` 一份，壳里的 `SharedPreferences` 一份。WebView 的 localStorage 落盘有延迟，实测「切完主题马上杀进程」会丢；而 `SharedPreferences.apply()` 更可靠，所以壳存的那份负责首帧，页面那份负责浏览器。首帧不闪。
- 页面在 `file://` 下不能靠 `prefers-color-scheme` 判断系统日夜（那个值跟着 Activity 的主题走），所以由壳读 `Configuration.uiMode` 通过 `#sys=` 告知。

想自己再跑一遍模拟器（镜像约 4.2 GB，装完可以删）：

```bash
SDK="$LOCALAPPDATA/Android/Sdk"
"$SDK/cmdline-tools/latest/bin/sdkmanager.bat" "emulator" "system-images;android-34;google_apis;x86_64"
"$SDK/cmdline-tools/latest/bin/avdmanager.bat" create avd -n cf -k "system-images;android-34;google_apis;x86_64" -d pixel_5
"$SDK/emulator/emulator.exe" -avd cf -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect
"$SDK/platform-tools/adb.exe" install -r android/out/concept-fable.apk
```

不想要了就删掉 `avdmanager delete avd -n cf`，以及 `$SDK/system-images` 和 `$SDK/emulator` 两个目录。

工程结构：

```
android/
  AndroidManifest.xml
  src/com/zcode/conceptfable/MainActivity.java   WebView 壳（约 110 行）
  res/values/{strings,colors,themes}.xml         应用名、启动底色、主题
  res/drawable/ic_foreground.xml                 图标前景：一页纸 + 三行字
  res/mipmap-anydpi-v26/ic_launcher.xml          自适应图标
  assets/index.html                              构建时从 standalone.html 复制
  build.py                                       离线打包脚本
  out/concept-fable.apk                          产物
```

## 引擎的几个设计取舍

- **抽签避开重复**：用 `sessionStorage` 记住上一组，优先换概念，其次换故事。
- **槽位只解析一次**：抽到一组时就把每个槽位定死，所以同一则故事里不会出现「三十九天」和「四十四天」混着用。
- **教学层用槽位、故事层不用**：讲解要跟着故事换名字，而故事的句子必须由人写通顺——两者混在一起会拼出「收箭那天的时候」这种病句。
- **`{hl}` 与 `〔引〕` 是保留标记**，校验器不会把它们当成未定义的槽位。
