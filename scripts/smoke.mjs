#!/usr/bin/env node
/**
 * smoke.mjs —— 用本机 Chrome 无头模式跑一遍课件，捕获运行时错误
 *
 *   node smoke.mjs <deck.html 或 deck.js>
 *
 * 会依次：走完全部页与步骤 → 回退 → 目录开关 → 翻页 → 拖动实验参数 →
 * 播放/暂停 → 换肤 → 首尾跳转。任一环节抛错都会被记录。
 */
import { readFile, writeFile } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

const CAPTURE = `
window.__errs = [];
window.addEventListener('error', e => window.__errs.push('ERROR: ' + (e.message || '') + ' @line ' + e.lineno));
window.addEventListener('unhandledrejection', e => window.__errs.push('REJECT: ' + e.reason));
['error','warn'].forEach(function(k){
  var orig = console[k].bind(console);
  console[k] = function(){ window.__errs.push('console.' + k + ': ' + Array.prototype.join.call(arguments, ' ')); orig.apply(null, arguments); };
});
`;

const DRIVER = `
(function(){
  var log = [], errs = window.__errs;
  var K = function(k, o){ document.body.dispatchEvent(new KeyboardEvent('keydown', Object.assign({key:k, bubbles:true, cancelable:true}, o||{}))); };
  var Q = function(s){ return document.querySelector(s); };
  var T = function(s){ var e = Q(s); return e ? (e.textContent||'').trim().replace(/\\s+/g,' ') : '<missing ' + s + '>'; };
  var n = function(s){ return document.querySelectorAll(s).length; };

  var pages = n('#menuGrid button');
  var seq = [];

  seq.push(function(){ log.push('首页渲染=' + !!Q('.slide')); });

  // 逐页走完所有步骤：靠目录跳页，再步进到页尾，记录最后一个步骤的状态
  seq.push(function(){
    var pageNo = function(){ return parseInt(T('#pager'), 10); };
    var capLen = function(){ var c = Q('.caption'); return c ? c.textContent.trim().length : -1; };
    for (var p = 1; p <= pages; p++) {
      K('m');
      var btns = document.querySelectorAll('#menuGrid button');
      if (!btns[p-1]) { errs.push('目录缺第 ' + p + ' 项'); continue; }
      btns[p-1].click();
      if (pageNo() !== p) { errs.push('目录跳转失败：期望 ' + p + '，实际 ' + pageNo()); continue; }

      var steps = n('.dots .dot-i');
      // 页型 / 渲染状态必须在步进前采集：步进会跨页，届时旧节点已不存在
      var hasFig = !!Q('figure svg'), isLab = !!Q('.lab'), labOk = !!Q('#labFig svg');
      var lastNodes = n('.node.is-in'), lastCap = capLen();
      for (var s = 0; s < 30; s++) {
        K('ArrowRight');
        if (pageNo() !== p) break;
        lastNodes = n('.node.is-in'); lastCap = capLen();
      }
      if (hasFig && !isLab && lastNodes === 0) errs.push('第 ' + p + ' 页有图示但没有任何节点出场（steps 没生效？）');
      if (steps > 0 && lastCap <= 0) errs.push('第 ' + p + ' 页有 ' + steps + ' 个步骤但解说词为空');
      if (isLab && !labOk) errs.push('第 ' + p + ' 页是实验页但图没渲染');
      log.push('  页 ' + p + ' · 步骤=' + steps + ' 出场节点=' + lastNodes + ' 解说字数=' + lastCap + (isLab ? ' [实验页]' : ''));
    }
  });

  seq.push(function(){ K('m'); log.push('目录打开=' + !Q('#menu').hidden + ' 条目=' + n('#menuGrid button')); K('Escape'); log.push('目录关闭=' + Q('#menu').hidden); });

  // 找到实验页（不假设页码）
  seq.push(function(){
    K('Home');
    for (var i = 0; i < 40 && !Q('.lab'); i++) K('ArrowRight', {shiftKey:true});
    if (!Q('.lab')) { errs.push('找不到实验页 .lab'); return; }
    var slider = document.querySelector('.prm input');
    if (!slider) { errs.push('实验页没有任何滑块'); return; }
    log.push('实验图=' + !!Q('#labFig svg') + ' 滑块=' + n('.prm input') + ' 读数=' + T('#labOut').slice(0,64));
    slider.value = slider.max; slider.dispatchEvent(new Event('input', {bubbles:true}));
    log.push('拖到最大后=' + T('#labOut').slice(0,64));
    var sliders = document.querySelectorAll('.prm input');
    if (sliders.length > 1) {
      var last = sliders[sliders.length - 1];
      last.value = last.min; last.dispatchEvent(new Event('input', {bubbles:true}));
    }
    log.push('提示文案=' + T('#labInsight').slice(0,56));
  });

  seq.push(function(){ Q('[data-act="play"]').click(); log.push('播放键=' + T('[data-act="play"]')); });
  seq.push(function(){ log.push('播放中页码=' + T('#pager')); Q('[data-act="play"]').click(); log.push('暂停键=' + T('[data-act="play"]')); });
  seq.push(function(){ K('t'); log.push('换肤=' + document.documentElement.dataset.theme); K('t'); log.push('换回=' + document.documentElement.dataset.theme); });
  seq.push(function(){ K('End'); log.push('End=' + T('#pager') + ' 结论页=' + !!Q('.end') + ' 进度=' + Q('#pbar').style.width); });
  seq.push(function(){ log.push('hash=' + location.hash); });

  var i = 0;
  (function run(){
    if(i >= seq.length){
      document.title = 'SMOKE<<' + errs.length + '>>' + errs.join(' ~~ ') + '<<LOG>>' + log.join(' ~~ ');
      return;
    }
    var fn = seq[i++];
    try { fn(); } catch(e) { errs.push('SEQ#' + (i-1) + ': ' + e.message); }
    setTimeout(run, 160);
  })();
})();
`;

