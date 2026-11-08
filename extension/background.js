// B站匿名搜索：搜索请求只去掉登录相关的 Cookie，保留 buvid3 等设备标识。
// 开关状态存放在 chrome.storage.local.enabled，弹窗和搜索页上的开关都通过这里同步。

// 登录相关 Cookie（bp_t_offset_<uid> 的名字里带有用户 ID，一并去掉）
const LOGIN_COOKIE = /^(SESSDATA|bili_jct|DedeUserID|DedeUserID__ckMd5|sid|bp_t_offset_\d+)$/;

const TARGETS = [
  { id: 1, url: "https://search.bilibili.com/", condition: { requestDomains: ["search.bilibili.com"], resourceTypes: ["main_frame"] } },
  { id: 2, url: "https://api.bilibili.com/x/web-interface/search/", condition: { regexFilter: "^https?://api\\.bilibili\\.com/x/web-interface/(wbi/)?search/", resourceTypes: ["xmlhttprequest", "other"] } }
];

async function isEnabled() {
  const { enabled } = await chrome.storage.local.get({ enabled: true });
  return enabled;
}

async function buildRule({ id, url, condition }) {
  const cookies = await chrome.cookies.getAll({ url });
  const value = cookies
    .filter((c) => !LOGIN_COOKIE.test(c.name))
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  return {
    id,
    priority: 1,
    action: {
      type: "modifyHeaders",
      requestHeaders: [value ? { header: "cookie", operation: "set", value } : { header: "cookie", operation: "remove" }],
      // 不让搜索请求的响应改写浏览器里的 Cookie，避免影响登录状态
      responseHeaders: [{ header: "set-cookie", operation: "remove" }]
    },
    condition
  };
}

async function applyRules() {
  const on = await isEnabled();
  const addRules = on ? await Promise.all(TARGETS.map(buildRule)) : [];
  const old = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: old.map((r) => r.id),
    addRules
  });
  await chrome.action.setBadgeText({ text: on ? "" : "关" });
  await chrome.action.setBadgeBackgroundColor({ color: "#9499a0" });
  await chrome.action.setTitle({ title: on ? "Bilibili/B站匿名搜索：已开启" : "Bilibili/B站匿名搜索：已关闭" });
}

// B站的 Cookie 变化时（比如设备标识刷新），重新生成规则
let timer = null;
chrome.cookies.onChanged.addListener(({ cookie }) => {
  if (!cookie.domain.endsWith("bilibili.com")) return;
  clearTimeout(timer);
  timer = setTimeout(applyRules, 500);
});

chrome.runtime.onInstalled.addListener(applyRules);
chrome.runtime.onStartup.addListener(applyRules);

// 弹窗和页面开关通过消息读写状态，规则生效后再回复，保证刷新页面时已是新状态
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === "get") {
    isEnabled().then((enabled) => reply({ enabled }));
    return true;
  }
  if (msg?.type === "set") {
    chrome.storage.local
      .set({ enabled: !!msg.enabled })
      .then(applyRules)
      .then(() => reply({ enabled: !!msg.enabled }));
    return true;
  }
});
