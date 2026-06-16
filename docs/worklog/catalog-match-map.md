# 전체 카탈로그 매칭 맵 (READ-ONLY 진단)

- **일자**: 2026-06-16
- **매처**: `fix/naver-sku-matching` (실제 함수 호출: matchNaverOffer / pickOfficialOffer / classifyOfferComposition)
- **모드**: READ-ONLY. DB/시트/sync 무변경. 라이브 네이버·쿠팡 검색 API만 사용.
- **대상**: 활성 listing 138건 중 어댑터 보유 104건 진단 (zigzag/ably 34건은 어댑터 없음 → 제외).

## 요약 분포
| 분류 | 건수 |
|---|---|
| ✅ OK 단품(앵커, 가격) | 37 |
| ⚠️ 큐레이션 URL=다중팩/세트 쿠팡(링크만) | 5 |
| ⚠️ 큐레이션 naver URL=세트 앵커(링크만) | 14 |
| 🔎 데모/오큐레이션 의심(링크만) | 2 |
| ⚠️ URL 데이터 오류(링크만) | 1 |
| 🔗 링크만(앵커 미스/OY-무앵커) | 45 |

## anchor-only 정책 적용 결과 (fuzzy 가격매칭 제거)

**보장 확인**
- **가격이 붙은 네이버 listing 15건 = 전부 N-앵커 단품**(fuzzy 가격 0건). matchNaverOffer가 앵커 외 가격 경로를 갖지 않음(코드 보장).
- **멀티쿼리 recall 성공**: 유세린 #85 = 오타명("하이아르론")인데 `유세린 세럼` recall 쿼리로 N(11355567271) 발견 → **60,900 정확 단품** 앵커.

**커버리지 (before=tier1+fuzzy → after=anchor-only)**
| 판매처 OK(가격) | before | after |
|---|---|---|
| coupang | 22 | 22 (영향 없음) |
| naver | 20 | **15** (fuzzy-only 제거; 일부 정상가도 앵커 불가라 링크만) |
| oliveyoung | 12 | **0** (OY는 oy.run→N 없음→링크만; 권장안) |
| **합계 OK** | 54 | **37** |

