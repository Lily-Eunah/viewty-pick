export type PackageExtractionResult = {
  detected: boolean;
  unitType: "ml" | "g" | "sheet" | "count" | "unknown";
  unitAmount: number | null;
  unitCount: number | null;
  totalAmount: number | null;
  promoType: "none" | "bundle" | "plus_one" | "set" | "unknown";
  confidence: "high" | "medium" | "low";
  evidence: string | null;
  method: "regex" | "llm" | "manual";
};

/**
 * Clean the title to avoid false positives from years, model numbers, barcodes, SPF, PA values.
 */
function cleanTitleText(title: string): string {
  return title
    .replace(/SPF\s*\d+/gi, '')
    .replace(/PA\s*\++/gi, '')
    .replace(/\b20\d{2}년?/g, '') // remove years like 2026, 2026년
    .replace(/\b\d{6,}\b/g, '')  // remove long numbers/IDs (6+ digits)
    .trim();
}

export function extractPackageFromTitle(title: string): PackageExtractionResult {
  const defaultResult: PackageExtractionResult = {
    detected: false,
    unitType: "unknown",
    unitAmount: null,
    unitCount: null,
    totalAmount: null,
    promoType: "none",
    confidence: "low",
    evidence: null,
    method: "regex",
  };

  if (!title) return defaultResult;

  const cleanTitle = cleanTitleText(title);

  // 1. Additive match: e.g. "50ml+50ml" or "50ml + 50ml"
  const addRegex = /(\d+(?:\.\d+)?)\s*(ml|g)\s*\+\s*(\d+(?:\.\d+)?)\s*(ml|g)/i;
  const addMatch = cleanTitle.match(addRegex);
  if (addMatch) {
    const amt1 = parseFloat(addMatch[1]);
    const amt2 = parseFloat(addMatch[3]);
    const type1 = addMatch[2].toLowerCase() as "ml" | "g";
    const type2 = addMatch[4].toLowerCase() as "ml" | "g";

    if (type1 === type2 && amt1 >= 1 && amt1 <= 1000 && amt2 >= 1 && amt2 <= 1000) {
      const isIdentical = amt1 === amt2;
      const total = amt1 + amt2;
      return {
        detected: true,
        unitType: type1,
        unitAmount: isIdentical ? amt1 : null,
        unitCount: 2,
        totalAmount: total,
        promoType: isIdentical ? "bundle" : "set",
        confidence: "high",
        evidence: addMatch[0],
        method: "regex",
      };
    }
  }

  // 2. Sheet + Volume combined match: e.g. "25ml, 10매입" or "10매입, 25ml"
  const sheetVolRegex1 = /(\d+(?:\.\d+)?)\s*(ml|g)\s*(?:,|\s)+(\d+)\s*(매|장|p|매입|시트)(?:\s|$|[.,/()'"])/i;
  const sheetVolMatch1 = cleanTitle.match(sheetVolRegex1);
  if (sheetVolMatch1) {
    const amt = parseFloat(sheetVolMatch1[1]);
    const count = parseInt(sheetVolMatch1[3], 10);

    if (amt >= 1 && amt <= 1000 && count >= 1 && count <= 300) {
      return {
        detected: true,
        unitType: "sheet",
        unitAmount: amt,
        unitCount: count,
        totalAmount: count, // total sheets
        promoType: "none",
        confidence: "high",
        evidence: sheetVolMatch1[0],
        method: "regex",
      };
    }
  }

  const sheetVolRegex2 = /(\d+)\s*(매|장|p|매입|시트)\s*(?:,|\s)+(\d+(?:\.\d+)?)\s*(ml|g)\b/i;
  const sheetVolMatch2 = cleanTitle.match(sheetVolRegex2);
  if (sheetVolMatch2) {
    const count = parseInt(sheetVolMatch2[1], 10);
    const amt = parseFloat(sheetVolMatch2[3]);

    if (amt >= 1 && amt <= 1000 && count >= 1 && count <= 300) {
      return {
        detected: true,
        unitType: "sheet",
        unitAmount: amt,
        unitCount: count,
        totalAmount: count, // total sheets
        promoType: "none",
        confidence: "high",
        evidence: sheetVolMatch2[0],
        method: "regex",
      };
    }
  }

  // 3. Volume/Weight + multiplier: e.g. "60ml x 2", "60ml×2"
  const multRegex = /(\d+(?:\.\d+)?)\s*(ml|g)\s*(?:,|\s)*[xX*×]\s*(\d+)\b/i;
  const multMatch = cleanTitle.match(multRegex);
  if (multMatch) {
    const amt = parseFloat(multMatch[1]);
    const type = multMatch[2].toLowerCase() as "ml" | "g";
    const count = parseInt(multMatch[3], 10);

    if (amt >= 1 && amt <= 1000 && count >= 1 && count <= 20) {
      return {
        detected: true,
        unitType: type,
        unitAmount: amt,
        unitCount: count,
        totalAmount: amt * count,
        promoType: count > 1 ? "bundle" : "none",
        confidence: "high",
        evidence: multMatch[0],
        method: "regex",
      };
    }
  }

  // 4. Volume/Weight + count suffix: e.g. "60ml, 2개", "60ml 2개입"
  const countRegex = /(\d+(?:\.\d+)?)\s*(ml|g)\s*(?:,|\s)+(\d+)\s*(개|입|개입|묶음|병|통|팩|set|세트)(?:\s|$|[.,/()'"])/i;
  const countMatch = cleanTitle.match(countRegex);
  if (countMatch) {
    const amt = parseFloat(countMatch[1]);
    const type = countMatch[2].toLowerCase() as "ml" | "g";
    const count = parseInt(countMatch[3], 10);

    if (amt >= 1 && amt <= 1000 && count >= 1 && count <= 20) {
      return {
        detected: true,
        unitType: type,
        unitAmount: amt,
        unitCount: count,
        totalAmount: amt * count,
        promoType: count > 1 ? "bundle" : "none",
        confidence: "high",
        evidence: countMatch[0],
        method: "regex",
      };
    }
  }

  // 5. Sheets / pads only: e.g. "마스크팩 10매입", "패드 70매"
  const sheetRegex = /(\d+)\s*(매|장|p|매입|시트)(?:\s|$|[.,/()'"])/i;
  const sheetMatch = cleanTitle.match(sheetRegex);
  if (sheetMatch) {
    const count = parseInt(sheetMatch[1], 10);
    if (count >= 1 && count <= 300) {
      return {
        detected: true,
        unitType: "sheet",
        unitAmount: null,
        unitCount: count,
        totalAmount: count,
        promoType: "none",
        confidence: "high",
        evidence: sheetMatch[0],
        method: "regex",
      };
    }
  }

  // 6. Single volume/weight: e.g. "60ml"
  const singleVolRegex = /\b(\d+(?:\.\d+)?)\s*(ml|g)\b/i;
  const singleVolMatch = cleanTitle.match(singleVolRegex);
  if (singleVolMatch) {
    const amt = parseFloat(singleVolMatch[1]);
    const type = singleVolMatch[2].toLowerCase() as "ml" | "g";

    if (amt >= 1 && amt <= 1000) {
      return {
        detected: true,
        unitType: type,
        unitAmount: amt,
        unitCount: 1,
        totalAmount: amt,
        promoType: "none",
        confidence: "high",
        evidence: singleVolMatch[0],
        method: "regex",
      };
    }
  }

  return defaultResult;
}
