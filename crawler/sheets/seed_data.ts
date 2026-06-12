import { google } from 'googleapis';

async function getSheets() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

// ─── products ───────────────────────────────────────────────────────────────
// product_key | slug | name | brand | category_slug | volume_ml | image_url | features | skin_types | hwahae_url | official_info_url | is_active
const PRODUCTS = [
  ['PROD_001', 'mongdies-excellent-suncream',      '몽디에스 엑설런트 선크림',             '몽디에스',         'sunscreen', '50', '', 'SPF50+ PA++++, 무기자차, 피부 저자극',      '건성,민감성',             '', '', 'true'],
  ['PROD_002', 'fusidyne-zinc-calming-sunscreen',   '후시다딘 더마 트러블 징크 카밍 선크림', '후시다딘 (동화약품)', 'sunscreen', '50', '', 'SPF50+ PA++++, 무기자차, 트러블 진정',     '수부지,지성,복합성',       '', '', 'true'],
  ['PROD_003', 'starlike-pdrn-skinfit-sunscreen',   '스타라이크 피디알엔 스킨핏 수분 선크림','스타라이크',        'sunscreen', '50', '', 'SPF50+ PA++++, 유기자차, 물광 에센스 제형', '수부지,지성',             '', '', 'true'],
  ['PROD_004', 'arocell-mela-txa-sunserum',         '아로셀 멜라 TXA 선세럼',              '아로셀',           'sunscreen', '50', '', 'SPF50+ PA++++, 유기자차, 미백/주름/자외선 3중', '건성,복합성',           '', '', 'true'],
  ['PROD_005', 'innisfree-toneup-nosebum-sunscreen','이니스프리 데일리 유브이 톤업 노세범 선크림', '이니스프리',  'sunscreen', '50', '', 'SPF50+ PA++++, 무기자차, 오일컨트롤',     '지성,복합성,민감성',       '', '', 'true'],
  ['PROD_006', 'beautyofjoseon-stayfresh-purple',   '조선미녀 스테이 프레쉬 톤업 선크림 퍼플','조선미녀',        'sunscreen', '50', '', 'SPF50+ PA++++, 혼합자차, 톤 보정',        '건성,민감성,복합성',       '', '', 'true'],
  ['PROD_007', 'numbuzin-3-porcelain-toneup',       '넘버즈인 3번 도자기결 톤업베이지 선크림','넘버즈인',        'sunscreen', '50', '', 'SPF50+ PA++++, 혼합자차, 파데프리 톤업',   '민감성,복합성,지성,건성',   '', '', 'true'],
];

