import { Listing, PromoType } from '../../lib/types';

export interface PriceOffer {
  regularPrice: number | null;
  salePrice: number | null;
  inStock: boolean;
  promoType: PromoType;
  promoText: string | null;
  sourceText: string | null;
  storeName?: string | null; // useful for Naver allowlist checking
}

export interface RetailerAdapter {
  code: string;
  fetchOffer(listing: Listing): Promise<PriceOffer>;
}

export { CoupangAdapter } from './coupang';
export { NaverAdapter } from './naver';
export { OliveYoungAdapter } from './oliveyoung';
