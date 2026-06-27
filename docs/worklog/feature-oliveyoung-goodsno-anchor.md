# feature/oliveyoung-goodsno-anchor

## 목표
올리브영을 **제목 유사도가 아니라 goodsNo 동일성**으로 앵커 → "비 벨벳 커버 쿠션"이 "세범컷 쿨링 쿠션"에 붙던 형제-변종 오매칭 제거(식별 문제, 파싱과 별개).

## 타당성(probe, READ-ONLY로 확인)
- **네이버 올영 offer link** = `...partner.do?...&sndType=goods&sndVal=A000000184222` → **URL에 goodsNo가 그대로**(페치 불필요). 실제로 "비벨벳 커버쿠션 본품+리필" offer의 sndVal=A000000184222 = 정확한 제품.
- **큐레이션 oy.run** = 200 OK 본문에 `getGoodsDetail.do?goodsNo=A000…` → 1회 페치로 추출(oliveyoung.co.kr 페이지는 WAF 403이지만 oy.run 인터스티셜은 무관).

## 구현
- `crawler/core/oliveyoungAnchor.ts`
  - `goodsNoFromOyOfferLink(link)` (순수): `goodsNo=` 우선, 없으면 `sndType=goods`의 `sndVal=`.
  - `resolveCuratedOyGoodsNo(url)`: 직접 URL이면 즉시 추출, oy.run 단축이면 1회 페치 본문에서 추출(캐시 + 상한 80, mock/test/비-OY → null).
- `naver.ts`: `pickOliveYoungOffer(..., anchorGoodsNo?)` — 앵커 있으면 goodsNo 일치 offer만 후보로(없으면 느슨 매칭 폴백). `matchOliveYoungOffer(..., anchorGoodsNo?)` 전달.
- `oliveyoung.ts` 어댑터: `resolveCuratedOyGoodsNo(listing.affiliate_url||url)` → matchOliveYoungOffer로.

## 동작
- 큐레이션 goodsNo ↔ 네이버 offer goodsNo 일치 → **그 offer를 정확 SKU로 채택**(이후 기존 band/parse 로직 그대로). 불일치/미해석/이번검색 미노출 → 기존 느슨 매칭 폴백(거동 보존).

## 테스트
- `test:oyanchor`(추출 순수함수) ✅, `test:naver`·`test:oliveyoung` 회귀 ✅, `test:all` exit 0 ✅, `tsc` ✅.

## 머지 후
- 운영자 `crawler:sync` 시 OY 매칭이 goodsNo 기준으로. (oy.run 해석은 per-run 캐시 + 상한.)
