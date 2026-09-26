// 商品导入：Saleor 后台扩展（「扩展」中安装后出现在「商品目录 → 商品导入」）。
//
// 流程：选择平台并粘贴商品链接 → 抓取名称、描述、价格、图片、尺码、颜色 → Claude 翻译为英/中/日
//       → 在页面上核对修改 → 入库（商品 + 规格 + 图片 + 三语翻译 + 各渠道价格，状态为未发布）
//
// 路由（均在 BASE_PATH 下，默认 /importer）：
//   GET  /manifest       Saleor 应用清单（安装时读取）
//   POST /register       Saleor 安装应用时回传应用令牌；收到后稍等安装完成再向 Saleor 验证，确认属于本应用才启用
//   GET  /               后台中打开的操作页面
//   GET  /api/options    商品类型、分类、渠道、仓库
//   POST /api/discover   { categoryId, refresh? }  按分类联网搜索可挑选商品的分类页 / 列表页（需 Claude 订阅令牌）
//                        返回逐行 JSON 流（application/x-ndjson），实时推送搜索进度与结果，事件见 discover.mjs
//   POST /api/scrape     { url, platform? }  平台默认自动识别
//   POST /api/translate  { name, description, colors, suggestCategory }
//   POST /api/import     见 saleor.mjs importProduct
//   POST /api/translate-fields  { name, description } → { en, zh, ja }  后台表单（新建分类弹窗等）的字段翻译
//   /api/* 需带请求头 Authorization-Bearer: <后台交给页面的员工凭证>
//
// 环境变量：
//   CLAUDE_CODE_OAUTH_TOKEN  翻译用：Claude 订阅令牌（`claude setup-token` 生成），走订阅额度
//   ANTHROPIC_API_KEY        翻译用：Claude API Key，按用量计费；两者都配时优先用订阅令牌
//   PUBLIC_URL          站点地址，如 https://pinso.top
//   TOKEN_TARGET_URL    Saleor 回传应用令牌的地址，默认 <PUBLIC_URL>/importer/register
//                       （Saleor 默认禁止向内网地址发请求，所以使用公网地址）
//   SALEOR_API_URL      默认 http://api:8000/graphql/
//   DATA_DIR            保存应用令牌的目录，默认 /data
//   PORT                默认 8200
//   CORS_ORIGINS        允许跨域调用的后台地址，逗号分隔（本地开发时后台在 http://localhost:9000；线上同域无需配置）

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scrape, ScrapeError } from './scrape.mjs';
import { translateBackend, translateFields, translateProduct } from './translate.mjs';
import { discoverStream } from './discover.mjs';
import { gql, importProduct, loadOptions, SaleorError, verifyStaff } from './saleor.mjs';

const env = process.env;
const PORT = Number(env.PORT || 8200);
const BASE = env.BASE_PATH || '/importer';
const PUBLIC_URL = (env.PUBLIC_URL || 'http://localhost:8200').replace(/\/$/, '');
const TOKEN_TARGET_URL = env.TOKEN_TARGET_URL || `${PUBLIC_URL}${BASE}/register`;
const APP_ID = 'pinso.product-importer';
const DATA_DIR = env.DATA_DIR || '/data';
const TOKEN_FILE = path.join(DATA_DIR, 'app-token.json');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = fs.readFileSync(path.join(HERE, 'public', 'index.html'), 'utf8');
const CORS_ORIGINS = (env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

const manifest = () => ({
  id: APP_ID,
  version: '1.0.0',
  name: '商品导入',
  about: '从 Shopify、独立站、亚马逊商品链接抓取商品信息，经 Claude 翻译为中英日三语后入库。',
  permissions: ['MANAGE_PRODUCTS', 'MANAGE_PRODUCT_TYPES_AND_ATTRIBUTES', 'MANAGE_TRANSLATIONS'],
  appUrl: `${PUBLIC_URL}${BASE}`,
  tokenTargetUrl: TOKEN_TARGET_URL,
  extensions: [{
    label: '商品导入',
    mount: 'NAVIGATION_CATALOG',
    target: 'APP_PAGE',
    permissions: ['MANAGE_PRODUCTS'],
    url: '/',
  }],
});

function readAppToken() {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')).token || '';
  } catch {
    return '';
  }
}

// 安装回调的地址是公开的，任何人都能往里提交令牌，所以先不启用：
// 等 Saleor 完成安装后用该令牌查询自身，确认是本应用的令牌才保存
async function verifyAndSaveToken(token) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    await new Promise(r => setTimeout(r, 5_000));
    const d = await gql(`{ app { identifier } }`, {}, token).catch(() => null);
    if (d?.app?.identifier === APP_ID) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token, installedAt: new Date().toISOString() }), { mode: 0o600 });
      log({ event: 'installed' });
      return;
    }
  }
  log({ event: 'token_rejected', message: '收到的令牌无法通过验证，已丢弃' });
}

function log(entry) {
  console.log(JSON.stringify({ time: new Date().toISOString(), ...entry }));
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}

