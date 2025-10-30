document.addEventListener("DOMContentLoaded", () => {
  const nameEl = document.getElementById("displayName");
  const urlEl = document.getElementById("backendUrl");
  const saveBtn = document.getElementById("save");
  const saved = document.getElementById("saved");

  chrome.storage.sync.get(["displayName", "backendUrl"], (s) => {
    nameEl.value = s.displayName || "";
    urlEl.value = s.backendUrl || "";
  });

  saveBtn.addEventListener("click", () => {
    const displayName = nameEl.value.trim() || "Guest";
    const backendUrl = urlEl.value.trim() || "";
    chrome.storage.sync.set({ displayName, backendUrl }, () => {
      saved.textContent = "Saved ✓";
      setTimeout(() => saved.textContent = "", 1200);
    });
  });
});
