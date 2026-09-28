// 运行在后台的商品导入页（/importer/，嵌在后台页面中）：把插件采集到的商品页转交给页面。
// 页面收到后回复 capture-received，此时才从插件存储中删除，避免页面还没加载好时丢失。

// 记下商品导入页在后台中的实际地址（重新安装导入应用后 ID 会变，以实际打开过的为准）
try {
  if (window.top !== window) chrome.storage.local.set({ importerPage: window.top.location.href });
} catch {
  // 忽略
}

const MAX_AGE = 10 * 60_000;
let delivered = '';

async function deliver() {
  // 同时开着几个导入页时，只交给正在看的那个
  if (document.visibilityState !== 'visible') return;
  const { capture } = await chrome.storage.local.get('capture');
  if (!capture || capture.id === delivered) return;
  if (Date.now() - capture.at > MAX_AGE) return chrome.storage.local.remove('capture');
  delivered = capture.id;
  window.postMessage({ source: 'pinso-extension', type: 'capture', id: capture.id, url: capture.url, htmlGz: capture.htmlGz }, location.origin);
}

window.addEventListener('message', async e => {
  if (e.source !== window || e.data?.source !== 'pinso-importer' || e.data.type !== 'capture-received') return;
  const { capture } = await chrome.storage.local.get('capture');
  if (capture?.id === e.data.id) await chrome.storage.local.remove('capture');
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.capture?.newValue) deliver();
});
document.addEventListener('visibilitychange', deliver);
deliver();
