console.log('FAFSA Navigator: service worker started');

// Auto-load profile when user navigates to studentaid.gov
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('studentaid.gov')) {
    chrome.cookies.get({ url: 'https://prodhacks3.vercel.app', name: 'fafsa_sid' }, async (cookie) => {
      if (!cookie) return;
      try {
        const res = await fetch(`https://prodhacks3.vercel.app/api/get-profile?sid=${cookie.value}`);
        const data = await res.json();
        if (data.fields) {
          chrome.storage.local.set({ fafsaProfile: data.fields });
          console.log('FAFSA Buddy: profile loaded for', data.fields.student_name);
        }
        if (data.extracted) {
          chrome.storage.local.set({ fafsaExtracted: data.extracted });
          console.log('FAFSA Buddy: extracted data loaded');
        }
      } catch (err) {
        console.log('FAFSA Buddy: could not load profile', err);
      }
    });
  }
});

console.log('FAFSA Navigator: background service worker started');