/**
 * oliveyoungAnchor: goodsNo 추출(순수) 테스트. 네트워크 없음.
 * Run: tsx crawler/core/__tests__/oliveyoungAnchor.test.ts
 */
import { goodsNoFromOyOfferLink } from '../oliveyoungAnchor';

let failed = false;
function check(name: string, cond: boolean, got?: unknown) {
  if (cond) console.log(`  ✓ ${name}`);
  else { failed = true; console.log(`  ✗ ${name} (got ${JSON.stringify(got)})`); }
}

console.log('=== oliveyoungAnchor.goodsNoFromOyOfferLink ===');

// 네이버 올영 offer 링크: sndType=goods 의 sndVal 이 goodsNo
const naverOffer = 'https://www.oliveyoung.co.kr/store/common/partner.do?chlNo=1&utm_source=naver&sndType=goods&sndVal=A000000184222';
check('naver offer sndVal → goodsNo', goodsNoFromOyOfferLink(naverOffer) === 'A000000184222', goodsNoFromOyOfferLink(naverOffer));

// 직접 상품 URL / oy.run 본문: goodsNo=
const detail = 'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000235913&utm_source=shutter';
check('getGoodsDetail goodsNo →', goodsNoFromOyOfferLink(detail) === 'A000000235913', goodsNoFromOyOfferLink(detail));

// sndType 이 goods 가 아니면 sndVal 신뢰 안 함
const nonGoods = 'https://www.oliveyoung.co.kr/store/common/partner.do?sndType=event&sndVal=EV123456';
check('non-goods sndVal → null', goodsNoFromOyOfferLink(nonGoods) === null, goodsNoFromOyOfferLink(nonGoods));

// goodsNo/sndVal 없음 → null
check('no goodsNo → null', goodsNoFromOyOfferLink('https://oy.run/abc') === null);
check('empty → null', goodsNoFromOyOfferLink('') === null);
check('null → null', goodsNoFromOyOfferLink(null) === null);

console.log(failed ? '\n✗ FAILED' : '\n✓ ALL PASSED');
process.exit(failed ? 1 : 0);
