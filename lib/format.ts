import { UIProduct } from './types';

/**
 * "비교" label source: names of sellers that contributed an actual price.
 * Link-only / no-price sellers (e.g. a Naver link-only row) are excluded so the
 * "○○ · ○○ 비교" tagline only names platforms a real price came from. Returns ''
 * when no priced seller exists — callers hide the label in that case.
 */
export function pricedStoreNames(product: UIProduct, max = 3): string {
  return product.stores
    .filter((s) => s.hasPrice)
    .map((s) => s.name)
    .slice(0, max)
    .join(' · ');
}

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
 * Formats unit price per the product's volume unit (ml/g/매).
 * Example: perUnit(198) -> 'ml당 198원'; perUnit(77, '매') -> '매당 77원'.
 * Unknown/blank unit falls back to 'ml' so existing callers are unchanged.
 */
export function perUnit(unitPrice: number | null | undefined, unit?: string | null): string {
  if (unitPrice === null || unitPrice === undefined || isNaN(unitPrice)) return '';
  const u = unit && unit.trim() ? unit.trim() : 'ml';
  return `${u}당 ${Math.round(unitPrice).toLocaleString('ko-KR')}원`;
}

/** @deprecated use perUnit(unitPrice, unit). Kept as an ml-only alias. */
export function perMl(unitPrice: number | null | undefined): string {
  return perUnit(unitPrice, 'ml');
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
