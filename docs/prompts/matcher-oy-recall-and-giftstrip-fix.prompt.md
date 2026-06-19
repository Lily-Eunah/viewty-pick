# Claude Code 작업 프롬프트 — OY recall(+올리브영) + gift-strip 선채점 + 카테고리 폼충돌

> 두 read-only 진단(`oy76-match-diagnosis.md`, OY 쿼리 부착 검증)으로 검증된 매처 정확도 fix.
> #34 자동 매칭 회복(14,400), #76 wrong 토너 제거 + 정답 단품 surface. 모두 저위험.
> 베이스: `fix/naver-sku-matching` (계속). DB·시트 무변경(검증은 read-only 맵).

## 배경 (검증됨)
- OY는 N 앵커 불가 → Naver 내 `mallName='올리브영'` 매칭. `brand+name` 쿼리는 올리브영 자기 단품을 window 밖으로 밀어내 놓침(랭킹 미스). **`brand+name+올리브영`** 부착 시 정답 단품이 상위로 surface(실측: #34 rank#0 sim1.00, #76 오일컷 로션 rank#4).
- #76 토너 세트(31,000)는 증정 "(+올인원크림)"이 raw-title 점수/폼충돌을 오염 → gift-strip 후 채점하면 sim 0.50 + 토너-vs-올인원 충돌 → 정확히 배제.

## 1. Fix — `pickOliveYoungOffer` / `matchOliveYoungOffer`

### 1a. OY recall 쿼리에 "+올리브영" 추가
- `matchOliveYoungOffer`의 쿼리 후보에 **`{brand} {name} 올리브영`** 추가(기존 brand+name·brand+category와 함께). 올리브영 자기 listing을 검색 window로 끌어올림.
- **mallName 필터 불변(트러스트 게이트)**: 채택 후보는 항상 `normalizeMallName == '올리브영'`. 제목에 "올리브영" 박은 리셀러는 제외. (부착은 recall용일 뿐.)

### 1b. gift-strip 선채점
- `pickOliveYoungOffer`에서 `productIdentityScore`·`hasFormConflict`를 **`stripPromoGifts(title)` 적용한 제목으로** 계산. 증정("+올인원크림 30ml" 등)이 점수·폼충돌을 오염시키지 못하게.
- (네이버 브랜드스토어 앵커 경로엔 영향 없음 — 이건 OY 매칭 한정. 단 stripPromoGifts 자체는 공용이므로 회귀 확인.)

### 1c. (권장) 카테고리 인지형 폼충돌 — #76 자동화
- `hasFormConflict`에 **클렌저군(워시/클렌징/폼/클렌저) ↔ 잔류군(올인원/로션/크림/세럼/토너/에센스/앰플)** 카테고리 충돌 추가.
- **반드시 카테고리 인지형(대칭)**: *큐레이션 제품의 군*과 *후보의 군*이 다를 때만 충돌. (클렌저로 큐레이션한 제품엔 워시/폼 허용 — 비플레인 클렌징폼 등 정상 클렌저가 안 떨어지게.)
- 효과: #76에서 "올인원 **워시**"(클렌저, 23,000)가 배제 → "오일컷 **로션**"(32,000) 단독 → 자동 정답. (부담되면 1c 생략 — #76은 held → manual_override, wrong 가격은 이미 제거됨.)

## 2. 검증 (read-only catalog-match-map 재실행, before/after)
- **#34 조선미녀 → 자동 매칭 14,400(sim 1.00)**, manual_override 불필요.
- **#76 닥터지**: 1c 적용 시 → **자동 오일컷 로션 32,000**; 미적용 시 → held(올인원 후보 경합) + **wrong 토너 31,000 미노출**.
- **wrong 가격 0**, 리셀러는 mallName 필터로 여전히 제외.
- **정상 OY 단품 점수·매칭 미영향**(부착·gift-strip·카테고리충돌이 과잉배제 안 함 — OK 분포 before/after 비교, 클렌저 큐레이션 제품 정상).
- 네이버 브랜드스토어 앵커·쿠팡 회귀 없음.

## 3. 테스트
- OY recall: brand+name이 놓친 올리브영 단품을 +올리브영 쿼리가 잡음(#34/#76 fixture). 리셀러(title-올리브영)는 mallName 필터로 제외.
- gift-strip 선채점: "토너 (+올인원크림 증정)" → 올인원 토큰 미반영 → form-conflict 발동/점수 하락.
- (1c) 카테고리 폼충돌: 올인원 큐레이션 vs 워시 후보 → 충돌; 클렌징 큐레이션 vs 폼 후보 → 충돌 없음(허용).
- 기존 normalize/coupang/naver-anchor/publicprices 회귀. `test:all`·typecheck·build·lint green.

## 4. 브랜치 & 커밋 (CLAUDE.md)
- `fix/naver-sku-matching`:
  - `feat: add +올리브영 recall query to oliveyoung matching`
  - `fix: score/form-conflict on gift-stripped title in pickOliveYoungOffer`
  - `feat: category-aware form conflict (cleanser vs leave-on)` (1c 채택 시)
  - `test: oy recall + gift-strip scoring + category conflict`
  - `docs: catalog-match-map re-run (before/after)`
- `git diff --check`, 시크릿·`docs/prompts`·`tmp`·`UI_DESIGN.md` 비커밋. **DB 쓰기 없음**.

## 5. Definition of Done
1. +올리브영 recall로 #34 자동 14,400, #76 정답 단품 surface(1c 시 자동 32,000 / 아니면 held).
2. gift-strip 선채점으로 #76 토너 세트 배제(wrong 0).
3. mallName 필터 유지(리셀러 제외), 정상 OY·브랜드스토어·쿠팡 회귀 없음(map before/after).
4. test/typecheck/build green, worklog 갱신.

## 6. 막히면
- 카테고리 군 분류가 애매한 제품(예: "워시오프 마스크")은 보수적으로 충돌 미적용 + 보고(정상 제품 탈락 방지 우선).
- +올리브영 부착이 특정 제품에서 리셀러만 잔뜩 올리고 올리브영 단품은 그대로 없으면 그건 진짜 부재 → held/manual_override로 두고 보고.
- 정상 OK가 크게 줄면(과잉배제) 멈추고 분포·원인 보고.

---
## 다음 (이 fix 후)
매처 완성 → 시트 정리(오타·쿠팡 short-link·데모; #34 override 불필요, #76 1c면 불필요) → `sheets:import` → **full sync → cf:deploy 반영** → 검증(wrong 0) → push/PR/merge. 웹 레이어(tier-4 link-only·개당가 정렬·mock 제거) 별도 PR.
