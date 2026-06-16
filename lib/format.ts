/**
 * Formats a number to Korean Won currency format.
 * Example: 9900 -> '9,900원'
 */
export function won(price: number | null | undefined): string {
  if (price === null || price === undefined || price <= 0 || isNaN(price)) {
    return '가격 확인 중';
  }
  return `${price.toLocaleString('ko-KR')}원`;
}

/**
 * Formats unit price (per ml).
 * Example: (9900, 50) -> 'ml당 198원'
 */
export function perMl(unitPrice: number | null | undefined): string {
  if (unitPrice === null || unitPrice === undefined || isNaN(unitPrice)) return '';
  return `ml당 ${Math.round(unitPrice).toLocaleString('ko-KR')}원`;
}

/**
 * Last-updated label in KST for the price freshness note.
 * Example: '2026-06-17T05:49:59Z' -> '2026.06.17 14:49 KST'
 */
export function updatedAt(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const k = new Date(d.getTime() + 9 * 3600 * 1000); // shift to KST, read as UTC parts
  const p = (n: number) => String(n).padStart(2, '0');
  return `${k.getUTCFullYear()}.${p(k.getUTCMonth() + 1)}.${p(k.getUTCDate())} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())} KST`;
}
