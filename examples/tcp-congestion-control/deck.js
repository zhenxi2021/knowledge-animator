/**
 * TCP 拥塞控制 —— 从慢启动到快速恢复
 *
 * 这是 knowledge-animator 的参考示例，覆盖全部 8 种页型：
 *   cover / map / scene(×5) / compare / code / lab / index / end
 *
 * 构建： node ../../scripts/build.mjs deck.js --open
 * 自检： node ../../scripts/check.mjs deck.js
 */

/* ============================================================
   通用件
   ============================================================ */
const SVG = (inner) => `<svg viewBox="0 0 960 460" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
const HEAD = (t) => `<text class="lane-t" x="34" y="44">${t}</text>`;

/* ============================================================
   SCENE 01 · 网络是个黑盒
   ============================================================ */
const SVG_BLACKBOX = SVG(`
  ${HEAD('BLACK BOX · 发送方对网络内部一无所知')}
  <rect class="lane-box" x="30" y="66" width="900" height="316" rx="14"/>
  <text class="em" x="906" y="92" text-anchor="end">带宽 / 队列深度 / 排队情况 —— 全部未知</text>

  <g class="node" id="app">
    <rect class="box" x="58" y="186" width="150" height="86" rx="11"/>
    <text class="t" x="133" y="220">应用</text>
    <text class="s" x="133" y="240">不停 write()</text>
  </g>
  <g class="node" id="snd">
    <rect class="box" x="272" y="186" width="164" height="86" rx="11"/>
    <text class="t" x="354" y="220">发送缓冲区</text>
    <text class="s" x="354" y="240">由 cwnd 决定放行</text>
  </g>
  <g class="node" id="net">
    <rect class="box" x="512" y="150" width="180" height="146" rx="11"/>
    <text class="t" x="602" y="182">路由器</text>
    <text class="s" x="602" y="202">出接口队列</text>
  </g>
  <g class="node" id="q1"><rect class="q" x="534" y="216" width="136" height="20" rx="4"/></g>
  <g class="node" id="q2"><rect class="q hot" x="534" y="242" width="136" height="20" rx="4"/></g>
  <g class="node" id="q3"><rect class="q bad" x="534" y="268" width="136" height="20" rx="4"/></g>
  <g class="node" id="drop">
    <text class="em" x="602" y="326" text-anchor="middle" style="fill:var(--bad)">✕ 尾丢弃 · 发送方毫不知情</text>
  </g>
  <g class="node" id="rcv">
    <rect class="box" x="756" y="186" width="150" height="86" rx="11"/>
    <text class="t" x="831" y="220">接收方</text>
    <text class="s" x="831" y="240">回 ACK</text>
  </g>

  <path class="edge" id="p1" d="M208 229 L266 229" marker-end="url(#ar)"/>
  <path class="edge" id="p2" d="M436 229 L506 229" marker-end="url(#ar)"/>
  <path class="edge" id="p3" d="M698 229 L750 229" marker-end="url(#ar)"/>
  <path class="edge" id="p4" d="M750 262 L698 262" marker-end="url(#ar-ok)"/>
  <text class="em" x="724" y="282" style="fill:var(--ok)">ACK</text>
`);

/* ============================================================
   SCENE 02 · 两个窗口
   ============================================================ */
const SVG_WINDOWS = SVG(`
  ${HEAD('SEND WINDOW = min(cwnd, rwnd) · 两个窗口，两种担心')}
  <text class="cap" x="180" y="396" text-anchor="start">已确认</text>
  <line class="lane" x1="180" y1="404" x2="880" y2="404"/>
  <rect x="180" y="404" width="150" height="12" rx="3" style="fill:var(--line3)"/>
  <text class="cap" x="255" y="434">已确认</text>
  <rect x="338" y="404" width="230" height="12" rx="3" style="fill:var(--warn)"/>
  <text class="cap" x="453" y="434">已发送 · 未确认</text>
  <rect x="576" y="404" width="304" height="12" rx="3" style="fill:var(--panel3)"/>
  <text class="cap" x="728" y="434">还不能发</text>

  <g class="node" id="rwnd">
    <text class="em" x="40" y="152">接收方通告</text>
    <rect class="box" x="180" y="128" width="380" height="46" rx="9"/>
    <text class="t" x="370" y="157">rwnd = 380</text>
  </g>
  <g class="node" id="cwnd">
    <text class="em" x="40" y="242">发送方自估</text>
    <rect class="box" x="180" y="218" width="220" height="46" rx="9"/>
    <text class="t" x="290" y="247">cwnd = 220</text>
  </g>
  <g class="node" id="win">
    <text class="em" x="40" y="332">实际能发</text>
    <rect class="box acc" x="180" y="308" width="220" height="46" rx="9"/>
    <text class="t" x="290" y="337">min = 220</text>
  </g>
