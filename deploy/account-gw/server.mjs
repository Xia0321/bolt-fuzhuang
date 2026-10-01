// 账号服务：顾客注册前校验 Cloudflare Turnstile 人机验证并限制频率，再转交 Saleor。
// 前台（Saleor Paper）的 /api/auth/register 在服务端调用本服务，本服务只在 Compose 内网提供注册接口；
// 登录、找回密码、结账由前台直接调用 Saleor（Saleor 自带登录防爆破，前台另有每 IP 频率限制）。
//
// 注册后由 Saleor 自带的邮件插件发送确认邮件，顾客点击邮件中的链接（前台登录页）完成确认后才能登录。
// 说明：Saleor 的公开接口仍可被直接调用，绕过网站表单的请求由 Saleor 自身的限制兜底（同一邮箱只发一次确认邮件）。
//
// 接口（失败统一返回 { ok: false, code, message }）：
//   GET  /api/config             → { captchaSiteKey, registerEnabled }
//   POST /api/register           { email, password, captchaToken, languageCode?, channel?, redirectUrl? } → { ok }
//                                redirectUrl 必须是 STOREFRONT_URL 下的地址，否则使用 <STOREFRONT_URL>/confirm-account
//   GET/POST /api/admin/captcha-bypass  运营工具：临时关闭人机验证（需 GW_ADMIN_SECRET）
//
// 环境变量：
//   TURNSTILE_SITE_KEY / TURNSTILE_SECRET  Cloudflare Turnstile 站点密钥与密钥
//   SALEOR_APP_TOKEN   Saleor 本地应用令牌，只需「管理客户」权限（注册时查询邮箱是否已注册）
//   SALEOR_API_URL     默认 http://api:8000/graphql/（Compose 内网）
//   SALEOR_HOST        请求 Saleor 时使用的 Host 头，需在 Saleor 的 ALLOWED_HOSTS 中，默认 localhost
//   STOREFRONT_URL     前台地址，确认邮件中的链接只能指向该地址下的页面
//   PORT               默认 8100
//
// 不依赖任何 npm 包，node server.mjs 即可运行。

import http from 'node:http';
import https from 'node:https';

const env = process.env;
const PORT = Number(env.PORT || 8100);
const SALEOR_API_URL = env.SALEOR_API_URL || 'http://api:8000/graphql/';
const SALEOR_HOST = env.SALEOR_HOST || 'localhost';
const STOREFRONT_URL = (env.STOREFRONT_URL || 'http://localhost:5173').replace(/\/$/, '');
const { TURNSTILE_SITE_KEY = '', TURNSTILE_SECRET = '', SALEOR_APP_TOKEN = '', GW_ADMIN_SECRET = '' } = env;
// 未配置 Turnstile 或 App 令牌时注册关闭
const CAPTCHA_ENABLED = Boolean(TURNSTILE_SITE_KEY && TURNSTILE_SECRET);
const REGISTER_ENABLED = CAPTCHA_ENABLED && Boolean(SALEOR_APP_TOKEN);

// 运行时可通过管理接口切换（用于 AI 调试、自动化测试），重启后自动恢复
let captchaBypassEnabled = false;

// 频率限制（Nginx 另有每 IP 的请求频率限制）
const LIMITS = {
  attemptsPerIpHour: Number(env.LIMIT_ATTEMPTS_PER_IP_HOUR || 20),
  signupsPerIpHour: Number(env.LIMIT_SIGNUPS_PER_IP_HOUR || 5),
  signupsPerIpDay: Number(env.LIMIT_SIGNUPS_PER_IP_DAY || 20),
  // 全站每小时注册数超过该值视为被攻击，暂停注册
  signupsGlobalHour: Number(env.LIMIT_SIGNUPS_GLOBAL_HOUR || 200),
};

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const LANGUAGES = new Set(['ZH_HANS', 'EN', 'JA']);

// ---------- 计数器（单实例，内存保存，重启后清零） ----------

const hits = new Map(); // key → 时间戳数组

function count(key, windowMs) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter(t => now - t < windowMs);
  hits.set(key, list);
  return list.length;
}

function record(key) {
  const list = hits.get(key) || [];
  list.push(Date.now());
  hits.set(key, list);
}

setInterval(() => {
  const now = Date.now();
  for (const [key, list] of hits) {
    const kept = list.filter(t => now - t < DAY);
    if (kept.length) hits.set(key, kept);
    else hits.delete(key);
  }
}, 10 * 60_000).unref();

// ---------- 外部请求 ----------

