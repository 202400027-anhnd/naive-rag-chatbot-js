import { embed, getIndex } from "./indexing";
import type { RetrievalResult } from "./types";

const TOP_K = 5;

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }

  return dot;
}

export async function retrieve(
  question: string,
  topK: number = TOP_K
): Promise<RetrievalResult[]> {
  const documents = await getIndex();
  const queryVector = await embed(question, "query");

  return documents
    .map((doc) => ({
      ...doc,
      score: cosineSimilarity(queryVector, doc.vector),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
