// 在B站搜索页的搜索框右侧插入"匿名搜索"开关，与扩展弹窗中的开关同步
(() => {
  const ID = "bsa-toggle";
  let enabled = true;

  function build() {
    const wrap = document.createElement("label");
    wrap.id = ID;
    wrap.title = "开启后，搜索结果不受个性化推荐影响（切换后自动刷新）";
    wrap.innerHTML =
      '<span class="bsa-text"></span>' +
      '<button type="button" class="bsa-switch" role="switch" aria-label="匿名搜索"></button>';
    wrap.querySelector("button").addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        const res = await chrome.runtime.sendMessage({ type: "set", enabled: !enabled });
        render(res.enabled);
        location.reload();
      } catch {
        // 扩展刚被更新或重新加载时，旧页面无法通信，刷新页面即可
        location.reload();
      }
    });
    return wrap;
  }

  function render(on) {
    enabled = on;
    const el = document.getElementById(ID);
    if (!el) return;
    el.classList.toggle("bsa-on", on);
    el.querySelector(".bsa-text").textContent = "匿名搜索";
    el.title = (on ? "匿名搜索：已开启" : "匿名搜索：已关闭") + "（点击切换，页面会自动刷新）";
    el.querySelector("button").setAttribute("aria-checked", String(on));
  }

  // 是否在搜索框里显示开关（在扩展弹窗中设置）
  let showInPage = false;

  // 插到搜索框内、"搜索"按钮左侧
  function mount() {
    if (!showInPage || document.getElementById(ID)) return;
    const btn = document.querySelector(".search-input-wrap .search-button");
    if (!btn) return;
    btn.insertAdjacentElement("beforebegin", build());
    render(enabled);
  }

  function unmount() {
    document.getElementById(ID)?.remove();
  }

  Promise.all([
    chrome.runtime.sendMessage({ type: "get" }),
    chrome.storage.local.get({ showInPage: true })
  ]).then(([res, opts]) => {
    enabled = res.enabled;
    showInPage = opts.showInPage;
    mount();
  });

  // 页面局部重绘时可能把开关去掉，发现缺失就重新插入
  new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });

  // 在扩展弹窗里切换时同步
  chrome.storage.onChanged.addListener((changes) => {
    if ("enabled" in changes) render(changes.enabled.newValue);
    if ("showInPage" in changes) {
      showInPage = changes.showInPage.newValue;
      showInPage ? mount() : unmount();
    }
  });
})();
