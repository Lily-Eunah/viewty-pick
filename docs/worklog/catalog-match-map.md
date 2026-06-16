# 전체 카탈로그 매칭 맵 (READ-ONLY 진단)

- **일자**: 2026-06-16
- **매처**: `fix/naver-sku-matching` (실제 함수 호출: matchNaverOffer / pickOfficialOffer / classifyOfferComposition)
- **모드**: READ-ONLY. DB/시트/sync 무변경. 라이브 네이버·쿠팡 검색 API만 사용.
- **대상**: 활성 listing 138건 중 어댑터 보유 104건 진단 (zigzag/ably 34건은 어댑터 없음 → 제외).

## 요약 분포
| 분류 | 건수 |
|---|---|
| ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | 78 |
| 🔬 검수 필요(이종세트/모호 OY) | 3 |
| 🔎 데모/오큐레이션 의심(링크만) | 2 |
| ⚠️ URL 데이터 오류(링크만) | 1 |
| 🔗 링크만(앵커 미스/OY 미수집) | 20 |

## 정책: 세트 포함(개당가) + OY 4-tier + 앵커-only 적용 결과

**커버리지 회복**: 가격 수집 OK **37 → 78** (이전 "세트 제외/OY 링크만" → 현 "세트 포함 개당가 + OY 느슨 매칭").

**보장 확인**
- 네이버 가격은 **N-앵커 단품 또는 동질묶음(개당가)** 만 (fuzzy 제목가 0). 앵커 미스 → 링크만.
- **묶음 개당가 수집**: 몽디에스 쿠팡 ×2(33,000), 후시다딘 쿠팡 ×4(38,530), 메디큐브 naver 250ml×2, 인터미션 x2더블, 라하 OY 1+1, 넘버즈인 OY 더블기획 → 모두 수집(normalize가 effective 개당가 산출).
- **증정은 미반영(라벨만)**: "(+7ml*2)", "+토너 20ml 증정", "(+세럼20ml+크림1ml)" 등 → 본품가만. (packageExtractor)
- **이종세트/디바이스/N종 → 검수(INSPECT, 무가격)**: #82 아벤느, #86 바이오힐보(+슈링크홈디바이스), #92 블라이드(모호 OY).

**OY 4-tier**: mallName='올리브영'(정확) 느슨 매칭. Tier2(가격)·Tier3(manual_override)·Tier4(링크만). 스타라이크·아로셀·메디큐브·코스알엑스·에스트라·니들리 등 OY가 가격 회복.

**⚠️ 느슨 OY의 잔여 오매칭(운영자가 수용한 리스크 — manual_override 권고)**
- **#34 조선미녀**: OY가 *다른 단품* "맑은쌀 선크림 아쿠아프레쉬 50ml" 25,300 매칭(큐레이션=스테이프레쉬 톤업 퍼플). 같은 폼·세트표시 없음 → 변형토큰 없인 구분 불가(엄격토큰 OY 미적용 결정).
- **#76 닥터지 OY**: "포 맨 ... 토너+올인원 증정 기획" 31,000(종 키워드 없어 이종 미감지). 큐레이션=올인원.
- → 두 건은 **manual_override로 확정** 권고. (volume-gate도 50ml↔50ml라 미해결.)

## 운영자 수정 리스트

### 2. 검수 필요 — 이종 2제품 세트 / 모호한 OY 매칭 (검수 후 manual_override 또는 단품 URL) (3)
- **아벤느 히알루론 액티브 B3 안티에이징 세럼 ** [naver] — 이종 2제품 세트 또는 모호한 OY 매칭 — 검수 후 manual_override 또는 단품 URL
  - 🔬 inspection — id-anchored to curated SKU (productNo 10698667363) but it is a heterogeneous 2-product set — needs inspection (no price)
  - 후보: 40 hits · official 2 (single 1) · closest "아벤느 아벤느 히알루론 액티브 B3 안티에이징 세럼 30ml" @G마켓 id1.00
  - url: https://naver.me/G1pzkqHd
- **바이오힐보 엔에이디 프리즈셀 글로우 파워 세럼** [oliveyoung] — 이종 2제품 세트 또는 모호한 OY 매칭 — 검수 후 manual_override 또는 단품 URL
  - 🔬 inspection — 올리브영 offer is a heterogeneous set — inspection/manual
  - 후보: 40 hits · official 2 (single 1) · closest "바이오힐보 엔에이디 프리즈셀 글로우 파워 세럼 30ml" @뷰티판도라 id1.00
  - url: https://oy.run/HHRGCszKOAUvRR
- **블라이드 버블링 스플래쉬 마스크 인디언 그레이셜 머드** [oliveyoung] — 이종 2제품 세트 또는 모호한 OY 매칭 — 검수 후 manual_override 또는 단품 URL
  - 🔬 inspection — 올리브영 offer(s) found but none confidently matched (best 0.33) — inspection/manual
  - 후보: 5 hits · official 0 (single 0) · closest "머드팩투폼블라이드 버블링 스플래쉬 마스크 인디언 그레이셜 머드" @블라이드BLITHE id1.00
  - url: https://oy.run/DDfzsAfybC0wY8

