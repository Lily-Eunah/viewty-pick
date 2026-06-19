# Claude Code 작업 프롬프트 — OY 쿼리에 "올리브영" 부착 효과 검증 (READ-ONLY)

> 목적: brand+name 쿼리에 **"올리브영"을 부착**하면 `mallName='올리브영'` 정답 오퍼(특히 #76 올인원 단품, #34 스테이프레쉬)가
> 상위/검색 window에 떠서 매칭 가능한지 실측 판별. **"구조적 부재"(기존 진단) vs "랭킹 미스"(가설)** 를 데이터로 가른다.
> **READ-ONLY. 실제 매처 함수 그대로 호출. 코드·DB·시트 무변경.**

## 0. 안전
- 라이브 네이버 검색만, 쓰기 없음. `searchNaverShopping`/`normalizeMallName`/`isIndividualMallOffer`/`productIdentityScore`/`hasFormConflict`/`stripPromoGifts` 직접 호출(재구현 금지).
- **mallName 필터 유지가 트러스트 게이트** — "올리브영" 부착은 *랭킹/recall*용일 뿐, 채택 후보는 항상 `mallName='올리브영'`만(제목에 올리브영 박은 리셀러는 제외).

## 1. 대상 & 비교
대상: #76(닥터지 레드 블레미쉬 포 맨 진정 올인원), #34(조선미녀 스테이 프레쉬 톤업 선크림 퍼플).

각 제품에 대해 두 쿼리의 결과를 **mallName='올리브영' 개별 오퍼만** 추려 비교:
- **(A) 현행**: `brand + name` (예: "닥터지 레드 블레미쉬 포 맨 진정 올인원")
- **(B) 부착**: `brand + name + 올리브영`

표(각 쿼리별): `title` · `lprice` · `productType` · `결과 내 순위(rank)` · `productIdentityScore` · `form-conflict(gift-strip 후)` · `gift-strip 후 제목`.

## 2. 핵심 규명
1. **(B)에서 (A)에 없던 새 `mallName='올리브영'` 오퍼가 뜨나?** 특히 **#76 올인원 *단품*(오일컷 로션/플루이드 150ml 등)** 이 `mallName='올리브영'`으로 surface되나?
2. 떴다면: gift-strip 후 `productIdentityScore` ≥ 0.6 + form-conflict 없음으로 **정답으로 채택되나?** ("진정" 토큰이 점수를 얼마나 깎는지도 같이).
3. 안 떴다면(리셀러만, 또는 여전히 세트/토너뿐): **구조적 부재 확정** → manual_override.
4. 부착이 기존 정상 OY 매칭을 해치지 않는지(리셀러가 mallName 필터로 잘 걸러지는지) 표본 1~2개로 확인.

## 3. 산출 (리포트만)
- #76·#34 각각 **(A) vs (B) 올리브영 오퍼 목록 + 정답 단품 surface 여부** 결론.
- **권고**:
  - surface되면 → 멀티쿼리 recall에 **`brand+name+올리브영` 쿼리 추가**(mallName 필터 유지). 저위험.
  - 안 되면 → 구조적 부재 → manual_override.
- `docs/worklog/`에 기록. 코드·DB 무변경.

## 4. 막히면
- 부착 쿼리가 리셀러만 잔뜩 올리고 올리브영 mallName은 그대로면 그 사실 보고(부착 무효 = 구조적 부재).
- 라이브 조회 막히면 "확인 불가 + 사유" 보고.