// ─── product_links ───────────────────────────────────────────────────────────
// link_key | product_key | seller_code | url | affiliate_url | store_name | is_official_store | is_rocket | crawl_enabled | crawl_method | is_active
const LINKS = [
  // PROD_001 몽디에스
  ['LINK_COUPANG_001', 'PROD_001', 'coupang',    'https://link.coupang.com/a/euTm1IrprU',                    'https://link.coupang.com/a/euTm1IrprU', '쿠팡',   'false', 'true',  'true', 'api',        'true'],
  ['LINK_NAVER_001',   'PROD_001', 'naver',      'https://brand.naver.com/mongdies/products/13009860683',    '',                                      '네이버',  'true',  'false', 'true', 'api',        'true'],
  // PROD_002 후시다딘
  ['LINK_COUPANG_002', 'PROD_002', 'coupang',    'https://link.coupang.com/a/euTogOeOKi',                    'https://link.coupang.com/a/euTogOeOKi', '쿠팡',   'false', 'true',  'true', 'api',        'true'],
  ['LINK_NAVER_002',   'PROD_002', 'naver',      'https://brand.naver.com/dongwhafusidyne/products/9999261730', '',                                   '네이버',  'true',  'false', 'true', 'api',        'true'],
  // PROD_003 스타라이크
  ['LINK_OY_003',      'PROD_003', 'oliveyoung', 'https://oy.run/g1ip6hEbG0GQsu',                           'https://oy.run/g1ip6hEbG0GQsu',         '올리브영', 'false', 'false', 'true', 'playwright', 'true'],
  ['LINK_COUPANG_003', 'PROD_003', 'coupang',    'https://link.coupang.com/a/euTq778JA4',                    'https://link.coupang.com/a/euTq778JA4', '쿠팡',   'false', 'true',  'true', 'api',        'true'],
  ['LINK_ZIGZAG_003',  'PROD_003', 'zigzag',     'https://s.zigzag.kr/abr/Lx0jJvYi94',                      'https://s.zigzag.kr/abr/Lx0jJvYi94',   '지그재그', 'false', 'false', 'true', 'playwright', 'true'],
  ['LINK_ABLY_003',    'PROD_003', 'ably',       'https://applink.a-bly.com/ogk2u3',                         'https://applink.a-bly.com/ogk2u3',      '에이블리', 'false', 'false', 'true', 'playwright', 'true'],
  // PROD_004 아로셀
  ['LINK_OY_004',      'PROD_004', 'oliveyoung', 'https://oy.run/nq6hNFFJuXtQ7h',                           'https://oy.run/nq6hNFFJuXtQ7h',         '올리브영', 'false', 'false', 'true', 'playwright', 'true'],
  ['LINK_COUPANG_004', 'PROD_004', 'coupang',    'https://link.coupang.com/a/euTq778JA4',                    'https://link.coupang.com/a/euTq778JA4', '쿠팡',   'false', 'true',  'true', 'api',        'true'],
  ['LINK_ZIGZAG_004',  'PROD_004', 'zigzag',     'https://s.zigzag.kr/abr/5DvMybQveI',                      'https://s.zigzag.kr/abr/5DvMybQveI',   '지그재그', 'false', 'false', 'true', 'playwright', 'true'],
  ['LINK_NAVER_004',   'PROD_004', 'naver',      'https://naver.me/5zURlN5z',                                '',                                      '네이버',  'false', 'false', 'true', 'api',        'true'],
  // PROD_005 이니스프리
  ['LINK_OY_005',      'PROD_005', 'oliveyoung', 'https://oy.run/rRbPHHbTfWaDJC',                           'https://oy.run/rRbPHHbTfWaDJC',         '올리브영', 'false', 'false', 'true', 'playwright', 'true'],
  ['LINK_COUPANG_005', 'PROD_005', 'coupang',    'https://link.coupang.com/a/euTvIULPLU',                    'https://link.coupang.com/a/euTvIULPLU', '쿠팡',   'false', 'true',  'true', 'api',        'true'],
  ['LINK_ZIGZAG_005',  'PROD_005', 'zigzag',     'https://s.zigzag.kr/abr/FUogL31meU',                      'https://s.zigzag.kr/abr/FUogL31meU',   '지그재그', 'false', 'false', 'true', 'playwright', 'true'],
  ['LINK_ABLY_005',    'PROD_005', 'ably',       'https://applink.a-bly.com/q27718',                         'https://applink.a-bly.com/q27718',      '에이블리', 'false', 'false', 'true', 'playwright', 'true'],
  ['LINK_NAVER_005',   'PROD_005', 'naver',      'https://brand.naver.com/innisfree/products/13155811785',   '',                                      '네이버',  'true',  'false', 'true', 'api',        'true'],
  // PROD_006 조선미녀
  ['LINK_OY_006',      'PROD_006', 'oliveyoung', 'https://oy.run/gsgwGOxKSzisni',                           'https://oy.run/gsgwGOxKSzisni',         '올리브영', 'false', 'false', 'true', 'playwright', 'true'],
  ['LINK_COUPANG_006', 'PROD_006', 'coupang',    'https://link.coupang.com/a/euTyhRQ4LQ',                    'https://link.coupang.com/a/euTyhRQ4LQ', '쿠팡',   'false', 'true',  'true', 'api',        'true'],
  ['LINK_NAVER_006',   'PROD_006', 'naver',      'https://brand.naver.com/beautyofjoseon/products/13518654945', '',                                   '네이버',  'true',  'false', 'true', 'api',        'true'],
  // PROD_007 넘버즈인
  ['LINK_OY_007',      'PROD_007', 'oliveyoung', 'https://oy.run/YYKPJc5qEf6uS2',                           'https://oy.run/YYKPJc5qEf6uS2',         '올리브영', 'false', 'false', 'true', 'playwright', 'true'],
  ['LINK_COUPANG_007', 'PROD_007', 'coupang',    'https://link.coupang.com/a/euTAD8gTQW',                    'https://link.coupang.com/a/euTAD8gTQW', '쿠팡',   'false', 'true',  'true', 'api',        'true'],
  ['LINK_NAVER_007',   'PROD_007', 'naver',      'https://brand.naver.com/numbuzin/products/5788327291',     '',                                      '네이버',  'true',  'false', 'true', 'api',        'true'],
];

async function seed() {
  const sheets = await getSheets();

  // Write products (starting row 2, after header)
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'products!A2',
    valueInputOption: 'RAW',
    requestBody: { values: PRODUCTS },
  });
  console.log(`✓ products: ${PRODUCTS.length} rows`);

  // Write product_links
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'product_links!A2',
    valueInputOption: 'RAW',
    requestBody: { values: LINKS },
  });
  console.log(`✓ product_links: ${LINKS.length} rows`);

  console.log('\nDone. Run `npm run sheets:import` to sync to Supabase.');
}

seed().catch((e) => { console.error(e); process.exit(1); });
