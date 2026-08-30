/**
 * knowledge-animator · Tailscale 工作原理
 * 取材：https://tailscale.com/blog/how-tailscale-works
 * 构建： node ../../scripts/build.mjs deck.js
 * 自检： node ../../scripts/check.mjs deck.js
 */
export default {
  title: 'Tailscale 是怎么工作的',
  subtitle: '不需要公网 IP、不用开端口、不用改网络——装两个客户端就能 P2P 直连。背后是 WireGuard + 一个只传公钥的协调服务器 + 一套 NAT 打洞魔法。',
  slides: [

    /* ============ 1. 封面 ============ */
    {
      kind: 'cover',
      kicker: 'INTERACTIVE COURSE · Tailscale 工作原理',
      title: 'Tailscale 是怎么工作的',
      subtitle: '不需要公网 IP、不用开端口、不用改网络——装两个客户端就能 P2P 直连。背后是 WireGuard + 一个只传公钥的协调服务器 + 一套 NAT 打洞魔法。',
      chips: ['WireGuard', 'Coordination Server', 'DERP 中继', 'NAT 穿透', 'Zero-config'],
      hint: '← → 步进 · 空格 播放 · M 目录 · T 主题',
    },

    /* ============ 2. 课程地图 ============ */
    {
      kind: 'map',
      num: 'MAP', eyebrow: 'COURSE MAP',
      title: '课程地图',
      lede: '四段：传统 VPN 卡在哪 → Tailscale 三件套 → 连接怎么一步步建起来 → 对比 / 代码 / 动手实验。',
      parts: [
        { num: '01', title: '为什么',   desc: '传统 VPN 的延迟与单点之痛', goto: 'why' },
        { num: '02', title: '是什么',   desc: '数据面·控制面·中继三件套',   goto: 'arch' },
        { num: '03', title: '怎么动',   desc: '登录→分发公钥→打洞→直连',   goto: 'kex' },
        { num: '04', title: '真实现',   desc: '对比、代码、动手实验',       goto: 'cmp' },
      ],
    },

    /* ============ 3. 传统 VPN 痛点 ============ */
    {
      id: 'why', kind: 'scene', num: '01', eyebrow: 'THE PROBLEM',
      menuTitle: '01 · 传统 VPN 的痛',
      title: '传统 VPN：所有流量都得先过中央网关',
      lede: '一个纽约员工访问同城的纽约服务器，却要绕到旧金山的网关——延迟翻倍，且枢纽是单点瓶颈。',
      svg: `<svg viewBox="0 0 960 460" xmlns="http://www.w3.org/2000/svg">
  <text class="lane-t" x="34" y="44">TRADITIONAL VPN · hub-and-spoke</text>

  <g class="node" id="A">
    <rect class="box" x="60" y="330" width="160" height="64" rx="11"/>
    <text class="t" x="140" y="358">员工 A</text>
    <text class="s" x="140" y="376">纽约</text>
  </g>
  <g class="node" id="B">
    <rect class="box" x="60" y="200" width="160" height="64" rx="11"/>
    <text class="t" x="140" y="228">员工 B</text>
    <text class="s" x="140" y="246">远程</text>
  </g>
  <g class="node" id="C">
    <rect class="box" x="60" y="70" width="160" height="64" rx="11"/>
    <text class="t" x="140" y="98">员工 C</text>
    <text class="s" x="140" y="116">门店</text>
  </g>
  <g class="node" id="HUB">
    <rect class="box warn" x="400" y="120" width="170" height="64" rx="11"/>
    <text class="t" x="485" y="148">中央 VPN 网关</text>
    <text class="s" x="485" y="166">旧金山 · 需公网 IP</text>
  </g>
  <g class="node" id="S">
    <rect class="box" x="740" y="330" width="160" height="64" rx="11"/>
    <text class="t" x="820" y="358">服务器</text>
    <text class="s" x="820" y="376">纽约</text>
  </g>

  <path class="edge" id="e1" d="M220 345 C 300 320, 360 240, 400 168" marker-end="url(#ar)"/>
  <path class="edge" id="e2" d="M220 232 C 300 232, 360 210, 400 152" marker-end="url(#ar)"/>
  <path class="edge" id="e3" d="M220 102 C 300 110, 360 125, 400 145" marker-end="url(#ar)"/>
  <path class="edge" id="e4" d="M570 168 C 640 215, 690 290, 740 340" marker-end="url(#ar)"/>
</svg>`,
      steps: [
        { note: '传统 VPN 是 hub-and-spoke：每个客户端都先连到中央网关。', focus: ['HUB'], dur: 2200 },
        { note: '员工 A 在纽约，要访问同样在纽约的服务器。', focus: ['A', 'S'], dur: 2400 },
        { note: '但请求得先北上到旧金山的网关——明明同城却绕了半个美国。', focus: ['A', 'HUB'], packet: { path: 'e1', text: '请求', dur: 1300 }, tag: { on: 'HUB', text: '旧金山', tone: 'warn' }, dur: 2800 },
        { note: '再由网关转发到服务器。一来一回，延迟翻倍。', focus: ['HUB', 'S'], packet: { path: 'e4', text: '转发', dur: 1300 }, tag: { on: 'S', text: '同城绕远', tone: 'warn' }, dur: 2800 },
        { note: '而且枢纽要公网 IP、易被攻击，是整张网的单点与瓶颈。', focus: ['A', 'B', 'C', 'HUB', 'S'], tag: { on: 'HUB', text: '单点+瓶颈', tone: 'bad' }, dur: 2800 },
      ],
    },

    /* ============ 4. 三件套架构 ============ */
    {
      id: 'arch', kind: 'scene', num: '02', eyebrow: 'ARCHITECTURE',
      menuTitle: '02 · 三件套架构',
      title: 'Tailscale 的三件套：数据面 / 控制面 / 中继',
      lede: '数据走节点间 P2P（WireGuard），密钥走中心协调服务器（几乎不载流量），实在不行才绕 DERP 中继。',
      svg: `<svg viewBox="0 0 960 460" xmlns="http://www.w3.org/2000/svg">
  <text class="lane-t" x="34" y="44">TAILSCALE · 数据面 + 控制面 + 中继</text>

  <g class="node" id="n1">
    <rect class="box" x="70" y="350" width="140" height="60" rx="11"/>
    <text class="t" x="140" y="377">节点 A</text>
    <text class="s" x="140" y="393">笔记本</text>
  </g>
  <g class="node" id="n2">
    <rect class="box" x="270" y="350" width="140" height="60" rx="11"/>
    <text class="t" x="340" y="377">节点 B</text>
    <text class="s" x="340" y="393">手机</text>
  </g>
  <g class="node" id="n3">
    <rect class="box" x="470" y="350" width="140" height="60" rx="11"/>
    <text class="t" x="540" y="377">节点 C</text>
    <text class="s" x="540" y="393">服务器</text>
  </g>
  <g class="node" id="n4">
    <rect class="box" x="670" y="350" width="140" height="60" rx="11"/>
    <text class="t" x="740" y="377">节点 D</text>
    <text class="s" x="740" y="393">云主机</text>
  </g>
  <g class="node" id="CS">
    <rect class="box acc" x="380" y="70" width="200" height="60" rx="11"/>
    <text class="t" x="480" y="97">协调服务器</text>
    <text class="s" x="480" y="113">Coordination · 只传公钥</text>
  </g>
  <g class="node" id="DERP">
    <rect class="box warn" x="760" y="70" width="160" height="60" rx="11"/>
    <text class="t" x="840" y="97">DERP 中继</text>
    <text class="s" x="840" y="113">仅 UDP 不通时</text>
  </g>

  <path class="edge dash" id="c1" d="M160 352 C 250 300, 360 200, 440 134" marker-end="url(#ar-mute)"/>
  <path class="edge dash" id="c2" d="M360 352 C 400 300, 440 200, 460 134" marker-end="url(#ar-mute)"/>
  <path class="edge dash" id="c3" d="M560 352 C 540 300, 510 200, 500 134" marker-end="url(#ar-mute)"/>
  <path class="edge dash" id="c4" d="M760 352 C 680 300, 600 200, 560 134" marker-end="url(#ar-mute)"/>

  <path class="edge" id="m1" d="M210 380 L 270 380" marker-end="url(#ar)"/>
  <path class="edge" id="m2" d="M410 380 L 470 380" marker-end="url(#ar)"/>
  <path class="edge" id="m3" d="M610 380 L 670 380" marker-end="url(#ar)"/>
  <path class="edge" id="m4" d="M210 392 C 380 430, 500 430, 740 392" marker-end="url(#ar)"/>

  <path class="edge warn" id="r1" d="M760 350 C 800 300, 815 200, 825 134" marker-end="url(#ar-warn)"/>
</svg>`,
      steps: [
        { note: '数据平面：每个节点用 WireGuard 直接加密互联，形成 P2P mesh——延迟最低、不经过任何人。', focus: ['n1', 'n2', 'n3', 'n4'], dur: 2600 },
        { note: '控制平面：节点把公钥报到协调服务器。它像个大信箱，只转发密钥和策略，几乎不碰业务流量。', focus: ['CS'], packet: [{ path: 'c1', text: '公钥', dur: 1100 }, { path: 'c2', text: '公钥', dur: 1100 }, { path: 'c3', text: '公钥', dur: 1100 }, { path: 'c4', text: '公钥', dur: 1100 }], tag: { on: 'CS', text: '只传公钥', tone: 'acc' }, dur: 3200 },
        { note: '每个节点从服务器拿到同网络其他人的公钥 + 地址，自己配好 WireGuard——无需手动交换密钥。', focus: ['n1', 'n2', 'n3', 'n4', 'CS'], dur: 2800 },
        { note: '只有 UDP 打洞失败（如网络禁 UDP）时，才走 DERP 中继。它只搬运、看不到明文。', focus: ['n4', 'DERP'], packet: { path: 'r1', text: '加密包', dur: 1300 }, tag: { on: 'DERP', text: '兜底中继', tone: 'warn' }, dur: 3000 },
      ],
    },

    /* ============ 5. 登录与公钥分发流水线 ============ */
    {
      id: 'kex', kind: 'scene', num: '03', eyebrow: 'KEY EXCHANGE',
      menuTitle: '03 · 公钥分发',
      title: '一次连接是怎么"零配置"建起来的',
      lede: '自生成密钥对 → 用现有账号登录 → 公钥报到协调服务器 → 拉回整张网络的地址表（netmap）→ 自动配好 WireGuard。',
      svg: `<svg viewBox="0 0 960 460" xmlns="http://www.w3.org/2000/svg">
  <text class="lane-t" x="34" y="44">CONNECTION SETUP · 流水线</text>

  <g class="node" id="login">
    <rect class="box" x="40" y="200" width="150" height="70" rx="11"/>
    <text class="t" x="115" y="231">登录身份</text>
    <text class="s" x="115" y="249">OAuth2 / OIDC</text>
  </g>
  <g class="node" id="key">
    <rect class="box" x="235" y="200" width="150" height="70" rx="11"/>
    <text class="t" x="310" y="231">生密钥对</text>
    <text class="s" x="310" y="249">私钥永不出机</text>
  </g>
  <g class="node" id="report">
    <rect class="box" x="430" y="200" width="150" height="70" rx="11"/>
    <text class="t" x="505" y="231">报公钥</text>
    <text class="s" x="505" y="249">到协调服务器</text>
  </g>
  <g class="node" id="netmap">
    <rect class="box" x="625" y="200" width="150" height="70" rx="11"/>
    <text class="t" x="700" y="231">拉 netmap</text>
    <text class="s" x="700" y="249">同域节点列表</text>
  </g>
  <g class="node" id="mesh">
    <rect class="box acc" x="820" y="200" width="120" height="70" rx="11"/>
    <text class="t" x="880" y="231">建 mesh</text>
    <text class="s" x="880" y="249">P2P 隧道</text>
  </g>
  <g class="node" id="cs">
    <rect class="box acc" x="430" y="60" width="150" height="54" rx="10"/>
    <text class="t" x="505" y="86">协调服务器</text>
    <text class="s" x="505" y="102">公钥信箱</text>
  </g>

  <path class="edge" id="p1" d="M190 235 L 235 235" marker-end="url(#ar)"/>
  <path class="edge" id="p2" d="M385 235 L 430 235" marker-end="url(#ar)"/>
  <path class="edge" id="p3" d="M775 235 L 820 235" marker-end="url(#ar)"/>
  <path class="edge dash" id="e_up" d="M505 200 L 505 114" marker-end="url(#ar-acc)"/>
  <path class="edge dash" id="e_down" d="M520 116 C 560 140, 640 175, 700 200" marker-end="url(#ar-acc)"/>
</svg>`,
      steps: [
        { note: '第一步：用你已有的账号（Gmail / 企业 SSO）登录，Tailscale 自己不做认证。', focus: ['login'], dur: 2600 },
        { note: '第二步：本机生成随机密钥对，私钥永远不离开这台设备。', focus: ['key'], tag: { on: 'key', text: '私钥不离机', tone: 'ok' }, dur: 2600 },
        { note: '第三步：把公钥报到协调服务器。服务器不存私钥、看不到流量。', focus: ['report', 'cs'], packet: { path: 'e_up', text: '公钥', dur: 1200 }, dur: 2800 },
        { note: '第四步：从服务器拉回同网络里其他节点的公钥和地址表（netmap）。', focus: ['cs', 'netmap'], packet: { path: 'e_down', text: 'netmap', dur: 1200 }, dur: 2800 },
        { note: '第五步：用这些公钥自动配好 WireGuard——节点间 P2P 直连，不用手配任何隧道。', focus: ['netmap', 'mesh', 'login', 'key'], tag: { on: 'mesh', text: 'P2P 直连', tone: 'acc' }, dur: 2800 },
      ],
    },

    /* ============ 6. NAT 穿透 ============ */
    {
      id: 'nat', kind: 'scene', num: '04', eyebrow: 'NAT TRAVERSAL',
      menuTitle: '04 · NAT 打洞',
      title: '没有公网 IP，也能 P2P：UDP 打洞',
      lede: '两个节点都在 NAT 后、都没开放端口。借助 STUN/ICE 互相学到对方的外网映射地址，两边同时发包，洞就打通了。',
      svg: `<svg viewBox="0 0 960 460" xmlns="http://www.w3.org/2000/svg">
  <text class="lane-t" x="34" y="44">NAT TRAVERSAL · UDP hole punching</text>

  <rect class="lane-box" x="60" y="150" width="200" height="210" rx="14"/>
  <text class="em" x="160" y="172" text-anchor="middle">NAT A · 家庭路由器</text>
  <rect class="lane-box" x="700" y="150" width="200" height="210" rx="14"/>
  <text class="em" x="800" y="172" text-anchor="middle">NAT B · 公司防火墙</text>

  <g class="node" id="a">
    <rect class="box" x="110" y="250" width="110" height="56" rx="10"/>
    <text class="t" x="165" y="274">节点 A</text>
    <text class="s" x="165" y="291">192.168.x.x</text>
  </g>
  <g class="node" id="b">
    <rect class="box" x="740" y="250" width="110" height="56" rx="10"/>
    <text class="t" x="795" y="274">节点 B</text>
    <text class="s" x="795" y="291">10.x.x.x</text>
  </g>
  <g class="node" id="stun">
    <rect class="box acc" x="380" y="40" width="160" height="46" rx="10"/>
    <text class="t" x="460" y="68">STUN 服务器</text>
  </g>

  <ellipse cx="480" cy="262" rx="74" ry="44" style="fill:var(--panel2);stroke:var(--line2)"/>
  <text x="480" y="267" text-anchor="middle" style="fill:var(--mute);font:500 12px var(--sans)">互联网</text>

  <path class="edge" id="e_a_nat" d="M220 278 L 258 278" marker-end="url(#ar)"/>
  <path class="edge" id="e_b_nat" d="M740 278 L 702 278" marker-end="url(#ar)"/>
  <path class="edge dash" id="p_stun" d="M165 222 C 200 150, 300 100, 380 88" marker-end="url(#ar-acc)"/>
  <path class="edge dash" id="p_stun2" d="M540 86 C 620 100, 720 150, 795 222" marker-end="url(#ar-acc)"/>
  <path class="edge ok" id="punchAB" d="M410 250 C 450 248, 510 262, 555 270" marker-end="url(#ar-ok)"/>
  <path class="edge ok" id="punchBA" d="M550 252 C 510 250, 450 264, 405 272" marker-end="url(#ar-ok)"/>
</svg>`,
      steps: [
        { note: '两个节点都在各自的 NAT 后面，都没有公网 IP、没有开放端口。传统上这俩没法直接说话。', focus: ['a', 'b', 'a', 'b'], dur: 2800 },
        { note: '节点 A 问 STUN 服务器：我的外网地址端口是多少？拿到自己的"映射地址"。', focus: ['a', 'stun'], packet: { path: 'p_stun', text: '我在哪', dur: 1200 }, tag: { on: 'stun', text: '告知外网地址', tone: 'acc' }, dur: 3000 },
        { note: '节点 B 同样向 STUN 学到自己的外网映射地址。', focus: ['b', 'stun'], packet: { path: 'p_stun2', text: '我在哪', dur: 1200, reverse: true }, dur: 2800 },
        { note: '双方用学来的对方外网地址同时发包。NAT 看到"已有出去的会话"就放包进来——洞打通，之后 P2P 直连。', focus: ['a', 'b'], packet: [{ path: 'punchAB', text: 'Hi B', dur: 1300 }, { path: 'punchBA', text: 'Hi A', dur: 1300 }], tag: { on: 'a', text: '洞打通', tone: 'ok' }, dur: 3200 },
      ],
    },

    /* ============ 7. DERP 中继兜底 ============ */
    {
      id: 'derp', kind: 'scene', num: '05', eyebrow: 'DERP RELAY',
      menuTitle: '05 · DERP 中继',
      title: '当 UDP 被封死，就走 DERP 中继',
      lede: '某些严酷网络完全屏蔽 UDP、STUN 也失效。这时流量改走 DERP：用 HTTPS 流承载已加密的 WireGuard 包。DERP 只能搬运、读不到明文。',
      svg: `<svg viewBox="0 0 960 460" xmlns="http://www.w3.org/2000/svg">
  <text class="lane-t" x="34" y="44">DERP · 兜底中继（仅 UDP 不通时）</text>

  <g class="node" id="a">
    <rect class="box" x="70" y="210" width="150" height="64" rx="11"/>
    <text class="t" x="145" y="238">节点 A</text>
    <text class="s" x="145" y="256">背后有 NAT</text>
  </g>
  <g class="node" id="b">
    <rect class="box" x="740" y="210" width="150" height="64" rx="11"/>
    <text class="t" x="815" y="238">节点 B</text>
    <text class="s" x="815" y="256">背后有 NAT</text>
  </g>
  <g class="node" id="derp">
    <rect class="box warn" x="390" y="80" width="180" height="60" rx="11"/>
    <text class="t" x="480" y="106">DERP 中继</text>
    <text class="s" x="480" y="124">HTTPS 流 · 不解密</text>
  </g>

  <path class="edge dash" id="p_block" d="M220 242 L 740 242" marker-end="url(#ar-mute)"/>
  <text x="480" y="232" text-anchor="middle" style="fill:var(--bad);font:700 16px var(--sans)">✕ UDP 被屏蔽</text>
  <path class="edge warn" id="p_ad" d="M220 235 C 300 205, 350 155, 390 132" marker-end="url(#ar-warn)"/>
  <path class="edge warn" id="p_db" d="M570 132 C 640 155, 700 205, 740 235" marker-end="url(#ar-warn)"/>
</svg>`,
      steps: [
        { note: '还是这两个节点。理想情况它们 UDP 打洞直连（上页讲的）。', focus: ['a', 'b'], dur: 2400 },
        { note: '但有时网络把 UDP 整个禁掉，STUN/ICE 也打不开洞。直连失败。', focus: ['a', 'b'], flash: ['a', 'b'], tag: { on: 'a', text: 'UDP 不通', tone: 'bad' }, dur: 2800 },
        { note: '流量改道 DERP：用 HTTPS 流把已经加密的 WireGuard 包送到离对端最近的 DERP，再转给对端。', focus: ['derp'], packet: [{ path: 'p_ad', text: '加密包', dur: 1200 }, { path: 'p_db', text: '', dur: 1200 }], tag: { on: 'derp', text: '只搬运·不解密', tone: 'warn' }, dur: 3200 },
        { note: '关键：DERP 拿不到私钥，看到的全是密文——它只是个"盲转"的中转站。', focus: ['a', 'b', 'derp'], dur: 2800 },
      ],
    },

    /* ============ 8. 对比 ============ */
    {
      id: 'cmp', kind: 'compare', num: '06', eyebrow: 'COMPARISON',
      menuTitle: '06 · 对比',
      title: '三种组网方案，差在哪',
      lede: 'Tailscale 拿 WireGuard 的加密、配一个轻量控制面，把"手动 mesh"变成"自动 mesh"。',
      cols: ['传统 VPN (hub-spoke)', '手动 WireGuard mesh', 'Tailscale'],
      rows: [
        { k: '拓扑',     v: ['星型·过中心', '全互联·手动配', '全互联·自动'] },
        { k: '延迟',     v: ['高（绕枢纽）', '最低（P2P）', '最低（P2P）'] },
        { k: '配置成本', v: ['中', '高（N² 端点）', '极低（装软件登录）'] },
        { k: 'NAT/防火墙', v: ['需开端口', '需开端口', '自动打洞'] },
        { k: '密钥管理', v: ['集中·静态', '每台手动', '服务器自动分发'] },
        { k: '中继兜底', v: ['无', '无', 'DERP 自动'] },
      ],
      steps: [
        { rows: [0], note: '拓扑上，传统 VPN 是星型（过中心），两种 mesh 都是全互联。' },
        { rows: [1], note: '延迟上，过中心的 VPN 吃亏；两种 mesh 都走 P2P，最低。' },
        { rows: [2], note: '配置成本是关键分水岭：手动 mesh 要配 N² 个端点，Tailscale 装软件登录即可。' },
        { rows: [3, 4], note: 'NAT 穿透和密钥管理：Tailscale 自动打洞、服务器分发密钥，前两者都得手工折腾。' },
        { rows: [5], note: '只有 Tailscale 自带 DERP 中继兜底——UDP 不通也能连。' },
      ],
    },

    /* ============ 9. 代码 ============ */
    {
      kind: 'code', num: '07', eyebrow: 'WHAT IT DOES',
      menuTitle: '07 · 后台逻辑',
      title: 'tailscale up 之后，后台在做什么',
      lede: '删掉所有边界处理，剩下的就是这一段：登录拿身份、生成密钥、报到协调服务器、拉回 netmap、重配 WireGuard。',
      code: `async function bringUp() {
  const id    = await loginWithSSO();        // 1. 用现有账号登录
  const keys  = genKeyPair();                // 2. 生密钥对，私钥留本地
  coord.publish(id, keys.pub);              // 3. 公钥报到协调服务器
  const netmap = await coord.getNetmap();    // 4. 拉回同域节点公钥+地址
  for (const p of netmap.peers) {            // 5. 为每个 peer 写 WG 配置
    wg.setPeer(p.pub, p.endpoints);         //    → 建立 P2P 加密隧道
  }
}                                          // 之后数据直连，控制面退居幕后`,
      steps: [
        { lines: [2], note: '登录不自己造轮子——复用你已有的 SSO/OAuth2 身份。' },
        { lines: [3], note: '本机生成密钥对，私钥只留在本地，绝不上传。' },
        { lines: [4], note: '把公钥报到协调服务器，它只当个公钥信箱。' },
        { lines: [5], note: '拉回 netmap：同一网络里其他节点的公钥和地址。' },
        { lines: [6, 7], note: '为每个 peer 写入 WireGuard 配置——隧道自动建好，P2P 直连。' },
      ],
    },

    /* ============ 10. 交互实验 ============ */
    {
      id: 'lab', kind: 'lab', num: '08', eyebrow: 'LAB',
      menuTitle: '08 · 动手实验',
      title: '调一下：网络越严，越可能走中继',
      lede: '拖动"NAT 严格程度"和"地理距离"，看两个节点是 P2P 直连还是被迫走 DERP 中继，以及延迟怎么变。',
      params: [
        { id: 'nat', label: 'NAT 严格程度', min: 0, max: 10, step: 1, value: 3 },
        { id: 'dist', label: '地理距离', min: 1, max: 10, step: 1, value: 3 },
      ],
      svg: (v) => {
        const relay = v.nat >= 5;
        const lat = (relay ? 60 : 12) + v.dist * 4;
        const box = (x, y, w, h, stroke, label) =>
          `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" style="fill:var(--panel2);stroke:${stroke};stroke-width:2"/>` +
          `<text x="${x + w / 2}" y="${y + h / 2 + 5}" text-anchor="middle" style="fill:var(--ink);font:600 13.5px var(--sans)">${label}</text></g>`;
        const A = box(70, 220, 130, 60, 'var(--acc)', '节点 A');
        const B = box(760, 220, 130, 60, 'var(--acc)', '节点 B');
        if (relay) {
          const D = box(410, 90, 140, 56, 'var(--warn)', 'DERP 中继');
          const path = `<path class="edge warn" d="M200 250 C 300 215, 350 160, 410 132" marker-end="url(#ar-warn)"/>` +
                       `<path class="edge warn" d="M550 132 C 640 165, 700 215, 760 250" marker-end="url(#ar-warn)"/>`;
          const lbl = `<text x="480" y="178" text-anchor="middle" style="fill:var(--warn);font:600 14px var(--sans)">经 DERP 中继 · 延迟 ≈ ${lat} ms</text>`;
          return `<svg viewBox="0 0 960 460" xmlns="http://www.w3.org/2000/svg">
  <text class="lane-t" x="34" y="44">LIVE LAB · 拖动滑块看连接模式</text>
  ${A}${B}${D}${path}${lbl}
</svg>`;
        }
        const path = `<path class="edge ok" d="M200 250 L 760 250" marker-end="url(#ar-ok)"/>`;
        const lbl = `<text x="480" y="226" text-anchor="middle" style="fill:var(--ok);font:600 14px var(--sans)">P2P 直连 · 延迟 ≈ ${lat} ms</text>`;
        return `<svg viewBox="0 0 960 460" xmlns="http://www.w3.org/2000/svg">
  <text class="lane-t" x="34" y="44">LIVE LAB · 拖动滑块看连接模式</text>
  ${A}${B}${path}${lbl}
</svg>`;
      },
      readouts: (v) => {
        const relay = v.nat >= 5;
        const lat = (relay ? 60 : 12) + v.dist * 4;
        return [
          { k: '连接模式', v: relay ? '经 DERP 中继' : 'P2P 直连' },
          { k: 'DERP 参与', v: relay ? '是' : '否' },
          { k: '估计延迟', v: lat + ' ms' },
        ];
      },
      insight: (v) =>
        v.nat >= 5
          ? 'UDP 被网络屏蔽，数据只能借 HTTPS 流绕道 DERP——能连，但延迟和带宽受中继限制。'
          : 'UDP 打洞成功，数据节点间直连，延迟最低、不经过任何第三方。',
    },

    /* ============ 11. 资料索引 ============ */
    {
      kind: 'index', num: '09', eyebrow: 'SOURCES',
      menuTitle: '09 · 资料索引',
      title: '想往下读',
      items: [
        { label: 'tailscale.com/blog/how-tailscale-works', desc: '本课件所据的官方原理博客', url: 'https://tailscale.com/blog/how-tailscale-works' },
        { label: 'WireGuard', desc: '底层加密隧道（数据平面）', url: 'https://www.wireguard.com/' },
        { label: 'RFC 5389 · STUN', desc: 'NAT 会话映射发现', url: 'https://www.rfc-editor.org/rfc/rfc5389' },
        { label: 'RFC 8445 · ICE', desc: 'NAT 穿透候选地址协商', url: 'https://www.rfc-editor.org/rfc/rfc8445' },
        { label: 'RFC 5766 · TURN', desc: '中继（DERP 即其替代）', url: 'https://www.rfc-editor.org/rfc/rfc5766' },
        { label: 'github.com/tailscale/tailscale', desc: '节点软件（开源）', url: 'https://github.com/tailscale/tailscale' },
        { label: 'github.com/tailscale/derp', desc: 'DERP 中继实现（开源）', url: 'https://github.com/tailscale/derp' },
        { label: 'How NAT traversal works', desc: 'Dave Anderson 的打洞深潜', url: 'https://tailscale.com/blog/how-nat-traversal-works' },
      ],
    },

    /* ============ 12. 结论 ============ */
    {
      kind: 'end', num: 'END', eyebrow: 'CONCLUSION',
      menuTitle: '10 · 结论',
      title: '最后记住 5 句话',
      points: [
        'Tailscale = WireGuard（数据面）+ 协调服务器（控制面）+ DERP（中继兜底）。',
        '控制面只传公钥和策略、几乎不碰流量；数据面全互联 P2P，延迟最低。',
        '没有公网 IP、不用开端口：STUN/ICE 做 UDP 打洞，打不通就借 DERP 中继。',
        '零配置：登录现有账号 → 本机生密钥 → 服务器分发 netmap → 自动配好 WireGuard。',
        'DERP 看不到明文（私钥不离机），所以"经过中继"也不破坏零信任。',
      ],
    },

  ],
};
