# Authoring Guide · SVG 图示绘制规范

> 本技能的核心产出是图。`deck.js` 里 60% 的代码是 SVG 字符串。这份规范告诉你怎么画——画错的话动画就动不起来。

## 画布约定

- `viewBox="0 0 960 460"`（横向 16:7.67 比例，适配常规屏幕）
- 顶部 y ≤ 30 与底部 y ≥ 430 留作边距
- 横向上图头标题放在 y ≈ 30
- 坐标系（场景有轴时）`x: 0..960`、`y: 0..460`
- 节点 box 默认 `width: 110–200`，`height: 50–80`，圆角 `rx: 10–12`
- 字号：主标签 `13.5px`（`.t`）、副标签 `10.5px mono`（`.s`）、批注 `11.5px`（`.em`）、标题 `14px mono`（`.lane-t`）

## 节点 `.node`

```html
<g class="node" id="xid">
  <rect class="box" x="60" y="200" width="160" height="70" rx="11"/>
  <text class="t"  x="140" y="232">主标签</text>
  <text class="s"  x="140" y="252">副标签</text>
</g>
```

- `id` 必须全局唯一，**`steps` 引用靠它**——id 拼错 = 那个节点永远不会动
- `.t` 默认 `text-anchor: middle`，所以 `x` 写节点中心
- 套色：`class="box acc|warn|ok|bad"` 可让边框着色（用 CSS 变量，主色统一）
- 套色：「内容不固定」的虚线框：`class="box ghost"`
- 圆点/圈：`<g class="node" id="x"><circle r="5"/></g>` 即可——引擎 CSS 已为 `.node circle` 准备 accent 填色

### 进入与离场
- 写在 `steps[i].enter` 里的节点，**初始隐藏**，需要时显式 `enter`
- 不在任何 `enter` 里的节点，**永远可见**（作为骨架）——这是最常见的固定图结构
- `exit` 在 `enter` 之后撤销显隐（让节点退场）。累计语义
- `focus` / `dim` 是**绝对**状态（每步覆盖）
- `label` 用于运行时改写节点里的文字，**累积**

### 批注 `tag`
- `tag:{on:'节点id', text:'...', tone:'acc|warn|ok|bad'}`，在节点正上方贴一个小气泡
- 引擎用 `getBBox()` 自动定位；不要在 SVG 里手画 tag

## 连线 `.edge` / 路径 `<path>`

```html
<path class="edge" id="p1" d="M200 220 L260 220" marker-end="url(#ar)"/>
<path class="edge" d="M260 240 L200 240" marker-end="url(#ar-acc)"/>
```

- `marker-end="url(#ar|ar-mute|ar-acc|ar-warn|ar-ok|ar-bad)"` 选箭头颜色
- 想要虚线：`class="edge dash"`
- 想要流光动效：`class="edge is-flow"`（动画 + dash 滚动）
- 路径要参与 `packet`，**必须**是 `<path>`（不能是 `<line>` / `<polyline>`）——`getPointAtLength` 只对 `<path>` 有效

## 分层 / 泳道

- 包络框：`<rect class="lane-box" x="..." y="..." width="..." height="..." rx="14"/>`
- 分割线：`<path class="lane" d="M0 200 L960 200" stroke-dasharray="3 5"/>`
- 标签：`<text class="lane-t" x="..." y="...">LANE NAME</text>`

## 数据包 packet

```js
{ packet: { path: 'p1', text: 'DATA', dur: 1200, reverse: false, hold: 0, tone: 'acc' } }
```

- 必须落在已存在的 `<path>` 上
- `text` 留空则只显示一个点
- `tone` 用 `--acc` / `--warn` / `--ok` / `--bad` 切换圆点色
- `reverse: true` 沿路径反向走（适合 ACK 返回）
- `hold: 200` 表示走完后保留 200ms 再消失
- 同一帧可以并行 `p1` + `p2`：`packet:[{path:'p1',...},{path:'p2',...}]`（也可以 `packet: {path:'p1',...}` 单个）

## 反模式

| 反模式 | 表现 | 解决 |
|---|---|---|
| 把"骨架"节点也写进 `enter` | 初始画面全空，要按好几下才看到东西 | 骨架不写 enter，**只有动态出现**的写 |
| `id` 写中文 / 含 `.` `:` | selector 取不到 | 用英文 id（语义优先：`proxy` 不是 `对象1`） |
| 一条路径上挂两个 `packet` | 引擎只管 `clearPackets` 后启新的，旧的会消失 | 用并行数组 `packet:[{path:'p1',...},{path:'p2',...}]` |
| 同一 id 在不同 svg 中复用 | 引擎按 id 取节点会拿到错位 | 同一 deck 内 id 全局唯一（每个 slide 一组） |
| 字号写到 16px+ | 与 `.h1` 抢视觉 | 主标签 ≤ 14px；强调用 `tone: acc` 着色 |
| 用 `text-anchor` 属性的中文文本居中 | CJK 字符宽度与 mono 字宽不同 | 主标签用 `x=center`，`.t` 已是 `text-anchor: middle`；批注另起 `.em` 自由摆放 |

## 配色

**只允许用 CSS 变量**，别硬编码颜色：
- `--acc` 主强调（蓝）
- `--acc2` 次强调（紫）
- `--warn` 提醒（橙）
- `--ok` 成功（绿）
- `--bad` 危险（红）
- `--mute` 次要文字
- `--faint` 更次要

`<rect style="fill:var(--line3)"/>` 这种 inline style 允许，用来给"不属于任何节点的骨架"上色。
