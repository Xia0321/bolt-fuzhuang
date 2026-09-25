#!/usr/bin/env node
// 把本仓库维护的后台中文翻译合并进 Saleor Dashboard 的语言包。
// Saleor 源码不做任何修改，只在打包前生成 locale/zh-Hans.json。
//
// 用法：
//   node saleor/dashboard/apply-locale.mjs <saleor-dashboard 目录> [--check] [--report <文件>]
//
//   --check           只检查不写入，有错误时以非 0 退出（适合 CI）
//   --report <文件>   把仍未翻译、以及英文原文已变化的条目导出为 TSV，便于补译
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCALE = 'zh-Hans';
const here = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const dashboardDir = resolve(args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--report') ?? '');
const checkOnly = args.includes('--check');
const reportPath = args.includes('--report') ? args[args.indexOf('--report') + 1] : null;

if (!existsSync(join(dashboardDir, 'locale', 'defaultMessages.json'))) {
  console.error('用法：node saleor/dashboard/apply-locale.mjs <saleor-dashboard 目录> [--check] [--report <文件>]');
  process.exit(1);
}

const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const source = readJson(join(dashboardDir, 'locale', 'defaultMessages.json'));
const upstreamPath = join(dashboardDir, 'locale', `${LOCALE}.json`);
const upstream = existsSync(upstreamPath) ? readJson(upstreamPath) : {};
const ours = readJson(join(here, 'locale', `${LOCALE}.json`));

// 用 Dashboard 自带的 ICU 解析器校验语法（复数、select、占位符）
const require = createRequire(join(dashboardDir, 'package.json'));
const { parse } = require('@formatjs/icu-messageformat-parser');

// 收集消息中的变量名，用于确认译文没有丢失或写错占位符
function argumentNames(elements, names = new Set()) {
  for (const el of elements) {
    if (el.value !== undefined && typeof el.value === 'string' && el.type !== 0) names.add(el.value);
    if (el.options) for (const opt of Object.values(el.options)) argumentNames(opt.value, names);
    if (el.children) argumentNames(el.children, names);
  }
  return names;
}

const hasChinese = s => /[一-鿿]/.test(s);
// 只有占位符和符号的条目（如 "{value} {unit}"、"%"）无需翻译
const needsTranslation = s => /[A-Za-z]/.test(s.replace(/\{[^{}]*\}|<[^>]*>/g, ''));
const merged = {};
const errors = [];
const upstreamBugs = [];
let untranslatable = 0;
const outdated = [];
const missing = [];
let fromOurs = 0;
let fromUpstream = 0;

for (const [id, { string: english, context }] of Object.entries(source)) {
  const entry = ours[id];
  if (entry) {
    let englishAst = null;
    try {
      englishAst = parse(english, { ignoreTag: false });
    } catch {
      // Saleor 原文本身不符合 ICU 语法，运行时会退回英文，译文照常保留
      upstreamBugs.push(id);
    }
    if (englishAst) {
      try {
        const expected = [...argumentNames(englishAst)].sort().join(',');
        const actual = [...argumentNames(parse(entry.string, { ignoreTag: false }))].sort().join(',');
        if (expected !== actual) errors.push(`${id}: 占位符不一致（原文 ${expected || '无'}，译文 ${actual || '无'}）`);
      } catch (e) {
        errors.push(`${id}: ICU 语法错误 — ${e.message}`);
      }
    }
    if (entry.source !== english) outdated.push({ id, context, english, previous: entry.source, string: entry.string });
    merged[id] = { ...(context ? { context } : {}), string: entry.string };
    fromOurs++;
  } else if (upstream[id] && hasChinese(upstream[id].string)) {
    merged[id] = upstream[id];
    fromUpstream++;
  } else if (!needsTranslation(english)) {
    untranslatable++;
  } else {
    missing.push({ id, context, english });
  }
}

const obsolete = Object.keys(ours).filter(id => !source[id]);

console.log(`Saleor Dashboard 共 ${Object.keys(source).length} 条界面文字`);
console.log(`  本仓库翻译：${fromOurs} 条`);
console.log(`  沿用官方翻译：${fromUpstream} 条`);
console.log(`  无需翻译（纯占位符）：${untranslatable} 条`);
console.log(`  未翻译（显示英文）：${missing.length} 条`);
if (outdated.length) console.log(`  ⚠ 英文原文已变化、需复核：${outdated.length} 条`);
if (obsolete.length) console.log(`  · 新版本已删除、可清理：${obsolete.length} 条`);
if (upstreamBugs.length) console.log(`  · Saleor 原文本身语法有误（运行时显示英文）：${upstreamBugs.join(', ')}`);

if (errors.length) {
  console.error(`\n✗ ${errors.length} 条译文有误：`);
  for (const e of errors) console.error('  ' + e);
}

if (reportPath) {
  const clean = s => (s ?? '').replace(/\t/g, ' ').replace(/\n/g, '\\n');
  const rows = [
    ['id', 'status', 'context', 'english', 'current_translation'].join('\t'),
    ...missing.map(m => [m.id, 'missing', clean(m.context), clean(m.english), ''].join('\t')),
    ...outdated.map(o => [o.id, 'outdated', clean(o.context), clean(o.english), clean(o.string)].join('\t')),
  ];
  writeFileSync(reportPath, rows.join('\n') + '\n');
  console.log(`\n待处理条目已导出到 ${reportPath}`);
}

if (errors.length) process.exit(1);
if (checkOnly) {
  console.log('\n✓ 检查通过（未写入）');
} else {
  writeFileSync(upstreamPath, JSON.stringify(merged, null, 2) + '\n');
  console.log(`\n✓ 已写入 ${upstreamPath}`);
}
