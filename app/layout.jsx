import "./globals.css";

export const metadata = {
  title: "Local RAG Chatbot",
  description: "Chatbot hỏi đáp dựa trên tài liệu",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}