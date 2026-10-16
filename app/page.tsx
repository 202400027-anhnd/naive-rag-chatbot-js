"use client";

import { useState, useEffect, type FormEvent } from "react";
import type { Evidence, TurnUsage } from "@/contracts";

type MessageItem = {
  role: "user" | "assistant";
  content: string;
  evidence?: Evidence[];
  toolsUsed?: string[];
  turnUsage?: TurnUsage;
  blockedByGuardrail?: boolean;
};

type ThreadItem = {
  id: string;
  title: string;
  updatedAt: number;
};

const STORAGE_THREADS_KEY = "chatbot_phapluat_threads";
const STORAGE_MSG_PREFIX = "chatbot_phapluat_msgs_";

function generateNewThreadId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `thread_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `thread_${Math.random().toString(36).substring(2, 10)}`;
}

export default function Home() {
  const [threadId, setThreadId] = useState<string>(() => generateNewThreadId());
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // 1. Tải danh sách các thread cũ từ localStorage khi mở trang
  useEffect(() => {
    try {
      const savedThreads = localStorage.getItem(STORAGE_THREADS_KEY);
      if (savedThreads) {
        const parsed: ThreadItem[] = JSON.parse(savedThreads);
        setThreads(parsed);
      }
    } catch {
      // Bỏ qua lỗi parsing
    }
  }, []);

  // 2. Tải tin nhắn của thread hiện tại từ cache localStorage hoặc từ Server API
  useEffect(() => {
    try {
      const cached = localStorage.getItem(`${STORAGE_MSG_PREFIX}${threadId}`);
      if (cached) {
        setMessages(JSON.parse(cached));
      } else {
        // Thử lấy từ server checkpointer nếu có
        fetch(`/api/chat?threadId=${encodeURIComponent(threadId)}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data && Array.isArray(data.messages) && data.messages.length > 0) {
              setMessages(data.messages);
            }
          })
          .catch(() => {});
      }
    } catch {
      // Bỏ qua
    }
  }, [threadId]);

  // 3. Khởi tạo cuộc trò chuyện mới (/new)
  function handleNewChat() {
    const newId = generateNewThreadId();
    setThreadId(newId);
    setMessages([]);
    setQuestion("");
  }

  // 4. Chuyển sang xem lại một thread cũ
  function handleSelectThread(selectedId: string) {
    if (selectedId === threadId) return;
    setThreadId(selectedId);
    setQuestion("");
  }

  // 5. Xóa một thread cũ
  function handleDeleteThread(e: React.MouseEvent, idToDelete: string) {
    e.stopPropagation();
    const updated = threads.filter((t) => t.id !== idToDelete);
    setThreads(updated);
    try {
      localStorage.setItem(STORAGE_THREADS_KEY, JSON.stringify(updated));
      localStorage.removeItem(`${STORAGE_MSG_PREFIX}${idToDelete}`);
    } catch {}

    // Nếu xóa đúng thread đang active thì tạo thread mới
    if (threadId === idToDelete) {
      handleNewChat();
    }
  }

  // 6. Chọn gợi ý câu hỏi mẫu
  function handleSelectPrompt(promptText: string) {
    setQuestion(promptText);
  }

  // 7. Gửi câu hỏi
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = question.trim();
    if (!text || loading) return;

    const userMessage: MessageItem = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setQuestion("");
    setLoading(true);

    // Cập nhật danh sách threads
    const existingIndex = threads.findIndex((t) => t.id === threadId);
    let updatedThreads: ThreadItem[];
    if (existingIndex >= 0) {
      updatedThreads = [...threads];
      updatedThreads[existingIndex] = {
        ...updatedThreads[existingIndex],
        updatedAt: Date.now(),
      };
      // Đưa thread này lên đầu danh sách
      const current = updatedThreads.splice(existingIndex, 1)[0];
      updatedThreads.unshift(current);
    } else {
      const newTitle = text.length > 38 ? `${text.slice(0, 38)}...` : text;
      updatedThreads = [
        { id: threadId, title: newTitle, updatedAt: Date.now() },
        ...threads,
      ];
    }
    setThreads(updatedThreads);
    try {
      localStorage.setItem(STORAGE_THREADS_KEY, JSON.stringify(updatedThreads));
      localStorage.setItem(
        `${STORAGE_MSG_PREFIX}${threadId}`,
        JSON.stringify(newMessages)
      );
    } catch {}

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          threadId,
          userId: "default_user",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Đã xảy ra lỗi khi xử lý câu hỏi.");
      }

      const assistantMessage: MessageItem = {
        role: "assistant",
        content: data.answer,
        evidence: data.evidence,
        toolsUsed: data.toolsUsed,
        turnUsage: data.turnUsage,
        blockedByGuardrail: data.blockedByGuardrail,
      };

      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);

      try {
        localStorage.setItem(
          `${STORAGE_MSG_PREFIX}${threadId}`,
          JSON.stringify(finalMessages)
        );
      } catch {}
    } catch (error: any) {
      const errorMessage: MessageItem = {
        role: "assistant",
        content: `Lỗi: ${error?.message || "Không thể kết nối đến máy chủ."}`,
      };
      setMessages([...newMessages, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="layout-container">
      {/* SIDEBAR LỊCH SỬ TRÒ CHUYỆN */}
      <aside className={`sidebar ${sidebarOpen ? "open" : "collapsed"}`}>
        <div className="sidebar-header">
          <button
            type="button"
            className="sidebar-new-btn"
            onClick={handleNewChat}
          >
            <span>+</span> Cuộc trò chuyện mới
          </button>
        </div>

        <div className="sidebar-section-title">Lịch sử trò chuyện</div>

        <div className="threads-list">
          {threads.length === 0 ? (
            <div className="empty-threads">
              Chưa có phiên cũ. Bắt đầu hỏi để lưu lịch sử!
            </div>
          ) : (
            threads.map((t) => (
              <div
                key={t.id}
                className={`thread-item ${t.id === threadId ? "active" : ""}`}
                onClick={() => handleSelectThread(t.id)}
                title={t.title}
              >
                <div className="thread-icon">💬</div>
                <div className="thread-title">{t.title}</div>
                <button
                  type="button"
                  className="thread-delete-btn"
                  onClick={(e) => handleDeleteThread(e, t.id)}
                  title="Xóa cuộc trò chuyện này"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        <div className="sidebar-footer">
          <div className="storage-info">
            💾 Đã lưu cục bộ & RAM Server
          </div>
        </div>
      </aside>

      {/* KHUNG NỘI DUNG CHÍNH */}
      <main className="main-content">
        <header className="header">
          <div className="header-left">
            <button
              type="button"
              className="sidebar-toggle-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title="Đóng / mở thanh lịch sử"
            >
              ☰
            </button>
            <div className="header-info">
              <h1>Chatbot Pháp Luật Việt Nam</h1>
              <p>ReAct Agent tra cứu quy phạm pháp luật & kiểm chứng nguồn</p>
            </div>
          </div>
          <div className="header-actions">
            <span className="session-tag" title="Mã phiên hội thoại (Thread ID)">
              Phiên: <code>{threadId}</code>
            </span>
            <button
              type="button"
              className="new-chat-btn"
              onClick={handleNewChat}
              title="Tạo phiên mới (/new) — sở thích cá nhân vẫn được giữ lại"
            >
              + Phiên mới
            </button>
          </div>
        </header>

        <section className="chat">
          {messages.length === 0 && (
            <div className="welcome">
              <h2>Xin chào! Bạn cần tra cứu vấn đề pháp lý nào?</h2>
              <p>
                Hệ thống tự động điều phối giữa <strong>Kho tài liệu nội bộ (RAG)</strong> và <strong>Cổng thông tin chính phủ (Web)</strong>, đảm bảo trích dẫn điều khoản có căn cứ thực tế.
              </p>
              <div className="suggestions">
                <span className="suggestions-label">Gợi ý thử nghiệm:</span>
                <button
                  type="button"
                  className="suggestion-chip"
                  onClick={() =>
                    handleSelectPrompt(
                      "Quy định về thời hiệu khởi kiện yêu cầu bồi thường thiệt hại nằm ở điều nào?"
                    )
                  }
                >
                  🔍 Tra cứu nội bộ: Thời hiệu bồi thường thiệt hại
                </button>
                <button
                  type="button"
                  className="suggestion-chip"
                  onClick={() =>
                    handleSelectPrompt(
                      "Tìm Nghị định mới nhất về xử phạt vi phạm giao thông và cho link chính thức"
                    )
                  }
                >
                  🌐 Tra cứu Web: Nghị định vi phạm giao thông
                </button>
                <button
                  type="button"
                  className="suggestion-chip"
                  onClick={() =>
                    handleSelectPrompt(
                      "Tôi thích bạn trả lời ngắn gọn và nêu căn cứ điều luật trước, hãy ghi nhớ sở thích này"
                    )
                  }
                >
                  🧠 Bộ nhớ: Ghi nhớ sở thích trả lời ngắn gọn
                </button>
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <article
              className={`message ${message.role} ${
                message.blockedByGuardrail ? "blocked" : ""
              }`}
              key={index}
            >
              <div className="role-row">
                <span className="role-title">
                  {message.role === "user" ? "Bạn" : "Trợ lý Pháp luật"}
                </span>

                {message.toolsUsed && message.toolsUsed.length > 0 && (
                  <div className="tool-badges">
                    {message.toolsUsed.map((toolName, tIdx) => (
                      <span className="tool-badge" key={tIdx}>
                        {toolName === "search_legal_rag" && "🔍 Kho nội bộ"}
                        {toolName === "search_legal_web" && "🌐 Cổng Chính phủ"}
                        {toolName === "remember_preference" && "🧠 Đã nhớ sở thích"}
                        {toolName === "recall_preference" && "📖 Đã đọc sở thích"}
                        {!["search_legal_rag", "search_legal_web", "remember_preference", "recall_preference"].includes(toolName) && toolName}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="content">{message.content}</div>

              {message.evidence && message.evidence.length > 0 && (
                <details className="sources-accordion">
                  <summary>
                    Căn cứ pháp lý & Nguồn trích dẫn ({message.evidence.length})
                  </summary>

                  <div className="evidence-list">
                    {message.evidence.map((ev, sIdx) => (
                      <div className="evidence-card" key={`${ev.id}-${sIdx}`}>
                        <div className="evidence-header">
                          <span className={`origin-tag ${ev.origin}`}>
                            {ev.origin === "rag" ? "Kho nội bộ (RAG)" : "Web chính phủ"}
                          </span>
                          {ev.verification === "source_checked" ? (
                            <span className="verification-tag verified">
                              ✓ Đã kiểm chứng nguồn
                            </span>
                          ) : (
                            <span className="verification-tag unverified">
                              Chưa kiểm chứng
                            </span>
                          )}
                        </div>

                        <div className="evidence-title">
                          <strong>{ev.title}</strong>
                          {ev.lawNumber && <span className="law-badge">{ev.lawNumber}</span>}
                          {ev.article && <span className="article-badge">{ev.article}</span>}
                          {ev.clause && <span className="clause-badge">{ev.clause}</span>}
                        </div>

                        {ev.origin === "web" && ev.url && (
                          <div className="evidence-url">
                            <a
                              href={ev.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="official-link"
                            >
                              {ev.url} ↗
                            </a>
                          </div>
                        )}

                        <p className="evidence-snippet">{ev.snippet}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {message.turnUsage && (
                <div className="turn-usage">
                  <span>⚡ Lượt này: <strong>{message.turnUsage.totalTokens}</strong> tokens</span>
                  <span className="usage-breakdown">
                    (in: {message.turnUsage.inputTokens}, out: {message.turnUsage.outputTokens})
                  </span>
                </div>
              )}
            </article>
          ))}

          {loading && (
            <div className="loading">
              <span className="loading-spinner"></span>
              Đang suy luận, tra cứu căn cứ pháp lý và tổng hợp câu trả lời...
            </div>
          )}
        </section>

        <form className="composer" onSubmit={handleSubmit}>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Nhập câu hỏi pháp lý của bạn... (Enter để gửi, Shift+Enter xuống dòng)"
            rows={2}
            maxLength={4000}
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}
          />
          <button
            type="submit"
            className="submit-btn"
            disabled={loading || !question.trim()}
          >
            {loading ? "Đang xử lý..." : "Gửi câu hỏi"}
          </button>
        </form>

        <footer className="footer">
          Hệ thống ReAct Agent hỗ trợ quản lý đa phiên hội thoại. Lịch sử được lưu trữ tại thiết bị và đồng bộ phiên với RAM máy chủ.
        </footer>
      </main>
    </div>
  );
}
