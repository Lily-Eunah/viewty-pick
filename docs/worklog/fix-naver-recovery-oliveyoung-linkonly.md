# fix/naver-recovery-oliveyoung-linkonly

- **일자**: 2026-09-07
- **배경**: 네이버 검색 API 종료(2026-07-31) 이후 네이버 가격이 34일째 갱신되지 않았고, 올리브영도 로컬 헤드풀 크롤이 계속 차단되어 두 판매처 모두 사실상 죽어 있었다. 진단해 보니 원인이 서로 달랐다.

## 진단 (실측)

### 네이버 — 원인 4중

| # | 원인 | 근거 |
|---|---|---|
| 1 | 검색 API 종료 → `searchNaverShopping`이 `!res.ok`에 **throw** | `run.ts` per-listing catch로 전파 → `fail_count`만 올리고 **스냅샷 미기록** → 뷰가 7월 스냅샷을 계속 노출 |
| 2 | 페이지 크롤 폴백이 `NAVER_PAGE_CRAWL` **기본 off** | 과거 진단이 "HARD-BLOCKED → recovery 0"으로 결론 |
| 3 | 그 진단이 **headless로 측정됨** | 같은 머신·IP에서 재측정: plain fetch 429 / headless 429 / **headful 200** |
| 4 | `detectSoldOut` **오탐** | 메인 노드는 `productStatusType:"SALE"`인데, ~7KB 떨어진 무관한 `"stockQuantity":0` 하나로 전체 품절 판정 → `naver.ts`의 `!crawled.soldOut` 게이트가 멀쩡한 가격 폐기 |

파서 자체는 **정상**이었다. headful로 받은 실제 HTML에 프로덕션 파서를 돌리면 `regularPrice:20000 / salePrice:14000`(이니스프리), `70000 / 49000`(에뛰드)을 정확히 복구한다.

부수 발견: `handleConsecutiveFailures`의 비활성화 조건이 `newFailCount === 3`(등호)이라, 3을 넘어간 리스팅은 **두 번 다시 비활성화되지 않는다.** 실제로 네이버 리스팅 116건이 `fail_count=34, is_active=true` 상태로 매일 조용히 실패하고 있었다.

### 올리브영 — 정직한 경로가 모두 닫힘

- Naver-sourced 경로: 검색 API 종료로 소멸.
- 페이지 크롤: headless 403, **headful도 403**(큐레이트 goodsNo 3건 전부), 일반 에이전트 브라우저도 50초+ 챌린지 미해제. 문서상 과거엔 "headful+레지덴셜 3/3 통과"였으므로 WAF가 강화된 것으로 보인다.
- 올리브영에 IP 화이트리스팅/피드를 요청했으나 **거절**.
- 남은 간극은 "자동화 신호를 감추는 것" = 탐지 회피이며, AGENTS.md 규정 준수 수집 원칙상 채택하지 않는다.

## 변경

### 네이버 복구
- `crawler/core/naverPageCrawl.ts`
  - `chromium.launch({ headless: !HEADFUL })` — **헤드풀 기본**(`NAVER_CRAWL_HEADFUL=off`로 강제 headless 가능, 진단용). UA 스푸핑·anti-detection 플래그는 **없음**(헤드풀 Chromium은 실제 브라우저라 자기 UA가 곧 정직한 UA).
  - 네비게이션 **1회 리트라이**(런 첫 요청에서 `ERR_CONNECTION_RESET` 후 재시도 성공 관측).
  - `detectSoldOut`을 **메인 상품 노드로 스코프**. 앵커는 가격 파서와 동일한 "첫 2자리 이상 `salePrice`"(네이버가 앞쪽에 심는 디코이 `"salePrice":0`은 `\d{2,9}` 하한으로 양쪽 모두 건너뜀). 메인 노드를 못 찾으면 `false` — 그런 페이지는 어차피 가격도 못 뽑아 link-only로 간다.
