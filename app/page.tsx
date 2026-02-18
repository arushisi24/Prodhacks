"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Message {
  who: "user" | "assistant";
  text: string;
}

async function postJSON(url: string, body: object) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.reply || `HTTP ${res.status}`);
  return data;
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    } catch {
      addMessage(
        "assistant",
        "Hey! I'm here to help you get your financial aid stuff sorted. What school are you looking at?"
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bootWelcome();
  }, [bootWelcome]);

  async function sendMessage(text: string) {
    const msg = text.trim();
    if (!msg || loading) return;

    addMessage("user", msg);
    setInput("");
    setLoading(true);

    try {
      const data = await postJSON("/api/chat", { message: msg });
      addMessage("assistant", data.reply);
      setProgress(data.progress ?? 0);

      if (data.done) {
        // Let them see the final message then redirect to checklist
        setTimeout(() => router.push("/checklist"), 2200);
      }
    } catch (err) {
      addMessage(
        "assistant",
        err instanceof Error ? err.message : "Something went wrong. Try again."
      );
    } finally {
      setLoading(false);
      inputRef.current?.focus();
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
    await bootWelcome();
  }

  const pct = Math.round(progress * 100);

  return (
    <div
      style={{
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
      }}
    >
      {/* Top bar — fixed, never scrolls */}
      <header
        className="topbar"
        style={{
          flexShrink: 0,
          borderRadius: 0,
          margin: 0,
          border: "none",
          borderBottom: "1px solid var(--border)",
          padding: "14px 24px",
        }}
      >
        <div className="title-wrap">
          <div className="title">FAFSA Buddy</div>
          <div className="pill">
            <span>🔒</span>
            <span>Private session</span>
          </div>
        </div>
        <div className="progress-wrap">
          <div className="progress-label">
            <span>Getting your info</span>
            <span>{pct}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </header>

      {/* Chat area — fills remaining height, only this scrolls */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          maxWidth: 760,
          width: "100%",
          margin: "0 auto",
          padding: "20px 16px 0",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        <div
          ref={chatRef}
          className="chat"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            paddingBottom: 16,
          }}
        >
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.who}`}>
              {m.text}
            </div>
          ))}
          {loading && (
            <div
              className="bubble assistant"
              style={{ color: "var(--muted)", fontStyle: "italic" }}
            >
              Typing...
            </div>
          )}
        </div>

        <div className="composer" style={{ padding: "10px 0 4px", flexShrink: 0 }}>
          <input
            ref={inputRef}
            className="input"
            placeholder="Type here..."
            autoComplete="off"
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) sendMessage(input);
            }}
          />
          <button
            className="send"
            aria-label="Send"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => sendMessage(input)}
            disabled={loading}
          >
            ➤
          </button>
          <button className="reset" type="button" onClick={resetChat}>
            Reset
          </button>
        </div>

        <div className="fineprint" style={{ flexShrink: 0 }}>
          Don&apos;t enter SSNs, account/routing numbers, passwords, or PINs.
        </div>
      </div>
    </div>
  );
}