- **fully link-only(가격 판매처 0)된 제품 16건**: #29 #30 #35 #50 #71 #73 #81 #83 #84 #86 #90 #93 #94 #95 #97 #256. 다수는 **시트 정리로 회복 가능**(아래): naver URL=세트(앵커셋) 또는 coupang URL=팩 → 단품 URL 교체 시 정확 단품가 앵커됨.
- 손실 유형: (a) naver fuzzy-only 정상가(토리든 #74 19,700, 에뛰드 #73 등) — 앵커 불가라 링크만(신뢰 우선, fuzzy로 안 메움). (b) **OY 자동가 전량(12건)** — 권장안(링크만+override) 결과.

**⚠️ 운영자 확인 필요 (OY 트레이드오프, §1d)**
- 권장안대로 OY 자동가를 전부 제거(12→0)했음. 커버리지 영향이 큼(16건 fully link-only에 OY 기여 다수: 메디큐브·인터미션·에스트라·브링그린 등).
- **대안**: OY만 mallName='올리브영' + 엄격 제목매칭 best-effort 유지(오매칭 리스크 일부 수용) → OY 커버리지 회복. → **운영자 결정 요청**(현재는 권장안=링크만 구현 상태).

## 운영자 수정 리스트

### 2. 큐레이션 URL = 다중팩/세트 — 쿠팡 (단품 URL 교체) (5)
- **몽디에스 엑설런트 선크림** [coupang] — 시트 쿠팡 URL을 단품 상품으로 교체(현재 URL=팩/세트)
  - ⚠️ 33,000원 — [6개월 이상 첫 선케어] [1+1] 몽디에스 아기/유아 무기자차 선크림 (plus-combined extra unit (bundle/refill/set))
  - 후보: anchored pid 5529437152
  - url: https://www.coupang.com/vp/products/5529437152?itemId=22473906037&vendorItemId=90228874864&q=%EB%AA%BD%EB%94%94%EC%97%90%EC%8A%A4+%EC%84%A0%ED%81%AC%EB%A6%BC&searchId=7dde4efc12373664&sourceType=search&itemsCount=36&searchRank=0&rank=0&traceId=mqf4682x
- **후시다딘 (동화약품) 더마 트러블 징크 카밍 선크림** [coupang] — 시트 쿠팡 URL을 단품 상품으로 교체(현재 URL=팩/세트)
  - ⚠️ 38,530원 — 후시다인 더마 트러블 징크 카밍 선크림 SPF50+ PA++++, 50m (4-count multipack)
  - 후보: anchored pid 7941544246
  - url: https://coupang.com/vp/products/7941544246?itemId=23256847066&vendorItemId=90775076500&pickType=COU_PICK&q=후시다딘%20더마%20트러블%20징크&searchId=fbfb766613990286&sourceType=search&itemsCount=36&searchRank=0&rank=0&traceId=mqf46rbj
- **닥터지 레드 블레미쉬 수딩 업 선 스틱** [coupang] — 시트 쿠팡 URL을 단품 상품으로 교체(현재 URL=팩/세트)
  - ⚠️ 19,000원 — 닥터지 레드 블레미쉬 수딩 업 선스틱 듀오 세트 SPF50+ PA++++ (set/bundle keyword)
  - 후보: anchored pid 7975902054
  - url: https://www.coupang.com/vp/products/7975902054?itemId=18424406365&vendorItemId=85566203806&pickType=COU_PICK&q=%EB%A0%88%EB%93%9C+%EB%B8%94%EB%A0%88%EB%AF%B8%EC%89%AC+%EC%88%98%EB%94%A9+%EC%97%85+%EC%84%A0+%EC%8A%A4%ED%8B%B1&searchId=8d61789513056984&sourceType=search&itemsCount=36&searchRank=1&rank=1&traceId=mqf6b4jq
- **에스쁘아 비 벨벳 커버 쿠션** [coupang] — 시트 쿠팡 URL을 단품 상품으로 교체(현재 URL=팩/세트)
  - ⚠️ 23,100원 — 에스쁘아 비벨벳 커버 쿠션 13g + 퍼프 2p 세트 (plus-combined extra unit (bundle/refill/set))
  - 후보: anchored pid 9302781585
  - url: https://www.coupang.com/vp/products/9302781585?itemId=27559256105&vendorItemId=91855342559&q=%EB%B9%84+%EB%B2%A8%EB%B2%B3+%EC%BB%A4%EB%B2%84+%EC%BF%A0%EC%85%98&searchId=0b1118c515490176&sourceType=search&itemsCount=36&searchRank=0&rank=0&traceId=mqf4wrtk
- **아이소이 스킨케어 비건 쿠션** [coupang] — 시트 쿠팡 URL을 단품 상품으로 교체(현재 URL=팩/세트)
  - ⚠️ 35,900원 — 아이소이 스킨케어 비건 쿠션 21호(본품+리필) (plus-combined extra unit (bundle/refill/set))
  - 후보: anchored pid 8594202854
  - url: https://www.coupang.com/vp/products/8594202854?itemId=24923149433&vendorItemId=91931021297&q=%EC%8A%A4%ED%82%A8%EC%BC%80%EC%96%B4+%EB%B9%84%EA%B1%B4+%EC%BF%A0%EC%85%98&searchId=1320d671418738&sourceType=search&itemsCount=36&searchRank=0&rank=0&traceId=mqf4ufo9

### 2b. 큐레이션 naver URL = 세트 (앵커가 세트로 떨어짐 — 단품 URL 교체) (14)
- **몽디에스 엑설런트 선크림** [naver] — 시트 naver URL이 세트 페이지 — 단품 상품 URL로 교체
  - ⚠️ anchor=set — id-anchored to curated SKU (productNo 13009860683) but it is a set/multipack (2-count multipack) — curated URL points to a set; excluded
  - 후보: 0 hits · official 0 (single 0) · no individual offers
  - url: https://brand.naver.com/mongdies/products/13009860683
- **닥터지 레드 블레미쉬 수딩 업 선 스틱** [naver] — 시트 naver URL이 세트 페이지 — 단품 상품 URL로 교체
  - ⚠️ anchor=set — id-anchored to curated SKU (productNo 8315952932) but it is a set/multipack (plus-combined extra unit (bundle/refill/set)) — curated URL points to a set; excluded
  - 후보: 40 hits · official 1 (single 0) · closest "닥터지 레드 블레미쉬 수딩 업 선스틱 듀오 세트 SPF50+ PA++" @쿠팡 id1.00
  - url: https://brand.naver.com/dr-g/products/8315952932?n_media=684927&n_query=%EB%A0%88%EB%93%9C%EB%B8%94%EB%A0%88%EB%AF%B8%EC%89%AC%EC%88%98%EB%94%A9%EC%97%85%EC%84%A0%EC%8A%A4%ED%8B%B1&n_rank=2&n_ad_group=grp-a001-02-000000041934514&n_ad=nad-a001-02-000000298194588&n_campaign_type=2&n_mall_id=gwsscosemtic&n_mall_pid=8315952932&n_ad_group_type=2&n_match=3&NaPm=ct%3Dmqf6dujd%7Cci%3DERc1132ce4%2D68b3%2D11f1%2D89b7%2D5a79859463aa%7Ctr%3Dplan%7Chk%3D8c9e7df9cd5e98a9aaea85552dfeab4868279430%7Cnacn%3Dex1ZCIC6PJdZB
- **인터미션 레스트업 세럼 스킨** [naver] — 시트 naver URL이 세트 페이지 — 단품 상품 URL로 교체
  - ⚠️ anchor=set — id-anchored to curated SKU (productNo 5328668155) but it is a set/multipack (×N multiplier) — curated URL points to a set; excluded
  - 후보: 40 hits · official 2 (single 1) · closest "인터미션 레스트 업 세럼 스킨" @쿠팡 id1.00
  - url: https://smartstore.naver.com/intermissiontime/products/5328668155?nl-query=%EB%A0%88%EC%8A%A4%ED%8A%B8%EC%97%85%20%EC%84%B8%EB%9F%BC&nl-au=55c6881a1dfb43e78bad48a37653244e&NaPm=ci%3D55c6881a1dfb43e78bad48a37653244e%7Cct%3Dmqbj5yif%7Ctr%3Dnslsl%7Csn%3D2717958%7Chk%3D2ff99d8a65e88231e79dba6035bd15ee4acd23a5
- **닥터지 레드 블레미쉬 포 맨 진정 올인원** [naver] — 시트 naver URL이 세트 페이지 — 단품 상품 URL로 교체
  - ⚠️ anchor=set — id-anchored to curated SKU (productNo 11602103992) but it is a set/multipack (plus-combined extra unit (bundle/refill/set)) — curated URL points to a set; excluded
  - 후보: 40 hits · official 2 (single 0) · closest "[1+1+1] 닥터지 레드 블레미쉬 포 맨 진정 올인원 150mL" @고운세상 닥터지 id1.00
  - url: https://naver.me/FHOSRzEC
- **아벤느 히알루론 액티브 B3 안티에이징 세럼 ** [naver] — 시트 naver URL이 세트 페이지 — 단품 상품 URL로 교체
  - ⚠️ anchor=set — id-anchored to curated SKU (productNo 10698667363) but it is a set/multipack (plus-combined extra unit (bundle/refill/set)) — curated URL points to a set; excluded
  - 후보: 40 hits · official 2 (single 1) · closest "아벤느 아벤느 히알루론 액티브 B3 안티에이징 세럼 30ml" @G마켓 id1.00
  - url: https://naver.me/G1pzkqHd
- **브링그린 티트리 시카 딥 클렌징폼** [naver] — 시트 naver URL이 세트 페이지 — 단품 상품 URL로 교체
  - ⚠️ anchor=set — id-anchored to curated SKU (productNo 8601837234) but it is a set/multipack (2-count multipack) — curated URL points to a set; excluded
  - 후보: 40 hits · official 2 (single 1) · closest "[고밀도효소거품] 브링그린 티트리 시카 딥클렌징폼 기획 (더블/대용량" @올리브영 id1.00
  - url: https://naver.me/GNJsNVhQ
- **아르마니 루미너스 실크 프리마 글로우 쿠션** [naver] — 시트 naver URL이 세트 페이지 — 단품 상품 URL로 교체
  - ⚠️ anchor=set — id-anchored to curated SKU (productNo 12139954560) but it is a set/multipack (set/bundle keyword) — curated URL points to a set; excluded
  - 후보: 40 hits · official 9 (single 0) · closest "[아르마니 뷰티][리필위크] NEW 루미너스 실크 프리마 글로우 쿠션" @아르마니 뷰티 id1.00
  - url: https://brand.naver.com/armanibeauty/products/12139954560?NaPm=ct%3Dmqcc6w8i%7Cci%3DrBiXqAAAAZ7A%2DSwVAP9c%5Fw%2E%2E01%7Ctr%3Dpmax%7Chk%3D573fce30bfb99f963acd9e99b81006b7fd19dda3%7Cnacn%3Dex1ZCIC6PJdZB
- **몽디에스 선쿠션** [naver] — 시트 naver URL이 세트 페이지 — 단품 상품 URL로 교체
  - ⚠️ anchor=set — id-anchored to curated SKU (productNo 6069991995) but it is a set/multipack (plus-combined extra unit (bundle/refill/set)) — curated URL points to a set; excluded
  - 후보: 35 hits · official 2 (single 0) · closest "몽디에스 선쿠션 12g (SPF43) 유아선크림, 텐바이텐" @10x10 id1.00
  - url: https://brand.naver.com/mongdies/products/6069991995?NaPm=ct%3Dmqf6gfhh%7Cci%3DER08dfe99c%2D68b4%2D11f1%2Db0bf%2D0eb0cfea6841%7Ctr%3Dplan%7Chk%3D789ad50386a2d6c506b457b381764221e3a6b05b%7Cnacn%3Dex1ZCIC6PJdZB
- **랑콤 제니피끄 얼티미트 세럼** [naver] — 시트 naver URL이 세트 페이지 — 단품 상품 URL로 교체
  - ⚠️ anchor=set — id-anchored to curated SKU (productNo 10791745136) but it is a set/multipack (plus-combined extra unit (bundle/refill/set)) — curated URL points to a set; excluded
  - 후보: 40 hits · official 0 (single 0) · closest "랑콤 제니피끄 세럼 얼티미트, 115ml, 1개" @칵테일뷰티 id1.00
  - url: https://brand.naver.com/lancome/products/10791745136?nl-query=%EC%A0%9C%EB%8B%88%ED%94%BC%EB%81%84%20%EC%96%BC%ED%8B%B0%EB%AF%B8%ED%8A%B8%20%EC%84%B8%EB%9F%BC&nl-au=365c8460e236442fbefdb82a417242cb&NaPm=ci%3D365c8460e236442fbefdb82a417242cb%7Cct%3Dmqcbzcmu%7Ctr%3Dnslctg%7Csn%3D1309812%7Chk%3D7e3b2cb898c83d0555163d77aaff0adcd076b1ac
- **에스트라 에이시카 365 세럼 pH 4.5** [naver] — 시트 naver URL이 세트 페이지 — 단품 상품 URL로 교체
  - ⚠️ anchor=set — id-anchored to curated SKU (productNo 11715934703) but it is a set/multipack (×N multiplier) — curated URL points to a set; excluded
  - 후보: 40 hits · official 3 (single 0) · closest "[더블 세트] 에스트라 에이시카365 흔적진정세럼 pH4.5 40ml" @에스트라 id1.00
  - url: https://brand.naver.com/aestura365/products/11715934703?n_media=684927&n_query=%EC%97%90%EC%9D%B4%EC%8B%9C%EC%B9%B4365%EC%84%B8%EB%9F%BCPH4.5&n_rank=1&n_ad_group=grp-a001-02-000000065525279&n_ad=nad-a001-02-000000511915186&n_campaign_type=2&n_mall_id=ncp_1nuq05_01&n_mall_pid=11715934703&n_ad_group_type=2&n_match=3&NaPm=ct%3Dmqcbypqd%7Cci%3DER390d5fe7%2D6723%2D11f1%2Dbf4f%2D1e00a08223ef%7Ctr%3Dplan%7Chk%3Dde6806c2d9dd9d4ad2e79722a0ab9ac9eb8863ee%7Cnacn%3Dex1ZCIC6PJdZB
- **이즈앤트리 어니언 프레쉬 라이트 선스틱** [naver] — 시트 naver URL이 세트 페이지 — 단품 상품 URL로 교체
  - ⚠️ anchor=set — id-anchored to curated SKU (productNo 9988052762) but it is a set/multipack (2-count multipack) — curated URL points to a set; excluded
  - 후보: 40 hits · official 0 (single 0) · closest "이즈앤트리 어니언 프레쉬 라이트 선스틱 SPF50+ PA++++" @쿠팡 id1.00
  - url: https://brand.naver.com/isntree/products/9988052762?nl-query=%EC%96%B4%EB%8B%88%EC%96%B8%20%ED%94%84%EB%A0%88%EC%89%AC%20%EB%9D%BC%EC%9D%B4%ED%8A%B8%20%EC%84%A0%EC%8A%A4%ED%8B%B1&nl-au=1d4b2943060440c3961eca16e66d5cdf&NaPm=ci%3D1d4b2943060440c3961eca16e66d5cdf%7Cct%3Dmqf6efc8%7Ctr%3Dnslctg%7Csn%3D158772%7Chk%3D60a824f83cb1db4b2f0742e1ddc773f0c349f784
- **아이소이 스킨케어 비건 쿠션** [naver] — 시트 naver URL이 세트 페이지 — 단품 상품 URL로 교체
  - ⚠️ anchor=set — id-anchored to curated SKU (productNo 7899595094) but it is a set/multipack (plus-combined extra unit (bundle/refill/set)) — curated URL points to a set; excluded
  - 후보: 40 hits · official 3 (single 1) · closest "[N단독/3개] 아이소이 스킨케어 비건 제로 쿠션 리필 SPF38 P" @아이소이 공식스토어 id1.00
  - url: https://brand.naver.com/isoi/products/7899595094?nl-query=%EC%8A%A4%ED%82%A8%EC%BC%80%EC%96%B4%20%EB%B9%84%EA%B1%B4%20%EC%BF%A0%EC%85%98&nl-au=941430015ddb4e48ae3e828ce1540f12&NaPm=ci%3D941430015ddb4e48ae3e828ce1540f12%7Cct%3Dmqcc6abw%7Ctr%3Dnslcrm%7Csn%3D204434%7Chk%3Dbdc782dfab7daff808de7dfaa3ba14f932fbaeeb
- **라운드랩 자작나무 수분 클렌저** [naver] — 시트 naver URL이 세트 페이지 — 단품 상품 URL로 교체
  - ⚠️ anchor=set — id-anchored to curated SKU (productNo 11378409511) but it is a set/multipack (plus-combined extra unit (bundle/refill/set)) — curated URL points to a set; excluded
  - 후보: 40 hits · official 1 (single 0) · closest "[수분촉촉] 라운드랩 자작나무 수분 클렌저 150ml 기획 (+20m" @올리브영 id1.00
  - url: https://brand.naver.com/roundlab/products/11378409511?n_media=684927&n_query=%EC%9E%90%EC%9E%91%EB%82%98%EB%AC%B4%EC%88%98%EB%B6%84%ED%81%B4%EB%A0%8C%EC%A0%80&n_rank=1&n_ad_group=grp-a001-02-000000028975122&n_ad=nad-a001-02-000000417356472&n_campaign_type=2&n_mall_id=rueen&n_mall_pid=11378409511&n_ad_group_type=2&n_match=3&NaPm=ct%3Dmqcc1xsn%7Cci%3DER92b55675%2D6723%2D11f1%2Db7d7%2De6ec96a37452%7Ctr%3Dplan%7Chk%3D72103cfc91204a671cf9e5ef8005a92270ce2d2f%7Cnacn%3Dex1ZCIC6PJdZB
- **메디큐브 PDRN 핑크 시카 수딩 토너** [naver] — 시트 naver URL이 세트 페이지 — 단품 상품 URL로 교체
  - ⚠️ anchor=set — id-anchored to curated SKU (productNo 11488401506) but it is a set/multipack (×N multiplier) — curated URL points to a set; excluded
  - 후보: 40 hits · official 1 (single 1) · closest "PDRN 핑크 시카 수딩 토너" @메디큐브 id1.00
  - url: https://brand.naver.com/medicube/products/11488401506?n_media=684927&n_query=%EB%A9%94%EB%94%94%ED%81%90%EB%B8%8CPDRN%ED%95%91%ED%81%AC%ED%86%A0%EB%84%88&n_rank=1&n_ad_group=grp-a001-02-000000046839202&n_ad=nad-a001-02-000000361815636&n_campaign_type=2&n_mall_id=ncp_1o919d_01&n_mall_pid=11488401506&n_ad_group_type=2&n_match=3&NaPm=ct%3Dmqbizoan%7Cci%3DEReb01957f%2D66b1%2D11f1%2Dacfb%2D5e8cdf8985c9%7Ctr%3Dplan%7Chk%3D27c15cf45c54d9a7b397443497ceb10811f5a57b%7Cnacn%3Dex1ZCIC6PJdZB

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
| 29 | 몽디에스 엑설런트 선크림 | coupang | ⚠️ 큐레이션 URL=다중팩/세트 쿠팡(링크만) | ⚠️ 33,000원 — [6개월 이상 첫 선케어] [1+1] 몽디에스 아기/유아 무기자차 선크림 (plus-combined e | anchored pid 5529437152 |
| 29 | 몽디에스 엑설런트 선크림 | naver | ⚠️ 큐레이션 naver URL=세트 앵커(링크만) | ⚠️ anchor=set — id-anchored to curated SKU (productNo 13009860683) but | 0 hits · official 0 (single 0) · no individual offers |
| 30 | 후시다딘 (동화약품) 더마 트러블 징크 카밍 선크림 | coupang | ⚠️ 큐레이션 URL=다중팩/세트 쿠팡(링크만) | ⚠️ 38,530원 — 후시다인 더마 트러블 징크 카밍 선크림 SPF50+ PA++++, 50m (4-count multipa | anchored pid 7941544246 |
| 30 | 후시다딘 (동화약품) 더마 트러블 징크 카밍 선크림 | naver | 🔎 데모/오큐레이션 의심(링크만) | 🔗 link-only — anchor miss — curated productNo 9999261730 not in 3 que | 0 hits · official 0 (single 0) · no individual offers |
| 31 | 스타라이크 피디알엔 스킨핏 수분 선크림 | coupang | ✅ OK 단품(앵커, 가격) | ✅ 16,760원 — 스타라이크 피디알엔 스킨 핏 수분 선 크림 SPF 50+ PA++++ | anchored pid 8745247214 |
| 31 | 스타라이크 피디알엔 스킨핏 수분 선크림 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 0 (single 0) · closest "스타라이크 피디알엔 스킨 핏 수분 선 크림 50m |
| 32 | 아로셀 멜라 TXA 선세럼 | coupang | ✅ OK 단품(앵커, 가격) | ✅ 19,700원 — 아로셀 멜라 TXA 수분 선세럼 SPF50+ PA++++ | anchored pid 8885954154 |
| 32 | 아로셀 멜라 TXA 선세럼 | naver | ✅ OK 단품(앵커, 가격) | ✅ 25,000원 @아로셀 — [10% 추가적립] 100만 유튜버 PICK! 아로셀 멜라 트라넥스 선  [anchor] | 40 hits · official 0 (single 0) · closest "[아이돌선세럼/24시간지속] 아로셀 멜라 TXA  |
| 32 | 아로셀 멜라 TXA 선세럼 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 1 (single 1) · closest "[아이돌선세럼/24시간지속] 아로셀 멜라 TXA  |
| 33 | 이니스프리 데일리 유브이 톤업 노세범 선크림 | coupang | ✅ OK 단품(앵커, 가격) | ✅ 12,490원 — 이니스프리 데일리 유브이 톤업 선크림 핑크 SPF50+ PA++++ | anchored pid 9373986892 |
| 33 | 이니스프리 데일리 유브이 톤업 노세범 선크림 | naver | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — anchor miss — curated productNo 13155811785 not in 3 qu | 40 hits · official 1 (single 1) · closest "[파데프리_김아영PICK] 이니스프리 데일리 UV |
| 33 | 이니스프리 데일리 유브이 톤업 노세범 선크림 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 0 (single 0) · closest "[파데프리_김아영PICK] 이니스프리 데일리 UV |
| 34 | 조선미녀 스테이 프레쉬 톤업 선크림 퍼플 | coupang | ✅ OK 단품(앵커, 가격) | ✅ 14,400원 — 조선미녀 스테이 프레쉬 톤업 선크림 퍼플 SPF50+ PA++++ | anchored pid 9544152755 |
| 34 | 조선미녀 스테이 프레쉬 톤업 선크림 퍼플 | naver | ✅ OK 단품(앵커, 가격) | ✅ 15,300원 @뷰티오브조선 : 조선미녀 — 조선미녀 스테이프레쉬 톤업 선크림 50ml (퍼플/그린) SPF50+ P [a | 40 hits · official 1 (single 1) · closest "조선미녀 스테이프레쉬 톤업 선크림 50ml (퍼플 |
| 34 | 조선미녀 스테이 프레쉬 톤업 선크림 퍼플 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 0 (single 0) · closest "조선미녀 스테이프레쉬 톤업 선크림 50ml (퍼플 |
| 35 | 넘버즈인 3번 도자기결 톤업베이지 선크림 | coupang | ⚠️ URL 데이터 오류(링크만) | ⛔ data_error | share short-link (no productId) |
| 35 | 넘버즈인 3번 도자기결 톤업베이지 선크림 | naver | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — anchor miss — curated productNo 5788327291 not in 3 que | 40 hits · official 0 (single 0) · closest "[파데프리] 넘버즈인 3번 도자기결 톤업베이지 선 |
| 35 | 넘버즈인 3번 도자기결 톤업베이지 선크림 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 1 (single 0) · closest "[파데프리] 넘버즈인 3번 도자기결 톤업베이지 선 |
| 50 | 메디큐브 PDRN 핑크 시카 수딩 토너 | naver | ⚠️ 큐레이션 naver URL=세트 앵커(링크만) | ⚠️ anchor=set — id-anchored to curated SKU (productNo 11488401506) but | 40 hits · official 1 (single 1) · closest "PDRN 핑크 시카 수딩 토너" @메디큐브 id1 |
| 50 | 메디큐브 PDRN 핑크 시카 수딩 토너 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 1 (single 1) · closest "PDRN 핑크 시카 수딩 토너" @메디큐브 id1 |
| 69 | 비플레인 녹두 모공 클리어링 라하 토너 | coupang | ✅ OK 단품(앵커, 가격) | ✅ 13,800원 — 비플레인 녹두 모공 클리어링 라하 토너 | anchored pid 8431337141 |
| 69 | 비플레인 녹두 모공 클리어링 라하 토너 | naver | ✅ OK 단품(앵커, 가격) | ✅ 16,800원 @비플레인 beplain — [모공비움 토너] 비플레인 녹두 모공 클리어링 라하 토너 265ml, 1 [an | 40 hits · official 2 (single 2) · closest "[모공비움 토너] 비플레인 녹두 모공 클리어링 라 |
| 69 | 비플레인 녹두 모공 클리어링 라하 토너 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 1 (single 0) · closest "[모공비움 토너] 비플레인 녹두 모공 클리어링 라 |
| 70 | 에스네이처 아쿠아 오아시스 토너 | coupang | ✅ OK 단품(앵커, 가격) | ✅ 14,880원 — 에스네이처 아쿠아 오아시스 토너 | anchored pid 7093360467 |
| 70 | 에스네이처 아쿠아 오아시스 토너 | naver | ✅ OK 단품(앵커, 가격) | ✅ 18,900원 @에스네이처 — 에스네이처 아쿠아 오아시스 토너 300ml [anchor] | 40 hits · official 4 (single 2) · closest "[라운지전용] 에스네이처 아쿠아 오아시스 토너 2 |
| 70 | 에스네이처 아쿠아 오아시스 토너 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 1 (single 0) · closest "[라운지전용] 에스네이처 아쿠아 오아시스 토너 2 |
| 71 | 인터미션 레스트업 세럼 스킨 | naver | ⚠️ 큐레이션 naver URL=세트 앵커(링크만) | ⚠️ anchor=set — id-anchored to curated SKU (productNo 5328668155) but  | 40 hits · official 2 (single 1) · closest "인터미션 레스트 업 세럼 스킨" @쿠팡 id1.0 |
| 71 | 인터미션 레스트업 세럼 스킨 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 0 (single 0) · closest "인터미션 레스트 업 세럼 스킨" @쿠팡 id1.0 |
| 72 | 이지앤트리 체스트넛 바하 0.9 클리어 토너 | coupang | ✅ OK 단품(앵커, 가격) | ✅ 12,900원 — 이즈앤트리 체스트넛 바하 0.9% 클리어 토너 | anchored pid 6764118502 |
| 72 | 이지앤트리 체스트넛 바하 0.9 클리어 토너 | naver | 🔎 데모/오큐레이션 의심(링크만) | 🔗 link-only — anchor miss — curated productNo 12650048480 not in 3 qu | 0 hits · official 0 (single 0) · no individual offers |
| 73 | 에뛰드 순정 약산성 5.5 진정 토너 | coupang | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no_offer: Coupang: productId 18359349 not in searc | anchored pid 18359349 |
| 73 | 에뛰드 순정 약산성 5.5 진정 토너 | naver | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — anchor miss — curated productNo 10516809109 not in 3 qu | 40 hits · official 2 (single 2) · closest "에뛰드 순정 약산성 5.5 진정 토너" @아모레퍼 |
| 74 | 토리든 다이브인 포맨 저분자 히알루론산 올인원 | coupang | ✅ OK 단품(앵커, 가격) | ✅ 19,930원 — 토리든 다이브인 포맨 저분자 히알루론산 올인원 | anchored pid 9304294159 |
| 74 | 토리든 다이브인 포맨 저분자 히알루론산 올인원 | naver | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — anchor miss — curated productNo 11604693319 not in 3 qu | 40 hits · official 2 (single 2) · closest "토리든 다이브인 포맨 저분자 히알루론산 올인원 2 |
| 74 | 토리든 다이브인 포맨 저분자 히알루론산 올인원 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 1 (single 0) · closest "토리든 다이브인 포맨 저분자 히알루론산 올인원 2 |
| 75 | 코스노리 판테놀 베리어 에멀전 | coupang | ✅ OK 단품(앵커, 가격) | ✅ 16,800원 — 코스노리 판테놀 베리어 에멀전, 150ml, 1개 | anchored pid 7892362977 |
| 75 | 코스노리 판테놀 베리어 에멀전 | naver | ✅ OK 단품(앵커, 가격) | ✅ 18,000원 @코스노리 — 코스노리 판테놀 베리어 로션 에멀전 150ml, 1개 [anchor] | 40 hits · official 1 (single 1) · closest "코스노리 판테놀 베리어 로션 에멀전 150ml,  |
| 75 | 코스노리 판테놀 베리어 에멀전 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 0 (single 0) · closest "코스노리 판테놀 베리어 로션 에멀전 150ml,  |
| 76 | 닥터지 레드 블레미쉬 포 맨 진정 올인원 | coupang | ✅ OK 단품(앵커, 가격) | ✅ 17,000원 — 닥터지 레드 블레미쉬 포 맨 진정 올인원 | anchored pid 8660511597 |
| 76 | 닥터지 레드 블레미쉬 포 맨 진정 올인원 | naver | ⚠️ 큐레이션 naver URL=세트 앵커(링크만) | ⚠️ anchor=set — id-anchored to curated SKU (productNo 11602103992) but | 40 hits · official 2 (single 0) · closest "[1+1+1] 닥터지 레드 블레미쉬 포 맨 진정  |
| 76 | 닥터지 레드 블레미쉬 포 맨 진정 올인원 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 0 (single 0) · closest "[1+1+1] 닥터지 레드 블레미쉬 포 맨 진정  |
| 77 | 피지오겔 레드수딩 AI 로션 | coupang | ✅ OK 단품(앵커, 가격) | ✅ 22,410원 — 피지오겔 레드수딩 AI 로션 | anchored pid 6729084280 |
| 77 | 피지오겔 레드수딩 AI 로션 | naver | ✅ OK 단품(앵커, 가격) | ✅ 25,900원 @피지오겔 공식몰 — 피지오겔 레드수딩 AI 페이셜 로션 200ml 민감피부장벽 진정 [anchor] | 40 hits · official 0 (single 0) · closest "피지오겔 레드수딩 AI 로션" @쿠팡 id1.00 |
| 77 | 피지오겔 레드수딩 AI 로션 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 0 (single 0) · closest "피지오겔 레드수딩 AI 로션" @쿠팡 id1.00 |
| 78 | 온그리디언츠 스킨 베리어 카밍 로션 | naver | ✅ OK 단품(앵커, 가격) | ✅ 24,900원 @온그리디언츠 — [속광로션] 온그리디언츠 스킨 베리어 카밍 로션 이엑스 220ml, 1개 [anchor] | 40 hits · official 3 (single 1) · closest "[속광로션] 온그리디언츠 스킨 베리어 카밍 로션  |
| 78 | 온그리디언츠 스킨 베리어 카밍 로션 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 0 (single 0) · closest "[속광로션] 온그리디언츠 스킨 베리어 카밍 로션  |
| 79 | 듀이트리 AC 딥 장벽 진정 앰플 | coupang | ✅ OK 단품(앵커, 가격) | ✅ 14,800원 — 듀이트리 AC 딥 장벽 진정 앰플 | anchored pid 8431559881 |
| 79 | 듀이트리 AC 딥 장벽 진정 앰플 | naver | ✅ OK 단품(앵커, 가격) | ✅ 18,900원 @듀이트리 — [듀이트리] AC 딥 장벽 진정 보습 앰플 60ml [anchor] | 40 hits · official 1 (single 1) · closest "듀이트리 AC 딥 모이스처 장벽 진정 앰플 60m |
| 79 | 듀이트리 AC 딥 장벽 진정 앰플 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 1 (single 0) · closest "듀이트리 AC 딥 모이스처 장벽 진정 앰플 60m |
| 80 | 코스알엑스 더 알파 알부틴 2 디스컬러레이션 케어 세럼 | coupang | ✅ OK 단품(앵커, 가격) | ✅ 17,340원 — 코스알엑스 더 알파 알부틴 2 디스컬러레이션 케어 세럼 | anchored pid 8318643689 |
| 80 | 코스알엑스 더 알파 알부틴 2 디스컬러레이션 케어 세럼 | naver | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — anchor miss — curated productNo 10796508170 not in 3 qu | 40 hits · official 2 (single 2) · closest "[코스알엑스] 더 알파-알부틴 2 디스컬러레이션  |
| 80 | 코스알엑스 더 알파 알부틴 2 디스컬러레이션 케어 세럼 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 0 (single 0) · closest "[코스알엑스] 더 알파-알부틴 2 디스컬러레이션  |
| 81 | 에스트라 에이시카 365 세럼 pH 4.5 | coupang | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no_offer: Coupang: productId 9392392732 not in sea | anchored pid 9392392732 |
| 81 | 에스트라 에이시카 365 세럼 pH 4.5 | naver | ⚠️ 큐레이션 naver URL=세트 앵커(링크만) | ⚠️ anchor=set — id-anchored to curated SKU (productNo 11715934703) but | 40 hits · official 3 (single 0) · closest "[더블 세트] 에스트라 에이시카365 흔적진정세럼 |
| 81 | 에스트라 에이시카 365 세럼 pH 4.5 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 2 (single 1) · closest "[더블 세트] 에스트라 에이시카365 흔적진정세럼 |
| 82 | 아벤느 히알루론 액티브 B3 안티에이징 세럼  | coupang | ✅ OK 단품(앵커, 가격) | ✅ 27,590원 — 아벤느 안티에이징 HAB3 탄력 액티브 세럼 | anchored pid 8306356651 |
| 82 | 아벤느 히알루론 액티브 B3 안티에이징 세럼  | naver | ⚠️ 큐레이션 naver URL=세트 앵커(링크만) | ⚠️ anchor=set — id-anchored to curated SKU (productNo 10698667363) but | 40 hits · official 2 (single 1) · closest "아벤느 아벤느 히알루론 액티브 B3 안티에이징 세 |
| 82 | 아벤느 히알루론 액티브 B3 안티에이징 세럼  | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 0 (single 0) · closest "아벤느 아벤느 히알루론 액티브 B3 안티에이징 세 |
| 83 | 퍼셀 880억/mL 글루타치온 플렉서블 리포좀 | naver | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — anchor miss — curated productNo 13000644987 not in 2 qu | 40 hits · official 2 (single 2) · closest "[대용량][투명미백] 880억/mL 글루타치온 플 |
| 83 | 퍼셀 880억/mL 글루타치온 플렉서블 리포좀 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 0 (single 0) · closest "[대용량][투명미백] 880억/mL 글루타치온 플 |
| 84 | 랑콤 제니피끄 얼티미트 세럼 | coupang | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no_offer: Coupang: productId 8464853636 not in sea | anchored pid 8464853636 |
| 84 | 랑콤 제니피끄 얼티미트 세럼 | naver | ⚠️ 큐레이션 naver URL=세트 앵커(링크만) | ⚠️ anchor=set — id-anchored to curated SKU (productNo 10791745136) but | 40 hits · official 0 (single 0) · closest "랑콤 제니피끄 세럼 얼티미트, 115ml, 1개" |
| 84 | 랑콤 제니피끄 얼티미트 세럼 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 0 (single 0) · closest "랑콤 제니피끄 세럼 얼티미트, 115ml, 1개" |
| 85 | 유세린 하이아르론 에피셀린 세럼 | naver | ✅ OK 단품(앵커, 가격) | ✅ 60,900원 @유세린공식스토어 — 유세린 하이알루론 에피셀린 세럼 30ml [anchor] | 40 hits · official 2 (single 0) · closest "유세린 하이알루론 에피셀린 세럼 30ml 더블팩" |
| 85 | 유세린 하이아르론 에피셀린 세럼 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 1 (single 0) · closest "유세린 하이알루론 에피셀린 세럼 30ml 더블팩" |
| 86 | 바이오힐보 엔에이디 프리즈셀 글로우 파워 세럼 | naver | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — anchor miss — curated productNo 12443904908 not in 3 qu | 40 hits · official 1 (single 0) · closest "바이오힐보 엔에이디 프리즈셀 글로우 파워 세럼 3 |
| 86 | 바이오힐보 엔에이디 프리즈셀 글로우 파워 세럼 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 2 (single 1) · closest "바이오힐보 엔에이디 프리즈셀 글로우 파워 세럼 3 |
| 87 | 라운드랩 자작나무 수분 클렌저 | coupang | ✅ OK 단품(앵커, 가격) | ✅ 15,500원 — 라운드랩 자작나무 수분 클렌저 | anchored pid 9558253617 |
| 87 | 라운드랩 자작나무 수분 클렌저 | naver | ⚠️ 큐레이션 naver URL=세트 앵커(링크만) | ⚠️ anchor=set — id-anchored to curated SKU (productNo 11378409511) but | 40 hits · official 1 (single 0) · closest "[수분촉촉] 라운드랩 자작나무 수분 클렌저 150 |
| 87 | 라운드랩 자작나무 수분 클렌저 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 1 (single 0) · closest "[수분촉촉] 라운드랩 자작나무 수분 클렌저 150 |
| 88 | 몰바니 저자극 LHA 율피 젤 클렌저 | naver | ✅ OK 단품(앵커, 가격) | ✅ 28,000원 @몰바니 — 몰바니 율피 저자극 LHA 클렌징젤 200ml [anchor] | 40 hits · official 0 (single 0) · closest "몰바니 저자극 LHA 율피 젤 클렌저 200ml+ |
| 88 | 몰바니 저자극 LHA 율피 젤 클렌저 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 1 (single 1) · closest "몰바니 저자극 LHA 율피 젤 클렌저 200ml+ |
| 89 | 니들리 마일드 효소 클렌징 파우더 | naver | ✅ OK 단품(앵커, 가격) | ✅ 17,950원 @니들리 NEEDLY — 니들리 마일드 효소 클렌징 파우더 60g [anchor] | 40 hits · official 2 (single 2) · closest "니들리 마일드 효소 클렌징 파우더 60g" @니들 |
| 89 | 니들리 마일드 효소 클렌징 파우더 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 1 (single 1) · closest "니들리 마일드 효소 클렌징 파우더 60g" @니들 |
| 90 | 브링그린 티트리 시카 딥 클렌징폼 | naver | ⚠️ 큐레이션 naver URL=세트 앵커(링크만) | ⚠️ anchor=set — id-anchored to curated SKU (productNo 8601837234) but  | 40 hits · official 2 (single 1) · closest "[고밀도효소거품] 브링그린 티트리 시카 딥클렌징폼 |
| 90 | 브링그린 티트리 시카 딥 클렌징폼 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 1 (single 1) · closest "[고밀도효소거품] 브링그린 티트리 시카 딥클렌징폼 |
| 91 | 일리윤 젠틀 딥 페이셜 클렌저 | coupang | ✅ OK 단품(앵커, 가격) | ✅ 16,600원 — 일리윤 젠틀 딥 페이셜 클렌저 | anchored pid 8688664449 |
| 91 | 일리윤 젠틀 딥 페이셜 클렌저 | naver | ✅ OK 단품(앵커, 가격) | ✅ 17,600원 @아모레퍼시픽몰 헤어바디 — 일리윤 젠틀 딥 민감 피부 페이셜 클렌저 250ml [anchor] | 40 hits · official 1 (single 1) · closest "일리윤 젠틀 딥 페이셜 클렌저" @아모레퍼시픽공식 |
| 91 | 일리윤 젠틀 딥 페이셜 클렌저 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 1 (single 0) · closest "일리윤 젠틀 딥 페이셜 클렌저" @아모레퍼시픽공식 |
| 92 | 블라이드 버블링 스플래쉬 마스크 인디언 그레이셜 머드 | coupang | ✅ OK 단품(앵커, 가격) | ✅ 21,000원 — 블라이드 얼음모공팩 인디언 머드팩투폼 클렌징폼 120ml, 클레이팩 모공 | anchored pid 8091623533 |
| 92 | 블라이드 버블링 스플래쉬 마스크 인디언 그레이셜 머드 | naver | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — anchor miss — curated productNo 4777507234 not in 3 que | 5 hits · official 1 (single 1) · closest "머드팩투폼블라이드 버블링 스플래쉬 마스크 인디언 그 |
| 92 | 블라이드 버블링 스플래쉬 마스크 인디언 그레이셜 머드 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 5 hits · official 0 (single 0) · closest "머드팩투폼블라이드 버블링 스플래쉬 마스크 인디언 그 |
| 93 | 랑콤 스킨 이돌 3 세럼 파인 커버 | coupang | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no_offer: Coupang: productId 9553155211 not in sea | anchored pid 9553155211 |
| 93 | 랑콤 스킨 이돌 3 세럼 파인 커버 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 38 hits · official 0 (single 0) · closest "랑콤 스킨 이돌 3 세럼 파인커버 쿠션 P10 1 |
| 94 | 아이소이 스킨케어 비건 쿠션 | coupang | ⚠️ 큐레이션 URL=다중팩/세트 쿠팡(링크만) | ⚠️ 35,900원 — 아이소이 스킨케어 비건 쿠션 21호(본품+리필) (plus-combined extra unit (bun | anchored pid 8594202854 |
| 94 | 아이소이 스킨케어 비건 쿠션 | naver | ⚠️ 큐레이션 naver URL=세트 앵커(링크만) | ⚠️ anchor=set — id-anchored to curated SKU (productNo 7899595094) but  | 40 hits · official 3 (single 1) · closest "[N단독/3개] 아이소이 스킨케어 비건 제로 쿠션 |
| 95 | 아르마니 루미너스 실크 프리마 글로우 쿠션 | naver | ⚠️ 큐레이션 naver URL=세트 앵커(링크만) | ⚠️ anchor=set — id-anchored to curated SKU (productNo 12139954560) but | 40 hits · official 9 (single 0) · closest "[아르마니 뷰티][리필위크] NEW 루미너스 실크 |
| 96 | 파넬 시카마누 세럼쿠션 | naver | ✅ OK 단품(앵커, 가격) | ✅ 22,000원 @파넬 공식스토어 — 파넬 시카마누 세럼쿠션 SPF45 PA++ 본품, 21호, 15g [anchor] | 40 hits · official 16 (single 5) · closest "파넬 시카마누 세럼쿠션 SPF45 PA++ 본품 |
| 96 | 파넬 시카마누 세럼쿠션 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 0 (single 0) · closest "파넬 시카마누 세럼쿠션 SPF45 PA++ 본품, |
| 97 | 에스쁘아 비 벨벳 커버 쿠션 | coupang | ⚠️ 큐레이션 URL=다중팩/세트 쿠팡(링크만) | ⚠️ 23,100원 — 에스쁘아 비벨벳 커버 쿠션 13g + 퍼프 2p 세트 (plus-combined extra unit ( | anchored pid 9302781585 |
| 97 | 에스쁘아 비 벨벳 커버 쿠션 | naver | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — anchor miss — curated productNo 6354332173 not in 3 que | 40 hits · official 7 (single 1) · closest "에스쁘아 NEW 비벨벳 커버 쿠션 리필 SPF42 |
| 97 | 에스쁘아 비 벨벳 커버 쿠션 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 1 (single 0) · closest "에스쁘아 NEW 비벨벳 커버 쿠션 리필 SPF42 |
| 98 | VDL 커버스테인 하이커버 쿠션 | coupang | ✅ OK 단품(앵커, 가격) | ✅ 30,780원 — 브이디엘 커버 스테인 하이커버 쿠션 | anchored pid 9216167170 |
| 98 | VDL 커버스테인 하이커버 쿠션 | naver | ✅ OK 단품(앵커, 가격) | ✅ 32,400원 @VDL 공식플래그십 스토어 — VDL 커버스테인 하이커버 쿠션 13g (SPF35/ PA++) [ancho | 40 hits · official 2 (single 0) · closest "VDL 커버스테인 하이커버 쿠션 (본품 +리필)  |
| 98 | VDL 커버스테인 하이커버 쿠션 | oliveyoung | 🔗 링크만(앵커 미스/OY-무앵커) | 🔗 link-only — no curated productId to anchor — link-only | 40 hits · official 0 (single 0) · closest "VDL 커버스테인 하이커버 쿠션 (본품 +리필)  |
| 99 | 미샤 래디언스 퍼펙트핏 쿠션 | coupang | ✅ OK 단품(앵커, 가격) | ✅ 10,450원 — 미샤 래디언스 퍼펙트핏 쿠션 15g | anchored pid 1665858959 |
| 256 | 닥터지 레드 블레미쉬 수딩 업 선 스틱 | coupang | ⚠️ 큐레이션 URL=다중팩/세트 쿠팡(링크만) | ⚠️ 19,000원 — 닥터지 레드 블레미쉬 수딩 업 선스틱 듀오 세트 SPF50+ PA++++ (set/bundle keyw | anchored pid 7975902054 |
| 256 | 닥터지 레드 블레미쉬 수딩 업 선 스틱 | naver | ⚠️ 큐레이션 naver URL=세트 앵커(링크만) | ⚠️ anchor=set — id-anchored to curated SKU (productNo 8315952932) but  | 40 hits · official 1 (single 0) · closest "닥터지 레드 블레미쉬 수딩 업 선스틱 듀오 세트  |
| 257 | 이즈앤트리 어니언 프레쉬 라이트 선스틱 | coupang | ✅ OK 단품(앵커, 가격) | ✅ 9,070원 — 이즈앤트리 어니언 프레쉬 라이트 선스틱 SPF50+ PA++++ | anchored pid 7982068790 |
| 257 | 이즈앤트리 어니언 프레쉬 라이트 선스틱 | naver | ⚠️ 큐레이션 naver URL=세트 앵커(링크만) | ⚠️ anchor=set — id-anchored to curated SKU (productNo 9988052762) but  | 40 hits · official 0 (single 0) · closest "이즈앤트리 어니언 프레쉬 라이트 선스틱 SPF50 |
| 258 | 유이크 바이옴 레미디 퍼펙트 보송 선스틱 | coupang | ✅ OK 단품(앵커, 가격) | ✅ 19,630원 — 유이크 바이옴 레미디 퍼펙트 보송 선스틱 | anchored pid 8012195103 |
| 258 | 유이크 바이옴 레미디 퍼펙트 보송 선스틱 | naver | ✅ OK 단품(앵커, 가격) | ✅ 19,200원 @UIQ 유이크 — 유이크 바이옴 레미디 퍼펙트 보송 선스틱 18g [anchor] | 40 hits · official 5 (single 3) · closest "유이크 바이옴 레미디 퍼펙트 보송 선스틱 18g" |
| 261 | 몽디에스 선쿠션 | coupang | ✅ OK 단품(앵커, 가격) | ✅ 35,000원 — 몽디에스 아기 유아 어린이 징크 논나노 무기자차 쿨링 선쿠션 SPF50+ | anchored pid 9459679505 |
| 261 | 몽디에스 선쿠션 | naver | ⚠️ 큐레이션 naver URL=세트 앵커(링크만) | ⚠️ anchor=set — id-anchored to curated SKU (productNo 6069991995) but  | 35 hits · official 2 (single 0) · closest "몽디에스 선쿠션 12g (SPF43) 유아선크림, |

> 정당한 no_offer(세트only/미입점)는 수정 불필요(trust-first 의도). 위 1~5만 시트 정리 대상.
