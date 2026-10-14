import "dotenv/config";
import { readdir, readFile, stat } from "node:fs/promises";
import { PDFParse } from "pdf-parse";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "@huggingface/transformers";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const documentsDir = path.resolve(currentDir, "../../../documents");

const CHUNK_SIZE = 700;
const CHUNK_OVERLAP = 120;

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
});

let embedderPromise;
let indexPromise;
let lastIndexSignature = "";

async function readDocument(filename) {
  const filePath = path.join(documentsDir, filename);

  if (filename.toLowerCase().endsWith(".txt")) {
    return readFile(filePath, "utf8");
  }

  if (filename.toLowerCase().endsWith(".pdf")) {
    const data = await readFile(filePath);
    const parser = new PDFParse({ data });

    try {
      const result = await parser.getText();
      const text = result.text.trim();

      if (!text) {
        throw new Error(
          `Không trích xuất được văn bản từ ${filename}. PDF có thể là file scan.`
        );
      }

      return text;
    } finally {
      await parser.destroy();
    }
  }

  throw new Error(`Định dạng tài liệu không được hỗ trợ: ${filename}`);
}

function getEmbedder() {
  if (!embedderPromise) {
    embedderPromise = pipeline(
      "feature-extraction",
      "Xenova/multilingual-e5-small"
    ).catch((error) => {
      embedderPromise = undefined;
      throw error;
    });
  }

  return embedderPromise;
}

export async function embed(input, prefix) {
  const embedder = await getEmbedder();

  const output = await embedder(`${prefix}: ${input}`, {
    pooling: "mean",
    normalize: true,
  });

  return Array.from(output.data);
}

async function buildIndex(filenames) {
  const documents = [];

  for (const filename of filenames) {
    const text = await readDocument(filename);

    if (!text.trim()) continue;

    const chunks = await splitter.createDocuments([text]);

    for (const chunk of chunks) {
      documents.push({
        id: documents.length + 1,
        document: filename,
        content: chunk.pageContent,
      });
    }
  }

  if (documents.length === 0) {
    throw new Error("Các tài liệu không có nội dung.");
  }

  return Promise.all(
    documents.map(async (doc) => ({
      ...doc,
      vector: await embed(doc.content, "passage"),
    }))
  );
}

export async function getIndex() {
  const filenames = (await readdir(documentsDir))
    .filter((name) => /\.(txt|pdf)$/i.test(name))
    .sort();

  if (filenames.length === 0) {
    throw new Error("Không tìm thấy file TXT hoặc PDF trong documents.");
  }

  const fileInfo = await Promise.all(
    filenames.map(async (filename) => {
      const filePath = path.join(documentsDir, filename);
      const { size, mtimeMs } = await stat(filePath);

      return `${filename}:${size}:${mtimeMs}`;
    })
  );

  const signature = [
    `chunkSize:${CHUNK_SIZE}`,
    `chunkOverlap:${CHUNK_OVERLAP}`,
    ...fileInfo,
  ].join("|");

  if (!indexPromise || signature !== lastIndexSignature) {
    lastIndexSignature = signature;

    indexPromise = buildIndex(filenames).catch((error) => {
      indexPromise = undefined;
      lastIndexSignature = "";
      throw error;
    });
  }

  return indexPromise;
}
