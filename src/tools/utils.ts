export type LegalMetadata = {
  lawNumber?: string;
  article?: string;
  clause?: string;
};

/**
 * Extracts legal references (article, clause, law/decree number) from text.
 */
export function extractLegalMetadata(
  content: string,
  fallbackDocumentName?: string
): LegalMetadata {
  let article: string | undefined;
  let clause: string | undefined;
  let lawNumber: string | undefined;

  // 1. Article / Điều: "Điều 15", "Điều 116a", "Điều 468"
  const articleMatch = content.match(/(?:^|\b|\s)Điều\s+(\d+[a-zđ]?)/i);
  if (articleMatch) {
    article = `Điều ${articleMatch[1]}`;
  }

  // 2. Clause / Khoản: "Khoản 2", "khoản 1" or paragraph starting with "1. "
  const clauseMatch =
    content.match(/(?:^|\b|\s)Khoản\s+(\d+)/i) ||
    content.match(/(?:^|\n)\s*(\d+)\.\s+[A-ZÀ-Ỹ]/);
  if (clauseMatch) {
    clause = `Khoản ${clauseMatch[1]}`;
  }

  // 3. Law Number / Số hiệu văn bản:
  // e.g. "Luật số 91/2015/QH13", "Nghị định số 100/2019/NĐ-CP", "Thông tư 01/2020/TT-BTP", "Bộ luật Dân sự 2015"
  const lawMatch = content.match(
    /(?:Luật|Bộ luật|Nghị định|Thông tư)\s+(?:số\s+)?(\d+(?:\/\d+)?\/[A-Za-zÀ-ỹĐđ0-9_-]+)/i
  );
  if (lawMatch) {
    lawNumber = lawMatch[0].trim();
  } else {
    const namedLawMatch = content.match(
      /(?:Bộ luật Dân sự|Luật Đất đai|Luật Doanh nghiệp|Luật Lao động|Luật Giao thông đường bộ)(?:\s+(?:năm\s+)?\d{4})?/i
    );
    if (namedLawMatch) {
      lawNumber = namedLawMatch[0].trim();
    } else if (fallbackDocumentName) {
      if (/dansu/i.test(fallbackDocumentName)) {
        lawNumber = "Bộ luật Dân sự";
      } else {
        lawNumber = fallbackDocumentName.replace(/\.(pdf|txt)$/i, "");
      }
    }
  }

  return { lawNumber, article, clause };
}
