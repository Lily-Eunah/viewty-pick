// Mock data mirrors the simplified Google Sheet format (validate.ts schemas).
// product_key is optional (auto-generated when blank).

export const mockCategoriesSheet = [
  { slug: 'sunscreen', name: '선크림',  sort_order: '1' },
  { slug: 'toner',     name: '토너',    sort_order: '2' },
  { slug: 'cream',     name: '크림',    sort_order: '3' },
  { slug: 'serum',     name: '세럼',    sort_order: '4' },
  { slug: 'cleansing', name: '클렌징',  sort_order: '5' },
  { slug: 'cushion',   name: '쿠션',    sort_order: '6' },
];

export const mockProductsSheet = [
  { product_key: '', name: '엑설런트 선크림',                    brand: '몽디에스',           category: '선크림', volume_ml: '50', skin_types: '건성,민감성',            features: 'SPF50+ PA++++, 무기자차, 피부 저자극',          hwahae_url: '', image_url: '', is_disabled: '' },
  { product_key: '', name: '더마 트러블 징크 카밍 선크림',       brand: '후시다딘 (동화약품)', category: '선크림', volume_ml: '50', skin_types: '수부지,지성,복합성',      features: 'SPF50+ PA++++, 무기자차, 트러블 진정',          hwahae_url: '', image_url: '', is_disabled: '' },
  { product_key: '', name: '피디알엔 스킨핏 수분 선크림',        brand: '스타라이크',          category: '선크림', volume_ml: '50', skin_types: '수부지,지성',            features: 'SPF50+ PA++++, 유기자차, 물광 에센스 제형',     hwahae_url: '', image_url: '', is_disabled: '' },
  { product_key: '', name: '멜라 TXA 선세럼',                   brand: '아로셀',             category: '선크림', volume_ml: '50', skin_types: '건성,복합성',            features: 'SPF50+ PA++++, 유기자차, 미백/주름/자외선 3중', hwahae_url: '', image_url: '', is_disabled: '' },
  { product_key: '', name: '데일리 유브이 톤업 노세범 선크림',   brand: '이니스프리',          category: '선크림', volume_ml: '50', skin_types: '지성,복합성,민감성',      features: 'SPF50+ PA++++, 무기자차, 오일컨트롤',          hwahae_url: '', image_url: '', is_disabled: '' },
  { product_key: '', name: '스테이 프레쉬 톤업 선크림 퍼플',    brand: '조선미녀',            category: '선크림', volume_ml: '50', skin_types: '건성,민감성,복합성',      features: 'SPF50+ PA++++, 혼합자차, 톤 보정',             hwahae_url: '', image_url: '', is_disabled: '' },
  { product_key: '', name: '3번 도자기결 톤업베이지 선크림',     brand: '넘버즈인',            category: '선크림', volume_ml: '50', skin_types: '민감성,복합성,지성,건성', features: 'SPF50+ PA++++, 혼합자차, 파데프리 톤업',       hwahae_url: '', image_url: '', is_disabled: '' },
];

// Wide format: one row per product, one URL column per seller
export const mockProductLinksSheet = [
  {
    product_name: '엑설런트 선크림',
    oliveyoung:   '',
    coupang:      'https://link.coupang.com/a/euTm1IrprU',
    naver:        'https://brand.naver.com/mongdies/products/13009860683',
    zigzag:       '',
    ably:         '',
  },
  {
    product_name: '더마 트러블 징크 카밍 선크림',
    oliveyoung:   '',
    coupang:      'https://link.coupang.com/a/euTogOeOKi',
    naver:        'https://brand.naver.com/dongwhafusidyne/products/9999261730',
    zigzag:       '',
    ably:         '',
  },
  {
    product_name: '피디알엔 스킨핏 수분 선크림',
    oliveyoung:   'https://oy.run/g1ip6hEbG0GQsu',
    coupang:      'https://link.coupang.com/a/euTq778JA4',
    naver:        '',
    zigzag:       'https://s.zigzag.kr/abr/Lx0jJvYi94',
    ably:         'https://applink.a-bly.com/ogk2u3',
  },
  {
    product_name: '멜라 TXA 선세럼',
    oliveyoung:   'https://oy.run/nq6hNFFJuXtQ7h',
    coupang:      'https://link.coupang.com/a/euTq778JA4',
    naver:        'https://naver.me/5zURlN5z',
    zigzag:       'https://s.zigzag.kr/abr/5DvMybQveI',
    ably:         '',
  },
  {
    product_name: '데일리 유브이 톤업 노세범 선크림',
    oliveyoung:   'https://oy.run/rRbPHHbTfWaDJC',
    coupang:      'https://link.coupang.com/a/euTvIULPLU',
    naver:        'https://brand.naver.com/innisfree/products/13155811785',
    zigzag:       'https://s.zigzag.kr/abr/FUogL31meU',
    ably:         'https://applink.a-bly.com/q27718',
  },
  {
    product_name: '스테이 프레쉬 톤업 선크림 퍼플',
    oliveyoung:   'https://oy.run/gsgwGOxKSzisni',
    coupang:      'https://link.coupang.com/a/euTyhRQ4LQ',
    naver:        'https://brand.naver.com/beautyofjoseon/products/13518654945',
    zigzag:       '',
    ably:         '',
  },
  {
    product_name: '3번 도자기결 톤업베이지 선크림',
    oliveyoung:   'https://oy.run/YYKPJc5qEf6uS2',
    coupang:      'https://link.coupang.com/a/euTAD8gTQW',
    naver:        'https://brand.naver.com/numbuzin/products/5788327291',
    zigzag:       '',
    ably:         '',
  },
];

