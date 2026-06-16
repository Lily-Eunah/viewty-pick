# 전체 카탈로그 매칭 맵 (READ-ONLY 진단)

- **일자**: 2026-06-16
- **매처**: `fix/naver-sku-matching` (실제 함수 호출: matchNaverOffer / pickOfficialOffer / classifyOfferComposition)
- **모드**: READ-ONLY. DB/시트/sync 무변경. 라이브 네이버·쿠팡 검색 API만 사용.
- **대상**: 활성 listing 138건 중 어댑터 보유 104건 진단 (zigzag/ably 34건은 어댑터 없음 → 제외).

## 요약 분포
| 분류 | 건수 |
|---|---|
| ✅ OK 단품 | 58 |
| ⚠️ 큐레이션 URL=다중팩/세트 | 5 |
| ⛔ no_offer(정당) | 19 |
| ⚠️ allowlist/입점 갭 | 18 |
| 🔎 데모/오큐레이션 의심 | 3 |
| ⚠️ URL 데이터 오류 | 1 |

## 핵심 발견 (큐레이션 해석)

> 아래 분류표는 자동 휴리스틱이라 라벨 노이즈가 있음(↓ 해석 주의). 운영자 액션 기준으로 정리:

**A. 시트 쿠팡 URL = 다중팩/세트 → 단품 URL 교체 (5건, 확실)**
- 몽디에스 엑설런트 선크림 — 쿠팡이 `[1+1] 아기/유아 선크림` 33,000(다른 제품+1+1)
- 후시다딘 더마 트러블 선크림 — `5개입` 48,160
- 닥터지 레드블레미쉬 수딩 업 선스틱 #256 — `듀오 세트` 28,200
- 에스쁘아 비벨벳 커버 쿠션 — `쿠션 13g + 퍼프 2p 세트` 23,100
- 아이소이 비건 쿠션 — `본품+리필` 35,900

**B. 시트 쿠팡 short-link(productId 없음) → 상세 URL 교체 (1건)**: 넘버즈인 3번 선크림 (`link.coupang.com/a/…`).

**C. 시트 제품명 오타 → 검색 저하로 단품 미매칭 (확인된 2건, 더 있을 수 있음)**
- 유세린 `하이아르론` → **`하이알루론`** (closest 제목이 정타 노출: "유세린 하이알루론 에피셀린 세럼 30ml")
- 바이오힐보 `엔에이디` → **`NAD`** (OY는 정타로 단품 39,000 매칭됨; naver는 `엔에이디`라 미매칭)
- ⚠️ 이 케이스들은 분류표에서 NAME_MISMATCH가 아니라 `no_offer(정당)`/`allowlist 갭`으로 잘못 들어가 있음(↓주의 2). "후보 요약"의 closest 제목 철자를 시트명과 대조 권장.

**D. 잔존 교차상품 매칭 (다른 SKU를 0.5 유사도로 매칭 — 값 스폿체크 필요)**
- 닥터지 레드블레미쉬 **포 맨 올인원** #76 / **수딩 업 선스틱** #256 가 naver에서 `레드 블레미쉬 클리어 수딩 크림 70mL`(다른 제품) 27,600으로 매칭. OY #76도 `수딩 크림 EX` 38,000.
- 일리윤 젠틀 딥 클렌저 #91 쿠팡 **81,840원**(naver 17,600 대비 과다 — 대량/케이스 의심).
- → 동일 라인(레드블레미쉬 등) 토큰 공유로 0.5 임계가 느슨. 임계 상향 또는 라인 구분 보강 후속 검토(코드).

**E. OY via 네이버 미노출 = 구조적 (allowlist 수정 대상 아님)**
- `allowlist/입점 갭` 18건의 대부분은 **올영 오퍼가 네이버 쇼핑에 안 떠서** 발생(올영 입점하나 네이버 미표출). 어댑터는 이미 `올리브영` 기본값을 쓰므로 allowlist 추가로 해결 안 됨. → 올영 단품가는 네이버 경유로 수집 불가한 구조적 한계(별도 수집경로 필요). 일부는 네이버 브랜드스토어 자체 미노출.

**F. 데모/단종 의심 (검색 0 hits)**: 몽디에스 엑설런트 선크림 / 후시다딘 / 이지앤트리 체스트넛 토너의 **naver** = 0 hits(브랜드스토어 미인덱스·단종·리뉴얼 가능). 카탈로그 정리 검토(쿠팡엔 존재하는 경우 있음).

**G. 정상 동작 확인**: 58건 OK 단품(메디큐브 28,700·토리든 19,700·코스알엑스·니들리·브링그린·에스트라 OY 32,300 등). 세트/번들 제외도 정상(랑콤·아르마니·VDL·라운드랩·에스트라 naver → no_offer).

