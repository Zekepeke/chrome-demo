// Utility: debounce
const debounce = (fn, ms=250) => {
  let t; return (...args) => { clearTimeout(t); t=setTimeout(()=>fn(...args),ms); };
};

const statusInput = document.getElementById("statusInput");
const clearBtn = document.getElementById("clearBtn");
const savedLabel = document.getElementById("savedLabel");
const connDot = document.getElementById("connDot");
const connText = document.getElementById("connText");
const motd = document.getElementById("motd");
const openOptions = document.getElementById("openOptions");
const pingBtn = document.getElementById("pingBtn");
const pageTitleEl = document.getElementById("pageTitle");
const snippetEl = document.getElementById("snippet");
const wordCountEl = document.getElementById("wordCount");

const CH = new BroadcastChannel('qde-sync');

// Load initial settings and status
chrome.storage.sync.get(["status"], (s) => {
  statusInput.value = s.status || "";
  savedLabel.textContent = s.status ? "Saved in sync storage" : "Nothing saved yet";
});

// Keep UI updated whenever any context updates the status
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.status) {
    const v = changes.status.newValue || "";
    if (statusInput.value !== v) {
      statusInput.value = v;
      savedLabel.textContent = "Updated from another context";
    }
  }
  if (area === "local") {
    if (changes.serverConnected) reflectConn(changes.serverConnected.newValue);
    if (changes.motd) motd.textContent = changes.motd.newValue || "—";
  }
});

CH.onmessage = (e) => {
  if (e.data?.type === "WS_MESSAGE") {
    motd.textContent = JSON.stringify(e.data.data, null, 2);
  }
};

// Persist as the user types (debounced) and show "Saved" state
const saveStatus = debounce((value) => {
  chrome.storage.sync.set({ status: value });
  savedLabel.textContent = "Saved ✔";
}, 300);

statusInput.addEventListener("input", (e) => {
  savedLabel.textContent = "Saving…";
  saveStatus(e.target.value);
});

clearBtn.addEventListener("click", () => {
  statusInput.value = "";
  chrome.storage.sync.set({ status: "" });
  savedLabel.textContent = "Cleared";
});

openOptions.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

pingBtn.addEventListener("click", async () => {
  chrome.runtime.sendMessage({ type: "SEND_TO_SERVER", payload: { type: "ping", at: Date.now() } }, () => {});
});

function reflectConn(connected) {
  connDot.classList.toggle("ok", !!connected);
  connText.textContent = connected ? "Server connected" : "Not connected";
}

// Ask background for current connection state
chrome.runtime.sendMessage({ type: "PING" }, (res) => {
  if (res?.ok) reflectConn(res.connected);
});

// Request page info from the content script
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_INFO" }, (info) => {
    if (!info) {
      pageTitleEl.textContent = "This page doesn't allow content scripts here.";
      snippetEl.textContent = "Try a regular website tab.";
      return;
    }
    pageTitleEl.textContent = info.title || "";
    snippetEl.textContent = info.snippet || "";
    wordCountEl.textContent = info.wordCount ?? 0;
  });
});
