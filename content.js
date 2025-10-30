// Content script used by the demo to read page info
function getSelectionOrPage() {
  const selection = window.getSelection()?.toString()?.trim();
  const title = document.title || location.hostname;
  if (selection) {
    return { title, snippet: selection, wordCount: countWords(selection), source: "selection" };
  }
  const main = document.querySelector("article") || document.querySelector("main") || document.body;
  const text = (main?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 2000);
  return { title, snippet: text, wordCount: countWords(text), source: "page" };
}

function countWords(s) {
  if (!s) return 0;
  return (s.match(/[^\s]+/g) || []).length;
}

chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
  if (req.type === "GET_PAGE_INFO") {
    const info = getSelectionOrPage();
    sendResponse(info);
  }
});
