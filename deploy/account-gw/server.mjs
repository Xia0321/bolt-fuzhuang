// 注册服务：为顾客注册加上人机验证（Cloudflare Turnstile）和频率限制。
//
// 注册后由 Saleor 自带的邮件插件发送确认邮件，顾客点击邮件中的链接（前台 /confirm-account）完成确认后才能登录。
// 本服务负责在调用 accountRegister 之前拦住脚本批量注册，避免消耗发信额度。
//
// 接口：
//   GET  /api/register/config  → { enabled, captchaSiteKey }
//   POST /api/register         { email, password, captchaToken, languageCode?, channel? }
//                              → { ok: true } 或 { ok: false, code, message }
//
// 环境变量：
//   TURNSTILE_SITE_KEY / TURNSTILE_SECRET  Cloudflare Turnstile 站点密钥与密钥
//   SALEOR_APP_TOKEN   Saleor 后台「扩展」中创建的本地应用令牌，只需「管理客户」权限（查询邮箱是否已注册）
//   SALEOR_API_URL     默认 http://api:8000/graphql/（Compose 内网）
//   SALEOR_HOST        请求 Saleor 时使用的 Host 头，需在 Saleor 的 ALLOWED_HOSTS 中，默认 localhost
//   STOREFRONT_URL     前台地址，确认邮件中的链接指向 <STOREFRONT_URL>/confirm-account
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
const { TURNSTILE_SITE_KEY = '', TURNSTILE_SECRET = '', SALEOR_APP_TOKEN = '' } = env;
const ENABLED = Boolean(TURNSTILE_SITE_KEY && TURNSTILE_SECRET && SALEOR_APP_TOKEN);

// 频率限制（Nginx 另有每 IP 每分钟 3 次的请求限制）
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

async function saleor(query, variables, { auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (SALEOR_HOST) headers.Host = SALEOR_HOST;
  if (auth) headers.Authorization = `Bearer ${SALEOR_APP_TOKEN}`;
  const res = await request(SALEOR_API_URL, { headers, body: JSON.stringify({ query, variables }) });
  const json = JSON.parse(res.body);
  if (json.errors?.length) throw new Error(`Saleor: ${json.errors[0].message}`);
  return json.data;
}

async function verifyCaptcha(token, ip) {
  const body = new URLSearchParams({ secret: TURNSTILE_SECRET, response: token, remoteip: ip }).toString();
  const res = await request('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  return JSON.parse(res.body).success === true;
}

// ---------- 注册 ----------

class Reject extends Error {
  constructor(code, status = 400, message = code) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const PASSWORD_CODES = new Set(['PASSWORD_TOO_SHORT', 'PASSWORD_TOO_SIMILAR', 'PASSWORD_TOO_COMMON', 'PASSWORD_ENTIRELY_NUMERIC', 'INVALID_PASSWORD']);

async function register(input, ip) {
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  const captchaToken = typeof input.captchaToken === 'string' ? input.captchaToken : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Reject('INVALID_EMAIL');
  if (password.length < 8 || password.length > 128) throw new Reject('INVALID_PASSWORD');
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
      redirectUrl: `${STOREFRONT_URL}/confirm-account`,
      ...(LANGUAGES.has(input.languageCode) ? { languageCode: input.languageCode } : {}),
      ...(typeof input.channel === 'string' && /^[a-z0-9-]{1,50}$/.test(input.channel) ? { channel: input.channel } : {}),
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

const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  // Nginx 以 X-Real-IP 传入客户端真实 IP；本地开发直连时使用连接地址
  const ip = req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown';

  if (req.method === 'GET' && path === '/api/register/config') {
    return send(res, 200, { enabled: ENABLED, captchaSiteKey: ENABLED ? TURNSTILE_SITE_KEY : '' });
  }
  if (req.method === 'GET' && path === '/health') return send(res, 200, { ok: true });
  if (req.method !== 'POST' || path !== '/api/register') return send(res, 404, { ok: false, code: 'NOT_FOUND' });
  if (!ENABLED) return send(res, 503, { ok: false, code: 'DISABLED' });

  try {
    const input = JSON.parse(await readBody(req));
    await register(input ?? {}, ip);
    log({ ip, event: 'registered', domain: String(input.email).split('@')[1] });
    send(res, 200, { ok: true });
  } catch (e) {
    if (e instanceof Reject) {
      log({ ip, event: 'rejected', code: e.code });
      return send(res, e.status, { ok: false, code: e.code, message: e.message });
    }
    if (e instanceof SyntaxError) return send(res, 400, { ok: false, code: 'BAD_REQUEST' });
    log({ ip, event: 'error', message: e.message });
    send(res, 500, { ok: false, code: 'UNKNOWN', message: 'Registration failed' });
  }
});

server.listen(PORT, () => {
  log({ event: 'started', port: PORT, enabled: ENABLED, saleor: SALEOR_API_URL });
  if (!ENABLED) log({ event: 'warning', message: 'TURNSTILE_SITE_KEY / TURNSTILE_SECRET / SALEOR_APP_TOKEN 未配置，注册已关闭' });
});