`);

/* ============================================================
   SCENE 03 · 慢启动（ACK 自时钟）
   ============================================================ */
const RTT_LANES = [
  { y: 92,  n: 1, ack: 142 },
  { y: 172, n: 2, ack: 222 },
  { y: 252, n: 4, ack: 302 },
  { y: 332, n: 8, ack: null },
];
const SVG_SLOWSTART = SVG(`
  ${HEAD('SLOW START · 每回来一个 ACK，cwnd += 1 MSS')}
  ${RTT_LANES.map((l, i) => `
  <g class="node" id="r${i + 1}">
    <text class="em" x="46" y="${l.y + 24}">RTT ${i + 1}</text>
    ${Array.from({ length: l.n }, (_, k) =>
      `<rect class="box" x="${190 + k * 38}" y="${l.y}" width="30" height="34" rx="6"/>`
    ).join('')}
    <text class="t" x="580" y="${l.y + 24}">cwnd = ${l.n}</text>
  </g>
  ${l.ack ? `<path class="edge" id="a${i + 1}" d="M520 ${l.ack} L196 ${l.ack}" marker-end="url(#ar-ok)"/>` : ''}
  ${l.ack ? `<text class="em" x="532" y="${l.ack + 4}" style="fill:var(--ok)">ACK ×${l.n}</text>` : ''}
  `).join('')}
  <text class="cap" x="580" y="392">← 一个 RTT 翻一倍 →</text>
`);

/* ============================================================
   SCENE 04 · 状态机
   ============================================================ */
const SVG_FSM = SVG(`
  ${HEAD('STATE MACHINE · 两个状态、两条出路')}

  <g class="node" id="ss">
    <rect class="box" x="70" y="96" width="190" height="66" rx="11"/>
    <text class="t" x="165" y="122">慢启动</text>
    <text class="s" x="165" y="142">Slow Start · 指数增长</text>
  </g>
  <g class="node" id="ca">
    <rect class="box" x="430" y="96" width="210" height="66" rx="11"/>
    <text class="t" x="535" y="122">拥塞避免</text>
    <text class="s" x="535" y="142">Congestion Avoidance · 线性增长</text>
  </g>
  <g class="node" id="fr">
    <rect class="box" x="720" y="250" width="200" height="66" rx="11"/>
    <text class="t" x="820" y="276">快速恢复</text>
    <text class="s" x="820" y="296">Fast Recovery</text>
  </g>
  <g class="node" id="rto">
    <rect class="box bad" x="180" y="290" width="200" height="66" rx="11"/>
    <text class="t" x="280" y="316">超时重传</text>
    <text class="s" x="280" y="336">RTO · 最坏的信号</text>
  </g>

  <path class="edge" id="e1" d="M260 120 L430 120" marker-end="url(#ar-acc)"/>
  <text class="em" x="345" y="110" text-anchor="middle">cwnd ≥ ssthresh</text>

  <path class="edge" id="e2" d="M640 162 C700 190 750 208 782 250" marker-end="url(#ar-warn)"/>
  <text class="em" x="742" y="206" text-anchor="start" style="fill:var(--warn)">3 个重复 ACK</text>

  <path class="edge" id="e3" d="M880 250 C930 180 720 132 640 132" marker-end="url(#ar-ok)"/>
  <text class="em" x="906" y="168" text-anchor="end" style="fill:var(--ok)">新 ACK 到达</text>

  <path class="edge" id="e4" d="M470 162 C440 200 390 240 344 276" marker-end="url(#ar-bad)"/>
  <text class="em" x="392" y="230" text-anchor="end" style="fill:var(--bad)">超时</text>

  <path class="edge" id="e5" d="M720 306 C600 366 430 356 388 336" marker-end="url(#ar-bad)"/>
  <text class="em" x="560" y="374" style="fill:var(--bad)">超时</text>

  <path class="edge" id="e6" d="M276 290 C266 240 230 200 212 168" marker-end="url(#ar-bad)"/>
  <text class="em" x="150" y="252" text-anchor="start" style="fill:var(--bad)">ssthresh = cwnd/2</text>
  <text class="em" x="150" y="270" text-anchor="start" style="fill:var(--bad)">cwnd = 1</text>
