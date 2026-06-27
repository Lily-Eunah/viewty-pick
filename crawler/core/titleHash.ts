import * as crypto from 'crypto';

/**
 * title_parse_cache의 키. 원문 제목 기준(과정규화 금지 — 마케팅 접두 등 미세 차이가 다른
 * 구성을 의미할 수 있어, 공백 trim만 한 뒤 sha256). 동일 제목이면 동일 해시 → 0콜 재사용.
 */
export function hashTitleForCache(title: string): string {
  return crypto.createHash('sha256').update((title || '').trim()).digest('hex');
}
