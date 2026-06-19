# Claude Code 작업 프롬프트 — 매처: 멀티쿼리 앵커 recall + 앵커 미스→링크만 + 세트/묶음 *포함*(개당가)

> 결정(운영자):
> - **세트/묶음(1+1·다중팩·본품+리필 등)도 가격 수집에 *포함*** — 제외하지 않는다. 같은 제품을 더 싸게 사는 선택지이므로 **개당가(혜택가)로 표시**한다. 핵심은 **개수/구성 정확 파싱.**
> - **N 앵커로 *정확한 큐레이션 SKU*를 못 잡으면(식별 불가) → 링크만(가격 없음).** fuzzy 제목매칭 가격은 금지(다른 제품 가격 노출 방지).
> - 앵커 recall은 **멀티쿼리**(brand+name → brand+category …)로 높인다(여전히 N 앵커).
>
> 베이스: `fix/naver-sku-matching`(2-tier 매처 수정). DESIGN §4.3(기본가/혜택가/ml당) 정합.

---

## 0. 핵심 방향 (이전 "세트 제외" 정책 폐기)
- **가격 = N 앵커로 확정된 큐레이션 SKU**(단품이든 세트든 *그대로 수집·가격화*).
- **fuzzy 제목/변형 매칭은 가격 소스에서 제거** — 앵커로 식별 못 하면 링크만.
- 앵커 미스 = `no_offer`(링크만) → fail_count 미증가(no-match는 fetch 실패 아님).

## 1. 변경

### 1a. 멀티쿼리 앵커 recall (Tier-1)
- 1차 `cleanQuery(brand, name)`(display=100) → N(`/products/{N}`) 미발견 시 **추가 쿼리**: `brand + category`(토리든 세럼 / 닥터지 크림 등; category는 `products.category`), 선택적으로 `brand + 핵심토큰`(오타 이름 우회). 여전히 **link→/products/{N} 앵커**.
- **비용 통제**: 결과를 브랜드/공식몰 prefilter → 상위 K개 link만 resolve → N 일치 시 중단. listing당 resolve 글로벌 캡(≤6) + naver.me N캐시.

### 1b. 앵커 결과 = 무조건 가격화 (묶음/증정 포함) — `packageExtractor`/`normalize` 정확 파싱
앵커된 항목을 구성/수량 판정하고 **모두 수집**:

| 구성 | 처리 | 표시 |
|---|---|---|
| **단품** | qty=1 | base = 판매가 |
| **동질 묶음**(1+1·2+1·N개입·×N·본품+리필·동일용량 additive) | qty=N → **effective 개당가 = 가격/N**, ml당 | "N개 / 개당 X원" + base |
| **증정형**(본품 + 여행용/미니/사은품 증정 — *우리 카탈로그의 유일한 이종 형태*) | 본품 qty=1, **증정품은 수량·용량·가격에 일절 미반영, 라벨만**(DESIGN §4.3) | base = 본품 판매가 + "○○ 증정" 라벨 |
| (이종 2제품 세트: 토너+세럼 *둘 다 본품*) | **링크에 안 넣음 → 미발생.** 혹시 나오면 추측 가격 금지 → **검수 알림** | — |

- **개수 파싱이 핵심**: `extractPackageFromTitle` 보강 —
  - 1+1·2+1·N개입·×N·본품+리필·동일용량 additive → **동질 수량 N**.
  - **증정/여행용/미니/사은품/샘플(`+…증정`, `여행용 토너 증정`, `7ml*2` 등) → 수량·용량 미반영, 라벨만** — *증정품을 수량으로 세거나 용량에 더하지 않게*(예: "세럼 30ml + 토너 20ml 증정" = 30ml 세럼 1개, 50ml/2개 아님). (현 버그 수정.)
  - 'set'을 무조건 수량2로 흡수하던 것도 수정.
- normalize: `base_unit_price`/`effective_unit_price`(개당)/`unit_price`(ml당)를 **본품 기준**으로. 증정품은 가격·수량·용량에 일절 미반영.

### 1c. 앵커 미스 → 링크만 (trust)
- 멀티쿼리에도 N이 안 뜨면(식별 불가) → `no_offer`(가격 없음, 링크 노출). **fuzzy 제목 가격매칭 금지.**

### 1d. 올영 — 4단계 노출 제어 (운영자 확정)
OY는 oy.run이라 **N 앵커 불가** → Naver 내 **올리브영 판매점(mallName='올리브영') 매칭**으로 가격 수집. 큐레이터 제휴 링크(`affiliate_url`) 유무 + 수집 결과로 4단계:

1. **Tier 1 (Hidden)**: `affiliate_url` 없음 → OY 미판매 제품 판단 → **OY 행(가격·구매버튼) 숨김.**
2. **Tier 2 (Naver)**: `affiliate_url` 있음 + 네이버에서 올영 판매점 제품 매칭 성공 → **그 가격 표시**(세트/1+1이면 §1b대로 개당가 포함), 링크=`affiliate_url`.
3. **Tier 3 (Manual)**: 네이버 OY 수집 실패 + `manual_override` 있음 → **수동 가격** 표시, 링크=`affiliate_url`.
4. **Tier 4 (Link-only)**: 수집·수동 모두 없음 → **가격 비움 + 상세 링크 버튼(`affiliate_url`)만.**

