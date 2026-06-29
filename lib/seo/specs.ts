// Candidate SEO-page specs, aligned with the seo_pages sheet's title brainstorm.
// This is the *authoring* source: the generator script (scripts/ops/analyze-seo-
// topics.ts) keeps only the specs that back >= MIN_SEO_PRODUCTS products and
// writes them to the sheet, which the importer then loads into the seo_pages
// table that /best/[slug] renders. Add a topic here → it becomes a page the next
// time the generator + import run (provided it clears the 4-product bar).

export interface SeoPageSpec {
  slug: string;
  page_type: 'curation' | 'skin' | 'keyword' | 'category';
  title: string; // <title> + sheet title
  h1: string; // on-page H1
  description: string; // meta description (unique per page)
  category?: string; // minor or major category slug
  skin_type?: string; // Korean skin-type name
  badge_type?: string; // 'directorpi' | 'hwahae'
  keywords?: string; // CSV synonyms (OR-matched against name/features/tags)
}

const cmp = '쿠팡·올리브영·네이버 최저가를 한 번에 비교했어요.';

export const SEO_PAGE_SPECS: SeoPageSpec[] = [
  // ─── Existing sunscreen pages (slugs preserved) ──────────────────────────────
  { slug: 'directorpi-sunscreen', page_type: 'curation', category: 'sunscreen', badge_type: 'directorpi',
    title: '디렉터파이 추천 선크림 TOP 최저가 비교 2026', h1: '디렉터파이 추천 선크림 최저가 비교',
    description: `디렉터파이가 성분으로 검증한 추천 선크림을 모아 ${cmp} 무기자차·톤업까지 유형별 최저가를 확인하세요.` },
  { slug: 'mineral-sunscreen', page_type: 'curation', category: 'sunscreen', keywords: '무기자차,무기자,징크,산화아연',
    title: '무기자차 선크림 추천 최저가 비교 2026', h1: '무기자차 선크림 최저가 비교',
    description: `자극 적은 무기자차 선크림만 골라 ${cmp} 백탁·사용감과 가격을 함께 비교하세요.` },
  { slug: 'dry-skin-sunscreen', page_type: 'skin', category: 'sunscreen', skin_type: '건성',
    title: '건성 피부 선크림 추천 최저가 비교 2026', h1: '건성 피부 선크림 최저가 비교',
    description: `건성 피부에 맞는 보습력 좋은 선크림을 ${cmp}` },
  { slug: 'sensitive-skin-sunscreen', page_type: 'skin', category: 'sunscreen', skin_type: '민감성',
    title: '민감성 피부 선크림 추천 최저가 비교 2026', h1: '민감성 피부 선크림 최저가 비교',
    description: `자극 없는 민감성 피부 선크림을 성분과 가격 기준으로 ${cmp}` },
  { slug: 'oily-skin-sunscreen', page_type: 'skin', category: 'sunscreen', skin_type: '지성',
    title: '지성·수부지 선크림 추천 최저가 비교 2026', h1: '지성·수부지 선크림 최저가 비교',
    description: `백탁 없고 산뜻한 지성·수부지 선크림을 ${cmp}` },
  { slug: 'toneup-sunscreen', page_type: 'curation', category: 'sunscreen', keywords: '톤업',
    title: '톤업 선크림 추천 최저가 비교 2026', h1: '톤업 선크림 최저가 비교',
    description: `보송부터 촉촉 톤업까지 데일리 톤업 선크림을 ${cmp}` },
  { slug: 'combination-sunscreen', page_type: 'skin', category: 'sunscreen', skin_type: '복합성',
    title: '복합성 피부 선크림 추천 최저가 비교 2026', h1: '복합성 피부 선크림 최저가 비교',
    description: `번들거림과 건조함을 동시에 잡는 복합성 선크림을 ${cmp}` },

  // ─── Category (minor) pages ──────────────────────────────────────────────────
  { slug: 'toner-best', page_type: 'category', category: 'toner',
    title: '토너·스킨 추천 최저가 비교 2026', h1: '토너·스킨 추천 최저가 비교',
    description: `성분으로 검증한 추천 토너·스킨을 모아 ${cmp}` },
  { slug: 'serum-best', page_type: 'category', category: 'serum',
    title: '세럼·앰플 추천 최저가 비교 2026', h1: '세럼·앰플 추천 최저가 비교',
    description: `효과 입증된 세럼·앰플을 골라 ${cmp}` },
  { slug: 'cream-best', page_type: 'category', category: 'cream', keywords: '',
    title: '수분크림·보습크림 추천 최저가 비교 2026', h1: '수분크림·보습크림 추천 최저가 비교',
    description: `장벽·보습 성분으로 고른 수분크림을 ${cmp}` },
  { slug: 'cushion-best', page_type: 'category', category: 'cushion',
    title: '쿠션 추천 최저가 비교 2026 | 커버·지속력', h1: '쿠션 추천 최저가 비교',
    description: `커버력과 지속력으로 검증한 쿠션을 ${cmp}` },
  { slug: 'foundation-best', page_type: 'category', category: 'foundation',
    title: '파운데이션 추천 최저가 비교 2026', h1: '파운데이션 추천 최저가 비교',
    description: `촉촉·매트 마무리별 추천 파운데이션을 ${cmp}` },
  { slug: 'pad-best', page_type: 'category', category: 'pad',
    title: '토너패드 추천 최저가 비교 2026', h1: '토너패드 추천 최저가 비교',
    description: `각질·진정 케어 토너패드를 ${cmp}` },
  { slug: 'cleansing-foam-best', page_type: 'category', category: 'cleansing',
    title: '클렌징폼·젤 추천 최저가 비교 2026', h1: '클렌징폼·젤 추천 최저가 비교',
    description: `순하게 씻기는 약산성·저자극 클렌징폼을 ${cmp}` },
  { slug: 'cleansing-oil-best', page_type: 'category', category: 'cleansing-oil',
    title: '클렌징오일·밤 추천 최저가 비교 2026', h1: '클렌징오일·밤 추천 최저가 비교',
    description: `잔여물 없이 녹이는 클렌징오일·밤을 ${cmp}` },
  { slug: 'bodywash-best', page_type: 'category', category: 'shower',
    title: '바디워시 추천 최저가 비교 2026', h1: '바디워시 추천 최저가 비교',
    description: `향과 성분으로 고른 추천 바디워시를 ${cmp}` },
  { slug: 'body-lotion-best', page_type: 'category', category: 'body-lotion',
    title: '바디로션·바디크림 추천 최저가 비교 2026', h1: '바디로션·바디크림 추천 최저가 비교',
    description: `보습 오래가는 바디로션·바디크림을 ${cmp}` },
  { slug: 'sheet-mask-best', page_type: 'category', category: 'sheet-mask',
    title: '마스크팩·시트팩 추천 최저가 비교 2026', h1: '마스크팩·시트팩 추천 최저가 비교',
    description: `진정·수분 마스크팩을 박스 단위 ${cmp}` },
  { slug: 'allinone-best', page_type: 'category', category: 'allinone',
    title: '올인원 추천 최저가 비교 2026', h1: '올인원 추천 최저가 비교',
    description: `토너·세럼·크림을 한 번에 끝내는 올인원을 ${cmp}` },
  { slug: 'device-best', page_type: 'category', category: 'device',
    title: '뷰티 디바이스 추천 최저가 비교 2026', h1: '뷰티 디바이스 추천 최저가 비교',
    description: `리프팅·고주파 뷰티 디바이스를 ${cmp}` },

  // ─── Major-category hub pages ────────────────────────────────────────────────
  { slug: 'skincare-best', page_type: 'category', category: 'skincare',
    title: '기초 스킨케어 추천 최저가 비교 2026', h1: '기초 스킨케어 추천 최저가 비교',
    description: `토너·세럼·크림까지 성분 검증된 기초 스킨케어를 ${cmp}` },
  { slug: 'base-makeup-best', page_type: 'category', category: 'base-makeup',
    title: '베이스 메이크업 추천 최저가 비교 2026', h1: '베이스 메이크업 추천 최저가 비교',
    description: `쿠션·파운데이션 등 베이스 메이크업을 ${cmp}` },
  { slug: 'bodycare-best', page_type: 'category', category: 'bodycare',
    title: '바디케어 추천 최저가 비교 2026', h1: '바디케어 추천 최저가 비교',
    description: `바디워시·바디로션까지 바디케어 전 품목을 ${cmp}` },
  { slug: 'cleansing-best', page_type: 'category', category: 'cleansing-care',
    title: '클렌징 추천 최저가 비교 2026', h1: '클렌징 추천 최저가 비교',
    description: `클렌징폼·오일·워터까지 순한 클렌징을 ${cmp}` },
  { slug: 'maskpack-best', page_type: 'category', category: 'maskpack',
    title: '마스크팩 추천 최저가 비교 2026', h1: '마스크팩 추천 최저가 비교',
    description: `시트팩·패드까지 진정·수분 마스크팩을 ${cmp}` },

  // ─── Skin × category ─────────────────────────────────────────────────────────
  { slug: 'dry-cream', page_type: 'skin', category: 'cream', skin_type: '건성',
    title: '건성 피부 크림 추천 최저가 비교 2026', h1: '건성 피부 크림 최저가 비교',
    description: `당김 없는 고보습 건성용 크림을 ${cmp}` },
  { slug: 'dehydrated-cream', page_type: 'skin', category: 'cream', skin_type: '수부지',
    title: '수부지 크림 추천 최저가 비교 2026', h1: '수부지 크림 최저가 비교',
    description: `속건조 잡는 수부지용 크림을 ${cmp}` },
  { slug: 'dry-serum', page_type: 'skin', category: 'serum', skin_type: '건성',
    title: '건성 피부 세럼 추천 최저가 비교 2026', h1: '건성 피부 세럼 최저가 비교',
    description: `보습·장벽 건성용 세럼을 ${cmp}` },
  { slug: 'sensitive-serum', page_type: 'skin', category: 'serum', skin_type: '민감성',
    title: '민감성 피부 세럼 추천 최저가 비교 2026', h1: '민감성 피부 세럼 최저가 비교',
    description: `저자극 진정 민감성용 세럼을 ${cmp}` },
  { slug: 'dry-cushion', page_type: 'skin', category: 'cushion', skin_type: '건성',
    title: '건성 피부 쿠션 추천 최저가 비교 2026', h1: '건성 피부 쿠션 최저가 비교',
    description: `들뜸 없는 촉촉 건성용 쿠션을 ${cmp}` },
  { slug: 'dry-foundation', page_type: 'skin', category: 'foundation', skin_type: '건성',
    title: '건성 피부 파운데이션 추천 최저가 비교 2026', h1: '건성 피부 파운데이션 최저가 비교',
    description: `각질 부각 없는 촉촉 건성용 파운데이션을 ${cmp}` },
  { slug: 'dry-device', page_type: 'skin', category: 'device', skin_type: '건성',
    title: '건성 피부 뷰티 디바이스 추천 최저가 비교 2026', h1: '건성 피부 뷰티 디바이스 최저가 비교',
    description: `보습·탄력 케어 뷰티 디바이스를 ${cmp}` },

  // ─── Keyword pages ───────────────────────────────────────────────────────────
  { slug: 'acne-toner', page_type: 'keyword', category: 'toner', keywords: '여드름,트러블,진정,약산성',
    title: '여드름·트러블 토너 추천 최저가 비교 2026', h1: '여드름·트러블 토너 최저가 비교',
    description: `진정·약산성 트러블 토너를 ${cmp}` },
  { slug: 'acne-serum', page_type: 'keyword', category: 'serum', keywords: '여드름,트러블,진정,시카',
    title: '여드름·트러블 세럼 추천 최저가 비교 2026', h1: '여드름·트러블 세럼 최저가 비교',
    description: `트러블 진정 세럼·앰플을 ${cmp}` },
  { slug: 'acne-cream', page_type: 'keyword', category: 'cream', keywords: '여드름,트러블,진정,시카',
    title: '여드름·트러블 크림 추천 최저가 비교 2026', h1: '여드름·트러블 크림 최저가 비교',
    description: `진정·장벽 트러블 크림을 ${cmp}` },
  { slug: 'acne-pad', page_type: 'keyword', category: 'pad', keywords: '여드름,트러블,진정,각질',
    title: '진정·트러블 패드 추천 최저가 비교 2026', h1: '진정·트러블 패드 최저가 비교',
    description: `각질·트러블 정돈 진정 패드를 ${cmp}` },
  { slug: 'blackhead-cleansing-oil', page_type: 'keyword', category: 'cleansing-oil', keywords: '블랙헤드,모공,피지',
    title: '블랙헤드·모공 클렌징오일 추천 최저가 비교 2026', h1: '블랙헤드·모공 클렌징오일 최저가 비교',
    description: `블랙헤드·모공 녹이는 클렌징오일을 ${cmp}` },
  { slug: 'soothing-mask', page_type: 'keyword', category: 'maskpack', keywords: '진정,시카,수딩,센텔라',
    title: '진정 마스크팩 추천 최저가 비교 2026', h1: '진정 마스크팩 최저가 비교',
    description: `자극 가라앉히는 진정 마스크팩을 ${cmp}` },
  { slug: 'hydra-mask', page_type: 'keyword', category: 'maskpack', keywords: '수분,아쿠아,히알루론',
    title: '수분 마스크팩 추천 최저가 비교 2026', h1: '수분 마스크팩 최저가 비교',
    description: `속수분 채우는 수분 마스크팩을 ${cmp}` },

  // ─── Men ─────────────────────────────────────────────────────────────────────
  { slug: 'men-best', page_type: 'keyword', keywords: '남자,남성,맨즈,for men,포 맨,포맨',
    title: '남자 화장품 추천 최저가 비교 2026', h1: '남자 화장품 추천 최저가 비교',
    description: `남성 스킨케어·올인원까지 검증된 남자 화장품을 ${cmp}` },
  { slug: 'men-skincare', page_type: 'keyword', category: 'skincare', keywords: '남자,남성,맨즈,for men,포 맨,포맨',
    title: '남자 스킨케어 추천 최저가 비교 2026', h1: '남자 스킨케어 추천 최저가 비교',
    description: `남성 토너·올인원 등 기초 스킨케어를 ${cmp}` },
  { slug: 'men-allinone', page_type: 'keyword', category: 'allinone', keywords: '남자,남성,맨즈,for men,포 맨,포맨',
    title: '남자 올인원 추천 최저가 비교 2026', h1: '남자 올인원 추천 최저가 비교',
    description: `간편한 남성 올인원을 ${cmp}` },
];
