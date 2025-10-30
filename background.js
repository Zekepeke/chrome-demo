// Quick Demo Extension background service worker
// - Opens the options page on first install
// - Keeps a BroadcastChannel to fan-out "status" changes in real time
// - Optionally connects to a WebSocket backend (placeholder URL)
// - Syncs server messages into storage.local so the popup can react

const CHANNEL = new BroadcastChannel('qde-sync');
let ws = null;
let wsUrl = null;
let displayName = 'Guest';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(["displayName", "backendUrl"], (s) => {
    if (!s.displayName) {
      chrome.tabs.create({ url: "options.html" });
    }
    displayName = s.displayName || "Guest";
    wsUrl = s.backendUrl || null;
    maybeConnectWebSocket();
  });
});

// Listen to storage changes and broadcast lightweight updates
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes.status) {
    const status = changes.status.newValue || "";
    CHANNEL.postMessage({ type: "STATUS_CHANGED", status, at: Date.now() });
    sendStatusToServer(status);
  }
  if (areaName === "sync" && (changes.backendUrl || changes.displayName)) {
    if (changes.backendUrl) wsUrl = changes.backendUrl.newValue || null;
    if (changes.displayName) displayName = changes.displayName.newValue || "Guest";
    reconnectWebSocketSoon();
  }
});

// Allow popup to nudge us and also to ask if we're connected
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "PING") {
    sendResponse({ ok: true, connected: !!ws && ws.readyState === 1 });
    return true;
  }
  if (msg?.type === "SEND_TO_SERVER") {
    sendToServer(msg.payload);
    sendResponse({ ok: true });
    return true;
  }
});

function maybeConnectWebSocket() {
  if (!wsUrl) return;
  try {
    ws = new WebSocket(wsUrl);
  } catch (e) {
    console.warn("[QDE] Bad WebSocket URL:", wsUrl, e);
    return;
  }

  ws.addEventListener("open", () => {
    chrome.storage.local.set({ serverConnected: true });
    sendToServer({ type: "hello", name: displayName });
    // If we already have a status, publish it
    chrome.storage.sync.get(["status"], (s) => {
      if (s.status) sendStatusToServer(s.status);
    });
  });

  ws.addEventListener("message", (ev) => {
    // Expect JSON, but be resilient
    let data = null;
    try { data = JSON.parse(ev.data); } catch { data = { type: "text", text: String(ev.data) }; }
    if (data.type === "motd" || data.type === "text") {
      chrome.storage.local.set({ motd: data.text, motdAt: Date.now() });
    }
    // broadcast raw payload for the popup to reflect instantly
    CHANNEL.postMessage({ type: "WS_MESSAGE", data });
  });

  ws.addEventListener("close", () => {
    chrome.storage.local.set({ serverConnected: false });
    reconnectWebSocketSoon();
  });

  ws.addEventListener("error", () => {
    chrome.storage.local.set({ serverConnected: false });
    reconnectWebSocketSoon();
  });
}

let reconnectTimer = null;
function reconnectWebSocketSoon() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (ws) { try { ws.close(); } catch {} ws = null; }
  reconnectTimer = setTimeout(maybeConnectWebSocket, 1200);
}

function sendToServer(obj) {
  if (!ws || ws.readyState !== 1) return;
  try {
    ws.send(JSON.stringify(obj));
  } catch (e) {
    console.warn("[QDE] ws send error", e);
  }
}

function sendStatusToServer(status) {
  sendToServer({ type: "status", name: displayName, status, at: Date.now() });
}
