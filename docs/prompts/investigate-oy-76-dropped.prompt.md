# Claude Code 작업 프롬프트 — 닥터지 #76 OY 매칭 진단: 정답이 왜 후보에서 빠졌나 (READ-ONLY)

> 목적: #76(닥터지 레드 블레미쉬 포 맨 **진정 올인원**)에서 **토너 세트(31,000)가 선택되고 정답 올인원 단품이 빠진 정확한 사유**를
> *실제 어댑터가 본 데이터*로 규명한다. 가설: 큐레이션명의 "진정"이 실제 제목("올인원 오일컷 로션/플루이드")과 안 맞아 유사도가 깎임 +
> 토너 세트의 증정("올인원크림")이 점수를 올림. **추측 금지 — 실측 덤프로 확인.** 코드·DB·시트 무변경.

## 0. 안전
- **READ-ONLY.** 라이브 네이버 검색만, 쓰기 없음. **실제 매처 함수(`matchOliveYoungOffer`/`pickOliveYoungOffer`/`searchNaverShopping`/`productIdentityScore`/`hasFormConflict`/`stripPromoGifts`/`extractPackageFromTitle`)를 그대로 호출** — 재구현 금지(실제 동작과 괴리 방지).
- 대상: **#76 닥터지 레드 블레미쉬 포 맨 진정 올인원** (가능하면 #34 조선미녀도 같은 방식으로).

## 1. 덤프 (매처가 실제로 본 그대로)
- 매처가 쓰는 **쿼리(`cleanQuery(brand,name)`)를 출력**, `searchNaverShopping`(display=100) 호출.
- **전체 결과 항목 표**: `title` · `mallName` · `productType` · `lprice` · `link(또는 /products/{N})`.
- **각 항목별 진단 컬럼**:
  - `isIndividualMallOffer`? / `mallName=='올리브영'`?
  - `stripPromoGifts(title)` 결과(증정 제거 후 제목)
  - `extractPackageFromTitle` → heterogeneous? unitCount?
  - `hasFormConflict(curatedName, title)` 결과
  - `productIdentityScore(title, curatedName)` 점수
  - 매처 판정: 후보채택/held/제외 + 사유

## 2. 핵심 규명
1. **OY mallName 올인원 *단품* 오퍼가 결과에 존재하나?** — `mallName='올리브영'`인 항목만 추려서, 그중 올인원 단품(오일컷 로션/플루이드 150ml 등)이 있는지. *없고 catalog/리셀러뿐이면* → 정답이 애초에 OY 개별 오퍼로 안 떠서 빠진 것(= 구조적, manual_override).
2. **있다면 왜 토너 세트보다 점수가 낮나?** — 정답 후보 vs 토너 세트의 `productIdentityScore`를 나란히. **"진정" 토큰 가설 검증**: 큐레이션 "…진정 올인원" vs 실제 "…올인원 오일컷 로션"의 점수를, "진정"을 뺐을 때와 비교해 제시.
3. **토너 세트가 왜 1등/auto-price?** — 증정 "(+올인원크림 30ml)"이 `stripPromoGifts` 후에도 점수/폼충돌/heterogeneous에 어떻게 영향(올인원 토큰 잔존 여부, 토너 vs 올인원 폼충돌이 왜 안 걸렸는지).

## 3. 산출 (리포트만)
- **결론**: 정답이 빠진 정확한 사유(① OY 개별 오퍼 부재 / ② "진정" 등 이름 불일치로 점수 미달 / ③ catalog 필터 제외 / ④ 토너 세트가 증정으로 위장 — 중 무엇인지 데이터로).
- **권고**: 스코어링 보정("진정" 같은 서술 토큰 약화/메인 카테고리 명사 우선) / 필터 조정 / 쿼리 보강 / 혹은 manual_override가 정답인지.
- `docs/worklog/`에 진단 기록. 코드·DB 무변경.

## 4. 막히면
- 매처 함수 직접 호출이 결합도로 어려우면 보고(재구현 우회 금지).
- 라이브 조회가 막히면 "확인 불가 + 사유" 보고.