// 用 http 模块而不是 fetch：需要自定义 Host 头，以便在容器内网访问 Saleor
function request(url, { method = 'POST', headers = {}, body = '' } = {}) {
  const target = new URL(url);
  const lib = target.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(target, { method, headers: { 'Content-Length': Buffer.byteLength(body), ...headers }, timeout: 15_000 }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end(body);
  });
}

// auth：使用 App 令牌；headers：额外请求头（转发顾客的登录凭证、客户端 IP）
async function saleor(query, variables, { auth = false, headers: extra = {} } = {}) {
  // X-Forwarded-Proto: https 告知 Saleor 原始连接已是 HTTPS，避免其将内网 HTTP 请求 301 重定向
  const headers = { 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https', ...extra };
  if (SALEOR_HOST) headers.Host = SALEOR_HOST;
  if (auth) headers.Authorization = `Bearer ${SALEOR_APP_TOKEN}`;
  const res = await request(SALEOR_API_URL, { headers, body: JSON.stringify({ query, variables }) });
  let json;
  try {
    json = JSON.parse(res.body);
  } catch {
    throw new Error(`saleor: unexpected response status=${res.status} body=${res.body.slice(0, 200)}`);
  }
  if (json.errors?.length) throw new Error(`Saleor: ${json.errors[0].message}`);
  return json.data;
}

async function verifyCaptcha(token, ip) {
  const body = new URLSearchParams({ secret: TURNSTILE_SECRET, response: token, remoteip: ip }).toString();
  const res = await request('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  let parsed;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    throw new Error(`turnstile: unexpected response status=${res.status} body=${res.body.slice(0, 200)}`);
  }
  return parsed.success === true;
}

class Reject extends Error {
  constructor(code, status = 400, message = code) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const str = v => (typeof v === 'string' ? v : '');
const cleanEmail = v => str(v).trim().toLowerCase();
const validChannel = v => (typeof v === 'string' && /^[a-z0-9-]{1,50}$/.test(v) ? v : undefined);
// 确认邮件中的链接只允许指向本站前台，防止注册接口被用来发送钓鱼链接
const confirmRedirectUrl = v => {
  const url = str(v);
  return url.startsWith(`${STOREFRONT_URL}/`) && url.length <= 500 ? url : `${STOREFRONT_URL}/confirm-account`;
};

// ---------- 注册 ----------

const PASSWORD_CODES = new Set(['PASSWORD_TOO_SHORT', 'PASSWORD_TOO_SIMILAR', 'PASSWORD_TOO_COMMON', 'PASSWORD_ENTIRELY_NUMERIC', 'INVALID_PASSWORD']);

async function register(input, ip) {
  const email = cleanEmail(input.email);
  const password = str(input.password);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Reject('INVALID_EMAIL');
  if (password.length < 8 || password.length > 128) throw new Reject('INVALID_PASSWORD');

  if (!captchaBypassEnabled) {
    const captchaToken = str(input.captchaToken);
    if (!captchaToken) throw new Reject('CAPTCHA_FAILED');
    // 先查频率再调用验证服务，被限流的请求不消耗外部调用
    if (count(`attempt:${ip}`, HOUR) >= LIMITS.attemptsPerIpHour
      || count(`signup:${ip}`, HOUR) >= LIMITS.signupsPerIpHour
      || count(`signup:${ip}`, DAY) >= LIMITS.signupsPerIpDay) {
      throw new Reject('RATE_LIMITED', 429);
    }
    if (count('signup:all', HOUR) >= LIMITS.signupsGlobalHour) throw new Reject('RATE_LIMITED', 429, 'global limit reached');
    record(`attempt:${ip}`);
    if (!(await verifyCaptcha(captchaToken, ip))) throw new Reject('CAPTCHA_FAILED');
  }

  // accountRegister 对已存在的邮箱同样返回成功，需先查询
  const found = await saleor(`query($email: String!) { user(email: $email) { id isConfirmed } }`, { email }, { auth: true });
  if (found.user?.isConfirmed) throw new Reject('EMAIL_EXISTS');
  if (found.user) {
    // 未确认的账号（没点确认链接，或他人抢先用该邮箱注册）删除后重新注册，会重新发送确认邮件，
    // 新密码以本次填写的为准，防止他人抢注邮箱
    const del = await saleor(`mutation($id: ID!) { customerDelete(id: $id) { errors { code message } } }`, { id: found.user.id }, { auth: true });
    if (del.customerDelete.errors.length) throw new Error(`customerDelete: ${del.customerDelete.errors[0].message}`);
    log({ ip, event: 'unconfirmed_replaced', domain: email.split('@')[1] });
  }

  const reg = await saleor(`mutation($input: AccountRegisterInput!) {
    accountRegister(input: $input) { errors { field code message } }
  }`, {
    input: {
      email,
      password,
      redirectUrl: confirmRedirectUrl(input.redirectUrl),
      ...(LANGUAGES.has(input.languageCode) ? { languageCode: input.languageCode } : {}),
      ...(validChannel(input.channel) ? { channel: input.channel } : {}),
    },
  });
  const err = reg.accountRegister.errors[0];
  if (err) {
    if (PASSWORD_CODES.has(err.code) || err.field === 'password') throw new Reject('INVALID_PASSWORD', 400, err.message);
    if (err.code === 'UNIQUE') throw new Reject('EMAIL_EXISTS');
    if (err.field === 'email') throw new Reject('INVALID_EMAIL', 400, err.message);
    throw new Error(`accountRegister: ${err.code} ${err.message}`);
  }
  record(`signup:${ip}`);
  record('signup:all');
  return { ok: true };
}

// ---------- HTTP ----------

function log(entry) {
  console.log(JSON.stringify({ time: new Date().toISOString(), ...entry }));
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req, limit = 10_000) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      data += chunk;
      if (data.length > limit) {
        reject(new Reject('TOO_LARGE', 413));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const ROUTES = {
  '/api/register': { handler: register, enabled: () => REGISTER_ENABLED || captchaBypassEnabled },
};

const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  // Nginx 以 X-Real-IP 传入客户端真实 IP；本地开发直连时使用连接地址
  const ip = req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown';

  if (req.method === 'GET' && path === '/api/config') {
    return send(res, 200, {
      captchaSiteKey: (CAPTCHA_ENABLED && !captchaBypassEnabled) ? TURNSTILE_SITE_KEY : '',
      registerEnabled: REGISTER_ENABLED || captchaBypassEnabled,
    });
  }
  if (req.method === 'GET' && path === '/health') return send(res, 200, { ok: true });

  // 管理接口：需要 Authorization: Bearer <GW_ADMIN_SECRET>，未配置 GW_ADMIN_SECRET 时不可用
  if (path === '/api/admin/captcha-bypass') {
    if (!GW_ADMIN_SECRET) return send(res, 404, { ok: false, code: 'NOT_FOUND' });
    if (req.headers.authorization !== `Bearer ${GW_ADMIN_SECRET}`) return send(res, 401, { ok: false, code: 'UNAUTHORIZED' });
    if (req.method === 'GET') {
      return send(res, 200, { ok: true, captchaBypass: captchaBypassEnabled, captchaEnabled: CAPTCHA_ENABLED, registerEnabled: REGISTER_ENABLED });
    }
    if (req.method === 'POST') {
      try {
        const body = JSON.parse(await readBody(req)) ?? {};
        captchaBypassEnabled = Boolean(body.enabled);
        log({ ip, event: 'admin', action: 'captcha_bypass', enabled: captchaBypassEnabled });
        return send(res, 200, { ok: true, captchaBypass: captchaBypassEnabled });
      } catch {
        return send(res, 400, { ok: false, code: 'BAD_REQUEST' });
      }
    }
  }
  const route = ROUTES[path];
  if (req.method !== 'POST' || !route) return send(res, 404, { ok: false, code: 'NOT_FOUND' });
  if (!route.enabled()) return send(res, 503, { ok: false, code: 'DISABLED' });

  try {
    const input = JSON.parse(await readBody(req)) ?? {};
    const result = await route.handler(input, ip);
    log({ ip, event: 'ok', path, ...(input.email ? { domain: String(input.email).split('@')[1] } : {}) });
    send(res, 200, result);
  } catch (e) {
    if (e instanceof Reject) {
      log({ ip, event: 'rejected', path, code: e.code });
      return send(res, e.status, { ok: false, code: e.code, message: e.message });
    }
    if (e instanceof SyntaxError) {
      log({ ip, event: 'error', path, message: `JSON parse failed: ${e.message}` });
      return send(res, 400, { ok: false, code: 'BAD_REQUEST' });
    }
    log({ ip, event: 'error', path, message: e.message });
    send(res, 500, { ok: false, code: 'UNKNOWN', message: 'Request failed' });
  }
});

server.listen(PORT, () => {
  log({ event: 'started', port: PORT, captcha: CAPTCHA_ENABLED, register: REGISTER_ENABLED, saleor: SALEOR_API_URL });
  if (!CAPTCHA_ENABLED) log({ event: 'warning', message: 'TURNSTILE_SITE_KEY / TURNSTILE_SECRET 未配置，人机验证与注册已关闭' });
  else if (!REGISTER_ENABLED) log({ event: 'warning', message: 'SALEOR_APP_TOKEN 未配置，注册已关闭' });
});
