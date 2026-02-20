console.log('FAFSA Navigator: service worker started');

// Show welcome modal on first install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set flag that user hasn't seen welcome yet
    chrome.storage.local.set({ hasSeenWelcome: false });
  }
});