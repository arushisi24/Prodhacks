function setActiveChapter(ch) {
  for (let i = 1; i <= 6; i++) {
    const elx = document.getElementById(`chapter-${i}`);
    if (!elx) continue;
    elx.classList.toggle("active", i === ch);
  }
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

function el(id) {
  return document.getElementById(id);
}

function addBubble(container, who, text) {
  const div = document.createElement("div");
  div.className = `bubble ${who}`;
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function setProgress(p) {
  const pct = Math.round((p || 0) * 100);
  const pctEl = el("progressPct");
  const fillEl = el("progressFill");
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (fillEl) fillEl.style.width = `${pct}%`;
}

function showQuickReplies(show) {
  const qr = el("quickReplies");
  if (!qr) return;
  qr.classList.toggle("hidden", !show);
}

async function refreshDashboard() {
  const out = el("stateJson");
  if (!out) return;
  const state = await getJSON("/api/state");
  out.textContent = JSON.stringify(state, null, 2);
  setProgress(state.progress);
}

async function initChat() {
  const chat = el("chat");
  const input = el("msgInput");
  const sendBtn = el("sendBtn");
  const resetBtn = el("resetBtn");

  if (!chat || !input || !sendBtn) return;

  async function bootWelcome() {
    // Ask backend for opening message + state
    const data = await postJSON("/api/chat", { message: "" });
    addBubble(chat, "assistant", data.reply);
    setProgress(data.progress);

    if (typeof data.chapter === "number") setActiveChapter(data.chapter);

    // Welcome screen should show buttons
    showQuickReplies(true);
  }

  // Initial greeting on page load
  try {
    await bootWelcome();
  } catch (err) {
    // fallback if server isn't reachable
    addBubble(
      chat,
      "assistant",
      "Hi! I’m FAFSA Buddy 👋\n\nWhat do you want help with today? Use the buttons below."
    );
    showQuickReplies(true);
  }

  async function sendMessage(text) {
    const msg = (text || "").trim();
    if (!msg) return;

    addBubble(chat, "user", msg);
    input.value = "";

    const data = await postJSON("/api/chat", { message: msg });
    addBubble(chat, "assistant", data.reply);

    setProgress(data.progress);
    if (typeof data.chapter === "number") setActiveChapter(data.chapter);

    // Show quick replies only when the assistant is asking the "start" question
    const replyLower = (data.reply || "").toLowerCase();
    const shouldShow =
      replyLower.includes("tap one of the buttons") ||
      replyLower.includes("what do you want help with") ||
      replyLower.includes("choose one") ||
      replyLower.includes("i don't know") ||
      replyLower.includes("i don’t know");

    showQuickReplies(shouldShow);
  }

  sendBtn.addEventListener("click", () => sendMessage(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage(input.value);
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      await postJSON("/api/reset", {});
      chat.innerHTML = "";
      await bootWelcome();
    });
  }

  // Quick reply chips
  const qr = el("quickReplies");
  if (qr) {
    qr.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-chip]");
      if (!btn) return;
      sendMessage(btn.getAttribute("data-chip"));
    });
  }
}

// page boot
document.addEventListener("DOMContentLoaded", async () => {
  // If this is dashboard page
  if (el("stateJson")) {
    await refreshDashboard();

    const refreshBtn = el("refreshBtn");
    const resetBtn = el("resetBtn");

    if (refreshBtn) refreshBtn.addEventListener("click", refreshDashboard);
    if (resetBtn) {
      resetBtn.addEventListener("click", async () => {
        await postJSON("/api/reset", {});
        await refreshDashboard();
      });
    }
    return;
  }

  // Otherwise chat/checklist pages
  try {
    const st = await getJSON("/api/state");
    setProgress(st.progress);
  } catch (_) {
    // ignore if server not up
  }

  initChat();
});