- `crawler/adapters/naver.ts`
  - 검색 API를 **opt-in(`NAVER_SHOPPING_API`, 기본 off)**. throw 대신 `[]` 반환 → 전 호출자가 anchor-miss로 자연스럽게 강등되고 페이지 크롤이 가격을 공급한다. **삭제가 아니라 스위치** — API 매칭 ~1,300줄 제거는 회귀 원인 분리를 위해 별도 리팩터로 남긴다.
  - 페이지 크롤 게이트 **기본 on**(`NAVER_PAGE_CRAWL=off`로 비활성화).
- `crawler/core/healthcheck.ts` — `newFailCount === 3` → **`>= 3`**. 비활성화는 멱등이므로 이후 실패마다 재확정해도 안전하고, 기존 `>= 5` 알림 분기는 흡수된다.

### 올리브영 링크 전용
- `crawler/adapters/oliveyoung.ts` — `OLIVEYOUNG_PRICE_COLLECTION`(기본 off) 게이트를 mock 분기 뒤에 추가. 네트워크 호출 없이 즉시 `no_offer` 반환.
  - **`no_offer`를 쓰는 것이 핵심.** `listing_prices_public`은 최신 스냅샷이 `ok`인 리스팅만 노출하므로, 스냅샷을 쓰는 행위가 곧 **정지 이전의 묵은 가격을 회수**하는 동작이다. 단순히 크롤을 안 돌리면 옛 가격이 영원히 남는다(실제로 한 제품이 7/15 가격을 7주 뒤까지 "🏆 최저가"로 노출 중이었다).
  - `inStock: true` 유지 → `manual_override`(tier 3)로 운영자가 가격을 채울 수 있는 경로는 보존.
  - 큐레이터 `affiliate_url`은 그대로 구매 링크로 렌더 → **쇼핑 큐레이터 수수료 영향 없음.**

### 실행 위치 재배치
- `.github/workflows/crawl.yml` — `--skip-seller=oliveyoung` → **`--skip-seller=naver`**.
  - 네이버는 헤드풀이 필요해 러너에서 못 돈다 → 로컬로.
  - 올리브영은 이제 **건너뛰지 않는다.** 매 런 `no_offer`를 남겨야 묵은 가격이 회수되고, 어댑터가 즉시 반환하므로 비용이 없다.
- `scripts/ops/naver-local-crawl.ts` (신규) + `naver:crawl:local` — `--only-seller=naver --skip-import`, `NAVER_PAGE_CRAWL=on`, 자기 자신에 한해 `CRAWLER_ALLOW_PROD_WRITE=true`. 기존 올리브영 로컬 러너와 동일한 패턴.
- `scripts/ops/oliveyoung-local-crawl.ts` — **DORMANT** 표기. 삭제하지 않음(재개 대비). **Windows 작업 스케줄러에서 등록 해제 필요.**

### 검증 도구
- `scripts/live-check/live-check-naver-page.ts` (신규) + `live-check:naver-page` — 프로덕션 파서를 실제 페이지에 돌리는 read-only 검증. `.env` 불필요. 다음에 네이버가 구조를 바꿨을 때 "네이버가 바뀐 건가, 우리 크롤이 깨진 건가"를 5초에 판정한다.

## 테스트

- `crawler/core/__tests__/naverPageCrawl.test.ts` — 기존 sold-out 픽스처에 메인 노드 앵커 추가(구 픽스처는 버그 있는 계약을 인코딩하고 있었다), 회귀 3건 신규:
  - 메인 노드에서 ~7KB 떨어진 `"stockQuantity":0` → **NOT soldOut**
  - 디코이 `"salePrice":0`이 앵커가 되지 않음
  - 메인 노드 부재 → not soldOut
- 게이트: `typecheck` clean · `test:all` **전부 통과** · 변경 파일 `eslint` clean.
- 라이브: `npm run live-check:naver-page` → 이니스프리 `20000/14000 soldOut:false` **OK**, 에뛰드 `70000/49000 soldOut:false` **OK**. (수정 전에는 둘 다 `soldOut:true`로 가격이 폐기되던 건들.)
- `next build` / `cf:build`는 미실행 — 크롤러·워크플로만 변경했고 렌더링 경로는 건드리지 않았다.

