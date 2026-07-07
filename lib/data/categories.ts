import { Category } from '../types';

// 2-tier seed (mirrors migration 0012). Majors first, then minors with parent_id.
export const categories: Category[] = [
  // 대분류 (major)
  { id: 1, slug: 'suncare', name: '선케어', sort_order: 1, level: 'major', parent_id: null },
  { id: 2, slug: 'skincare', name: '스킨케어', sort_order: 2, level: 'major', parent_id: null },
  { id: 3, slug: 'cleansing-care', name: '클렌징', sort_order: 3, level: 'major', parent_id: null },
  { id: 4, slug: 'maskpack', name: '마스크팩', sort_order: 4, level: 'major', parent_id: null },
  { id: 5, slug: 'bodycare', name: '바디케어', sort_order: 5, level: 'major', parent_id: null },
  { id: 6, slug: 'base-makeup', name: '베이스 메이크업', sort_order: 6, level: 'major', parent_id: null },
  { id: 23, slug: 'haircare', name: '헤어케어', sort_order: 0, level: 'major', parent_id: null },
  { id: 24, slug: 'Feminine Hygiene', name: '위생용품', sort_order: 0, level: 'major', parent_id: null },

  // 소분류 (minor) — existing slugs (sunscreen/toner/serum/cream/cleansing/cushion) kept
  { id: 7, slug: 'sunscreen', name: '선크림', sort_order: 1, level: 'minor', parent_id: 1 },
  { id: 8, slug: 'sunstick', name: '선스틱', sort_order: 2, level: 'minor', parent_id: 1 },
  { id: 9, slug: 'suncushion', name: '선쿠션', sort_order: 3, level: 'minor', parent_id: 1 },

  { id: 10, slug: 'toner', name: '스킨/토너', sort_order: 1, level: 'minor', parent_id: 2 },
  { id: 11, slug: 'lotion', name: '로션', sort_order: 2, level: 'minor', parent_id: 2 },
  { id: 12, slug: 'serum', name: '에센스/세럼/앰플', sort_order: 3, level: 'minor', parent_id: 2 },
  { id: 13, slug: 'allinone', name: '올인원', sort_order: 4, level: 'minor', parent_id: 2 },
  { id: 14, slug: 'cream', name: '크림', sort_order: 5, level: 'minor', parent_id: 2 },
  { id: 28, slug: 'device', name: '디바이스', sort_order: 6, level: 'minor', parent_id: 2 },

  { id: 15, slug: 'cleansing', name: '클렌징폼/젤', sort_order: 1, level: 'minor', parent_id: 3 },
  { id: 16, slug: 'cleansing-oil', name: '오일/밤', sort_order: 2, level: 'minor', parent_id: 3 },
  { id: 17, slug: 'cleansing-water', name: '워터/밀크', sort_order: 3, level: 'minor', parent_id: 3 },
  { id: 34, slug: 'lip&eye makeup remover', name: '립&아이 리무버', sort_order: 4, level: 'minor', parent_id: 3 },

  { id: 18, slug: 'sheet-mask', name: '시트팩', sort_order: 1, level: 'minor', parent_id: 4 },
  { id: 19, slug: 'pad', name: '패드', sort_order: 2, level: 'minor', parent_id: 4 },

  { id: 20, slug: 'shower', name: '샤워/입욕', sort_order: 1, level: 'minor', parent_id: 5 },
  { id: 21, slug: 'body-lotion', name: '바디로션/크림', sort_order: 2, level: 'minor', parent_id: 5 },
  { id: 32, slug: 'shaving', name: '쉐이빙폼/젤/크림', sort_order: 3, level: 'minor', parent_id: 5 },
  { id: 33, slug: 'tanning/after-sun', name: '태닝/애프터선', sort_order: 3, level: 'minor', parent_id: 5 },

  { id: 22, slug: 'cushion', name: '쿠션', sort_order: 1, level: 'minor', parent_id: 6 },
  { id: 29, slug: 'foundation', name: '파운데이션', sort_order: 2, level: 'minor', parent_id: 6 },
  { id: 30, slug: 'BB/CC', name: 'BB/CC', sort_order: 3, level: 'minor', parent_id: 6 },
  { id: 31, slug: 'Concealer', name: '컨실러', sort_order: 4, level: 'minor', parent_id: 6 },

  { id: 25, slug: 'shampoo/scaler', name: '샴푸/스케일러', sort_order: 1, level: 'minor', parent_id: 23 },
  { id: 26, slug: 'scalp tonic', name: '두피에센스', sort_order: 2, level: 'minor', parent_id: 23 },

  { id: 27, slug: 'Intimate Care', name: 'Y존케어', sort_order: 1, level: 'minor', parent_id: 24 },
];