`);

/* ============================================================
   SCENE 05 · AIMD 公平性
   ============================================================ */
const AIMD_PTS = [
  [340, 110], [320, 250], [390, 180], [345, 285], [420, 210],
  [360, 300], [435, 225], [367.5, 307.5], [442.5, 232.5], [450, 240],
];
const SVG_AIMD = SVG(`
  ${HEAD('AIMD · 加性增、乘性减，为什么一定收敛到公平')}
  <path class="lane" d="M300 390 L624 390" marker-end="url(#ar)"/>
  <path class="lane" d="M300 390 L300 64"  marker-end="url(#ar)"/>
  <text class="em" x="630" y="394">流 A 的窗口</text>
  <text class="em" x="306" y="78" text-anchor="start">↑ 流 B 的窗口</text>

  <g class="node" id="fair">
    <path class="edge" d="M300 390 L600 90" stroke-dasharray="7 6" style="stroke:var(--ok)"/>
    <text class="em" x="566" y="100" text-anchor="end" style="fill:var(--ok)">公平线 B = A</text>
  </g>
  <g class="node" id="cap">
    <path class="edge" d="M300 90 L600 390" stroke-dasharray="7 6" style="stroke:var(--bad)"/>
    <text class="em" x="332" y="106" style="fill:var(--bad)">瓶颈 A + B = 150</text>
  </g>

  ${AIMD_PTS.slice(1).map(([x1, y1], i) => {
    const [x0, y0] = AIMD_PTS[i];
    return `<path class="edge" id="s${i + 1}" d="M${x0} ${y0} L${x1} ${y1}"/>`;
  }).join('')}

  ${AIMD_PTS.map(([x, y], i) =>
    `<g class="node" id="d${i}"><circle cx="${x}" cy="${y}" r="5"/></g>`
  ).join('')}

  <text class="em" x="356" y="124" style="fill:var(--mute)">A=20 B=140</text>