### 3. URL 데이터 오류 (1)
- **넘버즈인 3번 도자기결 톤업베이지 선크림** [coupang] — 시트 URL을 제품 상세(/vp/products/{id})로 교체
  - ⛔ data_error
  - 후보: share short-link (no productId)
  - url: https://link.coupang.com/a/euTAD8gTQW

### 4. 데모/오큐레이션 정리 후보 (2)
- **후시다딘 (동화약품) 더마 트러블 징크 카밍 선크림** [naver] — 검색 0건 — 브랜드스토어 미인덱스/단종 의심, 카탈로그 정리 검토
  - 🔗 link-only — anchor miss — curated productNo 9999261730 not in 3 queries — link-only (no fuzzy price)
  - 후보: 0 hits · official 0 (single 0) · no individual offers
  - url: https://brand.naver.com/dongwhafusidyne/products/9999261730
- **이지앤트리 체스트넛 바하 0.9 클리어 토너** [naver] — 검색 0건 — 브랜드스토어 미인덱스/단종 의심, 카탈로그 정리 검토
  - 🔗 link-only — anchor miss — curated productNo 12650048480 not in 3 queries — link-only (no fuzzy price)
  - 후보: 0 hits · official 0 (single 0) · no individual offers
  - url: https://brand.naver.com/isntree/products/12650048480?NaPm=ct%3Dmqbj6un9%7Cci%3DrBo15QAAAZ6%2DEchXAOAakg%2E%2E01%7Ctr%3Dpmax%7Chk%3D7be5a23627fac3a0009acb7ae9a2423541f0ef47%7Cnacn%3Dex1ZCIC6PJdZB

