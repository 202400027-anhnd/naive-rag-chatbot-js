# Naive RAG Chatbot

A simple Naive RAG chatbot built with JavaScript, Next.js, LangChain, local embeddings, and a LiteLLM-compatible API.

## Getting Started

**1. Install dependencies**

```bash
npm install
```

**2. Configure environment variables**

Create a `.env` file in the project root:

```env
LITELLM_API_KEY=your_api_key
LITELLM_BASE_URL=your_api_base_url
MODEL_NAME=your_model_name
```

**3. Add documents**

Place your PDF documents in the `documents/` directory.

**4. Run the application**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Notes

- Embeddings are generated locally using `multilingual-e5-small`.
- The LLM is accessed through a LiteLLM-compatible API.
- The retrieval index is stored in memory.
