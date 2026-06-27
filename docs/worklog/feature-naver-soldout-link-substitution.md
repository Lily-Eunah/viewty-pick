# feature/naver-soldout-link-substitution

## 배경 / 문제

운영자가 시트에 건 네이버 smartstore 링크(특정 SKU)가 **품절**되면, 그 상품이 네이버 쇼핑 검색 결과에서 빠진다. 그 결과:

1. Tier-1 앵커(`/products/{N}`) 미스 → Tier-2 공식몰 폴백(B2)이 **같은 공식몰의 다른 활성 구성**(가격·용량 모두 다름)을 매칭해 가격을 채택.
2. 교체된 링크는 `latest_matched_url`에만 들어가는데, `/go` 리디렉션 우선순위가 `affiliate_url → latest_matched_url → url`이라 **`affiliate_url`(= 운영자 시트 링크)이 항상 이김** → 바로가기는 여전히 품절 페이지로 이동, 시트값도 그대로.
3. B2는 `warn:false` / `outcome:'ok'` → inspection·link_only 어느 쪽에도 안 들어감.

결과: **노출 가격(다른 SKU) ↔ 클릭 도착 페이지(품절 원본) 불일치**, 게다가 무경고.

## 운영자 결정 (의도된 동작)

- 비-`naver.me` 네이버 링크는 어필리에이트가 아니라 단순 공식몰 제품 링크 → **교체 허용**.
- 품절로 원본 구성이 사라지면 **공식몰 다른 구성의 가격·링크를 정식 채택**하고 **시트값도 갱신**.
- 단, **운영자가 처음 입력한 원본 링크는 보존**(새 컬럼) + **Discord 통보**.

## 구현 요약

- `crawler/adapters/index.ts` — `PriceOffer.linkSubstituted?: boolean` 추가.
- `crawler/adapters/naver.ts` — `fetchOffer` 폴백 분기에서 `linkSubstituted = (fallbackTier==='official-store' && updateLink)`. 즉 **B2(공식몰 + 비어필리에이트)만 true**; A2(어필리에이트 유지)·catalog·Tier-1 앵커는 false.
- `crawler/run.ts` — B2 교체 시:
  - DB `url`/`affiliate_url`을 새 링크로 즉시 갱신(import 전에도 `/go`가 새 구성으로) → Supabase `listings.update` + mock 머지에 두 필드 추가.
  - `naverLinkSubs`(시트 라이트백용) + Discord 메시지 수집, 영속화 직후 시트 라이트백 호출(Supabase + Google 설정 시), 일일 요약에 전달.
- `crawler/sheets/linkWriteback.ts` (신규) — `planNaverLinkWriteback`(순수) + `writeBackNaverSubstitutions`(best-effort IO).
  - `product_links`에서 **product_key(우선) → product_name** 매칭(importer `resolveProductKey`와 동일 규칙).
  - **WRITE-ONCE**: `naver_prev`가 비어있을 때만 운영자 원본을 그곳에 보존(이후 자동교체 링크로 덮지 않음), `naver`는 새 링크로 갱신. 동일값이면 no-op.
- `crawler/sheets/setup_headers.ts` — `product_links` 헤더 **맨 끝에 `naver_prev` 추가**. (setup_headers는 row1만 덮어쓰므로 중간 삽입 시 기존 zigzag/ably 데이터가 어긋남 → 반드시 끝에.)
- `crawler/core/notify.ts` — 일일 요약에 🔁 "네이버 링크 교체" 섹션.

## 주요 변경 파일

| 파일 | 내용 |
|---|---|
| `crawler/adapters/index.ts` | `linkSubstituted` 플래그 |
| `crawler/adapters/naver.ts` | B2에서 플래그 set |
| `crawler/run.ts` | DB url/affiliate_url 갱신 + 라이트백/Discord 수집·호출 |
| `crawler/sheets/linkWriteback.ts` (신규) | 시트 라이트백 plan + IO |
| `crawler/sheets/setup_headers.ts` | `naver_prev` 헤더(끝에) |
| `crawler/core/notify.ts` | Discord 교체 통보 섹션 |
| tests | `linkWriteback.test.ts`(신규), `naver.test.ts`, `summary.test.ts`, `package.json`(test:linkwriteback + test:all) |

## 설계 노트

- **마이그레이션·리디렉션 코드 변경 불필요.** 교체 링크가 `affiliate_url`로 들어가 기존 우선순위(`affiliate_url` 우선)를 자연히 활용.
- 영구 일관성: 시트 `naver`=새 링크 → 다음 `sheets:import`가 `url`/`affiliate_url`을 그대로 이어받음. `link_key=naver_{product_key}`는 URL 비의존이라 행 교체 아닌 갱신(orphan 없음).
- 교체된 구성은 다른 용량/가격일 수 있음(의도). `naver_prev` + Discord로 추적, 운영자가 유지/원복 판단.

## 테스트 결과

- `npm run test:all` — ALL PASSED (신규 `test:linkwriteback` 포함).
- `npx tsc --noEmit` — error 0.
- lint — 신규 경고 없음(기존 경고 3건만).

## 운영자 후속 조치 (merge 후)

1. `npm run sheets:headers` — `product_links`에 `naver_prev` 열 추가(맨 끝, 기존 데이터 비파괴).
2. 다음 `crawler:sync`부터 적용. 교체 발생 시 Discord 🔁 알림 + `naver_prev`에 원본 보존.

## 남은 이슈 / TODO

- 없음. (선택) 교체가 잦은 제품은 운영자가 원본 SKU 재입고 시 `naver_prev` → `naver` 수동 원복.
