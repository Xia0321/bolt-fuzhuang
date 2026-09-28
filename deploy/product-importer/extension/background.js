// 点插件图标：在当前商品页取出页面 HTML（精简 + gzip），存到插件存储，再打开后台的商品导入页；
// 导入页里的内容脚本（importer.js）把它转交给页面，页面带着它调用 /api/scrape，服务器不用再去请求对方网站。
const SITE = 'https://pinso.top';
// 后台里「商品目录 → 商品导入」的地址（QXBwOjI= 是导入应用在 Saleor 中的 ID）。
// 重新安装导入应用后 ID 会变：打开一次新的导入页，importer.js 会记下新地址并优先使用
const IMPORTER_PAGE = `${SITE}/dashboard/extensions/app/${encodeURIComponent('QXBwOjI=')}`;

chrome.action.onClicked.addListener(async tab => {
  try {
    if (!/^https?:/.test(tab.url || '')) throw new Error('请在商品详情页上点击插件');
    if (tab.url.startsWith(SITE)) throw new Error('请到要采集的商品详情页上点击插件');
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: capturePage });
    if (result.error) throw new Error(result.error);
    await chrome.storage.local.set({ capture: { id: crypto.randomUUID(), url: result.url, htmlGz: result.htmlGz, at: Date.now() } });
    await toast(tab.id, '已采集，正在打开商品导入页…');
    await openImporter();
  } catch (e) {
    await toast(tab.id, `采集失败：${e.message}`, true).catch(() => {});
  }
});

// 在商品页中执行：去掉样式、图标等与商品数据无关的部分后压缩。脚本要保留，亚马逊的颜色、尺码、图集数据在脚本里
async function capturePage() {
  const doc = document.documentElement.cloneNode(true);
  doc.querySelectorAll('style, link, svg, noscript, iframe, video, canvas, template').forEach(el => el.remove());
  doc.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
  const html = `<!doctype html>${doc.outerHTML}`;
  const gz = new Blob([html]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(gz).arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const htmlGz = btoa(binary);
  // 导入服务单次请求上限 2MB
  if (htmlGz.length > 1_900_000) return { error: '页面内容太大，无法采集' };
  return { url: location.href, htmlGz };
}

// 已打开的商品导入页直接切过去（页面会自动开始抓取）；没打开过则新开
async function openImporter() {
  const { importerPage = IMPORTER_PAGE } = await chrome.storage.local.get('importerPage');
  const path = url => url.split(/[?#]/)[0];
  const open = (await chrome.tabs.query({ url: `${SITE}/dashboard/*` })).find(t => t.url && path(t.url) === path(importerPage));
  if (open) {
    await chrome.tabs.update(open.id, { active: true });
    await chrome.windows.update(open.windowId, { focused: true });
    return;
  }
  await chrome.tabs.create({ url: importerPage });
}

// 在商品页右上角显示几秒提示
async function toast(tabId, text, error = false) {
  await chrome.scripting.executeScript({
    target: { tabId },
    args: [text, error],
    func: (message, isError) => {
      document.getElementById('pinso-capture-toast')?.remove();
      const el = document.createElement('div');
      el.id = 'pinso-capture-toast';
      el.textContent = message;
      el.style.cssText = `position:fixed;top:16px;right:16px;z-index:2147483647;max-width:360px;padding:10px 14px;border-radius:6px;
        font:14px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;color:#fff;background:${isError ? '#c62828' : '#2e7d32'};box-shadow:0 4px 12px rgba(0,0,0,.2)`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), isError ? 6000 : 3000);
    },
  });
}
