"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

interface Message {
  who: "user" | "assistant";
  text: string;
}

const STEPS = [
  { num: 1, label: "Goal & basics" },
  { num: 2, label: "Household / dependency" },
  { num: 3, label: "Taxes & income" },
  { num: 4, label: "Assets & banking" },
  { num: 5, label: "Schools & timing" },
  { num: 6, label: "Checklist" },
];

async function postJSON(url: string, body: object) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [progress, setProgress] = useState(0);
  const [activeChapter, setActiveChapter] = useState(1);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }

  function addMessage(who: "user" | "assistant", text: string) {
    setMessages((prev) => [...prev, { who, text }]);
    setTimeout(scrollToBottom, 50);
  }

  const bootWelcome = useCallback(async () => {
    try {
      const data = await postJSON("/api/chat", { message: "" });
      addMessage("assistant", data.reply);
      setProgress(data.progress ?? 0);
      if (typeof data.chapter === "number") setActiveChapter(data.chapter);
      setShowQuickReplies(true);
    } catch {
      addMessage(
        "assistant",
        "Hi! I'm FAFSA Buddy 👋\n\nWhat do you want help with today? Use the buttons below."
      );
      setShowQuickReplies(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bootWelcome();
  }, [bootWelcome]);

  async function sendMessage(text: string) {
    const msg = text.trim();
    if (!msg) return;

    addMessage("user", msg);
    setInput("");
    setShowQuickReplies(false);

    try {
      const data = await postJSON("/api/chat", { message: msg });
      addMessage("assistant", data.reply);
      setProgress(data.progress ?? 0);
      if (typeof data.chapter === "number") setActiveChapter(data.chapter);

      const replyLower = (data.reply || "").toLowerCase();
      const shouldShow =
        replyLower.includes("what do you want help with") ||
        replyLower.includes("tap one of the buttons") ||
        replyLower.includes("choose one") ||
        replyLower.includes("i don't know");
      setShowQuickReplies(shouldShow);
    } catch (err) {
      addMessage("assistant", "Something went wrong. Please try again.");
    }
  }

  async function resetChat() {
    try {
      await postJSON("/api/reset", {});
    } catch {
      // ignore
    }
    setMessages([]);
    setProgress(0);
    setActiveChapter(1);
    setShowQuickReplies(false);
    await bootWelcome();
  }

  const pct = Math.round(progress * 100);

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand">Getting to know you</div>
          <div className="subtle">
            Answer a few questions so we can personalize your checklist
          </div>
        </div>

        <nav className="stepper" aria-label="FAFSA steps">
          {STEPS.map((s) =>
            s.num === 6 ? (
              <Link key={s.num} href="/checklist" className="step">
                <span className="step-num">{s.num}</span>
                <span className="step-label">{s.label}</span>
              </Link>
            ) : (
              <button
                key={s.num}
                id={`chapter-${s.num}`}
                className={`step${activeChapter === s.num ? " active" : ""}`}
              >
                <span className="step-num">{s.num}</span>
                <span className="step-label">{s.label}</span>
              </button>
            )
          )}
        </nav>

        <div className="sidebar-footer">
          <Link className="tiny-link" href="/dashboard">
            Developer dashboard
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        <header className="topbar">
          <div className="title-wrap">
            <div className="title">FAFSA Buddy</div>
            <div className="pill">
              <span>🔒</span>
              <span>Private session</span>
            </div>
          </div>
          <div className="progress-wrap">
            <div className="progress-label">
              <span>Progress</span>
              <span>{pct}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </header>

        <section className="chat-area">
          <div ref={chatRef} className="chat">
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.who}`}>
                {m.text}
              </div>
            ))}
          </div>

          {showQuickReplies && (
            <div className="quick-replies">
              {[
                { label: "Need help paying for college", ghost: false },
                { label: "Not sure what I qualify for", ghost: false },
                { label: "School told me to apply", ghost: false },
                { label: "I don't know", ghost: true },
              ].map(({ label, ghost }) => (
                <button
                  key={label}
                  className={`chip${ghost ? " ghost" : ""}`}
                  onClick={() => sendMessage(label)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className="composer">
            <input
              className="input"
              placeholder="Type your answer..."
              autoComplete="off"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage(input);
              }}
            />
            <button className="send" aria-label="Send" onClick={() => sendMessage(input)}>
              ➤
            </button>
            <button className="reset" type="button" onClick={resetChat}>
              Reset
            </button>
          </div>

          <div className="fineprint">
            Don&apos;t enter SSNs, account/routing numbers, passwords, or PINs.
          </div>
        </section>
      </main>
    </div>
  );
}
