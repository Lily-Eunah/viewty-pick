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
  // true when the title combines two DIFFERENT main products (e.g. 토너 100ml + 세럼
  // 30ml, both 본품) — a per-unit price is not computable → caller excludes + flags.
  heterogeneous?: boolean;
};

// "N종" (2종/3종/4종) classification — shared by packageExtractor (heterogeneous
// gate) and naver.ts (classifyOfferComposition / Discord verify). A BARE "N종" is
// almost always an "N종 중 택1" OPTION-SELECT page (단품 구매), NOT a physical set,
// so it must NOT be treated as a heterogeneous set — it is priced as a single. It
// is a set ONLY when a set-context word sits adjacent to it (N종 세트/구성/기획/패키지/
// 콜렉션/컬렉션, or 세트/기획/선물/패키지 N종).
export const N_JONG_RE = /\d+\s*종/;
export const N_JONG_SET_RE =
  /\d+\s*종\s*(?:세트|구성|기획|패키지|콜렉션|컬렉션|기프트|선물)|(?:세트|기획|선물|패키지|콜렉션|컬렉션)\s*\d+\s*종/;

// Explicit physical-SET compounds (fix/set-classification-evidence-based): a 세트/
// 패키지/콜렉션/기프트 genuinely bundles multiple DIFFERENT items, so it is the only
// KEYWORD evidence (besides ≥2 distinct non-multiple volumes / a device) that makes a
// title heterogeneous. AMBIGUOUS marketing words (기획/선물/단독/구성/"N종") are NOT
// here — a "100ml 기획 3종" / "선물 2종" with no real multi-item evidence is a single
// (대개 'N종 중 택1' 옵션선택), not a set. (N_JONG_SET_RE stays only for isBareNJong.)
export const SET_COMPOUND_RE = /세트|패키지|콜렉션|컬렉션|기프트/;

/** True when a title carries a BARE "N종" (option-select), i.e. N종 with no set-context word. */
export function isBareNJong(title: string): boolean {
  return N_JONG_RE.test(title || '') && !N_JONG_SET_RE.test(title || '');
}

/**
 * Homogeneous multipack guard (fix/set-classification-evidence-based §B): distinct
 * volumes that are integer MULTIPLES of the smallest unit AND accompanied by a
 * count/×N signal (N개·N팩·×N·더블) are the SAME product in a larger pack — NOT a
 * heterogeneous set — so they are priced per the smallest unit. Returns null when
 * the sizes are not multiple-related or no count signal is present (→ the caller
 * keeps the heterogeneous-set treatment for genuinely different products).
 *   e.g. [30, 60] + "2개"/"×2" → { unit: 30, count: 2 };  [30, 50] → null (비배수).
 */
function homogeneousMultipackUnit(amts: number[], title: string): { unit: number; count: number } | null {
  const distinct = [...new Set(amts)].sort((a, b) => a - b);
  if (distinct.length < 2) return null;
  const unit = distinct[0];
  if (unit < 1) return null;
  if (!distinct.every((v) => Number.isInteger(v / unit))) return null; // all multiples of the smallest
  if (!/(\d+)\s*(?:개|팩|병|입|매)|[xX×*]\s*\d+|더블/.test(title)) return null; // need a count/배수 signal
  const count = Math.round(distinct[distinct.length - 1] / unit);
  if (count < 2 || count > 20) return null;
  return { unit, count };
}

/**
 * Strip free-gift / sample / promo-only clauses so they are NOT counted as the
 * main product's quantity or volume. A "(+에피셀린 세럼 7ml*2)" / "+ 토너 20ml 증정"
 * is a freebie → removed. A "본품+리필" / "(+265ml 리필팩)" is an ADDED UNIT of the
 * same product (1+1) → KEPT (counted as quantity downstream). A bare same-volume
 * additive like "50ml+50ml" is also kept.
 */