/* ---------- 参数 ---------- */
const input = process.argv[2];
if (!input) { console.error('用法: node smoke.mjs <deck.html|deck.js>'); process.exit(2); }
let htmlPath = input;
if (/\.m?js$/.test(input)) {
  const buildOut = path.join(os.tmpdir(), 'ka-smoke-' + Date.now() + '.html');
  execFileSync(process.execPath, [path.join(path.dirname(new URL(import.meta.url).pathname), 'build.mjs'), input, '-o', buildOut], { stdio: 'inherit' });
  htmlPath = buildOut;
}

const chrome = CHROME_CANDIDATES.find(p => { try { return statSync(p).isFile() } catch { return false } });
if (!chrome) { console.error('✗ 没找到 Chrome/Chromium，无法做浏览器冒烟'); process.exit(3); }

let html = await readFile(path.resolve(htmlPath), 'utf8');
html = html.replace('</head>', `<script>${CAPTURE}</script>\n</head>`);
html = html.replace('</body>', `<script>${DRIVER}</script>\n</body>`);
const tmp = path.join(os.tmpdir(), 'ka-smoke-run.html');
await writeFile(tmp, html, 'utf8');

const dom = execFileSync(chrome, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--virtual-time-budget=20000', '--dump-dom', pathToFileURL(tmp).href,
], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });

const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const m = /<title>SMOKE<<(\d+)>>([\s\S]*?)<<LOG>>([\s\S]*?)<\/title>/.exec(unesc(dom));
if (!m) {
  console.error('✗ 没能拿到冒烟报告（驱动没跑完？）。DOM 长度=' + dom.length);
  process.exit(4);
}
const count = Number(m[1]);
const errs = m[2].split(' ~~ ').filter(Boolean);
const logs = m[3].split(' ~~ ').filter(Boolean);

const line = '─'.repeat(70);
console.log(`\n${line}\n  smoke · ${path.basename(htmlPath)}\n${line}`);
logs.forEach(l => console.log('  ' + l));
console.log(line);
if (count > 0) {
  errs.forEach(e => console.log('  ✗ ' + e));
  console.log(`${line}\n  ✗ ${count} 个运行时问题\n`);
  process.exit(1);
}
console.log('  ✓ 全流程无运行时错误\n');
