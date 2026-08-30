#!/usr/bin/env node
/**
 * build.mjs —— 把 deck.js 注入模板，产出单文件 HTML 课件
 *
 *   node build.mjs <deck.js> [-o out.html] [--open]
 *
 * deck.js 是标准 ES module： export default { title, subtitle, slides:[...] }
 */
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { execSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const TEMPLATE = path.join(HERE, '..', 'assets', 'template.html');

/* ---------- 参数 ---------- */
const argv = process.argv.slice(2);
let deckPath = null, outPath = null, open = false;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '-o' || a === '--out') outPath = argv[++i];
  else if (a === '--open') open = true;
  else if (a === '-h' || a === '--help') { console.log('用法: node build.mjs <deck.js> [-o out.html] [--open]'); process.exit(0); }
  else if (!a.startsWith('-')) deckPath = a;
}
if (!deckPath) { console.error('✗ 缺少 deck.js 路径\n用法: node build.mjs <deck.js> [-o out.html] [--open]'); process.exit(1); }

const absDeck = path.resolve(deckPath);
const absOut  = path.resolve(outPath || absDeck.replace(/\.m?js$/, '') + '.html');

/* ---------- 读 deck ---------- */
let DECK;
try {
  const mod = await import(pathToFileURL(absDeck).href);
  DECK = mod.default;
} catch (err) {
  console.error('✗ deck.js 加载失败：', err.message);
  process.exit(1);
}
if (!DECK || !Array.isArray(DECK.slides)) {
  console.error('✗ deck.js 必须 export default { title, slides: [...] }');
  process.exit(1);
}

/* ---------- 注入 ---------- */
const src = await readFile(absDeck, 'utf8');
const body = /(^|\n)\s*export\s+default\s+/.test(src)
  ? src.replace(/(^|\n)(\s*)export\s+default\s+/, '$1$2const DECK = ')
  : src;
if (!/const\s+DECK\s*=/.test(body)) {
  console.error('✗ 未能在 deck.js 中定位 `export default`，无法注入');
  process.exit(1);
}

const tpl = await readFile(TEMPLATE, 'utf8');
if (!tpl.includes('/*__DECK__*/')) { console.error('✗ 模板缺少 /*__DECK__*/ 注入点'); process.exit(1); }

const html = tpl
  .replace('__TITLE__', () => DECK.title || '知识动画课')
  .replace('/*__DECK__*/', () => body);

await writeFile(absOut, html, 'utf8');

const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
console.log(`✓ ${path.basename(absOut)}  (${DECK.slides.length} 页 · ${kb} KB · 零依赖单文件)`);
console.log(`  ${absOut}`);

if (open) {
  try { execSync(`open "${absOut}"`); } catch { /* 非 macOS 忽略 */ }
}