function readBody(req, limit = 2_000_000) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      data += chunk;
      if (data.length > limit) {
        reject(new Error('请求内容过大'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  // 本地开发时后台与导入服务不同源，按白名单允许跨域
  const origin = req.headers.origin;
  if (origin && CORS_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization-Bearer');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') return res.end();
  }
  if (!pathname.startsWith(BASE)) return send(res, 404, { error: 'NOT_FOUND' });
  const route = pathname.slice(BASE.length) || '/';

  try {
    if (req.method === 'GET' && route === '/manifest') return send(res, 200, manifest());
    if (req.method === 'GET' && (route === '/' || route === '/index.html')) return send(res, 200, PAGE, 'text/html; charset=utf-8');
    if (req.method === 'GET' && route === '/health') return send(res, 200, { ok: true, installed: !!readAppToken() });

    if (req.method === 'POST' && route === '/register') {
      const { auth_token: token } = JSON.parse(await readBody(req, 10_000));
      if (typeof token !== 'string' || !token) return send(res, 400, { error: 'NO_TOKEN' });
      verifyAndSaveToken(token);
      return send(res, 200, { success: true });
    }

    if (!route.startsWith('/api/')) return send(res, 404, { error: 'NOT_FOUND' });

    const staff = await verifyStaff(req.headers['authorization-bearer']);
    if (!staff) return send(res, 401, { error: '请从 Saleor 后台打开本页面（需要「管理商品」权限）' });
    const appToken = readAppToken();
    if (!appToken) return send(res, 503, { error: '应用尚未完成安装，请在后台「扩展」中重新安装商品导入' });

    if (req.method === 'GET' && route === '/api/options') return send(res, 200, await loadOptions(appToken));

    const input = req.method === 'POST' ? JSON.parse(await readBody(req) || '{}') : {};
    if (req.method === 'POST' && route === '/api/discover') {
      if (translateBackend() !== 'claude-code') return send(res, 503, { error: '找货源需要配置 Claude 订阅令牌（CLAUDE_CODE_OAUTH_TOKEN）' });
      const { categories } = await loadOptions(appToken);
      const category = categories.find(c => c.id === input.categoryId);
      if (!category) return send(res, 400, { error: '请先选择分类' });
      const name = category.parent ? `${category.parent.name} / ${category.name}` : category.name;
      // 逐行推送进度；X-Accel-Buffering 让 Nginx 不缓冲，页面能实时看到
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
      const emit = event => res.write(`${JSON.stringify(event)}\n`);
      try {
        await discoverStream(name, {
          refresh: Boolean(input.refresh),
          emit: event => {
            emit(event);
            if (event.type === 'done') log({ event: 'discovered', staff, category: name, found: event.total, cached: Boolean(event.cached), searchMs: event.searchMs, elapsedMs: event.elapsedMs });
          },
        });
      } catch (e) {
        emit({ type: 'error', message: e.message });
      }
      return res.end();
    }
    if (req.method === 'POST' && route === '/api/scrape') {
      const product = await scrape(input.platform ? String(input.platform) : 'auto', String(input.url).trim());
      log({ event: 'scraped', staff, platform: input.platform, url: input.url });
      return send(res, 200, product);
    }
    if (req.method === 'POST' && route === '/api/translate') {
      if (!translateBackend()) return send(res, 503, { error: '服务器未配置 CLAUDE_CODE_OAUTH_TOKEN（订阅额度）或 ANTHROPIC_API_KEY，无法翻译' });
      // 自动分类时把现有分类交给 Claude 推荐；指定分类时不需要
      const categories = input.suggestCategory ? (await loadOptions(appToken)).categories : [];
      const result = await translateProduct({
        name: String(input.name ?? ''),
        description: String(input.description ?? ''),
        colors: Array.isArray(input.colors) ? input.colors.map(String) : [],
        categories: categories.map(c => ({ id: c.id, name: c.parent ? `${c.parent.name} / ${c.name}` : c.name })),
      });
      return send(res, 200, result);
    }
    if (req.method === 'POST' && route === '/api/translate-fields') {
      if (!translateBackend()) return send(res, 503, { error: '服务器未配置 CLAUDE_CODE_OAUTH_TOKEN（订阅额度）或 ANTHROPIC_API_KEY，无法翻译' });
      const name = String(input.name ?? '').trim();
      if (!name) return send(res, 400, { error: '请先填写名称' });
      return send(res, 200, await translateFields({ name, description: String(input.description ?? '') }));
    }
    if (req.method === 'POST' && route === '/api/import') {
      const result = await importProduct(input, appToken);
      log({ event: 'imported', staff, product: result.id, source: input.sourceUrl });
      return send(res, 200, result);
    }
    return send(res, 404, { error: 'NOT_FOUND' });
  } catch (e) {
    const known = e instanceof ScrapeError || e instanceof SaleorError || e instanceof SyntaxError;
    log({ event: 'error', route, message: e.message });
    return send(res, known ? 400 : 500, { error: known ? e.message : `处理失败：${e.message}` });
  }
});

server.listen(PORT, () => log({ event: 'started', port: PORT, base: BASE, installed: !!readAppToken(), translate: translateBackend() || 'none' }));
