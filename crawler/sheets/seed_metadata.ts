import { google } from 'googleapis';

async function getSheets() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

const ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

// ─── categories ─────────────────────────────────────────────────────────────
// slug | name | sort_order
const CATEGORIES = [
  ['sunscreen', '선크림',  '1'],
  ['toner',     '토너',    '2'],
  ['cream',     '크림',    '3'],
  ['serum',     '세럼',    '4'],
  ['cleansing', '클렌징',  '5'],
  ['cushion',   '쿠션',    '6'],
];

// ─── badges ──────────────────────────────────────────────────────────────────
// product_key | badge_slug | badge_name | detail | source_title | ref_url | source_date | is_active
const BADGES = [
  ['PROD_001', 'directorpi', '디렉터파이 추천', '2026 무기자차 건성·민감성 Top', '디렉터파이 2026 선크림 추천', '', '2026-06-12', 'true'],
  ['PROD_002', 'directorpi', '디렉터파이 추천', '2026 무기자차 수부지·지성 Top', '디렉터파이 2026 선크림 추천', '', '2026-06-12', 'true'],
  ['PROD_003', 'directorpi', '디렉터파이 추천', '2026 유기자차 수부지·지성 Top', '디렉터파이 2026 선크림 추천', '', '2026-06-12', 'true'],
  ['PROD_004', 'directorpi', '디렉터파이 추천', '2026 유기자차 건성·복합성 Top', '디렉터파이 2026 선크림 추천', '', '2026-06-12', 'true'],
  ['PROD_005', 'directorpi', '디렉터파이 추천', '2026 톤업 보송 Top',           '디렉터파이 2026 선크림 추천', '', '2026-06-12', 'true'],
  ['PROD_006', 'directorpi', '디렉터파이 추천', '2026 톤업 촉촉 Top',           '디렉터파이 2026 선크림 추천', '', '2026-06-12', 'true'],
  ['PROD_007', 'directorpi', '디렉터파이 추천', '2026 톤업 파데프리 Top',        '디렉터파이 2026 선크림 추천', '', '2026-06-12', 'true'],
];

// ─── retailer_allowlist ──────────────────────────────────────────────────────
// seller_code | brand | allowed_store_name | is_active
// 네이버 브랜드 공식스토어만 수집 허용 (비공식 판매자 제외)
const ALLOWLIST = [
  ['naver', '몽디에스',   '몽디에스 공식스토어',  'true'],
  ['naver', '동화약품',   '동화약품 공식몰',      'true'],
  ['naver', '이니스프리', '이니스프리 공식몰',    'true'],
  ['naver', '조선미녀',   '조선미녀 공식몰',      'true'],
  ['naver', '넘버즈인',   '넘버즈인 공식몰',      'true'],
];

// ─── seo_pages ───────────────────────────────────────────────────────────────
// slug | page_type | title | h1 | description | category | skin_type | badge_type | is_active
const SEO_PAGES = [
  [
    'directorpi-sunscreen',
    'curation',
    '디렉터파이 2026 추천 선크림 TOP 7 최저가 비교',
    '디렉터파이 추천 선크림 최저가 비교',
    '디렉터파이가 2026년 추천한 선크림 중 무기자차·유기자차·톤업 유형별 TOP 제품을 모아 쿠팡·올리브영·네이버 최저가를 비교했어요.',
    'sunscreen', '', 'directorpi', 'true',
  ],
  [
    'mineral-sunscreen',
    'curation',
    '2026 무기자차 선크림 추천 최저가 비교 | 건성·민감성·지성',
    '무기자차 선크림 최저가 비교',
    '자극 없는 무기자차 선크림을 피부 타입별로 비교했어요. 건성·민감성에는 몽디에스, 수부지·지성에는 후시다딘이 추천되고 있어요.',
    'sunscreen', '', '', 'true',
  ],
  [
    'dry-skin-sunscreen',
    'skin',
    '건성 피부 선크림 추천 최저가 비교 2026',
    '건성 피부 선크림 최저가 비교',
    '건성 피부에 맞는 보습력 좋은 선크림을 최저가 기준으로 비교했어요.',
    'sunscreen', '건성', '', 'true',
  ],
  [
    'sensitive-skin-sunscreen',
    'skin',
    '민감성 피부 선크림 추천 최저가 비교 2026',
    '민감성 피부 선크림 최저가 비교',
    '자극 없는 민감성 피부 선크림을 성분과 가격 기준으로 비교했어요.',
    'sunscreen', '민감성', '', 'true',
  ],
  [
    'oily-skin-sunscreen',
    'skin',
    '지성·수부지 피부 선크림 추천 최저가 비교 2026',
    '지성·수부지 피부 선크림 최저가 비교',
    '백탁 없고 오일컨트롤 되는 지성·수부지 선크림을 최저가 기준으로 비교했어요.',
    'sunscreen', '지성', '', 'true',
  ],
  [
    'toneup-sunscreen',
    'curation',
    '2026 톤업 선크림 추천 최저가 비교 | 보송·촉촉·파데프리',
    '톤업 선크림 최저가 비교',
    '보송 톤업부터 촉촉 톤업, 파데프리까지 타입별 톤업 선크림을 최저가 기준으로 비교했어요.',
    'sunscreen', '', '', 'true',
  ],
];

async function seed() {
  const sheets = await getSheets();

  await sheets.spreadsheets.values.update({
    spreadsheetId: ID, range: 'categories!A2',
    valueInputOption: 'RAW', requestBody: { values: CATEGORIES },
  });
  console.log(`✓ categories: ${CATEGORIES.length} rows`);

  await sheets.spreadsheets.values.update({
    spreadsheetId: ID, range: 'badges!A2',
    valueInputOption: 'RAW', requestBody: { values: BADGES },
  });
  console.log(`✓ badges: ${BADGES.length} rows`);

  await sheets.spreadsheets.values.update({
    spreadsheetId: ID, range: 'retailer_allowlist!A2',
    valueInputOption: 'RAW', requestBody: { values: ALLOWLIST },
  });
  console.log(`✓ retailer_allowlist: ${ALLOWLIST.length} rows`);

  await sheets.spreadsheets.values.update({
    spreadsheetId: ID, range: 'seo_pages!A2',
    valueInputOption: 'RAW', requestBody: { values: SEO_PAGES },
  });
  console.log(`✓ seo_pages: ${SEO_PAGES.length} rows`);

  console.log('\nDone. Run `npm run sheets:import` to sync to Supabase.');
}

seed().catch((e) => { console.error(e); process.exit(1); });