## per-listing 전체 표
| # | 제품 | 판매처 | 분류 | 매처 결과 | 후보 요약 |
|---|---|---|---|---|---|
| 29 | 몽디에스 엑설런트 선크림 | coupang | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 33,000원 (×2 개당가) — [6개월 이상 첫 선케어] [1+1] 몽디에스 아기/유아 무기자차 선크림 | anchored pid 5529437152 |
| 29 | 몽디에스 엑설런트 선크림 | naver | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 31,500원 @몽디에스 — 몽디에스 징크 유아 어린이 초등학생 무기자차 이지워시 선크림 SPF50  [anchor] | 0 hits · official 0 (single 0) · no individual offers |
| 30 | 후시다딘 (동화약품) 더마 트러블 징크 카밍 선크림 | coupang | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 38,530원 (×4 개당가) — 후시다인 더마 트러블 징크 카밍 선크림 SPF50+ PA++++, 50m | anchored pid 7941544246 |
| 30 | 후시다딘 (동화약품) 더마 트러블 징크 카밍 선크림 | naver | 🔎 데모/오큐레이션 의심(링크만) | 🔗 link-only — anchor miss — curated productNo 9999261730 not in 3 que | 0 hits · official 0 (single 0) · no individual offers |
| 31 | 스타라이크 피디알엔 스킨핏 수분 선크림 | coupang | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 16,760원 — 스타라이크 피디알엔 스킨 핏 수분 선 크림 SPF 50+ PA++++ | anchored pid 8745247214 |
| 31 | 스타라이크 피디알엔 스킨핏 수분 선크림 | oliveyoung | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 24,000원 @올리브영 — [화잘먹/24시간속보습] 스타라이크 PDRN 스킨 핏 수분 선크림 50m [OY] | 40 hits · official 0 (single 0) · closest "스타라이크 피디알엔 스킨 핏 수분 선 크림 50m |
| 32 | 아로셀 멜라 TXA 선세럼 | coupang | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 19,700원 — 아로셀 멜라 TXA 수분 선세럼 SPF50+ PA++++ | anchored pid 8885954154 |
| 32 | 아로셀 멜라 TXA 선세럼 | naver | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 25,000원 @아로셀 — [10% 추가적립] 100만 유튜버 PICK! 아로셀 멜라 트라넥스 선  [anchor] | 40 hits · official 0 (single 0) · closest "[아이돌선세럼/24시간지속] 아로셀 멜라 TXA  |
| 32 | 아로셀 멜라 TXA 선세럼 | oliveyoung | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 25,000원 @올리브영 — [아이돌선세럼/24시간지속] 아로셀 멜라 TXA 선세럼 40ml [OY] | 40 hits · official 1 (single 1) · closest "[아이돌선세럼/24시간지속] 아로셀 멜라 TXA  |
| 33 | 이니스프리 데일리 유브이 톤업 노세범 선크림 | coupang | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 12,490원 — 이니스프리 데일리 유브이 톤업 선크림 핑크 SPF50+ PA++++ | anchored pid 9373986892 |
| 33 | 이니스프리 데일리 유브이 톤업 노세범 선크림 | naver | 🔗 링크만(앵커 미스/OY 미수집) | 🔗 link-only — anchor miss — curated productNo 13155811785 not in 3 qu | 40 hits · official 1 (single 1) · closest "[파데프리_김아영PICK] 이니스프리 데일리 UV |
| 33 | 이니스프리 데일리 유브이 톤업 노세범 선크림 | oliveyoung | 🔗 링크만(앵커 미스/OY 미수집) | 🔗 link-only — no 올리브영 offer found (Tier 3/4) | 40 hits · official 0 (single 0) · closest "[파데프리_김아영PICK] 이니스프리 데일리 UV |
| 34 | 조선미녀 스테이 프레쉬 톤업 선크림 퍼플 | coupang | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 14,400원 — 조선미녀 스테이 프레쉬 톤업 선크림 퍼플 SPF50+ PA++++ | anchored pid 9544152755 |
| 34 | 조선미녀 스테이 프레쉬 톤업 선크림 퍼플 | naver | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 15,300원 @뷰티오브조선 : 조선미녀 — 조선미녀 스테이프레쉬 톤업 선크림 50ml (퍼플/그린) SPF50+ P [a | 40 hits · official 1 (single 1) · closest "조선미녀 스테이프레쉬 톤업 선크림 50ml (퍼플 |
| 34 | 조선미녀 스테이 프레쉬 톤업 선크림 퍼플 | oliveyoung | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 25,300원 @올리브영 — [쿨링진정/쌀알춘식이스트레스볼] 조선미녀 맑은쌀 선크림 아쿠아프레쉬 50 [OY] | 40 hits · official 0 (single 0) · closest "조선미녀 스테이프레쉬 톤업 선크림 50ml (퍼플 |
| 35 | 넘버즈인 3번 도자기결 톤업베이지 선크림 | coupang | ⚠️ URL 데이터 오류(링크만) | ⛔ data_error | share short-link (no productId) |
| 35 | 넘버즈인 3번 도자기결 톤업베이지 선크림 | naver | 🔗 링크만(앵커 미스/OY 미수집) | 🔗 link-only — anchor miss — curated productNo 5788327291 not in 3 que | 40 hits · official 0 (single 0) · closest "[파데프리] 넘버즈인 3번 도자기결 톤업베이지 선 |
| 35 | 넘버즈인 3번 도자기결 톤업베이지 선크림 | oliveyoung | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 24,900원 @올리브영 — [파데프리] 넘버즈인 3번 도자기결 톤업베이지 선크림 50ml 더블기획  [OY] | 40 hits · official 1 (single 0) · closest "[파데프리] 넘버즈인 3번 도자기결 톤업베이지 선 |
| 50 | 메디큐브 PDRN 핑크 시카 수딩 토너 | naver | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 57,400원 @메디큐브 공식몰 — 메디큐브 PDRN 핑크 시카 수딩 토너 250ml X 2개 [anchor] | 40 hits · official 1 (single 1) · closest "PDRN 핑크 시카 수딩 토너" @메디큐브 id1 |
| 50 | 메디큐브 PDRN 핑크 시카 수딩 토너 | oliveyoung | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 15,000원 @올리브영 — [흔적미백]메디큐브 PDRN 핑크 시카 수딩 토너 250ml [OY] | 40 hits · official 1 (single 1) · closest "PDRN 핑크 시카 수딩 토너" @메디큐브 id1 |
| 69 | 비플레인 녹두 모공 클리어링 라하 토너 | coupang | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 13,800원 — 비플레인 녹두 모공 클리어링 라하 토너 | anchored pid 8431337141 |
| 69 | 비플레인 녹두 모공 클리어링 라하 토너 | naver | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 16,800원 @비플레인 beplain — [모공비움 토너] 비플레인 녹두 모공 클리어링 라하 토너 265ml, 1 [an | 40 hits · official 2 (single 2) · closest "[모공비움 토너] 비플레인 녹두 모공 클리어링 라 |
| 69 | 비플레인 녹두 모공 클리어링 라하 토너 | oliveyoung | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 24,000원 @올리브영 — [1+1/피지케어] 비플레인 녹두 모공 클리어링 라하 토너 265ml 기 [OY] | 40 hits · official 1 (single 0) · closest "[모공비움 토너] 비플레인 녹두 모공 클리어링 라 |
| 70 | 에스네이처 아쿠아 오아시스 토너 | coupang | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 14,880원 — 에스네이처 아쿠아 오아시스 토너 | anchored pid 7093360467 |
| 70 | 에스네이처 아쿠아 오아시스 토너 | naver | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 18,900원 @에스네이처 — 에스네이처 아쿠아 오아시스 토너 300ml [anchor] | 40 hits · official 4 (single 2) · closest "[라운지전용] 에스네이처 아쿠아 오아시스 토너 2 |
| 70 | 에스네이처 아쿠아 오아시스 토너 | oliveyoung | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 18,900원 @올리브영 — [속촉촉 진정토너] 에스네이처 아쿠아 오아시스 토너 300ml 기획 (+ [OY] | 40 hits · official 1 (single 0) · closest "[라운지전용] 에스네이처 아쿠아 오아시스 토너 2 |
| 71 | 인터미션 레스트업 세럼 스킨 | naver | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 51,200원 @인터미션 — [x2더블] 인터미션 레스트업 세럼스킨 200mlX2/ 속보습 수분진정  [anchor] | 40 hits · official 2 (single 1) · closest "인터미션 레스트 업 세럼 스킨" @쿠팡 id1.0 |
| 71 | 인터미션 레스트업 세럼 스킨 | oliveyoung | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 27,200원 @올리브영 — [단독기획]인터미션 레스트업 세럼스킨 290ml [OY] | 40 hits · official 0 (single 0) · closest "인터미션 레스트 업 세럼 스킨" @쿠팡 id1.0 |
| 72 | 이지앤트리 체스트넛 바하 0.9 클리어 토너 | coupang | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 12,900원 — 이즈앤트리 체스트넛 바하 0.9% 클리어 토너 | anchored pid 6764118502 |
| 72 | 이지앤트리 체스트넛 바하 0.9 클리어 토너 | naver | 🔎 데모/오큐레이션 의심(링크만) | 🔗 link-only — anchor miss — curated productNo 12650048480 not in 3 qu | 0 hits · official 0 (single 0) · no individual offers |
| 73 | 에뛰드 순정 약산성 5.5 진정 토너 | coupang | 🔗 링크만(앵커 미스/OY 미수집) | 🔗 link-only — no_offer: Coupang: productId 18359349 not in searc | anchored pid 18359349 |
| 73 | 에뛰드 순정 약산성 5.5 진정 토너 | naver | 🔗 링크만(앵커 미스/OY 미수집) | 🔗 link-only — anchor miss — curated productNo 10516809109 not in 3 qu | 40 hits · official 2 (single 2) · closest "에뛰드 순정 약산성 5.5 진정 토너" @아모레퍼 |
| 74 | 토리든 다이브인 포맨 저분자 히알루론산 올인원 | coupang | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 19,930원 — 토리든 다이브인 포맨 저분자 히알루론산 올인원 | anchored pid 9304294159 |
| 74 | 토리든 다이브인 포맨 저분자 히알루론산 올인원 | naver | 🔗 링크만(앵커 미스/OY 미수집) | 🔗 link-only — anchor miss — curated productNo 11604693319 not in 3 qu | 40 hits · official 2 (single 2) · closest "토리든 다이브인 포맨 저분자 히알루론산 올인원 2 |
| 74 | 토리든 다이브인 포맨 저분자 히알루론산 올인원 | oliveyoung | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 38,000원 @올리브영 — [단독기획] 토리든 다이브인 포맨 저분자 히알루론산 올인원 200g 더블 [OY] | 40 hits · official 1 (single 0) · closest "토리든 다이브인 포맨 저분자 히알루론산 올인원 2 |
| 75 | 코스노리 판테놀 베리어 에멀전 | coupang | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 16,800원 — 코스노리 판테놀 베리어 에멀전, 150ml, 1개 | anchored pid 7892362977 |
| 75 | 코스노리 판테놀 베리어 에멀전 | naver | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 18,000원 @코스노리 — 코스노리 판테놀 베리어 로션 에멀전 150ml, 1개 [anchor] | 40 hits · official 1 (single 1) · closest "코스노리 판테놀 베리어 로션 에멀전 150ml,  |
| 75 | 코스노리 판테놀 베리어 에멀전 | oliveyoung | 🔗 링크만(앵커 미스/OY 미수집) | 🔗 link-only — no 올리브영 offer found (Tier 3/4) | 40 hits · official 0 (single 0) · closest "코스노리 판테놀 베리어 로션 에멀전 150ml,  |
| 76 | 닥터지 레드 블레미쉬 포 맨 진정 올인원 | coupang | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 16,990원 — 닥터지 레드 블레미쉬 포 맨 진정 올인원 | anchored pid 8660511597 |
| 76 | 닥터지 레드 블레미쉬 포 맨 진정 올인원 | naver | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 39,000원 @고운세상 닥터지 — [1+1] 닥터지 레드 블레미쉬 포 맨 진정 올인원 150mL [anchor] | 40 hits · official 2 (single 0) · closest "[1+1+1] 닥터지 레드 블레미쉬 포 맨 진정  |
| 76 | 닥터지 레드 블레미쉬 포 맨 진정 올인원 | oliveyoung | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 31,000원 @올리브영 — [증정 기획] 닥터지 레드 블레미쉬 포 맨 멀티 수딩 토너 200ml 보 [OY] | 40 hits · official 0 (single 0) · closest "[1+1+1] 닥터지 레드 블레미쉬 포 맨 진정  |
| 77 | 피지오겔 레드수딩 AI 로션 | coupang | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 22,410원 — 피지오겔 레드수딩 AI 로션 | anchored pid 6729084280 |
| 77 | 피지오겔 레드수딩 AI 로션 | naver | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 25,900원 @피지오겔 공식몰 — 피지오겔 레드수딩 AI 페이셜 로션 200ml 민감피부장벽 진정 [anchor] | 40 hits · official 0 (single 0) · closest "피지오겔 레드수딩 AI 로션" @쿠팡 id1.00 |
| 77 | 피지오겔 레드수딩 AI 로션 | oliveyoung | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 37,500원 @올리브영 — 피지오겔 레드수딩 AI 진정보습 로션 200ml [OY] | 40 hits · official 0 (single 0) · closest "피지오겔 레드수딩 AI 로션" @쿠팡 id1.00 |
| 78 | 온그리디언츠 스킨 베리어 카밍 로션 | naver | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 24,900원 @온그리디언츠 — [속광로션] 온그리디언츠 스킨 베리어 카밍 로션 이엑스 220ml, 1개 [anchor] | 40 hits · official 3 (single 1) · closest "[속광로션] 온그리디언츠 스킨 베리어 카밍 로션  |
| 78 | 온그리디언츠 스킨 베리어 카밍 로션 | oliveyoung | 🔗 링크만(앵커 미스/OY 미수집) | 🔗 link-only — no 올리브영 offer found (Tier 3/4) | 40 hits · official 0 (single 0) · closest "[속광로션] 온그리디언츠 스킨 베리어 카밍 로션  |
| 79 | 듀이트리 AC 딥 장벽 진정 앰플 | coupang | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 14,800원 — 듀이트리 AC 딥 장벽 진정 앰플 | anchored pid 8431559881 |
| 79 | 듀이트리 AC 딥 장벽 진정 앰플 | naver | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 18,900원 @듀이트리 — [듀이트리] AC 딥 장벽 진정 보습 앰플 60ml [anchor] | 40 hits · official 1 (single 1) · closest "듀이트리 AC 딥 모이스처 장벽 진정 앰플 60m |
| 79 | 듀이트리 AC 딥 장벽 진정 앰플 | oliveyoung | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 22,400원 @올리브영 — [시카PDRN/장벽앰플] 듀이트리 AC 딥 장벽 진정 보습 앰플 60ml [OY] | 40 hits · official 1 (single 0) · closest "듀이트리 AC 딥 모이스처 장벽 진정 앰플 60m |
| 80 | 코스알엑스 더 알파 알부틴 2 디스컬러레이션 케어 세럼 | coupang | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 17,340원 — 코스알엑스 더 알파 알부틴 2 디스컬러레이션 케어 세럼 | anchored pid 8318643689 |
| 80 | 코스알엑스 더 알파 알부틴 2 디스컬러레이션 케어 세럼 | naver | 🔗 링크만(앵커 미스/OY 미수집) | 🔗 link-only — anchor miss — curated productNo 10796508170 not in 3 qu | 40 hits · official 2 (single 2) · closest "[코스알엑스] 더 알파-알부틴 2 디스컬러레이션  |
| 80 | 코스알엑스 더 알파 알부틴 2 디스컬러레이션 케어 세럼 | oliveyoung | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 19,500원 @올리브영 — [흔적케어] 코스알엑스 더 알파 - 알부틴 세럼 50ml (펩타이드세럼  [OY] | 40 hits · official 0 (single 0) · closest "[코스알엑스] 더 알파-알부틴 2 디스컬러레이션  |
| 81 | 에스트라 에이시카 365 세럼 pH 4.5 | coupang | 🔗 링크만(앵커 미스/OY 미수집) | 🔗 link-only — no_offer: Coupang: productId 9392392732 not in sea | anchored pid 9392392732 |
| 81 | 에스트라 에이시카 365 세럼 pH 4.5 | naver | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 32,300원 @에스트라 — [싱글] 에스트라 에이시카365 흔적진정세럼 pH4.5 40ml x 1개 [anchor] | 40 hits · official 3 (single 0) · closest "[더블 세트] 에스트라 에이시카365 흔적진정세럼 |
| 81 | 에스트라 에이시카 365 세럼 pH 4.5 | oliveyoung | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 32,300원 @올리브영 — 에스트라 에이시카365 흔적진정세럼 pH4.5 40ml [OY] | 40 hits · official 2 (single 1) · closest "[더블 세트] 에스트라 에이시카365 흔적진정세럼 |
| 82 | 아벤느 히알루론 액티브 B3 안티에이징 세럼  | coupang | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 27,590원 — 아벤느 안티에이징 HAB3 탄력 액티브 세럼 | anchored pid 8306356651 |
| 82 | 아벤느 히알루론 액티브 B3 안티에이징 세럼  | naver | 🔬 검수 필요(이종세트/모호 OY) | 🔬 inspection — id-anchored to curated SKU (productNo 10698667363) but | 40 hits · official 2 (single 1) · closest "아벤느 아벤느 히알루론 액티브 B3 안티에이징 세 |
| 82 | 아벤느 히알루론 액티브 B3 안티에이징 세럼  | oliveyoung | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 55,000원 @올리브영 — [모공앰플] 아벤느 HAB3 탄력 액티브 안티에이징 세럼 30ml (기획 [OY] | 40 hits · official 0 (single 0) · closest "아벤느 아벤느 히알루론 액티브 B3 안티에이징 세 |
| 83 | 퍼셀 880억/mL 글루타치온 플렉서블 리포좀 | naver | 🔗 링크만(앵커 미스/OY 미수집) | 🔗 link-only — anchor miss — curated productNo 13000644987 not in 2 qu | 40 hits · official 2 (single 2) · closest "[대용량][투명미백] 880억/mL 글루타치온 플 |
| 83 | 퍼셀 880억/mL 글루타치온 플렉서블 리포좀 | oliveyoung | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 22,000원 @올리브영 — [잡티톤업] 퍼셀 880억/mL 글루타치온 플렉서블 리포좀 톤업앰플 20 [OY] | 40 hits · official 0 (single 0) · closest "[대용량][투명미백] 880억/mL 글루타치온 플 |
| 84 | 랑콤 제니피끄 얼티미트 세럼 | coupang | 🔗 링크만(앵커 미스/OY 미수집) | 🔗 link-only — no_offer: Coupang: productId 8464853636 not in sea | anchored pid 8464853636 |
| 84 | 랑콤 제니피끄 얼티미트 세럼 | naver | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 282,200원 @랑콤 — [6월] 제니피끄 세럼 115ml 세트 (+토너 100ml, 세럼 21m [anchor] | 40 hits · official 0 (single 0) · closest "랑콤 제니피끄 세럼 얼티미트, 115ml, 1개" |
| 84 | 랑콤 제니피끄 얼티미트 세럼 | oliveyoung | 🔗 링크만(앵커 미스/OY 미수집) | 🔗 link-only — no 올리브영 offer found (Tier 3/4) | 40 hits · official 0 (single 0) · closest "랑콤 제니피끄 세럼 얼티미트, 115ml, 1개" |
| 85 | 유세린 하이아르론 에피셀린 세럼 | naver | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 60,900원 @유세린공식스토어 — 유세린 하이알루론 에피셀린 세럼 30ml [anchor] | 40 hits · official 2 (single 0) · closest "유세린 하이알루론 에피셀린 세럼 30ml 더블팩" |
| 85 | 유세린 하이아르론 에피셀린 세럼 | oliveyoung | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 39,900원 @올리브영 — [1등 세럼] 유세린 하이알루론 에피셀린 세럼 30ml 기획 (+에피셀린 [OY] | 40 hits · official 1 (single 0) · closest "유세린 하이알루론 에피셀린 세럼 30ml 더블팩" |
| 86 | 바이오힐보 엔에이디 프리즈셀 글로우 파워 세럼 | naver | 🔗 링크만(앵커 미스/OY 미수집) | 🔗 link-only — anchor miss — curated productNo 12443904908 not in 3 qu | 40 hits · official 1 (single 0) · closest "바이오힐보 엔에이디 프리즈셀 글로우 파워 세럼 3 |
| 86 | 바이오힐보 엔에이디 프리즈셀 글로우 파워 세럼 | oliveyoung | 🔬 검수 필요(이종세트/모호 OY) | 🔬 inspection — 올리브영 offer is a heterogeneous set — inspection/manual | 40 hits · official 2 (single 1) · closest "바이오힐보 엔에이디 프리즈셀 글로우 파워 세럼 3 |
| 87 | 라운드랩 자작나무 수분 클렌저 | coupang | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 15,500원 — 라운드랩 자작나무 수분 클렌저 | anchored pid 9558253617 |
| 87 | 라운드랩 자작나무 수분 클렌저 | naver | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 28,900원 @라운드랩 — [슈퍼적립 10%] 라운드랩 자작나무 수분 클렌저 150ml 3개 세트  [anchor] | 40 hits · official 1 (single 0) · closest "[수분촉촉] 라운드랩 자작나무 수분 클렌저 150 |
| 87 | 라운드랩 자작나무 수분 클렌저 | oliveyoung | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 12,900원 @올리브영 — [수분촉촉] 라운드랩 자작나무 수분 클렌저 150ml 기획 (+20ml) [OY] | 40 hits · official 1 (single 0) · closest "[수분촉촉] 라운드랩 자작나무 수분 클렌저 150 |
| 88 | 몰바니 저자극 LHA 율피 젤 클렌저 | naver | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 28,000원 @몰바니 — 몰바니 율피 저자극 LHA 클렌징젤 200ml [anchor] | 40 hits · official 0 (single 0) · closest "몰바니 저자극 LHA 율피 젤 클렌저 200ml+ |
| 88 | 몰바니 저자극 LHA 율피 젤 클렌저 | oliveyoung | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 18,900원 @올리브영 — 몰바니 저자극 LHA 율피 젤 클렌저 200ml [OY] | 40 hits · official 1 (single 1) · closest "몰바니 저자극 LHA 율피 젤 클렌저 200ml+ |
| 89 | 니들리 마일드 효소 클렌징 파우더 | naver | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 17,950원 @니들리 NEEDLY — 니들리 마일드 효소 클렌징 파우더 60g [anchor] | 40 hits · official 2 (single 2) · closest "니들리 마일드 효소 클렌징 파우더 60g" @니들 |
| 89 | 니들리 마일드 효소 클렌징 파우더 | oliveyoung | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 15,120원 @올리브영 — 니들리 마일드 효소 클렌징 파우더 60g [OY] | 40 hits · official 1 (single 1) · closest "니들리 마일드 효소 클렌징 파우더 60g" @니들 |
| 90 | 브링그린 티트리 시카 딥 클렌징폼 | naver | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 11,200원 @브링그린 — 브링그린 티트리 시카 딥 클렌징폼 120ml, 2개 [anchor] | 40 hits · official 2 (single 1) · closest "[고밀도효소거품] 브링그린 티트리 시카 딥클렌징폼 |
| 90 | 브링그린 티트리 시카 딥 클렌징폼 | oliveyoung | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 10,500원 @올리브영 — [고밀도효소거품] 브링그린 티트리 시카 딥클렌징폼 기획 (더블/대용량) [OY] | 40 hits · official 1 (single 1) · closest "[고밀도효소거품] 브링그린 티트리 시카 딥클렌징폼 |
| 91 | 일리윤 젠틀 딥 페이셜 클렌저 | coupang | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 16,600원 — 일리윤 젠틀 딥 페이셜 클렌저 | anchored pid 8688664449 |
| 91 | 일리윤 젠틀 딥 페이셜 클렌저 | naver | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 17,600원 @아모레퍼시픽몰 헤어바디 — 일리윤 젠틀 딥 민감 피부 페이셜 클렌저 250ml [anchor] | 40 hits · official 1 (single 1) · closest "일리윤 젠틀 딥 페이셜 클렌저" @아모레퍼시픽공식 |
| 91 | 일리윤 젠틀 딥 페이셜 클렌저 | oliveyoung | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 16,800원 @올리브영 — [여행용 단독증정/저자극 촉촉] 일리윤 젠틀 딥 페이셜 클렌저 기획(25 [OY] | 40 hits · official 1 (single 0) · closest "일리윤 젠틀 딥 페이셜 클렌저" @아모레퍼시픽공식 |
| 92 | 블라이드 버블링 스플래쉬 마스크 인디언 그레이셜 머드 | coupang | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 21,000원 — 블라이드 얼음모공팩 인디언 머드팩투폼 클렌징폼 120ml, 클레이팩 모공 | anchored pid 8091623533 |
| 92 | 블라이드 버블링 스플래쉬 마스크 인디언 그레이셜 머드 | naver | 🔗 링크만(앵커 미스/OY 미수집) | 🔗 link-only — anchor miss — curated productNo 4777507234 not in 3 que | 5 hits · official 1 (single 1) · closest "머드팩투폼블라이드 버블링 스플래쉬 마스크 인디언 그 |
| 92 | 블라이드 버블링 스플래쉬 마스크 인디언 그레이셜 머드 | oliveyoung | 🔬 검수 필요(이종세트/모호 OY) | 🔬 inspection — 올리브영 offer(s) found but none confidently matched (best | 5 hits · official 0 (single 0) · closest "머드팩투폼블라이드 버블링 스플래쉬 마스크 인디언 그 |
| 93 | 랑콤 스킨 이돌 3 세럼 파인 커버 | coupang | 🔗 링크만(앵커 미스/OY 미수집) | 🔗 link-only — no_offer: Coupang: productId 9553155211 not in sea | anchored pid 9553155211 |
| 93 | 랑콤 스킨 이돌 3 세럼 파인 커버 | oliveyoung | 🔗 링크만(앵커 미스/OY 미수집) | 🔗 link-only — no 올리브영 offer found (Tier 3/4) | 38 hits · official 0 (single 0) · closest "랑콤 스킨 이돌 3 세럼 파인커버 쿠션 P10 1 |
| 94 | 아이소이 스킨케어 비건 쿠션 | coupang | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 35,900원 — 아이소이 스킨케어 비건 쿠션 21호(본품+리필) | anchored pid 8594202854 |
| 94 | 아이소이 스킨케어 비건 쿠션 | naver | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 40,800원 @아이소이 공식스토어 — [아이소이] 스킨케어 비건 쿠션 SPF38 PA++ 21호 (본품13g+ [anch | 40 hits · official 3 (single 1) · closest "[N단독/3개] 아이소이 스킨케어 비건 제로 쿠션 |
| 95 | 아르마니 루미너스 실크 프리마 글로우 쿠션 | naver | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 113,050원 @아르마니 뷰티 — [아르마니 뷰티][리필위크] NEW 루미너스 실크 프리마 글로우 쿠션 1 [anchor | 40 hits · official 9 (single 0) · closest "[아르마니 뷰티][리필위크] NEW 루미너스 실크 |
| 96 | 파넬 시카마누 세럼쿠션 | naver | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 22,000원 @파넬 공식스토어 — 파넬 시카마누 세럼쿠션 SPF45 PA++ 본품, 21호, 15g [anchor] | 40 hits · official 16 (single 5) · closest "파넬 시카마누 세럼쿠션 SPF45 PA++ 본품 |
| 96 | 파넬 시카마누 세럼쿠션 | oliveyoung | 🔗 링크만(앵커 미스/OY 미수집) | 🔗 link-only — no 올리브영 offer found (Tier 3/4) | 40 hits · official 0 (single 0) · closest "파넬 시카마누 세럼쿠션 SPF45 PA++ 본품, |
| 97 | 에스쁘아 비 벨벳 커버 쿠션 | coupang | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 23,100원 (×2 개당가) — 에스쁘아 비벨벳 커버 쿠션 13g + 퍼프 2p 세트 | anchored pid 9302781585 |
| 97 | 에스쁘아 비 벨벳 커버 쿠션 | naver | 🔗 링크만(앵커 미스/OY 미수집) | 🔗 link-only — anchor miss — curated productNo 6354332173 not in 3 que | 40 hits · official 7 (single 1) · closest "에스쁘아 NEW 비벨벳 커버 쿠션 리필 SPF42 |
| 97 | 에스쁘아 비 벨벳 커버 쿠션 | oliveyoung | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 31,900원 @올리브영 — [100시간 지속/고커버] 에스쁘아 비벨벳 커버쿠션 SPF42 PA++  [OY] | 40 hits · official 1 (single 0) · closest "에스쁘아 NEW 비벨벳 커버 쿠션 리필 SPF42 |
| 98 | VDL 커버스테인 하이커버 쿠션 | coupang | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 30,780원 — 브이디엘 커버 스테인 하이커버 쿠션 | anchored pid 9216167170 |
| 98 | VDL 커버스테인 하이커버 쿠션 | naver | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 32,400원 @VDL 공식플래그십 스토어 — VDL 커버스테인 하이커버 쿠션 13g (SPF35/ PA++) [ancho | 40 hits · official 2 (single 0) · closest "VDL 커버스테인 하이커버 쿠션 (본품 +리필)  |
| 98 | VDL 커버스테인 하이커버 쿠션 | oliveyoung | 🔗 링크만(앵커 미스/OY 미수집) | 🔗 link-only — no 올리브영 offer found (Tier 3/4) | 40 hits · official 0 (single 0) · closest "VDL 커버스테인 하이커버 쿠션 (본품 +리필)  |
| 99 | 미샤 래디언스 퍼펙트핏 쿠션 | coupang | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 10,450원 — 미샤 래디언스 퍼펙트핏 쿠션 15g | anchored pid 1665858959 |
| 256 | 닥터지 레드 블레미쉬 수딩 업 선 스틱 | coupang | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 19,000원 — 닥터지 레드 블레미쉬 수딩 업 선스틱 듀오 세트 SPF50+ PA++++ | anchored pid 7975902054 |
| 256 | 닥터지 레드 블레미쉬 수딩 업 선 스틱 | naver | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 28,500원 @고운세상 닥터지 — [1+1] 닥터지 레드 블레미쉬 수딩 업 선 스틱 21g (SPF50+/ [anchor | 40 hits · official 1 (single 0) · closest "닥터지 레드 블레미쉬 수딩 업 선스틱 듀오 세트  |
| 257 | 이즈앤트리 어니언 프레쉬 라이트 선스틱 | coupang | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 9,070원 — 이즈앤트리 어니언 프레쉬 라이트 선스틱 SPF50+ PA++++ | anchored pid 7982068790 |
| 257 | 이즈앤트리 어니언 프레쉬 라이트 선스틱 | naver | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 29,900원 @이즈앤트리 — [더블구성] 이즈앤트리 어니언 프레쉬 라이트 선스틱 22g SFP50 P [anchor] | 40 hits · official 0 (single 0) · closest "이즈앤트리 어니언 프레쉬 라이트 선스틱 SPF50 |
| 258 | 유이크 바이옴 레미디 퍼펙트 보송 선스틱 | coupang | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 19,630원 — 유이크 바이옴 레미디 퍼펙트 보송 선스틱 | anchored pid 8012195103 |
| 258 | 유이크 바이옴 레미디 퍼펙트 보송 선스틱 | naver | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 19,200원 @UIQ 유이크 — 유이크 바이옴 레미디 퍼펙트 보송 선스틱 18g [anchor] | 40 hits · official 5 (single 3) · closest "유이크 바이옴 레미디 퍼펙트 보송 선스틱 18g" |
| 261 | 몽디에스 선쿠션 | coupang | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 35,000원 — 몽디에스 아기 유아 어린이 징크 논나노 무기자차 쿨링 선쿠션 SPF50+ | anchored pid 9459679505 |
| 261 | 몽디에스 선쿠션 | naver | ✅ 가격 수집(앵커 단품/묶음·OY·쿠팡) | ✅ 31,500원 @몽디에스 — 1+1 몽디에스 쿨링 징크 무기자차 논나노 아기 유아 초등학생 키즈 백탁 [anchor] | 35 hits · official 2 (single 0) · closest "몽디에스 선쿠션 12g (SPF43) 유아선크림, |

> 정당한 no_offer(세트only/미입점)는 수정 불필요(trust-first 의도). 위 1~5만 시트 정리 대상.