- **매칭 정책 — 엄격 토큰 금지(느슨 매칭).** OY는 검증된 단일 판매처라 `mallName='올리브영'` 자체가 강한 신뢰 신호. 제목엔 인플루언서픽·증정 등 홍보문구가 많아 **변형 토큰을 엄격히 적용하면 정상 제품이 오히려 탈락**한다. → **mallName 일치 + 합리적 제목 유사도면 채택**(네이버 브랜드스토어의 strict 잣대를 OY엔 적용하지 않음).
- **모호 → 자동 기각/추측 대신 검수 알림.** OY 후보가 복수이거나 확신이 낮으면 **Discord/검수 큐로 알림**(운영자 검토). 검토 전엔 틀린 가격 노출 방지 위해 Tier-3/4(수동/링크만)로 두고, 운영자가 `manual_override`로 확정.
- **(선결) mallName 표기 확인**: OY가 네이버 검색에서 실제로 어떤 `mallName`으로 뜨는지 확인 — `올리브영`으로 통일되는지, `올리브영 공식`/`oliveyoung` 등 변형이 있는지. catalog-match-map 데이터/read-only로 확인해 **허용 mallName 집합**을 확정(매칭 키).

## 2. 검증 (read-only map before/after)
- 멀티쿼리 앵커 hit-rate, 회복 listing.
- **가격 붙은 네이버 listing = 100% 앵커된 SKU**(단품 또는 세트, 개수 파싱됨). fuzzy 가격 0건.
- **묶음/증정이 정상 수집**되는지(라하 6개 개당 11,300, 더마 5팩 개당, 본품+리필; 증정형은 본품가 + 라벨·증정품 미반영).
- 앵커 미스 → 링크만, **틀린 가격 0**. 쿠팡 영향 없음.
- 분포: 앵커-단품 / 동질묶음(개당) / 증정형(본품가+라벨) / 미스(링크만).

## 3. 테스트
- packageExtractor: 1+1/2+1/N개입/×N/본품+리필 → 동질 수량 N; **증정/여행용/미니/샘플 → 수량·용량 미반영(라벨만)** ("세럼 30ml + 토너 20ml 증정" → 30ml·1개).
- normalize: 동질묶음 effective 개당가·ml당 정확, 증정품은 가격·수량·용량 미반영(본품 기준).
- 멀티쿼리 앵커 recall, 앵커 미스→링크만(fuzzy 금지·fail_count 미증가), resolve 캡/캐시.
- 기존 coupang/healthcheck/publicprices 회귀. `test:all`·typecheck·build·lint green.

## 4. 브랜치 & 커밋 (CLAUDE.md)
- `fix/naver-sku-matching` 커밋:
  - `feat: multi-query anchor recall (brand+category fallback to find N)`
  - `refactor: drop fuzzy title price matching → link-only on anchor miss`
  - `fix: packageExtractor — homogeneous qty vs heterogeneous set vs gift`
  - `feat: include anchored sets/bundles with per-unit (effective) pricing`
  - `feat: OY (no anchor) → link-only unless manual_override`
  - `test: anchor recall + set inclusion + link-only fallback`
  - `docs: catalog-match-map re-run (distribution)`
- 각 커밋 전후 `git diff --stat`/`git diff --check`/`git show --stat HEAD`. 시크릿·`docs/prompts`·`tmp`·`UI_DESIGN.md` 비커밋. **DB 쓰기 없음**(검증 read-only).

## 5. Definition of Done
1. 멀티쿼리 앵커 recall + resolve 캡/캐시.
2. **앵커된 SKU는 단품/세트 모두 가격 수집** — 동질묶음 개당가, 이종세트 세트가+라벨, 증정 라벨만. 개수 파싱 정확(테스트).
3. **앵커 미스/OY-무앵커만 링크만**(fuzzy 가격 0). 틀린 가격 0.
4. map 재실행 before/after 분포·회귀 없음. test/build green, worklog.

## 6. 막히면
- 이종 2제품 세트(토너+세럼 둘 다 본품)는 발생 안 함 — 혹시 나오면 추측 가격 금지 → 검수 알림.
- 동질 묶음 vs 증정 구분이 애매하면 **증정(본품가, 증정 라벨)으로 보수 처리** + 보고(증정품을 수량으로 세지 않기).
- 멀티쿼리에도 링크만이 과도하면 분포 보고(fuzzy 가격으로 메우지 말 것).

---

## 연결된 후속 (별도, 웹 레이어)
- **표시/정렬**: 다중팩은 "N개/개당가" 헤드라인 + **개당가(effective) 기준 정렬**(라하 쿠팡 6개가 네이버 1개보다 위로), 이종세트는 "세트가" 라벨, 0원/가격없음은 맨 뒤. + tier-4 link-only 행 렌더("…에서 보기").
- 이건 웹 PR. 이 매처 PR은 *값/구성 정확 수집*까지.
