import { Listing, PromoType } from '../../lib/types';

export interface PriceOffer {
  regularPrice: number | null;
  salePrice: number | null;
  inStock: boolean;
  promoType: PromoType;
  promoText: string | null;
  sourceText: string | null;
  storeName?: string | null;
  parsedVolumeRaw?: number | null; // ml parsed from product title/page (for volume mismatch check)
  shippingNote?: string | null;    // display label only: '무료배송', '로켓배송', '3,000원', etc.
}

export interface RetailerAdapter {
  code: string;
  fetchOffer(listing: Listing): Promise<PriceOffer>;
}

export { CoupangAdapter } from './coupang';
export { NaverAdapter } from './naver';
export { OliveYoungAdapter } from './oliveyoung';
