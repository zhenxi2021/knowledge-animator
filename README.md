# knowledge-animator

把复杂的知识原理 / 过程，用**可播放的单文件动画课件**具象化。

> 形态即 `examples/` 下两份成品课件——`tcp-congestion-control` 与 `tailscale-how-it-works`：分页幻灯 + 时间轴播放控制 + 滑块实验页。新课件建议从 `assets/starter.deck.js` 起步、照着例子改。

## 这是什么

- 零依赖**单文件 HTML** 课件（约 60KB），内嵌 SVG 动画引擎 + 时间轴播放控制
- **8 种页型**：`cover` / `map` / `scene` / `compare` / `code` / `lab` / `index` / `end`
- 播放 / 暂停 / 步进 / 速度档 / 进度条 / URL 深链，目录浮层、全屏、暗·亮主题切换
- `lab` 页支持**滑块实验**：读者亲手调参数看曲线/连线变化

## 目录结构

```
knowledge-animator/
├── SKILL.md                     # 主入口（工作流 + 质量门禁），供 WorkBuddy 加载
├── README.md                    # 本文件
├── install.sh                   # 一键装到 WorkBuddy 的 skills 目录
├── assets/
│   ├── template.html            # 运行时：CSS 设计令牌 + SVG 引擎 + 8 页型渲染
│   └── starter.deck.js          # 起步模板（覆盖全部页型，复制它来开新课件）
├── scripts/
│   ├── build.mjs                # deck.js → 单文件 deck.html
│   ├── check.mjs                # 结构自检（id 引用 / packet 路径 / lab 函数）
│   └── smoke.mjs                # 本机 Chrome 无头跑全流程（捕获运行时错误）
├── references/
│   ├── authoring-guide.md       # SVG 节点 / 连线 / 动画规范与反模式
│   ├── scene-patterns.md        # 8 种图示套路（流水线 / 状态机 / AIMD …）
│   └── narrative-structure.md   # 怎么把原理拆成 12–27 页
└── examples/
    ├── tcp-congestion-control/  # 示例：TCP 拥塞控制（12 页）
    └── tailscale-how-it-works/  # 示例：Tailscale 工作原理（12 页）
```

## 快速开始

```bash
# 1. 复制起步模板，改里面的 slides 数组
cp assets/starter.deck.js my-deck.js

# 2. 三道质量门
node scripts/check.mjs my-deck.js     # 静态自检（引用/结构）
node scripts/build.mjs my-deck.js     # 产出 my-deck.html（零依赖单文件）
node scripts/smoke.mjs my-deck.js     # 浏览器无头跑一遍（需本机 Chrome）

# 3. 打开
open my-deck.html
```

## 安装（通用）

`install.sh` 会自动探测本机装了哪些 AI 编码助手，并把技能装到各自的 skills 目录。
已支持：**claude / codex / workbuddy / qoder / openclaw / opencode / gemini / cursor**。

```bash
./install.sh                 # 检测已安装的助手，逐个装好
./install.sh --all          # 装到所有已知助手（即使本机没装，也建好目录）
./install.sh claude workbuddy   # 只装到指定助手
./install.sh --dir /path/skills # 装到自定义目录（会建 knowledge-animator 子目录）
./install.sh --project      # 用项目级目录（如 ./.claude/skills），而非用户级
./install.sh --list         # 列出已知助手及本机检测状态
```

安装后在对应助手输入 `/knowledge-animator`（或按它的技能调用方式）即可使用。
想加新助手：编辑 `install.sh` 里的 `TOOLS` 表加一行即可（名称 | 用户级目录 | 项目级目录 | 探测路径）。

## 浏览器键盘控制

| 按键 | 作用 |
|---|---|
| `空格` | 播放 / 暂停时间轴 |
| `→` / `←` | 前进 / 后退一个步骤（同页内的动画帧） |
| `Shift + →` / `Shift + ←` | 翻到上 / 下一页 |
| `M` | 目录浮层，跳任意页 |
| `F` | 全屏 |
| `T` | 暗 / 亮主题切换（记忆上次选择） |
| `Home` / `End` | 首页 / 末页 |

URL 支持深链：`deck.html#p6s3` = 第 6 页第 3 步。

## 参考文档

- `references/authoring-guide.md` —— 怎么画 SVG 节点、连线、动画
- `references/scene-patterns.md` —— 8 种知识类型的图示套路
- `references/narrative-structure.md` —— 页数与叙事结构怎么拆

## 示例

- `examples/tcp-congestion-control/` —— TCP 慢启动 / 拥塞避免 / 快速恢复，含 cwnd 曲线实验
- `examples/tailscale-how-it-works/` —— 节点 / 控制面 / DERP 中继 / NAT 打洞，含严格 NAT 滑块实验
