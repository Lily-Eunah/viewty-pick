/**
 * Formats a number to Korean Won currency format.
 * Example: 9900 -> '9,900원'
 */
export function won(price: number | null | undefined): string {
  if (price === null || price === undefined || isNaN(price)) return '-원';
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
 * Formats price drop amount.
 * Example: 2100 -> '어제보다 2,100원 저렴' or '▼ 2,100원'
 */
export function priceDrop(amount: number | null | undefined, simple = false): string {
  if (amount === null || amount === undefined || amount <= 0 || isNaN(amount)) return '';
  if (simple) {
    return `▼ ${amount.toLocaleString('ko-KR')}원`;
  }
  return `어제보다 ${amount.toLocaleString('ko-KR')}원 저렴`;
}

/**
 * Formats price drop rate.
 * Example: 18 -> '18%'
 */
export function priceDropRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || rate <= 0 || isNaN(rate)) return '';
  return `${Math.round(rate)}%`;
}
