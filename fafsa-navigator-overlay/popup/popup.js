// Show current profile status when popup opens
chrome.storage.local.get(['fafsaProfile'], ({ fafsaProfile }) => {
  const status = document.getElementById('sync-status');
  if (fafsaProfile && fafsaProfile.student_name) {
    status.textContent = `✅ Profile ready — ${fafsaProfile.student_name}`;
  } else {
    status.textContent = 'No profile loaded yet.';
  }
});

// Load profile button
document.getElementById('sync-btn').addEventListener('click', async () => {
  const status = document.getElementById('sync-status');
  status.textContent = 'Loading...';

  chrome.cookies.get({ url: 'https://prodhacks3.vercel.app', name: 'fafsa_sid' }, async (cookie) => {
    if (!cookie) {
      status.textContent = '❌ Complete the chat at prodhacks3.vercel.app first.';
      return;
    }

    try {
      const res = await fetch(`https://prodhacks3.vercel.app/api/get-profile?sid=${cookie.value}`);
      const data = await res.json();

      if (data.fields) {
        chrome.storage.local.set({ fafsaProfile: data.fields });
        status.textContent = `✅ Profile loaded — ${data.fields.student_name ?? 'student'}`;
      } else {
        status.textContent = '❌ No profile found. Complete the chat first.';
      }
    } catch (err) {
      status.textContent = '❌ Error connecting to website.';
    }
  });
});