## 롤아웃 순서

1. 머지 후 **`npm run naver:crawl:local`을 수동으로 1회** 실행하고 네이버 가격이 사이트에 정상 반영되는지 확인.
2. 확인되면 Windows 작업 스케줄러에 `naver:crawl:local` **등록**, `oliveyoung:crawl:local` **해제**.
3. 다음 GitHub 크롤에서 올리브영 행이 link-only로 바뀌고 묵은 가격이 사라지는지 확인.

## 후속: 로컬 머신 의존을 없앨 수 있는가 (프로브 추가)

로컬 헤드풀 배치에는 운영 문제가 있다 — **운영자 PC가 절전에 들어가면 예약 작업이 실행되지 않는다**(올리브영에서 실제로 겪음). 그러면 "매일 갱신"이 사실이 아니게 된다.

그런데 네이버 차단은 **IP가 아니라 브라우저 지문 기반**으로 보인다. 2026-09-07 같은 머신·같은 IP에서 몇 분 간격으로: plain fetch 429 · headless 429 · **headful 200**. IP가 변수가 아니었다면 가상 디스플레이를 쓰는 CI 러너로도 충분할 수 있다.

`.github/workflows/naver-headful-probe.yml`(`workflow_dispatch`, read-only, 시크릿 없음)이 이를 측정한다. 러너에서 A) headless(컨트롤) → B) `xvfb-run` 헤드풀을 연달아 돌리고 결과를 `$GITHUB_STEP_SUMMARY`에 결론까지 써 준다.

- **B 성공** → 지문 문제 확정. `crawl.yml`에서 `--skip-seller=naver`를 빼고 Playwright 설치 + `xvfb-run`을 crawl 잡에 추가, `naver:crawl:local`은 은퇴시키고 작업 스케줄러에서 해제. 운영자 PC가 일일 경로에서 빠진다.
- **B 실패** → 러너에서는 IP도 변수. 로컬 실행 유지 + 절전 대응(작업 스케줄러의 "작업 실행을 위해 절전 모드 해제", "예약 시작을 놓친 경우 가능한 대로 빨리 실행") + 신선도 가드가 필요하다.

올리브영 결과(headful도 403)를 네이버에 그대로 전이시키면 안 된다 — Cloudflare는 IP에 민감하고 네이버는 지문에 민감해 차단 성격이 다르다.

지원 변경: `live-check:naver-page`가 크롤러와 같은 `NAVER_CRAWL_HEADFUL` 스위치를 읽는다(기본 headful, `off`면 headless). 로컬 실측 — headless는 429 ×3, 헤드풀은 두 건 다 OK.

## 남은 이슈 / TODO

- **신선도 가드 미적용(운영자 판단으로 보류).** 뷰에 절대 상한(`crawled_at > now() - interval`)이 없어, 크롤이 아예 멈추면 여전히 묵은 `ok` 스냅샷이 최저가로 노출된다. 이번 변경은 올리브영·네이버 두 케이스를 개별적으로 막을 뿐 구조적 방어는 아니다.
- **API 매칭 ~1,300줄 정리** — `NAVER_SHOPPING_API=off`로 죽은 코드가 된 Tier-1/2/3·`fallbackPolicy`·공식몰 게이트 제거는 별도 PR.
- **에뛰드 큐레이트 링크가 `500ml, 2개` 세트를 가리킨다**(정가 70,000 / 49,000). 사이트는 500ml 단품 23,450원을 표시 중이므로, 복구 후 첫 크롤에서 `extractPackageFromTitle`이 "2개"를 제대로 잡는지 확인 필요.
- **올리브영 재개 조건** — 화이트리스팅이나 피드가 생기면 `OLIVEYOUNG_PRICE_COLLECTION=on` + 스케줄러 재등록.
