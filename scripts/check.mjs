#!/usr/bin/env node
/**
 * check.mjs —— 课件结构自检（零依赖）
 *
 *   node check.mjs <deck.js>
 *
 * 动画课件最常见的线上故障是「steps 引用了不存在的 id」——画面不动却不报错。
 * 这个脚本在构建前把这类问题全挑出来。
 */
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const KINDS = ['cover', 'map', 'scene', 'compare', 'code', 'lab', 'index', 'end'];

const errors = [], warns = [], infos = [];
const E = m => errors.push(m), W = m => warns.push(m);

const deckPath = process.argv[2];
if (!deckPath) { console.error('用法: node check.mjs <deck.js>'); process.exit(2); }

let DECK;
try {
  DECK = (await import(pathToFileURL(path.resolve(deckPath)).href)).default;
} catch (err) {
  console.error('✗ deck.js 加载失败：', err.message); process.exit(1);
}

/* ---------- SVG 解析：id -> {tag, cls} ---------- */
function parseSvg(svg) {
  const map = new Map();
  const re = /<([a-zA-Z][\w:-]*)\b([^>]*?)\/?>/g;
  let m;
  while ((m = re.exec(svg))) {
    const tag = m[1];
    const attrs = m[2];
    const id = /\bid\s*=\s*"([^"]+)"/.exec(attrs)?.[1];
    const cls = /\bclass\s*=\s*"([^"]*)"/.exec(attrs)?.[1] || '';
    if (!id) continue;
    if (map.has(id)) W(`SVG 内 id 重复：#${id}`);
    map.set(id, { tag: tag.toLowerCase(), cls });
  }
  return map;
}
const arr = x => x == null ? [] : (Array.isArray(x) ? x : [x]);
const idsIn = (steps, key) => {
  const out = new Set();
  steps.forEach(s => arr(s?.[key]).forEach(id => out.add(id)));
  return out;
};

/* ---------- 顶层 ---------- */
if (!DECK.title) W('缺少 DECK.title');
if (!Array.isArray(DECK.slides) || !DECK.slides.length) E('DECK.slides 必须是非空数组');
const slides = DECK.slides || [];

let sceneCount = 0, stepTotal = 0;

