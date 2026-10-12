import { embed, getIndex } from "./indexing.mjs";

const TOP_K = 5;

function cosineSimilarity(a, b) {
  let dot = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }

  return dot;
}

export async function retrieve(question, topK = TOP_K) {
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
