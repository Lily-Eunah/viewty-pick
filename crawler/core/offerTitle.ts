/**
 * offer.sourceText(어댑터가 붙인 접두/꼬리 포함)에서 순수 판매처 제목만 추출.
 * 예: "Naver API match: <title> (12345678)" → "<title>", 쿠팡 productName은 그대로.
 * parsePackage/캐시 키가 깨끗한 제목을 쓰도록 run.ts에서 사용.
 */
export function rawOfferTitle(sourceText: string | null | undefined): string {
  if (!sourceText) return '';
  let s = sourceText.trim();
  s = s
    .replace(/^Naver-sourced OliveYoung offer:\s*/i, '')
    .replace(/^Naver API match:\s*/i, '')
    .replace(/^Naver official-store (?:fallback|match)[^:]*:\s*/i, '')
    .replace(/^Naver catalog lprice fallback[^:]*:\s*/i, '')
    .replace(/^Naver page crawl:\s*/i, '')
    .replace(/^\[manual_override price\]\s*/i, '');
  s = s.replace(/\s+—\s+.*$/, '').replace(/\s*\(\d{3,}\)\s*$/, '').trim();
  return s;
}
