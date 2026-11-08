const box = document.getElementById("box");
const sw = document.getElementById("sw");
const statusEl = document.getElementById("status");
let current = false;

function render(on) {
  current = on;
  box.classList.toggle("on", on);
  sw.setAttribute("aria-checked", String(on));
  statusEl.textContent = on ? "开启" : "关闭";
}

sw.addEventListener("click", async () => {
  const { enabled } = await chrome.runtime.sendMessage({ type: "set", enabled: !current });
  render(enabled);

  // 当前标签页是B站搜索页时自动刷新，让切换立即生效
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url && /^https?:\/\/search\.bilibili\.com\//.test(tab.url)) {
    chrome.tabs.reload(tab.id);
  }
});

// 在搜索页上切换时，弹窗同步更新
chrome.storage.onChanged.addListener((changes) => {
  if ("enabled" in changes) render(changes.enabled.newValue);
});

chrome.runtime.sendMessage({ type: "get" }).then(({ enabled }) => render(enabled));

// 设置：是否在B站搜索框中显示开关，修改后搜索页上的开关会立即出现或消失
const optBox = document.getElementById("optBox");
const optSw = document.getElementById("optSw");
let showInPage = true;

function renderOpt(on) {
  showInPage = on;
  optBox.classList.toggle("on", on);
  optSw.setAttribute("aria-checked", String(on));
}

optSw.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.storage.local.set({ showInPage: !showInPage });
});

chrome.storage.onChanged.addListener((changes) => {
  if ("showInPage" in changes) renderOpt(changes.showInPage.newValue);
});

chrome.storage.local.get({ showInPage: true }).then(({ showInPage }) => renderOpt(showInPage));
