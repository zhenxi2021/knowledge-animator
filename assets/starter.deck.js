/**
 * knowledge-animator · 起步模板
 *
 * 把这份文件复制成 deck.js，再按你的主题填内容。覆盖了 8 种页型
 * 各一个最小例子，删掉不需要的即可。
 *
 * 构建： node ../scripts/build.mjs deck.js
 * 自检： node ../scripts/check.mjs deck.js
 */
export default {
  title: '我的课件标题',
  subtitle: '一句话副标题，写在页头',
  slides: [

    /* ============ 1. 封面 ============ */
    {
      kind: 'cover',
      title: '一句话讲清这课解决什么问题',
      subtitle: '可以用更长的解释。但核心句子请用 <b>短</b> 而<b>具体</b>的描述。',
      kicker: 'INTERACTIVE COURSE · 5 页示例',
      chips: ['关键概念 1', '关键概念 2', '关键概念 3'],
      hint: '← → 步进 · 空格 播放 · M 目录 · T 主题',
    },

    /* ============ 2. 课程地图 ============ */
    {
      kind: 'map',
      num: 'MAP', eyebrow: 'COURSE MAP',
      title: '课程地图',
      lede: '四段：为什么 → 是什么 → 怎么动 → 真实现',
      parts: [
        { num: '01', title: '为什么', desc: '不解决这个问题会怎样', goto: 'why' },
        { num: '02', title: '是什么', desc: '它的形状 / 构成',      goto: '3' },
        { num: '03', title: '怎么动', desc: '它在运行时怎么变化',  goto: '3' },
        { num: '04', title: '落地',   desc: '代码 + 实验',          goto: 'lab' },
      ],
    },

    /* ============ 3. 动画场景（核心） ============ */
    {
      id: 'why', kind: 'scene', num: '01', eyebrow: 'OBJECT',
      menuTitle: '01 · 为什么',
      title: '把这一页要做的事说清',
      lede: '一句话描述这页图示在解释什么。',
      svg: `<svg viewBox="0 0 960 460" xmlns="http://www.w3.org/2000/svg">
  <text class="lane-t" x="34" y="44">SCENE HEAD · 副标题</text>

  <g class="node" id="a">
    <rect class="box" x="80" y="200" width="150" height="70" rx="11"/>
    <text class="t" x="155" y="232">A</text>
    <text class="s" x="155" y="252">起</text>
  </g>
  <g class="node" id="b">
    <rect class="box" x="730" y="200" width="150" height="70" rx="11"/>
    <text class="t" x="805" y="232">B</text>
    <text class="s" x="805" y="252">终</text>
  </g>

  <path class="edge" id="p1" d="M230 235 L730 235" marker-end="url(#ar)"/>
</svg>`,
      steps: [
        { note: '先说 A 是什么、在干什么。', enter: ['a'], focus: ['a'], dur: 1800 },
        { note: '数据从 A 出发。',           focus: ['a'], packet: { path: 'p1', text: 'DATA', dur: 1200 }, dur: 2000 },
        { note: '数据抵达 B。',               enter: ['b'], focus: ['b'], dur: 1800 },
        { note: '最后用一句话总结。',         focus: ['a', 'b'], tag: { on: 'b', text: '终态', tone: 'acc' }, dur: 2200 },
      ],
    },

    /* ============ 4. 对比表 ============ */
    {
      kind: 'compare', num: '02', eyebrow: 'COMPARISON',
      menuTitle: '02 · 对比',
      title: 'A 和 B 的关键差异',
      lede: '强调两边在某条性质上的不同。',
      cols: ['方案 A', '方案 B'],
      rows: [
        { k: '复杂度',   v: ['低',  '高'] },
        { k: '性能',     v: ['一般', '好'] },
        { k: '适用场景', v: ['小数据', '大数据'] },
      ],
      steps: [
        { rows: [0], note: '先看复杂度。A 简单，B 复杂。' },
        { rows: [1], note: '但 B 用复杂度换来了性能。' },
        { rows: [2], note: '所以两者不是谁更好，是看场景。' },
      ],
    },

    /* ============ 5. 核心代码 ============ */
    {
      kind: 'code', num: '03', eyebrow: 'CODE',
      menuTitle: '03 · 关键代码',
      title: '主逻辑只有几行',
      lede: '删掉所有边界处理后，剩下的就是这一段。',
      code: `function example(state) {
  if (!state.ready) {
    return;
  }
  // 关键一步
  state.value = compute(state);
  state.ready = false;
}`,
      steps: [
        { lines: [2, 3], note: '第一步：前置检查。' },
        { lines: [6],   note: '核心逻辑：算一下。' },
        { lines: [7],   note: '最后：标记完成。' },
      ],
    },

    /* ============ 6. 交互实验 ============ */
    {
      id: 'lab', kind: 'lab', num: '04', eyebrow: 'LAB',
      menuTitle: '04 · 实验',
      title: '动手调一下，看效果',
      lede: '至少给一个可调参数。',
      params: [
        { id: 'speed', label: '速度', min: 1, max: 10, step: 1, value: 5 },
      ],
      svg: (v) => {
        const x = 100 + v.speed * 70, y = 200;
        return `<svg viewBox="0 0 960 460" xmlns="http://www.w3.org/2000/svg">
  <text class="lane-t" x="34" y="44">LIVE LAB · 拖动"速度"滑块</text>
  <g class="node" id="d">
    <rect class="box acc" x="${x - 40}" y="${y - 30}" width="80" height="60" rx="10"/>
    <text class="t" x="${x}" y="${y + 5}">${v.speed}</text>
  </g>
</svg>`;
      },
      readouts: (v) => [
        { k: '当前值', v: v.speed },
        { k: '×2',     v: v.speed * 2 },
      ],
      insight: (v) => v.speed > 7
        ? '速度很快 —— 想想现实里有这种"越快越好"的东西吗？'
        : '慢有慢的好处。',
    },

    /* ============ 7. 资料索引 ============ */
    {
      kind: 'index', num: '05', eyebrow: 'SOURCES',
      menuTitle: '05 · 资料索引',
      title: '想往下读',
      items: [
        { label: 'RFC 0000', desc: '相关标准', url: 'https://www.rfc-editor.org' },
        { label: '某篇论文', desc: '原始出处', url: 'https://example.com' },
      ],
    },

    /* ============ 8. 结论 ============ */
    {
      kind: 'end', num: 'END', eyebrow: 'CONCLUSION',
      menuTitle: '06 · 结论',
      title: '最后记住 N 句话',
      points: [
        '第一句话。',
        '第二句话。',
        '第三句话。',
      ],
    },

  ],
};