export function stripPromoGifts(title: string): string {
  return (title || '')
    // Parenthetical: a freebie unless it carries a refill/본품 (= an added unit).
    .replace(/\(([^)]*)\)/g, (m: string, inner: string) => {
      if (/리필|본품/.test(inner)) return m; // added unit (1+1) — keep for counting
      if (/\+|증정|사은품|샘플|미니|트래블|여행용|파우치|키트|쇼핑백|덤|마스크/.test(inner)) return ' ';
      return m;
    })
    // Non-paren gift tail: "+ … 증정/사은품/샘플/기프트" (gift word before next +/end).
    .replace(/\+[^+()]*?(?:증정|사은품|샘플|기프트)[^+()]*/g, ' ')
    // Named freebie after +: "+ 여행용/미니/트래블/파우치/키트 …".
    .replace(/\+\s*(?:여행용|미니|트래블|파우치|키트|쇼핑백)[^+()]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clean the title to avoid false positives from years, model numbers, barcodes, SPF, PA values.
 */
function cleanTitleText(title: string): string {
  return stripPromoGifts(title)
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
      if (!isIdentical) {
        // Differing volumes joined by "+": a homogeneous multipack ONLY when the
        // sizes are integer-multiple related AND a count/×N signal is present
        // (30ml + 60ml 2개 → 30ml ×2). Otherwise two DIFFERENT products combined
        // (heterogeneous set), per-unit not computable.
        const homo = homogeneousMultipackUnit([amt1, amt2], cleanTitle);
        if (homo) {
          return {
            detected: true, unitType: type1, unitAmount: homo.unit, unitCount: homo.count,
            totalAmount: homo.unit * homo.count, promoType: "bundle", confidence: "high",
            evidence: `${addMatch[0]} (homogeneous ×${homo.count})`, method: "regex", heterogeneous: false,
          };
        }
        return {
          detected: true, unitType: type1, unitAmount: null, unitCount: 2, totalAmount: amt1 + amt2,
          promoType: "set", confidence: "high", evidence: addMatch[0], method: "regex", heterogeneous: true,
        };
      }
      return {
        detected: true,
        unitType: type1,
        unitAmount: amt1,
        unitCount: 2,
        totalAmount: amt1 + amt2,
        promoType: "bundle", // identical volumes → a 1+1 homogeneous bundle
        confidence: "high",
        evidence: addMatch[0],
        method: "regex",
        heterogeneous: false,
      };
    }
  }

  // 1b. Refill / 본품+리필 (1+1 of the same product): one main unit + one refill.
  //     e.g. "라하 토너 265ml 기획 (+265ml 리필팩)" / "…본품+리필" → 2 × the main volume.
  if (/리필|본품\s*\+/.test(cleanTitle)) {
    const volM = cleanTitle.match(/(\d+(?:\.\d+)?)\s*(ml|g)\b/i);
    if (volM) {
      const amt = parseFloat(volM[1]);
      const type = volM[2].toLowerCase() as "ml" | "g";
      if (amt >= 1 && amt <= 1000) {
        return {
          detected: true, unitType: type, unitAmount: amt, unitCount: 2, totalAmount: amt * 2,
          promoType: "bundle", confidence: "high", evidence: '리필(1+1)', method: "regex",
        };
      }
    }
  }

  // 1c. N+N count promo with no unit on the operands: "1+1", "2+1" → x+y units.
  const plusRegex = /(?:^|[^0-9])([1-9])\s*\+\s*([1-9])(?![0-9])/;
  const plusMatch = cleanTitle.match(plusRegex);
  if (plusMatch) {
    const x = parseInt(plusMatch[1], 10);
    const y = parseInt(plusMatch[2], 10);
    const count = x + y;
    const volM = cleanTitle.match(/(\d+(?:\.\d+)?)\s*(ml|g)\b/i);
    const amt = volM ? parseFloat(volM[1]) : null;
    const type = (volM ? volM[2].toLowerCase() : 'count') as "ml" | "g" | "count";
    if (count >= 2 && count <= 20) {
      return {
        detected: true,
        unitType: amt !== null ? (type as "ml" | "g") : "count",
        unitAmount: amt,
        unitCount: count,
        totalAmount: amt !== null ? amt * count : count,
        promoType: "plus_one", confidence: "high", evidence: plusMatch[0].trim(), method: "regex",
      };
    }
  }

  // 1d. "더블기획/더블팩/더블구성" = homogeneous ×2 of the same product. Excludes the
  //     ambiguous "(더블/대용량)" (often just a larger single, not a 2-pack).
  if (/더블\s*(?:기획|팩|구성)/.test(cleanTitle) && !/대용량/.test(cleanTitle)) {
    const volM = cleanTitle.match(/(\d+(?:\.\d+)?)\s*(ml|g)\b/i);
    if (volM) {
      const amt = parseFloat(volM[1]);
      const type = volM[2].toLowerCase() as "ml" | "g";
      if (amt >= 1 && amt <= 1000) {
        return {
          detected: true, unitType: type, unitAmount: amt, unitCount: 2, totalAmount: amt * 2,
          promoType: "bundle", confidence: "high", evidence: '더블(×2)', method: "regex",
        };
      }
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

  // 5b. Heterogeneous set: combines two DIFFERENT products → per-unit not computable
  //     → flag so the caller excludes + flags for inspection. EVIDENCE-BASED signals
  //     (fix/set-classification-evidence-based — no longer ambiguous 기획/선물/N종):
  //       - ≥2 DISTINCT, NON-multiple main volumes (gift-stripped): 토너100ml + 세럼30ml.
  //         (배수 용량 + 개수 신호 = 동종 멀티팩 → handled just above, NOT heterogeneous.)
  //       - an explicit SET compound (세트/패키지/콜렉션/기프트 — SET_COMPOUND_RE). A
  //         bare "N종" / "기획 N종" carries NO such word → NOT heterogeneous (option-select).
  //       - a device/기기 bundle (세럼 + 슈링크 홈 디바이스).
  const volTokens = [...cleanTitle.matchAll(/(\d+(?:\.\d+)?)\s*(ml|g)\b/gi)];
  const allVols = volTokens.map((m) => parseFloat(m[1]));
  const sameUnit = new Set(volTokens.map((m) => m[2].toLowerCase())).size <= 1;
  // §B: homogeneous multipack (배수 용량 + 개수 신호) is the SAME product → per-unit price.
  if (sameUnit && volTokens.length >= 2) {
    const homo = homogeneousMultipackUnit(allVols, cleanTitle);
    if (homo) {
      const type = volTokens[0][2].toLowerCase() as "ml" | "g";
      return {
        detected: true, unitType: type, unitAmount: homo.unit, unitCount: homo.count,
        totalAmount: homo.unit * homo.count, promoType: "bundle", confidence: "high",
        evidence: `homogeneous multipack ×${homo.count}`, method: "regex", heterogeneous: false,
      };
    }
  }
  const heteroSignal = new Set(allVols).size >= 2 || SET_COMPOUND_RE.test(cleanTitle) || /디바이스|기기/.test(cleanTitle);
  if (heteroSignal) {
    return {
      detected: true, unitType: "unknown", unitAmount: null, unitCount: null, totalAmount: null,
      promoType: "set", confidence: "low", evidence: 'heterogeneous (multi-volume / set compound / device)', method: "regex",
      heterogeneous: true,
    };
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
