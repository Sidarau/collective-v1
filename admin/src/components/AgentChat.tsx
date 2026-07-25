"use client";

import { useState, useRef, useEffect } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  created_at: string;
}

interface Props {
  agentName: string;
  agentLabel: string;
  agentScope: string;
  initialMessages: ChatMessage[];
}

export default function AgentChat({ agentName, agentLabel, agentScope, initialMessages }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);

    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);

    try {
      const res = await fetch(`/api/agent-chat/${agentName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      setMessages((m) => [
        ...m.filter((x) => x.id !== optimistic.id),
        data.user_message,
        data.agent_message,
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m.filter((x) => x.id !== optimistic.id),
        {
          id: `err-${Date.now()}`,
          role: "system",
          content: `Could not send: ${e instanceof Error ? e.message : "unknown error"}`,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Header */}
      <div className="border-b border-neutral-200 pb-4 mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">{agentLabel}</h1>
        <p className="text-sm text-neutral-500 mt-1">
          {agentScope} scope · Distinct identity · Shared Collective workspace
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.length === 0 && (
          <div className="text-center text-neutral-400 mt-12 text-sm">
            No messages yet. Say hello to {agentLabel}.
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === "user"
                ? "ml-auto bg-neutral-900 text-white"
                : m.role === "system"
                  ? "mx-auto bg-red-50 text-red-700 text-center text-xs"
                  : "mr-auto bg-neutral-100 text-neutral-900"
            }`}
          >
            {m.content}
            <div
              className={`text-[10px] mt-1 ${
                m.role === "user" ? "text-neutral-400" : "text-neutral-400"
              }`}
            >
              {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-neutral-200 pt-4 mt-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message ${agentLabel}…`}
            className="flex-1 rounded-xl border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="rounded-xl bg-neutral-900 text-white px-5 py-3 text-sm font-medium hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? "…" : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
