---
name: knowledge-animator
summary: 把任意复杂原理或过程做成"可播放"的交互式图解课件 —— 单文件 HTML，分页幻灯 + SVG 动画 + 滑块实验
description: |
  用单文件 HTML 课件，把一段知识（原理 / 协议 / 流程 / 数据结构 / 系统行为）
  讲成一段可以翻页、可以一步步播放、可以动手调参数看变化的动画课。
  8 种页型（cover/map/scene/compare/code/lab/index/end），零依赖，~60KB，
  自带暗/亮双主题、目录浮层、全屏、深链。
  配套 build / check / smoke 脚本，保证结构正确、运行时无报错。
trigger: |
  讲解、图解、动画课件、可视化、show me how、step through、
  原理演示、可交互示意图、复杂概念拆解、
  "把这个做成动画"、"做一个交互式动画课件（像 TCP 拥塞控制那类）"
---

# knowledge-animator · 让知识动起来

**用途**：把任何复杂知识（原理、协议、流程、状态机、并发、数据结构）做成一份**可播放**的交互式图解课件。翻开第一页，按空格，它就一边演一边讲；想自己摸一遍，拖滑块也行。

**形态**：单文件 HTML（~60KB，零依赖），分页幻灯 + SVG 动画 + 可调参数实验。

**参考基准**：看 `examples/` 里的两份成品课件——`tcp-congestion-control`（12 页，含 cwnd 实验页）与 `tailscale-how-it-works`（12 页，含 NAT 打洞 / DERP 实验页）。它们就是本技能能力的"活样例"：分页幻灯 + 时间轴播放（播放/暂停/步进/速度）+ 内置**交互实验室**页型。写新课件时，优先照着这两个例子改，而不是从空白起步。

## 工作流

### 1. 选定主题
- 用户给一个概念 / 协议 / 系统 / 算法。
- 必要时先与用户对齐**受众**（开发者？产品经理？学生？）、**深度**（原理 vs 速通）、**重点**（哪几页必须深讲）。
- 如果信息足够，可以默认假设"开发者、技术深读者"，并自行定重点——但要把假设写在结果里。

### 2. 设计叙事骨架
读 `references/narrative-structure.md`，把主题拆成 **12–27 页**的课。一般结构：
1. `cover` 封面——一句话讲清这课解决什么问题
2. `map` 课程地图——4 段卡片，让读者建立预期
3. **3–6 页 `scene`**——核心动画场景
4. `compare` 对比表——多算法 / 多协议的横向比较
5. `code` 核心代码——逐行高亮
6. `lab` 交互实验——**这是杀手锏**，让读者亲手改参数看曲线 / 拓扑变化
7. `index` 资料索引——RFC / 论文 / 源码链接
8. `end` 结论——"最后记住 N 句话"

### 3. 逐页画图
读 `references/authoring-guide.md`，按规范画每页的 SVG（节点 `id`、连线 `id`、viewBox 约定）。
读 `references/scene-patterns.md`，挑对应套路：链路流水线、状态机、分层协议、反馈环、并发时序、数据结构、对比权衡、端到端串讲。

### 4. 写 `deck.js`
用 `assets/starter.deck.js`（或 `examples/` 里的样例）做模板，把数据填进去。文件必须是 ES module：
```js
export default { title, subtitle, slides: [ ... ] };
```

### 5. 校验与构建
```bash
node scripts/check.mjs deck.js     # 结构自检（id 引用 / packet 路径 / lab 函数齐全）
node scripts/build.mjs deck.js     # 生成 deck.html
node scripts/smoke.mjs deck.js     # 用本机 Chrome 跑一遍，捕获运行时错误
```
**三道关全绿才能交付。**

### 6. 预览
`open deck.html`（macOS），或 `node scripts/build.mjs deck.js --open`。

## 八种页型速查

| 页型 | 用途 | 关键字段 |
|---|---|---|
| `cover` | 封面 | `title, subtitle, chips, hint` |
| `map` | 课程地图 | `parts:[{num,title,desc,pages,goto}]` |
| `scene` | 动画场景 ★ | `svg, steps:[{enter,exit,focus,dim,label,tag,packet,flash,note,dur}]` |
| `compare` | 横向对比 | `cols, rows:[{k,v:[..]}], steps:[{rows}]` |
| `code` | 代码逐行 | `code, steps:[{lines}]` |
| `lab` | 交互实验 ★ | `params, svg(v), readouts(v), insight(v)` |
| `index` | 资料索引 | `items:[{label,desc,url}]` |
| `end` | 结论 | `points:[..]` |

完整字段说明见 `assets/template.html` 里的 `RENDER` 对象（每种页型怎么渲染）和 `sceneStep()`（scene 的每种 step 字段语义）。

## 键盘与界面

- `←` `→` 步进（scene 页逐步进，非 scene 页翻页）
- `Shift`+`←`/`→` 跨步翻页
- `空格` 播放/暂停（按 `dur` 自动前进）
- `M` 目录（`Esc` 关闭）
- `F` 全屏
- `T` 切换暗 / 亮主题（记忆在 localStorage）
- 底部有 0.5× / 1× / 1.5× / 2× 速度档
- 顶部有全局进度条，目录有当前页高亮

深链 `#p3s2` 直接跳到第 3 页第 2 步。

## 质量门禁（必须全过）

1. `check.mjs` 零错误（提醒可不阻塞）
2. `build.mjs` 成功生成单文件 HTML
3. `smoke.mjs` 全流程无运行时错误
4. 至少做一次**视觉检查**（headless Chrome 截图 2–3 个关键页）——`scene` 页 SVG 是否有溢出 / 重叠 / 标签截断，**这是结构校验发现不了的**

## 常见误区

- **步骤里写了不存在的 `id`** —— `check.mjs` 会抓，但漏了再运行 `smoke.mjs`
- **`packet.path` 指向 `<line>` 而不是 `<path>`** —— `getPointAtLength` 失效，`check.mjs` 会抓
- **lab 的 `readouts` / `insight` 不是函数** —— `check.mjs` 会提醒，但 slide 也会直接不显示
- **节点都堆在 enter 里，初始画面全空** —— 想让某节点从第一帧就在就别写进 `enter`
- **节点 `id` 含特殊字符（`:`、`.`）** —— 用 `CSS.escape` 处理（引擎已处理），但你写 tag selector 时也要用 `CSS.escape`
- **AIMD / 反馈环场景忘了画参考线** —— 公平线 / 容量线、状态机入口阈值这些"坐标系"必须先就位
- **解说词用"它"指代不清** —— 每条 `note` 第一句必须自解释，读者很可能跳着看

## 依赖

- 构建：仅 `node` ≥ 18
- 冒烟：本机 `Chrome` / `Chromium` / `Edge`（macOS 自带 `Google Chrome.app/Contents/MacOS/Google Chrome`）
- 运行时：**零依赖**，单个 HTML 拖到任何浏览器即开
