# refactor/naver-anchor-miss-linkonly

## 목표 (C + D)
- **C**: 비앵커 **가격비교 catalog 최저가**(Tier-3)를 제거 → inspection 아닌 **link_only**. 리셀러/비공식 가격이라 운영자 링크 가격과 거의 안 맞아 가치 없음. 복잡 로직 삭제. **공식스토어(Tier-2) 폴백은 유지.**
- **D**: Discord 검수대기/세트확인 메시지에서 **링크 제거**(메시지 길이만 늘림 — 링크는 시트/데이터에 있음).

## 변경
- `naver.ts`
  - `pickCatalogFallback` 함수 삭제, `matchNaverOffer`에서 Tier-3 호출 제거 → 공식스토어 미매칭 시 link-only.
  - `fallbackTier` 타입 `'official-store' | 'catalog'` → `'official-store'`. `fallbackPolicy`에서 catalog 분기 제거.
  - `fetchOffer`의 catalog(A3/B3) 분기 삭제(이제 official-store만) — '네이버 가격비교' mallName/임시 warning 사라짐. `CATALOG_LINK_RE`는 `isIndividualMallOffer`에서 계속 사용(유지).
- `run.ts`
  - 검수대기 Discord 라인에서 `c.link` 제거.
  - `nJongVerifyItems`에서 링크 제거(`제품 @ 판매처`만).
- `naver.test.ts`: catalog 관련 테스트(`pickCatalogFallback`, fallbackPolicy catalog, linkSubstituted catalog 케이스) 삭제/정리.

## 동작
- 네이버 앵커 미스 → 공식스토어 폴백만 시도(있으면 warning/검수, 링크정책 A2/B2 유지) → 없으면 **link_only**(가격 미채택). catalog 최저가는 더 이상 채택/검수되지 않음.
- Discord 메시지 짧아짐.

## 테스트
- `test:naver`(catalog 테스트 제거 후) ✅, `test:all` exit 0 ✅, `tsc` ✅.
