# Claude Code 작업 프롬프트 — 네이버 = naver.me 어필리에이트 단일 링크 전제 (비어필리에이트 불필요)

> 배경(확정): 네이버 매칭은 URL의 channelProductNo가 아니라 **brand+name 쿼리 + mallName/catalog identity**로 함(번호 namespace 불일치). 어필리에이트 `naver.me`를 resolve하면 channelProductNo가 나와 **소형 브랜드는 Tier-1 앵커도 그대로 작동**, 대형은 Tier-2 공식몰/Tier-3 catalog로 폴백. 따라서 **시트 네이버 컬럼엔 어필리에이트 `naver.me/*` 하나만** 넣으면 됨(별도 brand.naver.com URL 불필요).
> 베이스: 최신 `main`(PR #32 머지 후). 분기 `refactor/naver-affiliate-only`. 대상: `crawler/adapters/naver.ts`(+ /go 링크 로직 확인).

## 변경
1. **어필리에이트 판정 정의 고정**: `isNaverAffiliate(url)` = **`naver.me/` 를 포함하는 URL만 true**. 그 외(`brand.naver.com`·`smartstore`·`shopping.naver.com`·`ader.naver.com`·기타) **전부 비어필리에이트**. (PR #32가 더 넓게 잡았으면 naver.me로 좁힘.)
2. **naver.me 단일 링크로 전 과정 동작 보장** (별도 product URL 의존 제거):
   - `resolveCuratedProductNo(naver.me)` → redirect 따라가 `channelProductNo=N`(또는 `/products/N`) 추출 → Tier-1 앵커 시도.
   - 못 뽑거나 앵커 miss → Tier-2 공식몰 mallName 매칭 → Tier-3 catalog → Tier-4 link-only (PR #32 로직 그대로, brand.naver.com URL 없어도 동일하게 동작).
   - **시트 네이버 값이 naver.me 하나뿐이어도** 매칭·가격·폴백이 정상이어야 함.
3. **구매 링크 규칙 — 모든 큐레이트 URL을 그대로 유지(업데이트 안 함)**:
   - **naver.me·brand.naver.com·smartstore 등 무엇이든 구매 링크는 시트에 넣은 그대로** 사용(`/go`). **매칭된 store URL로 자동 교체하지 않음** — 운영자가 기존 brand.naver.com을 정리할 필요 없게(최소 변경).
   - 어필리에이트 판정(naver.me)은 **warning 문구용으로만** 사용: naver.me를 Tier-2 공식가로 매길 땐 "가격주체 불일치 가능" 표기(어필리에이트가 다른 판매처로 보낼 수 있으므로). brand.naver.com을 그 스토어 공식가로 매칭하면 링크·가격 주체가 같아 그 문구 불필요.

## 테스트
- **naver.me-only fixture**로:
  - 소형(번호 일치) → Tier-1 앵커 매칭(무 warning), 구매 링크 = naver.me.
  - 대형(에뛰드류) → Tier-2 공식가 + warning, 구매 링크 = **naver.me 유지**(공식몰 URL로 안 바뀜).
  - 공식스토어 없음(이니스프리/넘버즈인) → Tier-3 catalog + warning.
- `isNaverAffiliate`: `naver.me/x`=true; `brand.naver.com/...`·`smartstore...`·`ader.naver.com/...`=false.
- **기존 brand.naver.com 링크도 그대로 동작**: 매칭(Tier-1/2/3)되고, **구매 링크는 brand.naver.com 그대로 유지**(매칭 store URL로 교체 안 함). naver.me·brand.naver.com 섞여 있어도 둘 다 정상.
- **어떤 URL도 자동 교체 안 됨**(구매 링크 = 시트 값 그대로).
- 앵커 성공 제품(조선미녀 등) 회귀 0. `test:all`·typecheck·build·lint green.

## 운영자 데이터
- **기존 brand.naver.com URL은 정리하지 않아도 됨**(그대로 둬도 매칭·가격·구매링크 정상 동작). **앞으로 새로 넣는 네이버 링크만 `naver.me/*` 어필리에이트**로 넣으면 됨. 둘이 섞여 있어도 OK — 데이터 마이그레이션 불필요.

## 브랜치 & 적용
- `refactor/naver-affiliate-only`: `refactor: treat only naver.me as affiliate; match naver from affiliate-only link`, `test`, `docs: worklog`. 영어 PR → CI → merge.
- `git diff --check`, 시크릿·`docs/prompts`·`tmp` 비커밋.

## 막히면
- `naver.me` resolve가 광고형(`ader.naver.com`) 등으로 가 channelProductNo가 없으면 → 앵커 스킵하고 Tier-2/3 폴백(정상). 추측 가격 금지.
