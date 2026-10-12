"use client";

import { useState } from "react";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    const text = question.trim();
    if (!text || loading) return;

    setMessages((old) => [
      ...old,
      { role: "user", content: text },
    ]);
    setQuestion("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Đã xảy ra lỗi.");
      }

      setMessages((old) => [
        ...old,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources,
        },
      ]);
    } catch (error) {
      setMessages((old) => [
        ...old,
        {
          role: "assistant",
          content: `Lỗi: ${error.message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app">
      <header className="header">
        <div>
          <h1>RAG Chatbot</h1>
          <p>Hỏi đáp dựa trên tài liệu của bạn</p>
        </div>
        <span className="status">Local demo</span>
      </header>

      <section className="chat">
        {messages.length === 0 && (
          <div className="welcome">
            <h2>Bạn muốn tìm hiểu điều gì?</h2>
            <p>
              Hãy hỏi về luật dân sự Việt Nam, tôi sẽ trả lời dựa trên giáo trình
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <article
            className={`message ${message.role}`}
            key={index}
          >
            <div className="role">
              {message.role === "user" ? "Bạn" : "RAG Assistant"}
            </div>
            <div className="content">{message.content}</div>

            {message.sources?.length > 0 && (
              <details className="sources">
                <summary>
                  Nguồn tham khảo ({message.sources.length})
                </summary>

                {message.sources.map((source) => (
                  <div className="source" key={source.document}>
                    <strong>{source.document}</strong>
                    <span>
                      Similarity: {source.score}
                    </span>
                    <p>{source.excerpt}</p>
                  </div>
                ))}
              </details>
            )}
          </article>
        ))}

        {loading && (
          <div className="loading">Đang tìm tài liệu và tạo câu trả lời...</div>
        )}
      </section>

      <form className="composer" onSubmit={handleSubmit}>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Nhập câu hỏi của bạn..."
          rows={2}
          maxLength={4000}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !question.trim()}>
          {loading ? "Đang xử lý..." : "Gửi câu hỏi"}
        </button>
      </form>

      <footer>
        Câu trả lời được tạo từ tài liệu đã lập chỉ mục.
      </footer>
    </main>
  );
}