slides.forEach((s, i) => {
  const at = `[${i + 1}] ${s.menuTitle || s.title || s.id || '?'}`.slice(0, 60);
  if (!KINDS.includes(s.kind)) { E(`${at} · 未知页型 "${s.kind}"（可用：${KINDS.join('/')}）`); return; }

  const steps = arr(s.steps);
  stepTotal += steps.length;
  steps.forEach((st, k) => {
    if (st == null || typeof st !== 'object') E(`${at} · steps[${k}] 必须是对象`);
    if (s.kind !== 'lab' && !st?.note && !s.note) W(`${at} · step ${k + 1} 没有 note，播放时解说区会空白`);
    if (st && st.dur != null && (typeof st.dur !== 'number' || st.dur < 200)) W(`${at} · step ${k + 1} 的 dur=${st.dur} 过小（建议 800–2500ms）`);
  });

  switch (s.kind) {
    case 'cover':
      if (!s.title) E(`${at} · cover 缺 title`);
      if (!s.subtitle) W(`${at} · cover 建议写 subtitle`);
      break;

    case 'map':
      if (!arr(s.parts).length) E(`${at} · map 缺 parts`);
      arr(s.parts).forEach(p => {
        const g = String(p.goto ?? '');
        const okNum = /^\d+$/.test(g) && +g >= 1 && +g <= slides.length;
        const okId = slides.some(x => x.id === g);
        if (!okNum && !okId) E(`${at} · 章节 "${p.title}" 的 goto="${g}" 无法解析（应为页码数字或某页的 id）`);
      });
      break;

    case 'scene': {
      sceneCount++;
      if (typeof s.svg !== 'string' || !s.svg.includes('<svg')) { E(`${at} · scene 缺 svg 字符串`); break; }
      if (!/viewBox\s*=\s*"0 0 960 46\d"/.test(s.svg)) W(`${at} · viewBox 建议用 "0 0 960 460"（绘图网格约定）`);
      const map = parseSvg(s.svg);
      const nodes = [...map.entries()].filter(([, v]) => v.cls.split(/\s+/).includes('node'));
      nodes.forEach(([id]) => { if (!id) W(`${at} · 存在无 id 的 .node，无法被 steps 控制`) });
      if (!nodes.length) W(`${at} · 没有任何 class="node" 的元素，steps 将无处生效`);

      // steps 里引用的 id 必须真实存在
      const refs = new Map();
      ['enter', 'exit', 'focus', 'dim', 'flash'].forEach(key =>
        idsIn(steps, key).forEach(id => refs.set(id, key)));
      steps.forEach(st => {
        arr(st?.label).forEach(l => l?.id && refs.set(l.id, 'label'));
        arr(st?.tag).forEach(t => t?.on && refs.set(t.on, 'tag'));
        arr(st?.packet).forEach(p => p?.path && refs.set(p.path, 'packet'));
      });
      refs.forEach((key, id) => {
        if (!map.has(id)) E(`${at} · steps.${key} 引用了不存在的 #${id}`);
      });

      // packet 只能沿 <path> 飞
      steps.forEach((st, k) => arr(st?.packet).forEach(p => {
        const el = map.get(p?.path);
        if (el && el.tag !== 'path') E(`${at} · step ${k + 1} 的 packet.path="#${p.path}" 是 <${el.tag}>，必须用 <path>`);
      }));

      // 只出现 enter 而不在 exit 的节点无法退场（仅提示）
      const entered = idsIn(steps, 'enter');
      if (entered.size && !steps.length) W(`${at} · 有 .node 但没写 steps`);
      break;
    }

    case 'compare':
      if (!arr(s.cols).length) E(`${at} · compare 缺 cols`);
      if (!arr(s.rows).length) E(`${at} · compare 缺 rows`);
      arr(s.rows).forEach((r, ri) => {
        if (!r || !r.k) W(`${at} · 第 ${ri + 1} 行缺 k（行标题）`);
        if (!arr(r.v).length || arr(r.v).length !== arr(s.cols).length)
          E(`${at} · 第 ${ri + 1} 行的 v 有 ${arr(r.v).length} 项，与 cols(${arr(s.cols).length}) 不匹配`);
      });
      steps.forEach((st, k) => arr(st?.rows).forEach(r => {
        if (!Number.isInteger(r) || r < 0 || r >= arr(s.rows).length) E(`${at} · step ${k + 1} 的 rows 越界：${r}`);
      }));
      break;

    case 'code': {
      if (typeof s.code !== 'string' || !s.code.trim()) { E(`${at} · code 缺 code`); break; }
      const lines = s.code.split('\n').length;
      steps.forEach((st, k) => arr(st?.lines).forEach(l => {
        if (!Number.isInteger(l) || l < 1 || l > lines) E(`${at} · step ${k + 1} 的 lines 越界：${l}（共 ${lines} 行）`);
      }));
      if (!steps.length) W(`${at} · code 页没写 steps，无法逐行高亮讲解`);
      break;
    }

    case 'lab': {
      const ps = arr(s.params);
      if (!ps.length) E(`${at} · lab 缺 params`);
      ps.forEach(p => {
        ['id', 'label', 'min', 'max', 'value'].forEach(f => {
          if (p?.[f] === undefined) E(`${at} · param 缺 ${f}（${JSON.stringify(p)}）`);
        });
        if (p && p.min != null && p.max != null && p.value != null && (p.value < p.min || p.value > p.max))
          E(`${at} · param "${p.id}" 的 value=${p.value} 超出 [${p.min},${p.max}]`);
      });
      const ids = ps.map(p => p?.id);
      if (new Set(ids).size !== ids.length) E(`${at} · param 的 id 重复`);
      ['svg', 'readouts', 'insight'].forEach(f => {
        if (typeof s[f] !== 'function') W(`${at} · lab 缺 ${f}()（交互实验的核心输出）`);
      });
      // 试跑一次，捕获运行时错误
      const v0 = Object.fromEntries(ps.map(p => [p.id, p.value]));
      ['svg', 'readouts', 'insight'].forEach(f => {
        if (typeof s[f] !== 'function') return;
        try { s[f](v0) } catch (err) { E(`${at} · lab.${f}() 初值调用就抛错：${err.message}`) }
      });
      break;
    }

    case 'index':
      if (!arr(s.items).length) E(`${at} · index 缺 items`);
      arr(s.items).forEach(it => { if (!it?.url || !it?.label) E(`${at} · index item 缺 url 或 label`) });
      break;

    case 'end':
      if (!arr(s.points).length) E(`${at} · end 缺 points`);
      break;
  }
});

/* ---------- 结构性建议 ---------- */
const kinds = slides.map(s => s.kind);
if (!kinds.includes('cover')) W('建议加一页 cover 封面');
if (!kinds.includes('map')) W('建议加一页 map 课程地图（参考站的做法，帮助建立预期）');
if (!kinds.includes('end')) W('建议加一页 end 结论（"最后记住 N 句话"）');
if (sceneCount === 0) W('一页 scene 都没有 —— 这个技能的核心产出就是动画场景');
if (slides.length < 8) W(`只有 ${slides.length} 页，内容偏薄（参考站是 27 页，一般 12–24 页比较合适）`);
if (slides.length > 40) W(`${slides.length} 页偏多，考虑拆分主题`);

/* ---------- 报告 ---------- */
const line = '─'.repeat(66);
console.log(`\n${line}\n  check · ${path.basename(deckPath)}  ·  ${slides.length} 页 / ${sceneCount} 个动画场景 / ${stepTotal} 个步骤\n${line}`);
infos.forEach(m => console.log('  ·  ' + m));
warns.forEach(m => console.log('  ▲  ' + m));
errors.forEach(m => console.log('  ✗  ' + m));
console.log(line);
if (errors.length) { console.log(`  ✗ ${errors.length} 个错误、${warns.length} 个提醒 —— 先修错误再构建\n`); process.exit(1) }
console.log(`  ✓ 通过${warns.length ? `（${warns.length} 个提醒，可忽略或改进）` : '，没有问题'}\n`);