## 해석 주의 (자동 분류 한계)
1. **분류 vs 결과 사유 괴리 가능**: 분류는 `cleanQuery` 후보뷰 기준, 매처 결과는 `matchNaverOffer`(폴백 쿼리 포함) 기준이라 라벨과 사유가 어긋날 수 있음(예: #35 넘버즈인).
2. **NAME_MISMATCH 과소집계(=0)**: 오타 쿼리는 정답 단품을 결과에 못 띄워, 오타 케이스가 `no_offer(정당)`/`allowlist 갭`으로 분류됨. 실제 오타는 위 C + "closest" 철자 대조로 판별.
3. **ALLOWLIST_GAP 과대**: 위 E대로 대부분 구조적(OY-네이버 미노출). 진짜 allowlist 대상(네이버 공식스토어가 다른 mallName으로 존재)은 본 데이터로 단정 불가.
4. OK 단품 중에도 D(교차상품) 잔존 → priced 값 스폿체크 권장.

## 운영자 수정 리스트

### 2. 큐레이션 URL = 다중팩/세트 (단품 URL 교체) (5)
- **몽디에스 엑설런트 선크림** [coupang] — 시트 쿠팡 URL을 단품 상품으로 교체(현재 URL=팩/세트)
  - ⚠️ 33,000원 — [6개월 이상 첫 선케어] [1+1] 몽디에스 아기/유아 무기자차 선크림 (plus-combined extra unit (bundle/refill/set))
  - 후보: anchored pid 5529437152
  - url: https://www.coupang.com/vp/products/5529437152?itemId=22473906037&vendorItemId=90228874864&q=%EB%AA%BD%EB%94%94%EC%97%90%EC%8A%A4+%EC%84%A0%ED%81%AC%EB%A6%BC&searchId=7dde4efc12373664&sourceType=search&itemsCount=36&searchRank=0&rank=0&traceId=mqf4682x
- **후시다딘 (동화약품) 더마 트러블 징크 카밍 선크림** [coupang] — 시트 쿠팡 URL을 단품 상품으로 교체(현재 URL=팩/세트)
  - ⚠️ 48,160원 — 후시다인 더마 트러블 징크 카밍 선크림 SPF50+ PA++++, 50m (5-count multipack)
  - 후보: anchored pid 7941544246
  - url: https://coupang.com/vp/products/7941544246?itemId=23256847066&vendorItemId=90775076500&pickType=COU_PICK&q=후시다딘%20더마%20트러블%20징크&searchId=fbfb766613990286&sourceType=search&itemsCount=36&searchRank=0&rank=0&traceId=mqf46rbj
- **닥터지 레드 블레미쉬 수딩 업 선 스틱** [coupang] — 시트 쿠팡 URL을 단품 상품으로 교체(현재 URL=팩/세트)
  - ⚠️ 28,200원 — 닥터지 레드 블레미쉬 수딩 업 선스틱 듀오 세트 SPF50+ PA++++ (set/bundle keyword)
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

### 3. allowlist/입점 갭 (18)
- **아로셀 멜라 TXA 선세럼** [naver] — 공식몰 mallName 미식별 — allowlist 입력 검토 (closest @올리브영)
  - ⛔ no_offer — official mall offer(s) found but only set/bundle/multipack (plus-combined extra unit (bundle/refill/set)) — excluded from comparison (no comparable single SKU)
  - 후보: 40 hits · official 0 (single 0) · closest "[아이돌선세럼/24시간지속] 아로셀 멜라 TXA 선세럼 40ml" @올리브영 id1.00
  - url: https://naver.me/5zURlN5z
- **스타라이크 피디알엔 스킨핏 수분 선크림** [oliveyoung] — 올영 오퍼가 네이버에 안 뜸 — 올영 입점 여부/allowlist mallName 확인
  - ⛔ no_offer — no offer from the official mall (mallName did not match allowlist/brand)
  - 후보: 40 hits · official 0 (single 0) · closest "스타라이크 피디알엔 스킨 핏 수분 선 크림 50ml" @주식회사제이씨 id1.00
  - url: https://oy.run/g1ip6hEbG0GQsu
- **조선미녀 스테이 프레쉬 톤업 선크림 퍼플** [oliveyoung] — 올영 오퍼가 네이버에 안 뜸 — 올영 입점 여부/allowlist mallName 확인
  - ⛔ no_offer — no offer from the official mall (mallName did not match allowlist/brand)
  - 후보: 40 hits · official 0 (single 0) · closest "조선미녀 스테이프레쉬 톤업 선크림 50ml (퍼플/그린) SPF50+" @뷰티오브조선 : 조선미녀 id1.00
  - url: https://oy.run/gsgwGOxKSzisni
- **넘버즈인 3번 도자기결 톤업베이지 선크림** [naver] — 공식몰 mallName 미식별 — allowlist 입력 검토 (closest @올리브영)
  - ⛔ no_offer — official mall offer(s) found but title similarity < 0.5
  - 후보: 40 hits · official 0 (single 0) · closest "[파데프리] 넘버즈인 3번 도자기결 톤업베이지 선크림 50ml 더블기" @올리브영 id1.00
  - url: https://brand.naver.com/numbuzin/products/5788327291
- **이니스프리 데일리 유브이 톤업 노세범 선크림** [oliveyoung] — 올영 오퍼가 네이버에 안 뜸 — 올영 입점 여부/allowlist mallName 확인
  - ⛔ no_offer — no offer from the official mall (mallName did not match allowlist/brand)
  - 후보: 40 hits · official 0 (single 0) · closest "[파데프리_김아영PICK] 이니스프리 데일리 UV 톤업 노세범 선크림" @이니스프리 id0.80
  - url: https://oy.run/rRbPHHbTfWaDJC
- **인터미션 레스트업 세럼 스킨** [oliveyoung] — 올영 오퍼가 네이버에 안 뜸 — 올영 입점 여부/allowlist mallName 확인
  - ⛔ no_offer — no offer from the official mall (mallName did not match allowlist/brand)
  - 후보: 40 hits · official 0 (single 0) · closest "인터미션 레스트 업 세럼 스킨" @쿠팡 id1.00
  - url: https://oy.run/0LWPLnlcbU04Xx
- **피지오겔 레드수딩 AI 로션** [oliveyoung] — 올영 오퍼가 네이버에 안 뜸 — 올영 입점 여부/allowlist mallName 확인
  - ⛔ no_offer — official mall offer(s) found but title similarity < 0.5
  - 후보: 40 hits · official 0 (single 0) · closest "피지오겔 레드수딩 AI 로션" @쿠팡 id1.00
  - url: https://oy.run/Jf5K2w6AxdzZeA
- **온그리디언츠 스킨 베리어 카밍 로션** [oliveyoung] — 올영 오퍼가 네이버에 안 뜸 — 올영 입점 여부/allowlist mallName 확인
  - ⛔ no_offer — no offer from the official mall (mallName did not match allowlist/brand)
  - 후보: 40 hits · official 0 (single 0) · closest "[속광로션] 온그리디언츠 스킨 베리어 카밍 로션 이엑스 220ml, " @온그리디언츠 id1.00
  - url: https://oy.run/ynduOf2kvnEYNG
- **랑콤 제니피끄 얼티미트 세럼** [oliveyoung] — 올영 오퍼가 네이버에 안 뜸 — 올영 입점 여부/allowlist mallName 확인
  - ⛔ no_offer — no offer from the official mall (mallName did not match allowlist/brand)
  - 후보: 40 hits · official 0 (single 0) · closest "랑콤 제니피끄 세럼 얼티미트, 115ml, 1개" @칵테일뷰티 id1.00
  - url: https://oy.run/lNUucBpv2Prr5L
- **아벤느 히알루론 액티브 B3 안티에이징 세럼 ** [oliveyoung] — 올영 오퍼가 네이버에 안 뜸 — 올영 입점 여부/allowlist mallName 확인
  - ⛔ no_offer — no offer from the official mall (mallName did not match allowlist/brand)
  - 후보: 40 hits · official 0 (single 0) · closest "아벤느 아벤느 히알루론 액티브 B3 안티에이징 세럼 30ml" @G마켓 id1.00
  - url: https://oy.run/om3oDrroGCSL0m
- **퍼셀 880억/mL 글루타치온 플렉서블 리포좀** [oliveyoung] — 올영 오퍼가 네이버에 안 뜸 — 올영 입점 여부/allowlist mallName 확인
  - ⛔ no_offer — no offer from the official mall (mallName did not match allowlist/brand)
  - 후보: 40 hits · official 0 (single 0) · closest "[대용량][투명미백] 880억/mL 글루타치온 플렉서블 리포좀 55m" @퍼셀 공식 스토어 id1.00
  - url: https://oy.run/uknjESoEHzaPjm
- **파넬 시카마누 세럼쿠션** [oliveyoung] — 올영 오퍼가 네이버에 안 뜸 — 올영 입점 여부/allowlist mallName 확인
  - ⛔ no_offer — no offer from the official mall (mallName did not match allowlist/brand)
  - 후보: 40 hits · official 0 (single 0) · closest "파넬 시카마누 세럼쿠션 SPF45 PA++ 본품, 21호, 15g" @파넬 공식스토어 id1.00
  - url: https://oy.run/Tp4vRrC8PncSU2
- **블라이드 버블링 스플래쉬 마스크 인디언 그레이셜 머드** [oliveyoung] — 올영 오퍼가 네이버에 안 뜸 — 올영 입점 여부/allowlist mallName 확인
  - ⛔ no_offer — no offer from the official mall (mallName did not match allowlist/brand)
  - 후보: 5 hits · official 0 (single 0) · closest "머드팩투폼블라이드 버블링 스플래쉬 마스크 인디언 그레이셜 머드" @블라이드BLITHE id1.00
  - url: https://oy.run/DDfzsAfybC0wY8
- **랑콤 스킨 이돌 3 세럼 파인 커버** [oliveyoung] — 올영 오퍼가 네이버에 안 뜸 — 올영 입점 여부/allowlist mallName 확인
  - ⛔ no_offer — no offer from the official mall (mallName did not match allowlist/brand)
  - 후보: 38 hits · official 0 (single 0) · closest "랑콤 스킨 이돌 3 세럼 파인커버 쿠션 P10 14g" @TC코스메틱 id1.00
  - url: https://oy.run/4e9XnVAahdbANL
- **VDL 커버스테인 하이커버 쿠션** [oliveyoung] — 올영 오퍼가 네이버에 안 뜸 — 올영 입점 여부/allowlist mallName 확인
  - ⛔ no_offer — no offer from the official mall (mallName did not match allowlist/brand)
  - 후보: 40 hits · official 0 (single 0) · closest "VDL 커버스테인 하이커버 쿠션 (본품 +리필)  1개  A01" @쿠팡 id1.00
  - url: https://oy.run/DQrdfAE0felLYJ
- **코스노리 판테놀 베리어 에멀전** [oliveyoung] — 올영 오퍼가 네이버에 안 뜸 — 올영 입점 여부/allowlist mallName 확인
  - ⛔ no_offer — no offer from the official mall (mallName did not match allowlist/brand)
  - 후보: 40 hits · official 0 (single 0) · closest "코스노리 판테놀 베리어 로션 에멀전 150ml, 1개" @코스노리 id1.00
  - url: https://oy.run/joRW0R0oPnvzi4
- **랑콤 제니피끄 얼티미트 세럼** [naver] — 공식몰 mallName 미식별 — allowlist 입력 검토 (closest @칵테일뷰티)
  - ⛔ no_offer — official mall offer(s) found but only set/bundle/multipack (set/bundle keyword) — excluded from comparison (no comparable single SKU)
  - 후보: 40 hits · official 0 (single 0) · closest "랑콤 제니피끄 세럼 얼티미트, 115ml, 1개" @칵테일뷰티 id1.00
  - url: https://brand.naver.com/lancome/products/10791745136?nl-query=%EC%A0%9C%EB%8B%88%ED%94%BC%EB%81%84%20%EC%96%BC%ED%8B%B0%EB%AF%B8%ED%8A%B8%20%EC%84%B8%EB%9F%BC&nl-au=365c8460e236442fbefdb82a417242cb&NaPm=ci%3D365c8460e236442fbefdb82a417242cb%7Cct%3Dmqcbzcmu%7Ctr%3Dnslctg%7Csn%3D1309812%7Chk%3D7e3b2cb898c83d0555163d77aaff0adcd076b1ac
- **이즈앤트리 어니언 프레쉬 라이트 선스틱** [naver] — 공식몰 mallName 미식별 — allowlist 입력 검토 (closest @쿠팡)
  - ⛔ no_offer — official mall offer(s) found but title similarity < 0.5
  - 후보: 40 hits · official 0 (single 0) · closest "이즈앤트리 어니언 프레쉬 라이트 선스틱 SPF50+ PA++++" @쿠팡 id1.00
  - url: https://brand.naver.com/isntree/products/9988052762?nl-query=%EC%96%B4%EB%8B%88%EC%96%B8%20%ED%94%84%EB%A0%88%EC%89%AC%20%EB%9D%BC%EC%9D%B4%ED%8A%B8%20%EC%84%A0%EC%8A%A4%ED%8B%B1&nl-au=1d4b2943060440c3961eca16e66d5cdf&NaPm=ci%3D1d4b2943060440c3961eca16e66d5cdf%7Cct%3Dmqf6efc8%7Ctr%3Dnslctg%7Csn%3D158772%7Chk%3D60a824f83cb1db4b2f0742e1ddc773f0c349f784

### 4. URL 데이터 오류 (1)
- **넘버즈인 3번 도자기결 톤업베이지 선크림** [coupang] — 시트 URL을 제품 상세(/vp/products/{id})로 교체
  - ⛔ data_error
  - 후보: share short-link (no productId)
  - url: https://link.coupang.com/a/euTAD8gTQW

### 5. 데모/오큐레이션 정리 후보 (3)
- **후시다딘 (동화약품) 더마 트러블 징크 카밍 선크림** [naver] — 어느 판매처에도 정상 단품 없음 — 데모/오큐레이션 정리 검토
  - ⛔ no_offer — no individual-mall offers (only catalog representatives)
  - 후보: 0 hits · official 0 (single 0) · no individual offers
  - url: https://brand.naver.com/dongwhafusidyne/products/9999261730
- **몽디에스 엑설런트 선크림** [naver] — 어느 판매처에도 정상 단품 없음 — 데모/오큐레이션 정리 검토
  - ⛔ no_offer — no offer from the official mall (mallName did not match allowlist/brand)
  - 후보: 0 hits · official 0 (single 0) · no individual offers
  - url: https://brand.naver.com/mongdies/products/13009860683
- **이지앤트리 체스트넛 바하 0.9 클리어 토너** [naver] — 어느 판매처에도 정상 단품 없음 — 데모/오큐레이션 정리 검토
  - ⛔ no_offer — no offer from the official mall (mallName did not match allowlist/brand)
  - 후보: 0 hits · official 0 (single 0) · no individual offers
  - url: https://brand.naver.com/isntree/products/12650048480?NaPm=ct%3Dmqbj6un9%7Cci%3DrBo15QAAAZ6%2DEchXAOAakg%2E%2E01%7Ctr%3Dpmax%7Chk%3D7be5a23627fac3a0009acb7ae9a2423541f0ef47%7Cnacn%3Dex1ZCIC6PJdZB

## per-listing 전체 표
| # | 제품 | 판매처 | 분류 | 매처 결과 | 후보 요약 |
|---|---|---|---|---|---|
| 29 | 몽디에스 엑설런트 선크림 | coupang | ⚠️ 큐레이션 URL=다중팩/세트 | ⚠️ 33,000원 — [6개월 이상 첫 선케어] [1+1] 몽디에스 아기/유아 무기자차 선크림 (plus-combined e | anchored pid 5529437152 |
| 29 | 몽디에스 엑설런트 선크림 | naver | 🔎 데모/오큐레이션 의심 | ⛔ no_offer — no offer from the official mall (mallName did not match a | 0 hits · official 0 (single 0) · no individual offers |
| 30 | 후시다딘 (동화약품) 더마 트러블 징크 카밍 선크림 | coupang | ⚠️ 큐레이션 URL=다중팩/세트 | ⚠️ 48,160원 — 후시다인 더마 트러블 징크 카밍 선크림 SPF50+ PA++++, 50m (5-count multipa | anchored pid 7941544246 |
| 30 | 후시다딘 (동화약품) 더마 트러블 징크 카밍 선크림 | naver | 🔎 데모/오큐레이션 의심 | ⛔ no_offer — no individual-mall offers (only catalog representatives) | 0 hits · official 0 (single 0) · no individual offers |
| 31 | 스타라이크 피디알엔 스킨핏 수분 선크림 | coupang | ✅ OK 단품 | ✅ 16,760원 — 스타라이크 피디알엔 스킨 핏 수분 선 크림 SPF 50+ PA++++ | anchored pid 8745247214 |
| 31 | 스타라이크 피디알엔 스킨핏 수분 선크림 | oliveyoung | ⚠️ allowlist/입점 갭 | ⛔ no_offer — no offer from the official mall (mallName did not match a | 40 hits · official 0 (single 0) · closest "스타라이크 피디알엔 스킨 핏 수분 선 크림 50m |
| 32 | 아로셀 멜라 TXA 선세럼 | coupang | ✅ OK 단품 | ✅ 19,700원 — 아로셀 멜라 TXA 수분 선세럼 SPF50+ PA++++ | anchored pid 8885954154 |
| 32 | 아로셀 멜라 TXA 선세럼 | naver | ⚠️ allowlist/입점 갭 | ⛔ no_offer — official mall offer(s) found but only set/bundle/multipac | 40 hits · official 0 (single 0) · closest "[아이돌선세럼/24시간지속] 아로셀 멜라 TXA  |
| 32 | 아로셀 멜라 TXA 선세럼 | oliveyoung | ✅ OK 단품 | ✅ 25,000원 @올리브영 — [아이돌선세럼/24시간지속] 아로셀 멜라 TXA 선세럼 40ml | 40 hits · official 1 (single 1) · closest "[아이돌선세럼/24시간지속] 아로셀 멜라 TXA  |
| 33 | 이니스프리 데일리 유브이 톤업 노세범 선크림 | coupang | ✅ OK 단품 | ✅ 12,490원 — 이니스프리 데일리 유브이 톤업 선크림 핑크 SPF50+ PA++++ | anchored pid 9373986892 |
| 33 | 이니스프리 데일리 유브이 톤업 노세범 선크림 | naver | ✅ OK 단품 | ✅ 14,000원 @이니스프리 — [파데프리_김아영PICK] 이니스프리 데일리 UV 톤업 노세범 선크림 S | 40 hits · official 1 (single 1) · closest "[파데프리_김아영PICK] 이니스프리 데일리 UV |
| 33 | 이니스프리 데일리 유브이 톤업 노세범 선크림 | oliveyoung | ⚠️ allowlist/입점 갭 | ⛔ no_offer — no offer from the official mall (mallName did not match a | 40 hits · official 0 (single 0) · closest "[파데프리_김아영PICK] 이니스프리 데일리 UV |
| 34 | 조선미녀 스테이 프레쉬 톤업 선크림 퍼플 | coupang | ✅ OK 단품 | ✅ 14,400원 — 조선미녀 스테이 프레쉬 톤업 선크림 퍼플 SPF50+ PA++++ | anchored pid 9544152755 |
| 34 | 조선미녀 스테이 프레쉬 톤업 선크림 퍼플 | naver | ✅ OK 단품 | ✅ 15,300원 @뷰티오브조선 : 조선미녀 — 조선미녀 스테이프레쉬 톤업 선크림 50ml (퍼플/그린) SPF50+ P | 40 hits · official 1 (single 1) · closest "조선미녀 스테이프레쉬 톤업 선크림 50ml (퍼플 |
| 34 | 조선미녀 스테이 프레쉬 톤업 선크림 퍼플 | oliveyoung | ⚠️ allowlist/입점 갭 | ⛔ no_offer — no offer from the official mall (mallName did not match a | 40 hits · official 0 (single 0) · closest "조선미녀 스테이프레쉬 톤업 선크림 50ml (퍼플 |
| 35 | 넘버즈인 3번 도자기결 톤업베이지 선크림 | coupang | ⚠️ URL 데이터 오류 | ⛔ data_error | share short-link (no productId) |
| 35 | 넘버즈인 3번 도자기결 톤업베이지 선크림 | naver | ⚠️ allowlist/입점 갭 | ⛔ no_offer — official mall offer(s) found but title similarity < 0.5 | 40 hits · official 0 (single 0) · closest "[파데프리] 넘버즈인 3번 도자기결 톤업베이지 선 |
| 35 | 넘버즈인 3번 도자기결 톤업베이지 선크림 | oliveyoung | ⛔ no_offer(정당) | ⛔ no_offer — official mall offer(s) found but title similarity < 0.5 | 40 hits · official 1 (single 0) · closest "[파데프리] 넘버즈인 3번 도자기결 톤업베이지 선 |
| 50 | 메디큐브 PDRN 핑크 시카 수딩 토너 | naver | ✅ OK 단품 | ✅ 28,700원 @메디큐브 — PDRN 핑크 시카 수딩 토너 | 40 hits · official 1 (single 1) · closest "PDRN 핑크 시카 수딩 토너" @메디큐브 id1 |
| 50 | 메디큐브 PDRN 핑크 시카 수딩 토너 | oliveyoung | ✅ OK 단품 | ✅ 15,000원 @올리브영 — [흔적미백]메디큐브 PDRN 핑크 시카 수딩 토너 250ml | 40 hits · official 1 (single 1) · closest "PDRN 핑크 시카 수딩 토너" @메디큐브 id1 |
| 69 | 비플레인 녹두 모공 클리어링 라하 토너 | coupang | ✅ OK 단품 | ✅ 13,800원 — 비플레인 녹두 모공 클리어링 라하 토너 | anchored pid 8431337141 |
| 69 | 비플레인 녹두 모공 클리어링 라하 토너 | naver | ✅ OK 단품 | ✅ 16,800원 @비플레인 beplain — [모공비움 토너] 비플레인 녹두 모공 클리어링 라하 토너 265ml, 1 | 40 hits · official 2 (single 2) · closest "[모공비움 토너] 비플레인 녹두 모공 클리어링 라 |
| 69 | 비플레인 녹두 모공 클리어링 라하 토너 | oliveyoung | ⛔ no_offer(정당) | ⛔ no_offer — official mall offer(s) found but title similarity < 0.5 | 40 hits · official 1 (single 0) · closest "[모공비움 토너] 비플레인 녹두 모공 클리어링 라 |
| 70 | 에스네이처 아쿠아 오아시스 토너 | coupang | ✅ OK 단품 | ✅ 26,420원 — 에스네이처 아쿠아 오아시스 토너 | anchored pid 7093360467 |
| 70 | 에스네이처 아쿠아 오아시스 토너 | naver | ✅ OK 단품 | ✅ 18,900원 @에스네이처 — 에스네이처 아쿠아 오아시스 토너 300ml | 40 hits · official 4 (single 2) · closest "[라운지전용] 에스네이처 아쿠아 오아시스 토너 2 |
| 70 | 에스네이처 아쿠아 오아시스 토너 | oliveyoung | ⛔ no_offer(정당) | ⛔ no_offer — official mall offer(s) found but only set/bundle/multipac | 40 hits · official 1 (single 0) · closest "[라운지전용] 에스네이처 아쿠아 오아시스 토너 2 |
| 71 | 인터미션 레스트업 세럼 스킨 | naver | ✅ OK 단품 | ✅ 28,800원 @인터미션 — 인터미션 레스트 업 세럼스킨 200ml | 40 hits · official 2 (single 1) · closest "인터미션 레스트 업 세럼 스킨" @쿠팡 id1.0 |
| 71 | 인터미션 레스트업 세럼 스킨 | oliveyoung | ⚠️ allowlist/입점 갭 | ⛔ no_offer — no offer from the official mall (mallName did not match a | 40 hits · official 0 (single 0) · closest "인터미션 레스트 업 세럼 스킨" @쿠팡 id1.0 |
| 72 | 이지앤트리 체스트넛 바하 0.9 클리어 토너 | coupang | ✅ OK 단품 | ✅ 18,210원 — 이즈앤트리 체스트넛 바하 0.9% 클리어 토너 | anchored pid 6764118502 |
| 72 | 이지앤트리 체스트넛 바하 0.9 클리어 토너 | naver | 🔎 데모/오큐레이션 의심 | ⛔ no_offer — no offer from the official mall (mallName did not match a | 0 hits · official 0 (single 0) · no individual offers |
| 73 | 에뛰드 순정 약산성 5.5 진정 토너 | coupang | ✅ OK 단품 | ✅ 18,580원 — 에뛰드 하우스 순정 약산성 5.5 진정 토너, 350ml, 1개 | anchored pid 18359349 |
| 73 | 에뛰드 순정 약산성 5.5 진정 토너 | naver | ✅ OK 단품 | ✅ 24,200원 @에뛰드 본사직영샵 — [에뛰드] 순정 약산성 5.5 진정 토너 500ml, 1개 | 40 hits · official 2 (single 2) · closest "에뛰드 순정 약산성 5.5 진정 토너" @아모레퍼 |
| 74 | 토리든 다이브인 포맨 저분자 히알루론산 올인원 | coupang | ✅ OK 단품 | ✅ 19,930원 — 토리든 다이브인 포맨 저분자 히알루론산 올인원 | anchored pid 9304294159 |
| 74 | 토리든 다이브인 포맨 저분자 히알루론산 올인원 | naver | ✅ OK 단품 | ✅ 19,700원 @토리든 — 토리든 다이브인 포맨 저분자 히알루론산 올인원 200ml, 1개 | 40 hits · official 2 (single 2) · closest "토리든 다이브인 포맨 저분자 히알루론산 올인원 2 |
| 74 | 토리든 다이브인 포맨 저분자 히알루론산 올인원 | oliveyoung | ⛔ no_offer(정당) | ⛔ no_offer — no offer from the official mall (mallName did not match a | 40 hits · official 1 (single 0) · closest "토리든 다이브인 포맨 저분자 히알루론산 올인원 2 |
| 75 | 코스노리 판테놀 베리어 에멀전 | coupang | ✅ OK 단품 | ✅ 16,800원 — 코스노리 판테놀 베리어 에멀전, 150ml, 1개 | anchored pid 7892362977 |
| 75 | 코스노리 판테놀 베리어 에멀전 | naver | ✅ OK 단품 | ✅ 18,000원 @코스노리 — 코스노리 판테놀 베리어 로션 에멀전 150ml, 1개 | 40 hits · official 1 (single 1) · closest "코스노리 판테놀 베리어 로션 에멀전 150ml,  |
| 75 | 코스노리 판테놀 베리어 에멀전 | oliveyoung | ⚠️ allowlist/입점 갭 | ⛔ no_offer — no offer from the official mall (mallName did not match a | 40 hits · official 0 (single 0) · closest "코스노리 판테놀 베리어 로션 에멀전 150ml,  |
| 76 | 닥터지 레드 블레미쉬 포 맨 진정 올인원 | coupang | ✅ OK 단품 | ✅ 17,000원 — 닥터지 레드 블레미쉬 포 맨 진정 올인원 | anchored pid 8660511597 |
| 76 | 닥터지 레드 블레미쉬 포 맨 진정 올인원 | naver | ✅ OK 단품 | ✅ 27,600원 @고운세상 닥터지 — 닥터지 레드 블레미쉬 클리어 수딩 크림 70mL (단지형) 진정 수분 | 40 hits · official 2 (single 0) · closest "[1+1+1] 닥터지 레드 블레미쉬 포 맨 진정  |
| 76 | 닥터지 레드 블레미쉬 포 맨 진정 올인원 | oliveyoung | ✅ OK 단품 | ✅ 38,000원 @올리브영 — [3세대 리뉴얼] 닥터지 레드 블레미쉬 클리어 수딩 크림 EX 70ml | 40 hits · official 0 (single 0) · closest "[1+1+1] 닥터지 레드 블레미쉬 포 맨 진정  |
| 77 | 피지오겔 레드수딩 AI 로션 | coupang | ✅ OK 단품 | ✅ 22,410원 — 피지오겔 레드수딩 AI 로션 | anchored pid 6729084280 |
| 77 | 피지오겔 레드수딩 AI 로션 | naver | ✅ OK 단품 | ✅ 28,900원 @피지오겔공식사이트 — 피지오겔 레드수딩 AI 손상장벽 리페어 진정크림 100ml | 40 hits · official 0 (single 0) · closest "피지오겔 레드수딩 AI 로션" @쿠팡 id1.00 |
| 77 | 피지오겔 레드수딩 AI 로션 | oliveyoung | ⚠️ allowlist/입점 갭 | ⛔ no_offer — official mall offer(s) found but title similarity < 0.5 | 40 hits · official 0 (single 0) · closest "피지오겔 레드수딩 AI 로션" @쿠팡 id1.00 |
| 78 | 온그리디언츠 스킨 베리어 카밍 로션 | naver | ✅ OK 단품 | ✅ 24,900원 @온그리디언츠 — [속광로션] 온그리디언츠 스킨 베리어 카밍 로션 이엑스 220ml, 1개 | 40 hits · official 5 (single 1) · closest "[속광로션] 온그리디언츠 스킨 베리어 카밍 로션  |
| 78 | 온그리디언츠 스킨 베리어 카밍 로션 | oliveyoung | ⚠️ allowlist/입점 갭 | ⛔ no_offer — no offer from the official mall (mallName did not match a | 40 hits · official 0 (single 0) · closest "[속광로션] 온그리디언츠 스킨 베리어 카밍 로션  |
| 79 | 듀이트리 AC 딥 장벽 진정 앰플 | coupang | ✅ OK 단품 | ✅ 14,800원 — 듀이트리 AC 딥 장벽 진정 앰플 | anchored pid 8431559881 |
| 79 | 듀이트리 AC 딥 장벽 진정 앰플 | naver | ✅ OK 단품 | ✅ 18,900원 @듀이트리 — [듀이트리] AC 딥 장벽 진정 보습 앰플 60ml | 40 hits · official 1 (single 1) · closest "듀이트리 AC 딥 모이스처 장벽 진정 앰플 60m |
| 79 | 듀이트리 AC 딥 장벽 진정 앰플 | oliveyoung | ⛔ no_offer(정당) | ⛔ no_offer — official mall offer(s) found but only set/bundle/multipac | 40 hits · official 1 (single 0) · closest "듀이트리 AC 딥 모이스처 장벽 진정 앰플 60m |
| 80 | 코스알엑스 더 알파 알부틴 2 디스컬러레이션 케어 세럼 | coupang | ✅ OK 단품 | ✅ 17,340원 — 코스알엑스 더 알파 알부틴 2 디스컬러레이션 케어 세럼 | anchored pid 8318643689 |
| 80 | 코스알엑스 더 알파 알부틴 2 디스컬러레이션 케어 세럼 | naver | ✅ OK 단품 | ✅ 21,390원 @코스알엑스 — 코스알엑스 더 알파-알부틴 2 디스컬러레이션 케어 세럼 50ml, 1개 | 40 hits · official 2 (single 2) · closest "[코스알엑스] 더 알파-알부틴 2 디스컬러레이션  |
| 80 | 코스알엑스 더 알파 알부틴 2 디스컬러레이션 케어 세럼 | oliveyoung | ✅ OK 단품 | ✅ 19,500원 @올리브영 — [흔적케어] 코스알엑스 더 알파 - 알부틴 세럼 50ml (펩타이드세럼  | 40 hits · official 0 (single 0) · closest "[코스알엑스] 더 알파-알부틴 2 디스컬러레이션  |
| 81 | 에스트라 에이시카 365 세럼 pH 4.5 | coupang | ⛔ no_offer(정당) | ⛔ no_offer — Coupang: productId 9392392732 not in search result | anchored pid 9392392732 |
| 81 | 에스트라 에이시카 365 세럼 pH 4.5 | naver | ⛔ no_offer(정당) | ⛔ no_offer — official mall offer(s) found but only set/bundle/multipac | 40 hits · official 3 (single 0) · closest "[더블 세트] 에스트라 에이시카365 흔적진정세럼 |
| 81 | 에스트라 에이시카 365 세럼 pH 4.5 | oliveyoung | ✅ OK 단품 | ✅ 32,300원 @올리브영 — 에스트라 에이시카365 흔적진정세럼 pH4.5 40ml | 40 hits · official 2 (single 1) · closest "[더블 세트] 에스트라 에이시카365 흔적진정세럼 |
| 82 | 아벤느 히알루론 액티브 B3 안티에이징 세럼  | coupang | ✅ OK 단품 | ✅ 27,590원 — 아벤느 안티에이징 HAB3 탄력 액티브 세럼 | anchored pid 8306356651 |
| 82 | 아벤느 히알루론 액티브 B3 안티에이징 세럼  | naver | ✅ OK 단품 | ✅ 37,900원 @아벤느 — [아벤느] 히알루론 액티브 B3 안티에이징 세럼 30ml (탄력 액티브  | 40 hits · official 2 (single 1) · closest "아벤느 아벤느 히알루론 액티브 B3 안티에이징 세 |
| 82 | 아벤느 히알루론 액티브 B3 안티에이징 세럼  | oliveyoung | ⚠️ allowlist/입점 갭 | ⛔ no_offer — no offer from the official mall (mallName did not match a | 40 hits · official 0 (single 0) · closest "아벤느 아벤느 히알루론 액티브 B3 안티에이징 세 |
| 83 | 퍼셀 880억/mL 글루타치온 플렉서블 리포좀 | naver | ✅ OK 단품 | ✅ 32,400원 @퍼셀 공식 스토어 — [투명미백] 880억/mL 글루타치온 플렉서블 리포좀 30ml, 1개 | 40 hits · official 2 (single 2) · closest "[대용량][투명미백] 880억/mL 글루타치온 플 |
| 83 | 퍼셀 880억/mL 글루타치온 플렉서블 리포좀 | oliveyoung | ⚠️ allowlist/입점 갭 | ⛔ no_offer — no offer from the official mall (mallName did not match a | 40 hits · official 0 (single 0) · closest "[대용량][투명미백] 880억/mL 글루타치온 플 |
| 84 | 랑콤 제니피끄 얼티미트 세럼 | coupang | ⛔ no_offer(정당) | ⛔ no_offer — Coupang: productId 8464853636 not in search result | anchored pid 8464853636 |
| 84 | 랑콤 제니피끄 얼티미트 세럼 | naver | ⚠️ allowlist/입점 갭 | ⛔ no_offer — official mall offer(s) found but only set/bundle/multipac | 40 hits · official 0 (single 0) · closest "랑콤 제니피끄 세럼 얼티미트, 115ml, 1개" |
| 84 | 랑콤 제니피끄 얼티미트 세럼 | oliveyoung | ⚠️ allowlist/입점 갭 | ⛔ no_offer — no offer from the official mall (mallName did not match a | 40 hits · official 0 (single 0) · closest "랑콤 제니피끄 세럼 얼티미트, 115ml, 1개" |
| 85 | 유세린 하이아르론 에피셀린 세럼 | naver | ⛔ no_offer(정당) | ⛔ no_offer — no offer from the official mall (mallName did not match a | 40 hits · official 2 (single 0) · closest "유세린 하이알루론 에피셀린 세럼 30ml 더블팩" |
| 85 | 유세린 하이아르론 에피셀린 세럼 | oliveyoung | ⛔ no_offer(정당) | ⛔ no_offer — no offer from the official mall (mallName did not match a | 40 hits · official 1 (single 0) · closest "유세린 하이알루론 에피셀린 세럼 30ml 더블팩" |
| 86 | 바이오힐보 엔에이디 프리즈셀 글로우 파워 세럼 | naver | ⛔ no_offer(정당) | ⛔ no_offer — no offer from the official mall (mallName did not match a | 40 hits · official 1 (single 0) · closest "바이오힐보 엔에이디 프리즈셀 글로우 파워 세럼 3 |
| 86 | 바이오힐보 엔에이디 프리즈셀 글로우 파워 세럼 | oliveyoung | ✅ OK 단품 | ✅ 39,000원 @올리브영 — [광채세럼] 바이오힐보 NAD 프리즈셀 글로우 파워 세럼 30ml [단품 | 40 hits · official 2 (single 1) · closest "바이오힐보 엔에이디 프리즈셀 글로우 파워 세럼 3 |
| 87 | 라운드랩 자작나무 수분 클렌저 | coupang | ✅ OK 단품 | ✅ 15,500원 — 라운드랩 자작나무 수분 클렌저 | anchored pid 9558253617 |
| 87 | 라운드랩 자작나무 수분 클렌저 | naver | ⛔ no_offer(정당) | ⛔ no_offer — no offer from the official mall (mallName did not match a | 40 hits · official 1 (single 0) · closest "[수분촉촉] 라운드랩 자작나무 수분 클렌저 150 |
| 87 | 라운드랩 자작나무 수분 클렌저 | oliveyoung | ⛔ no_offer(정당) | ⛔ no_offer — official mall offer(s) found but only set/bundle/multipac | 40 hits · official 1 (single 0) · closest "[수분촉촉] 라운드랩 자작나무 수분 클렌저 150 |
| 88 | 몰바니 저자극 LHA 율피 젤 클렌저 | naver | ✅ OK 단품 | ✅ 28,000원 @몰바니 — 몰바니 율피 저자극 LHA 클렌징젤 200ml | 40 hits · official 0 (single 0) · closest "몰바니 저자극 LHA 율피 젤 클렌저 200ml+ |
| 88 | 몰바니 저자극 LHA 율피 젤 클렌저 | oliveyoung | ✅ OK 단품 | ✅ 18,900원 @올리브영 — 몰바니 저자극 LHA 율피 젤 클렌저 200ml | 40 hits · official 1 (single 1) · closest "몰바니 저자극 LHA 율피 젤 클렌저 200ml+ |
| 89 | 니들리 마일드 효소 클렌징 파우더 | naver | ✅ OK 단품 | ✅ 17,950원 @니들리 NEEDLY — 니들리 마일드 효소 클렌징 파우더 60g | 40 hits · official 2 (single 2) · closest "니들리 마일드 효소 클렌징 파우더 60g" @니들 |
| 89 | 니들리 마일드 효소 클렌징 파우더 | oliveyoung | ✅ OK 단품 | ✅ 15,120원 @올리브영 — 니들리 마일드 효소 클렌징 파우더 60g | 40 hits · official 1 (single 1) · closest "니들리 마일드 효소 클렌징 파우더 60g" @니들 |
| 90 | 브링그린 티트리 시카 딥 클렌징폼 | naver | ✅ OK 단품 | ✅ 10,500원 @브링그린 — 브링그린 티트리 시카 딥 클렌징폼 200ml, 1개 | 40 hits · official 2 (single 1) · closest "[고밀도효소거품] 브링그린 티트리 시카 딥클렌징폼 |
| 90 | 브링그린 티트리 시카 딥 클렌징폼 | oliveyoung | ✅ OK 단품 | ✅ 10,500원 @올리브영 — [고밀도효소거품] 브링그린 티트리 시카 딥클렌징폼 기획 (더블/대용량) | 40 hits · official 1 (single 1) · closest "[고밀도효소거품] 브링그린 티트리 시카 딥클렌징폼 |
| 91 | 일리윤 젠틀 딥 페이셜 클렌저 | coupang | ✅ OK 단품 | ✅ 81,840원 — 일리윤 젠틀 딥 페이셜 클렌저 | anchored pid 8688664449 |
| 91 | 일리윤 젠틀 딥 페이셜 클렌저 | naver | ✅ OK 단품 | ✅ 17,600원 @일리윤 — 일리윤 젠틀 딥 민감 피부 페이셜 클렌저 250ml | 40 hits · official 1 (single 1) · closest "일리윤 젠틀 딥 페이셜 클렌저" @아모레퍼시픽공식 |
| 91 | 일리윤 젠틀 딥 페이셜 클렌저 | oliveyoung | ⛔ no_offer(정당) | ⛔ no_offer — official mall offer(s) found but title similarity < 0.5 | 40 hits · official 1 (single 0) · closest "일리윤 젠틀 딥 페이셜 클렌저" @아모레퍼시픽공식 |
| 92 | 블라이드 버블링 스플래쉬 마스크 인디언 그레이셜 머드 | coupang | ✅ OK 단품 | ✅ 21,000원 — 블라이드 얼음모공팩 인디언 머드팩투폼 클렌징폼 120ml, 클레이팩 모공 | anchored pid 8091623533 |
| 92 | 블라이드 버블링 스플래쉬 마스크 인디언 그레이셜 머드 | naver | ✅ OK 단품 | ✅ 21,600원 @블라이드BLITHE — 머드팩투폼블라이드 버블링 스플래쉬 마스크 인디언 그레이셜 머드 | 5 hits · official 1 (single 1) · closest "머드팩투폼블라이드 버블링 스플래쉬 마스크 인디언 그 |
| 92 | 블라이드 버블링 스플래쉬 마스크 인디언 그레이셜 머드 | oliveyoung | ⚠️ allowlist/입점 갭 | ⛔ no_offer — no offer from the official mall (mallName did not match a | 5 hits · official 0 (single 0) · closest "머드팩투폼블라이드 버블링 스플래쉬 마스크 인디언 그 |
| 93 | 랑콤 스킨 이돌 3 세럼 파인 커버 | coupang | ⛔ no_offer(정당) | ⛔ no_offer — Coupang: productId 9553155211 not in search result | anchored pid 9553155211 |
| 93 | 랑콤 스킨 이돌 3 세럼 파인 커버 | oliveyoung | ⚠️ allowlist/입점 갭 | ⛔ no_offer — no offer from the official mall (mallName did not match a | 38 hits · official 0 (single 0) · closest "랑콤 스킨 이돌 3 세럼 파인커버 쿠션 P10 1 |
| 94 | 아이소이 스킨케어 비건 쿠션 | coupang | ⚠️ 큐레이션 URL=다중팩/세트 | ⚠️ 35,900원 — 아이소이 스킨케어 비건 쿠션 21호(본품+리필) (plus-combined extra unit (bun | anchored pid 8594202854 |
| 94 | 아이소이 스킨케어 비건 쿠션 | naver | ✅ OK 단품 | ✅ 26,000원 @아이소이 — 스킨케어 비건 쿠션 SPF38 PA++ 21호 미니 7g | 40 hits · official 3 (single 1) · closest "[N단독/3개] 아이소이 스킨케어 비건 제로 쿠션 |
| 95 | 아르마니 루미너스 실크 프리마 글로우 쿠션 | naver | ⛔ no_offer(정당) | ⛔ no_offer — no offer from the official mall (mallName did not match a | 40 hits · official 9 (single 0) · closest "[아르마니 뷰티][리필위크] NEW 루미너스 실크 |
| 96 | 파넬 시카마누 세럼쿠션 | naver | ✅ OK 단품 | ✅ 22,000원 @파넬 공식스토어 — 파넬 시카마누 세럼쿠션 SPF45 PA++ 본품, 21호, 15g | 40 hits · official 16 (single 5) · closest "파넬 시카마누 세럼쿠션 SPF45 PA++ 본품 |
| 96 | 파넬 시카마누 세럼쿠션 | oliveyoung | ⚠️ allowlist/입점 갭 | ⛔ no_offer — no offer from the official mall (mallName did not match a | 40 hits · official 0 (single 0) · closest "파넬 시카마누 세럼쿠션 SPF45 PA++ 본품, |
| 97 | 에스쁘아 비 벨벳 커버 쿠션 | coupang | ⚠️ 큐레이션 URL=다중팩/세트 | ⚠️ 23,100원 — 에스쁘아 비벨벳 커버 쿠션 13g + 퍼프 2p 세트 (plus-combined extra unit ( | anchored pid 9302781585 |
| 97 | 에스쁘아 비 벨벳 커버 쿠션 | naver | ✅ OK 단품 | ✅ 12,000원 @에스쁘아 본사직영샵 — 에스쁘아 NEW 비벨벳 커버쿠션 미니 SPF42 PA++ 4.5g | 40 hits · official 7 (single 1) · closest "에스쁘아 NEW 비벨벳 커버 쿠션 리필 SPF42 |
| 97 | 에스쁘아 비 벨벳 커버 쿠션 | oliveyoung | ⛔ no_offer(정당) | ⛔ no_offer — official mall offer(s) found but title similarity < 0.5 | 40 hits · official 1 (single 0) · closest "에스쁘아 NEW 비벨벳 커버 쿠션 리필 SPF42 |
| 98 | VDL 커버스테인 하이커버 쿠션 | coupang | ✅ OK 단품 | ✅ 30,780원 — 브이디엘 커버 스테인 하이커버 쿠션 | anchored pid 9216167170 |
| 98 | VDL 커버스테인 하이커버 쿠션 | naver | ⛔ no_offer(정당) | ⛔ no_offer — official mall offer(s) found but only set/bundle/multipac | 40 hits · official 2 (single 0) · closest "VDL 커버스테인 하이커버 쿠션 (본품 +리필)  |
| 98 | VDL 커버스테인 하이커버 쿠션 | oliveyoung | ⚠️ allowlist/입점 갭 | ⛔ no_offer — no offer from the official mall (mallName did not match a | 40 hits · official 0 (single 0) · closest "VDL 커버스테인 하이커버 쿠션 (본품 +리필)  |
| 99 | 미샤 래디언스 퍼펙트핏 쿠션 | coupang | ✅ OK 단품 | ✅ 10,450원 — 미샤 래디언스 퍼펙트핏 쿠션 15g | anchored pid 1665858959 |
| 256 | 닥터지 레드 블레미쉬 수딩 업 선 스틱 | coupang | ⚠️ 큐레이션 URL=다중팩/세트 | ⚠️ 28,200원 — 닥터지 레드 블레미쉬 수딩 업 선스틱 듀오 세트 SPF50+ PA++++ (set/bundle keyw | anchored pid 7975902054 |
| 256 | 닥터지 레드 블레미쉬 수딩 업 선 스틱 | naver | ✅ OK 단품 | ✅ 27,600원 @고운세상 닥터지 — 닥터지 레드 블레미쉬 클리어 수딩 크림 70mL (단지형) 진정 수분 | 40 hits · official 1 (single 0) · closest "닥터지 레드 블레미쉬 수딩 업 선스틱 듀오 세트  |
| 257 | 이즈앤트리 어니언 프레쉬 라이트 선스틱 | coupang | ✅ OK 단품 | ✅ 15,550원 — 이즈앤트리 어니언 프레쉬 라이트 선스틱 SPF50+ PA++++ | anchored pid 7982068790 |
| 257 | 이즈앤트리 어니언 프레쉬 라이트 선스틱 | naver | ⚠️ allowlist/입점 갭 | ⛔ no_offer — official mall offer(s) found but title similarity < 0.5 | 40 hits · official 0 (single 0) · closest "이즈앤트리 어니언 프레쉬 라이트 선스틱 SPF50 |
| 258 | 유이크 바이옴 레미디 퍼펙트 보송 선스틱 | coupang | ✅ OK 단품 | ✅ 19,630원 — 유이크 바이옴 레미디 퍼펙트 보송 선스틱 | anchored pid 8012195103 |
| 258 | 유이크 바이옴 레미디 퍼펙트 보송 선스틱 | naver | ✅ OK 단품 | ✅ 19,200원 @UIQ 유이크 — 유이크 바이옴 레미디 퍼펙트 보송 선스틱 18g | 40 hits · official 5 (single 3) · closest "유이크 바이옴 레미디 퍼펙트 보송 선스틱 18g" |
| 261 | 몽디에스 선쿠션 | coupang | ✅ OK 단품 | ✅ 35,000원 — 몽디에스 아기 유아 어린이 징크 논나노 무기자차 쿨링 선쿠션 SPF50+ | anchored pid 9459679505 |
| 261 | 몽디에스 선쿠션 | naver | ⛔ no_offer(정당) | ⛔ no_offer — official mall offer(s) found but only set/bundle/multipac | 35 hits · official 2 (single 0) · closest "몽디에스 선쿠션 12g (SPF43) 유아선크림, |

> 정당한 no_offer(세트only/미입점)는 수정 불필요(trust-first 의도). 위 1~5만 시트 정리 대상.