`);

/* ============================================================
   交互实验室：cwnd 模拟器
   ============================================================ */
const ROUNDS = 16;
function simulate({ ssthresh, lossRound, recovery }) {
  let cwnd = 1, ss = ssthresh;
  const out = [];
  for (let r = 1; r <= ROUNDS; r++) {
    if (cwnd < ss) cwnd = Math.min(ss, cwnd * 2);
    else cwnd += 1;
    const loss = r === lossRound;
    if (loss) {
      ss = Math.max(2, Math.floor(cwnd / 2));
      cwnd = recovery ? ss : 1;
    }
    out.push({
      r, cwnd, ss, loss,
      phase: loss ? (recovery ? 'fast-recovery' : 'slow-start')
                  : (cwnd < ss ? 'slow-start' : 'congestion-avoidance'),
    });
  }
  return out;
}
const PHASE_TONE = { 'slow-start': 'warn', 'congestion-avoidance': 'acc', 'fast-recovery': 'ok' };
const PHASE_NAME = { 'slow-start': '慢启动', 'congestion-avoidance': '拥塞避免', 'fast-recovery': '快速恢复' };

function labChart(v) {
  const data = simulate(v);
  const top = Math.max(8, Math.ceil(Math.max(...data.map(d => d.cwnd), v.ssthresh) / 4) * 4);
  const x0 = 78, x1 = 912, yBase = 386, yTop = 62;
  const X = r => x0 + (r - 1) * (x1 - x0) / (ROUNDS - 1);
  const Y = c => yBase - (c / top) * (yBase - yTop);
  const step = top / 4;

  const grid = [0, 1, 2, 3, 4].map(i => {
    const c = i * step, y = Y(c);
    return `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" style="stroke:var(--line)"/>
            <text class="em" x="${x0 - 12}" y="${y + 4}" text-anchor="end">${c}</text>`;
  }).join('');

  const xlab = data.filter(d => d.r % 2 === 0 || d.r === 1)
    .map(d => `<text class="em" x="${X(d.r)}" y="${yBase + 24}" text-anchor="middle">${d.r}</text>`).join('');

  const seg = data.slice(1).map((d, i) => {
    const p = data[i], tone = `var(--${PHASE_TONE[d.phase]})`;
    return `<line x1="${X(p.r)}" y1="${Y(p.cwnd)}" x2="${X(d.r)}" y2="${Y(d.cwnd)}"
                  style="stroke:${tone}" stroke-width="2.6" stroke-linecap="round"/>`;
  }).join('');

  const dots = data.map(d => {
    const tone = `var(--${PHASE_TONE[d.phase]})`;
    return d.loss
      ? `<g><circle cx="${X(d.r)}" cy="${Y(d.cwnd)}" r="7" fill="none" stroke="var(--bad)" stroke-width="2.4"/>
           <path d="M${X(d.r) - 4} ${Y(d.cwnd) - 4} L${X(d.r) + 4} ${Y(d.cwnd) + 4}
                    M${X(d.r) + 4} ${Y(d.cwnd) - 4} L${X(d.r) - 4} ${Y(d.cwnd) + 4}"
                 style="stroke:var(--bad)" stroke-width="2"/></g>`
      : `<circle cx="${X(d.r)}" cy="${Y(d.cwnd)}" r="4.5" style="fill:${tone};stroke:var(--bg2);stroke-width:2"/>`;
  }).join('');

  const ss0 = Y(v.ssthresh);
  const ss1 = Y(data[data.length - 1].ss);
  const dashed = (y, tone, label) => `
    <line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke-dasharray="6 6"
          style="stroke:var(--${tone})" stroke-width="1.4"/>
    <text class="em" x="${x1}" y="${y - 7}" text-anchor="end" style="fill:var(--${tone})">${label}</text>`;

  return SVG(`
    ${HEAD('LIVE LAB · 拖动参数，看拥塞窗口怎么被"砍"下来')}
    ${grid}
    <line x1="${x0}" y1="${yBase}" x2="${x1}" y2="${yBase}" style="stroke:var(--line2)"/>
    <text class="em" x="${x0 - 12}" y="40" text-anchor="end">cwnd</text>
    <text class="em" x="${x1}" y="${yBase + 44}" text-anchor="end">RTT</text>
    ${dashed(ss0, 'mute', `初始 ssthresh = ${v.ssthresh}`)}
    ${v.lossRound <= ROUNDS ? dashed(ss1, 'warn', `丢包后 ssthresh = ${data[data.length - 1].ss}`) : ''}
    ${seg}${dots}${xlab}
    <g>
      <rect x="620" y="52" width="18" height="4" rx="2" style="fill:var(--warn)"/>
      <text class="em" x="646" y="58">慢启动（指数）</text>
      <rect x="760" y="52" width="18" height="4" rx="2" style="fill:var(--acc)"/>
      <text class="em" x="786" y="58">拥塞避免（线性）</text>
    </g>
    <text class="cap" x="480" y="440" text-anchor="middle">当前末段：${PHASE_NAME[data[data.length - 1].phase]}</text>
  `);
}

function labReadouts(v) {
  const d = simulate(v);
  const before = d[v.lossRound - 2]?.cwnd ?? 0;
  const at = d[v.lossRound - 1];
  return [
    { k: '丢包前峰值', v: `${before} MSS` },
    { k: '丢包后', v: `${at.cwnd} MSS` },
    { k: '新 ssthresh', v: `${at.ss} MSS` },
    { k: `第 ${ROUNDS} 个 RTT`, v: `${d[d.length - 1].cwnd} MSS` },
  ];
}
function labInsight(v) {
  const d = simulate(v);
  const before = d[v.lossRound - 2]?.cwnd ?? 0;
  const after = d[v.lossRound - 1].cwnd;
  const tail = d[d.length - 1].cwnd;
  if (v.recovery) {
    return `快恢复：${before} → ${after}，只砍一半，随后线性爬回 ${tail}。<br>
            慢启动那一段的陡峭，和丢包这一下的陡降，合起来就是 TCP 的锯齿。`;
  }
  return `Tahoe：${before} → 1，直接退回慢启动。<br>
          早期实现的选择，恢复代价大得多 —— 这正是 Reno 引入快恢复的原因。`;
}

/* ============================================================
   DECK
   ============================================================ */
export default {
  title: 'TCP 拥塞控制',
  subtitle: 'SLOW START · CONGESTION AVOIDANCE · FAST RECOVERY',
  slides: [
    {
      id: 'cover', kind: 'cover',
      title: 'TCP 拥塞控制：一条看不见的管子，和一个只能靠猜的窗口',
      subtitle: '发送方永远看不到网络内部。它唯一能做的，是根据 ACK 回来的节奏，不断修正一个叫 cwnd 的数字。这一课把它拆开看。',
      kicker: 'INTERACTIVE COURSE · 12 页',
      chips: ['慢启动', '拥塞避免', '快速恢复', 'AIMD 公平性', 'Reno / Tahoe / CUBIC'],
      hint: '← → 步进 · 空格 自动播放 · M 目录 · F 全屏 · T 换肤',
    },

    {
      id: 'map', kind: 'map', num: 'MAP', eyebrow: 'COURSE MAP',
      title: '课程地图', lede: '四段：为什么会拥塞 → 窗口是什么 → 怎么增长与回退 → 为什么这样设计是公平的。',
      parts: [
        { num: '01', title: '网络是个黑盒', desc: '发送方看不到路由器队列，只能通过丢包间接推断。', pages: ['黑盒', '丢包'], goto: 'why' },
        { num: '02', title: '两个窗口', desc: 'rwnd 管接收方，cwnd 管网络。真正的发送窗口取二者较小值。', pages: ['rwnd', 'cwnd'], goto: 'windows' },
        { num: '03', title: '增长与回退', desc: '慢启动指数增长、拥塞避免线性增长，丢包触发状态迁移。', pages: ['慢启动', '状态机'], goto: 'slowstart' },
        { num: '04', title: '为什么公平', desc: 'AIMD 的收敛性，以及三代算法的分野。', pages: ['AIMD', '对比', '实验'], goto: 'aimd' },
      ],
    },

    {
      id: 'why', kind: 'scene', num: '01', eyebrow: 'OBJECT / 问题从哪来',
      menuTitle: '01 · 网络是个黑盒',
      title: '发送方看不见网络，只能看见 ACK',
      lede: '拥塞控制的全部困难，都来自这一条信息不对称。',
      svg: SVG_BLACKBOX,
      steps: [
        { note: '应用只管往 socket 里 write()。它完全不知道网络上发生了什么，也不该知道。', enter: ['app'], focus: ['app'], dur: 1900 },
        { note: '数据落到发送缓冲区。真正决定"这一刻能发多少"的，不是应用，是拥塞窗口 cwnd。', enter: ['snd'], focus: ['snd'], packet: { path: 'p1', text: '数据', dur: 1100, hold: 400 }, dur: 2200 },
        { note: '被放行的包进入网络，在路由器的出接口排队。队列是网络里唯一会被填满的东西。', enter: ['net', 'q1', 'q2'], focus: ['net'], packet: { path: 'p2', text: 'DATA', dur: 1300 }, dur: 2300 },
        { note: '队列排满，后来的包被直接丢弃 —— 这叫尾丢弃（tail drop）。注意：网络不会通知任何人。', enter: ['q3', 'drop'], focus: ['drop'], flash: ['q3'], dur: 2400 },
        { note: '接收方只对收到的包回 ACK。丢掉的那个包，不会产生 ACK。', enter: ['rcv'], focus: ['rcv'], packet: { path: 'p3', text: 'SEG', dur: 1100 }, dur: 2100 },
        { note: '于是发送方只能靠两条线索反推：ACK 迟迟不来（超时），或者连着收到 3 个重复的 ACK。', focus: ['snd'], packet: { path: 'p4', text: 'ACK', reverse: true, dur: 1400 }, dur: 2400 },
        { note: '结论：拥塞控制是一个"用 ACK 当心跳"的反馈系统。cwnd 就是它唯一的输出。', focus: ['snd', 'net'], tag: { on: 'snd', text: '唯一的输出：cwnd', tone: 'acc' }, dur: 2600 },
      ],
    },

    {
      id: 'windows', kind: 'scene', num: '02', eyebrow: 'OBJECT / 两个窗口',
      menuTitle: '02 · 两个窗口',
      title: 'rwnd 管接收方，cwnd 管网络',
      lede: '这两个窗口解决的是完全不同的问题，但发送方必须同时尊重它们。',
      svg: SVG_WINDOWS,
      steps: [
        { note: 'rwnd：接收方在每个 ACK 里通告自己的剩余缓冲。意思是"别把我撑死"。这是流量控制。', enter: ['rwnd'], focus: ['rwnd'], dur: 2400 },
        { note: 'cwnd：发送方自己维护的一个私有数字，从不在报文中传输。意思是"我猜网络还能吃多少"。这是拥塞控制。', enter: ['cwnd'], focus: ['cwnd'], dur: 2600 },
        { note: '实际能发出去的，是两者的较小值。绝大多数时候卡住你的是 cwnd，不是 rwnd。', enter: ['win'], focus: ['win'], dur: 2400 },
        { note: '所以：整门拥塞控制，研究的就是"这一个数字该怎么变"。', focus: ['cwnd', 'win'], tag: { on: 'cwnd', text: '本课的全部主角', tone: 'acc' }, dur: 2600 },
      ],
    },

    {
      id: 'slowstart', kind: 'scene', num: '03', eyebrow: 'PROTOCOL / 增长',
      menuTitle: '03 · 慢启动',
      title: '慢启动一点都不慢，它是指数的',
      lede: '每个回来的 ACK 都让 cwnd 加 1 —— 于是一个 RTT 就翻一倍。',
      svg: SVG_SLOWSTART,
      steps: [
        { note: '连接刚建立时 cwnd = 1 MSS。第一个 RTT 只能发一个包，慢得可笑。', enter: ['r1'], focus: ['r1'], dur: 2200 },
        { note: 'ACK 回来了，cwnd += 1 → 2。注意推动增长的是 ACK，不是定时器。这叫 ACK 自时钟。', packet: { path: 'a1', text: 'ACK', reverse: true, dur: 1300 }, focus: ['r1'], dur: 2400 },
        { note: '第二个 RTT 发 2 个包，回来 2 个 ACK，cwnd = 4。', enter: ['r2'], focus: ['r2'], dur: 2100 },
        { note: '4 个 ACK → cwnd = 8。窗口沿着 1 → 2 → 4 → 8 这条路狂奔。', enter: ['r3'], focus: ['r3'], packet: { path: 'a2', text: 'ACK×2', reverse: true, dur: 1200 }, dur: 2300 },
        { note: '第四个 RTT 可以一次发 8 个包了。从 1 到 8 只用了 4 个 RTT。', enter: ['r4'], focus: ['r4'], packet: { path: 'a3', text: 'ACK×4', reverse: true, dur: 1200 }, dur: 2300 },
        { note: '指数增长不可能无限持续。撞上一个叫 ssthresh 的阈值，就切换到线性模式。', focus: ['r4'], tag: { on: 'r4', text: '撞上 ssthresh 就切换', tone: 'warn' }, dur: 2600 },
      ],
    },

    {
      id: 'fsm', kind: 'scene', num: '04', eyebrow: 'PROTOCOL / 回退',
      menuTitle: '04 · 状态机',
      title: '两条回退路径：重复 ACK，还是超时',
      lede: '同样是丢包，信号的强弱完全不同，代价也完全不同。',
      svg: SVG_FSM,
      steps: [
        { note: '起点是慢启动。cwnd 指数增长，直到达到 ssthresh。', enter: ['ss'], focus: ['ss'], dur: 2000 },
        { note: '越过 ssthresh 后进入拥塞避免：每个 RTT 只加 1 MSS，从指数切换到线性。', enter: ['ca'], focus: ['ca'], packet: { path: 'e1', text: '切换', dur: 1200 }, dur: 2400 },
        { note: '弱信号：连着收到 3 个重复 ACK。说明只是丢了个包，网络还在转发后面的包 —— 代价可控。', enter: ['fr'], focus: ['fr'], packet: { path: 'e2', text: '3 dup ACK', dur: 1500 }, dur: 2600 },
        { note: '于是进入快速恢复：cwnd 砍半，重传丢失的包，不退回慢启动。收到新 ACK 就回到拥塞避免。', packet: { path: 'e3', text: '新 ACK', dur: 1600 }, focus: ['fr', 'ca'], dur: 2600 },
        { note: '强信号：超时 RTO。一个 ACK 都没回来，说明网络可能真的堵死了。', enter: ['rto'], focus: ['rto'], packet: { path: 'e4', text: 'RTO', dur: 1300 }, dur: 2500 },
        { note: '超时是最严厉的惩罚：ssthresh = cwnd/2，cwnd 直接重置为 1，从头开始慢启动。', packet: { path: 'e6', text: 'cwnd = 1', dur: 1500 }, focus: ['rto', 'ss'], dur: 2600 },
        { note: '快速恢复也可能超时 —— 那就同样打回慢启动。两条路最终都汇到 RTO。', packet: { path: 'e5', text: 'RTO', dur: 1400 }, focus: ['rto'], dur: 2400 },
        { note: '记住这个分野：重复 ACK = 砍一半；超时 = 归零重来。', focus: ['ca', 'rto'], tag: { on: 'rto', text: '最贵的信号', tone: 'bad' }, dur: 2600 },
      ],
    },

    {
      id: 'aimd', kind: 'scene', num: '05', eyebrow: 'PROTOCOL / 公平性',
      menuTitle: '05 · AIMD 为什么公平',
      title: '加性增、乘性减，会让两条流收敛到公平',
      lede: '不是约定，不是调度 —— 公平性是这条反馈律自己长出来的性质。',
      svg: SVG_AIMD,
      steps: [
        { note: '两条流共享同一条瓶颈链路。横轴是 A 的窗口，纵轴是 B 的窗口。', enter: ['fair', 'cap'], focus: ['fair'], dur: 2300 },
        { note: '起点严重不公平：A 只有 20，B 有 140。两者相加 160，已经超过瓶颈容量 150。', enter: ['d0'], focus: ['d0'], dur: 2500 },
        { note: '超了就要丢包。两条流同时检测到丢包，同时乘性减小：各自砍一半。', enter: ['d1'], packet: { path: 's1', text: '×0.5', dur: 1300 }, focus: ['d1'], dur: 2500 },
        { note: '然后加性增大：每个 RTT 各加 1 MSS。注意这个方向 —— 它是 45° 的，朝向公平线。', enter: ['d2'], packet: { path: 's2', text: '+1 每 RTT', dur: 1500 }, focus: ['d2'], dur: 2600 },
        { note: '又撞上瓶颈，再砍一半。每一次砍半，两条流的差距也跟着缩小一半。', enter: ['d3'], packet: { path: 's3', text: '×0.5', dur: 1200 }, focus: ['d3'], dur: 2500 },
        { note: '再爬升。加性增的方向平行于公平线，所以它在缩小相对差距。', enter: ['d4'], packet: { path: 's4', text: '+1', dur: 1300 }, focus: ['d4'], dur: 2400 },
        { note: '反复几个回合，锯齿越来越小，轨迹被"吸"向公平线。', enter: ['d5', 'd6', 'd7', 'd8'], packet: { path: 's5', text: '×0.5', dur: 1100 }, focus: ['d8'], dur: 2600 },
        { note: '收敛点是 A = B = 75，正好在公平线上。这就是 AIMD 的收敛性 —— TCP 公平性的全部来源。', enter: ['d9'], focus: ['d9'], tag: { on: 'd9', text: 'A = B = 75', tone: 'ok' }, dur: 2800 },
      ],
    },

    {
      id: 'compare', kind: 'compare', num: '06', eyebrow: 'ADAPTATION / 三代算法',
      menuTitle: '06 · Reno / Tahoe / CUBIC',
      title: '同一个 AIMD 骨架，三代不同做法',
      lede: '差别全在两件事：丢包后砍到多少，以及之后怎么长回去。',
      cols: ['Tahoe (1988)', 'Reno (1990)', 'CUBIC (2006+)'],
      rows: [
        { k: '丢包后 cwnd', v: ['重置为 1 MSS', '降为 cwnd / 2', '乘性减小 × 0.7'] },
        { k: '恢复路径', v: ['重新慢启动', '快恢复后线性增长', '三次函数，凹段快、凸段慢'] },
        { k: '增长依据', v: ['RTT 个数', 'RTT 个数', '距上次丢包的时间'] },
        { k: '高速网络表现', v: ['差', '差（RTT 越短越吃亏）', '好（与 RTT 解耦）'] },
        { k: '现状', v: ['历史意义', '教科书基线', 'Linux / 主流系统默认'] },
      ],
      steps: [
        { rows: [0], note: '第一处分野：丢包后砍到多狠。 Tahoe 直接归零，Reno 砍一半，CUBIC 只砍三成。' },
        { rows: [1], note: '第二处分野：砍完之后怎么长回去。前两者都按 RTT 计数，CUBIC 改按真实时间。' },
        { rows: [2], note: '按 RTT 计数有个致命问题：RTT 短的流增长更快，长肥管道上极不公平。' },
        { rows: [3], note: 'CUBIC 用三次函数把增长和 RTT 解耦，这才撑起了今天的高速长距网络。' },
        { rows: [4], note: '骨架一直没变，变的只是这两个旋钮。' },
      ],
    },

    {
      id: 'code', kind: 'code', num: '07', eyebrow: 'SOURCE / 实现',
      menuTitle: '07 · 核心代码',
      title: '增长逻辑其实只有十几行',
      lede: 'Linux net/ipv4/tcp_cong.c 的主干，去掉边界处理之后的样子。',
      code: `static void tcp_cong_avoid(struct sock *sk, u32 ack, u32 acked)
{
    struct tcp_sock *tp = tcp_sk(sk);

    if (!tcp_is_cwnd_limited(sk))
        return;

    if (tcp_in_slow_start(tp))
        acked = tcp_slow_start(tp, acked);
    else
        tcp_cong_avoid_ai(tp, tp->snd_cwnd, acked);

    tp->snd_cwnd = min(tp->snd_cwnd, tp->snd_cwnd_clamp);
}`,
      steps: [
        { lines: [5, 6], note: '第一个判断很容易被忽略：如果应用根本没给够数据，cwnd 就不动。否则会把"应用空闲"误判成"网络很宽"。' },
        { lines: [8, 9], note: '慢启动分支：每确认一个包，cwnd 加 1。一个 RTT 翻倍的效果就出自这里。' },
        { lines: [10, 11], note: '拥塞避免分支：加性增大，每个 RTT 约加 1 MSS。' },
        { lines: [13], note: '最后夹一个上限。整个函数没有一处"测量网络" —— 全是推测。' },
      ],
    },

    {
      id: 'lab', kind: 'lab', num: '08', eyebrow: 'LIVE LAB / 动手',
      menuTitle: '08 · 交互实验',
      title: '拖动参数，看锯齿怎么长出来',
      lede: '改初始阈值、改丢包时机、切换 Tahoe / Reno，曲线会立刻重算。',
      params: [
        { id: 'ssthresh', label: '初始 ssthresh', min: 4, max: 64, step: 4, value: 16 },
        { id: 'lossRound', label: '第几个 RTT 丢包', min: 2, max: 14, step: 1, value: 6 },
        { id: 'recovery', label: '丢包处理（0=Tahoe / 1=Reno）', min: 0, max: 1, step: 1, value: 1 },
      ],
      svg: labChart,
      readouts: labReadouts,
      insight: labInsight,
    },

    {
      id: 'index', kind: 'index', num: '09', eyebrow: 'SOURCE INDEX',
      menuTitle: '09 · 资料索引',
      title: '想往下读，从这几个入口进',
      items: [
        { label: 'RFC 5681', desc: 'TCP Congestion Control —— 慢启动、拥塞避免、快重传快恢复的标准定义', url: 'https://datatracker.ietf.org/doc/html/rfc5681' },
        { label: 'RFC 9438', desc: 'CUBIC for Fast Long-Distance Networks —— Linux 默认算法', url: 'https://datatracker.ietf.org/doc/html/rfc9438' },
        { label: 'Jacobson 1988', desc: 'Congestion Avoidance and Control —— 一切的开端，慢启动与 AIMD 的出处', url: 'https://ee.lbl.gov/papers/congavoid.pdf' },
        { label: 'tcp_cong.c', desc: 'Linux 拥塞控制框架与 tcp_slow_start / tcp_cong_avoid_ai', url: 'https://elixir.bootlin.com/linux/latest/source/net/ipv4/tcp_cong.c' },
        { label: 'tcp_input.c', desc: 'ACK 处理、重复 ACK 判定与快速恢复的状态迁移', url: 'https://elixir.bootlin.com/linux/latest/source/net/ipv4/tcp_input.c' },
      ],
    },

    {
      id: 'end', kind: 'end', num: 'END', eyebrow: 'CONCLUSION',
      menuTitle: '10 · 结论',
      title: '最后记住四句话',
      points: [
        '发送方看不见网络。它唯一的传感器是 ACK —— 拥塞控制是一个靠心跳驱动的反馈系统。',
        'rwnd 是接收方给的，cwnd 是发送方猜的。真正的发送窗口是 min(rwnd, cwnd)，而瓶颈几乎总是 cwnd。',
        '增长是指数转线性，回退分两档：重复 ACK 砍一半，超时直接归零。',
        '公平不是谁分配的。加性增 + 乘性减这条反馈律本身就会把多条流吸到公平线上。',
      ],
    },
  ],
};
