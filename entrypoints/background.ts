export default defineBackground(() => {
  // Open the side panel when the user clicks the extension icon
  browser.action.onClicked.addListener(async (tab) => {
    if (!tab.id) return;
    try {
      // @ts-expect-error — sidePanel API is MV3-only, not yet in @types/chrome
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch {
      // Fallback: open popup (non-Chrome browsers)
      try { await browser.action.openPopup(); } catch { /* ignore */ }
    }
  });

  // Keyboard shortcut: also opens the side panel
  browser.commands?.onCommand?.addListener(async (command) => {
    if (command !== 'fill-form') return;
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    try {
      // @ts-expect-error — sidePanel API
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch {
      try { await browser.action.openPopup(); } catch { /* ignore */ }
    }
  });
});