// Simplified: product_name + badge_type (display name auto-resolved in import.ts)
export const mockBadgesSheet = [
  { product_name: '엑설런트 선크림',                  badge_type: 'directorpi', detail: '2026 무기자차 건성·민감성 Top', source_title: '디렉터파이 2026 선크림 추천', ref_url: '', source_date: '2026-06-12' },
  { product_name: '더마 트러블 징크 카밍 선크림',      badge_type: 'directorpi', detail: '2026 무기자차 수부지·지성 Top',  source_title: '디렉터파이 2026 선크림 추천', ref_url: '', source_date: '2026-06-12' },
  { product_name: '피디알엔 스킨핏 수분 선크림',       badge_type: 'directorpi', detail: '2026 유기자차 수부지·지성 Top',  source_title: '디렉터파이 2026 선크림 추천', ref_url: '', source_date: '2026-06-12' },
  { product_name: '멜라 TXA 선세럼',                  badge_type: 'directorpi', detail: '2026 유기자차 건성·복합성 Top',  source_title: '디렉터파이 2026 선크림 추천', ref_url: '', source_date: '2026-06-12' },
  { product_name: '데일리 유브이 톤업 노세범 선크림', badge_type: 'directorpi', detail: '2026 톤업 보송 Top',             source_title: '디렉터파이 2026 선크림 추천', ref_url: '', source_date: '2026-06-12' },
  { product_name: '스테이 프레쉬 톤업 선크림 퍼플',   badge_type: 'directorpi', detail: '2026 톤업 촉촉 Top',             source_title: '디렉터파이 2026 선크림 추천', ref_url: '', source_date: '2026-06-12' },
  { product_name: '3번 도자기결 톤업베이지 선크림',    badge_type: 'directorpi', detail: '2026 톤업 파데프리 Top',          source_title: '디렉터파이 2026 선크림 추천', ref_url: '', source_date: '2026-06-12' },
];

// seller (enum) instead of seller_code
export const mockAllowlistSheet = [
  { seller: 'naver', brand: '몽디에스',   allowed_store_name: '몽디에스 공식스토어' },
  { seller: 'naver', brand: '동화약품',   allowed_store_name: '동화약품 공식몰'     },
  { seller: 'naver', brand: '이니스프리', allowed_store_name: '이니스프리 공식몰'   },
  { seller: 'naver', brand: '조선미녀',   allowed_store_name: '조선미녀 공식몰'     },
  { seller: 'naver', brand: '넘버즈인',   allowed_store_name: '넘버즈인 공식몰'     },
];

// product_name + seller instead of product_key + seller_code
export const mockOverridesSheet: Record<string, string>[] = [];

export const mockSeoPagesSheet = [
  { slug: 'directorpi-sunscreen',     page_type: 'curation', title: '디렉터파이 2026 추천 선크림 TOP 7 최저가 비교',          h1: '디렉터파이 추천 선크림 최저가 비교',   description: '디렉터파이가 2026년 추천한 선크림 중 무기자차·유기자차·톤업 유형별 TOP 제품을 모아 쿠팡·올리브영·네이버 최저가를 비교했어요.', category: 'sunscreen', skin_type: '', badge_type: 'directorpi', is_active: 'true' },
  { slug: 'mineral-sunscreen',        page_type: 'curation', title: '2026 무기자차 선크림 추천 최저가 비교 | 건성·민감성·지성', h1: '무기자차 선크림 최저가 비교',         description: '자극 없는 무기자차 선크림을 피부 타입별로 비교했어요.', category: 'sunscreen', skin_type: '', badge_type: '', is_active: 'true' },
  { slug: 'dry-skin-sunscreen',       page_type: 'skin',     title: '건성 피부 선크림 추천 최저가 비교 2026',                  h1: '건성 피부 선크림 최저가 비교',        description: '건성 피부에 맞는 보습력 좋은 선크림을 최저가 기준으로 비교했어요.',      category: 'sunscreen', skin_type: '건성',  badge_type: '', is_active: 'true' },
  { slug: 'sensitive-skin-sunscreen', page_type: 'skin',     title: '민감성 피부 선크림 추천 최저가 비교 2026',                h1: '민감성 피부 선크림 최저가 비교',      description: '자극 없는 민감성 피부 선크림을 성분과 가격 기준으로 비교했어요.',       category: 'sunscreen', skin_type: '민감성', badge_type: '', is_active: 'true' },
  { slug: 'oily-skin-sunscreen',      page_type: 'skin',     title: '지성·수부지 피부 선크림 추천 최저가 비교 2026',            h1: '지성·수부지 피부 선크림 최저가 비교', description: '백탁 없고 오일컨트롤 되는 지성·수부지 선크림을 최저가 기준으로 비교했어요.', category: 'sunscreen', skin_type: '지성',  badge_type: '', is_active: 'true' },
  { slug: 'toneup-sunscreen',         page_type: 'curation', title: '2026 톤업 선크림 추천 최저가 비교 | 보송·촉촉·파데프리',   h1: '톤업 선크림 최저가 비교',            description: '보송 톤업부터 촉촉 톤업, 파데프리까지 타입별 톤업 선크림을 최저가 기준으로 비교했어요.', category: 'sunscreen', skin_type: '', badge_type: '', is_active: 'true' },
];
