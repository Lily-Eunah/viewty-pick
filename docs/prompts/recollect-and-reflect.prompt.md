# Claude Code 작업 프롬프트 — 재수집 + 웹 반영 (fix/naver-sku-matching, merge 전 검증)

> 목적: 수정된 매칭 로직으로 **라이브 가격을 재수집**하고, **viewtypick.com(noindex)에 반영**한 뒤
> ground-truth·카탈로그 분포를 검증한다. 검증 결과를 보고 **merge는 별도로 결정**한다(merge 안 함).
>
> ⚠️ 라이브(프로덕션) Supabase에 **쓰기** + 프로덕션 사이트 revalidate. 아래 안전순서 엄수.

---

## 0. 안전 원칙
- **반드시 `fix/naver-sku-matching` 브랜치에서 실행** — main엔 아직 옛 매처라 main에서 돌리면 또 잘못 수집됨. `git rev-parse --abbrev-ref HEAD`로 확인.
- **시작 전 백업**: `npm run ops:backup` (현 상태 JSON). 위치 보고.
- append-only·재실행 가능·잘못 매칭은 no_offer(잘못된 가격 안 뜸) → 가역. 그래도 제한→전체 순서.
- 시크릿 비노출. merge는 이 작업에 포함하지 않음.

## 1. 사전 점검
- 브랜치 = `fix/naver-sku-matching` 확인.
- env(이름만): `NAVER_CLIENT_ID/SECRET`, `COUPANG_ACCESS_KEY/SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `REVALIDATE_SECRET`.
- **revalidate 타깃 확인**: 크롤러의 on-demand revalidation이 **프로덕션 도메인**(`https://viewtypick.com/api/revalidate`)을 가리키고 `REVALIDATE_SECRET`이 **Cloudflare에 설정된 값과 일치**하는지(불일치/로컬 타깃이면 라이브 ISR 페이지가 안 바뀜). 환경변수/설정 확인.

## 1.5 시트 재import + override 확인 (시트 변경됨 → 필수 선행)
- 구글 시트가 수정됐으므로 **`npm run sheets:import` 먼저** → 정정된 제품명(유세린 하이알루론·바이오힐보 NAD)·URL(넘버즈인 쿠팡 상세)·데모 제거가 DB에 반영(dedup/reconcile). 처리/비활성 카운트·**중복 URL 0** 확인.
- **manual_override는 이제 *선택*** (매처 fix로 wrong 가격 제거됨): #34는 자동 매칭(14,400), #76은 held(가격 없음=안전). 즉 **override 없이 full sync 돌려도 틀린 가격 안 나감.** #76·INSPECT 등에 OY 가격을 *보여주고 싶을 때만* manual_override(커버리지용).

## 2. 제한 재수집 (sanity)
- ground-truth 제품만: `npm run crawler:sync -- --only=<유세린,토리든,라하,조선미녀,닥터지 등>` (어댑터 `--only`). **fix/naver-sku-matching 브랜치에서 실행.**
- 결과 확인: 유세린 60,900(앵커) / 토리든 단품 / 라하 16,800 / **#34 조선미녀 자동 14,400(맑은쌀 25,300 아님)** / **#76 held(틀린 토너 31,000 미노출)** / 묶음은 개당가.
- 이상(정상 단품이 held·틀린 가격) 있으면 **여기서 멈추고 보고**(전체 진행 전).

## 3. 전체 재수집
- `npm run crawler:sync` (전체). normalize·healthcheck·score·**revalidate**·notify 포함.
- 쿠팡 50/min·2s 간격 준수(빠름). 올영 via 네이버 포함. Discord는 mock이라 알림 미발송(정상).
- `crawl_runs`/`crawl_errors`/`last_crawled_at` 기록되는지 확인(이번 fix로 켜짐).

## 4. 웹 반영 (viewtypick.com)
- run.ts의 revalidate가 변경 경로(`/`, `/c/...`, `/p/...`, `/pick/...`)를 **프로덕션에 on-demand revalidate** 했는지 확인.
- **viewtypick.com에서 실제 반영 확인**: 유세린/토리든/라하 가격이 갱신되고, 랑콤·바이오힐은 가격 없이(no_offer) 빠지는지.
- ⚠️ **OpenNext in-memory 캐시 주의**(worklog §5): on-demand revalidation이 isolate 간 전파가 불완전할 수 있음. 페이지가 안 바뀌면:
  1. revalidate 재호출, 또는
  2. **`npm run cf:deploy` 재배포**로 캐시 클리어(가장 확실 — fresh Worker가 Supabase에서 재fetch), 또는
  3. ISR 윈도우 경과 대기.
  → 재배포로 확실히 반영하는 걸 권장.

## 5. 검증 (보고용)
- **ground-truth 표**: 제품 | 재수집 전(stored) | 후 | 실값 일치 여부.
- **카탈로그 분포**: 전체 listing 중 priced vs no_offer 건수. **정상 단품이 세트로 오분류돼 잘못 제외**됐는지 / **매칭돼야 할 게 안 됐는지** 점검(false exclusion/inclusion).
- no_offer로 빠진 제품 목록 = **데모/오큐레이션 감사 입력**(P0 카탈로그 정리로 연결).
- viewtypick.com 반영 스크린샷/확인 결과.

## 6. 보고 후 (merge는 별도)
- 위 검증이 깨끗하면 → **push + PR**(영어, ground-truth 표 + 분포) → 운영자 리뷰/CI 후 merge.
- 이상 발견 시 → 브랜치 수정 → 재수집 → 재검증(merge 금지).
- **이 작업 자체는 merge하지 않는다.**

## 7. 막히면
- `--only` 플래그가 없거나 형식이 다르면 어댑터/run.ts 확인 후 보고(전체부터 강행 금지).
- revalidate가 프로덕션에 안 닿거나 secret 불일치면 → 설정 보고, 재배포 폴백 사용.
- 정상 단품이 대거 no_offer로 빠지면(분류 과도) → 멈추고 분류 규칙·증거 보고(merge·전체확정 금지).
- 라이브 조회/쓰기가 환경상 막히면 추측 말고 "불가 + 사유" 보고.

---

## 참고
- 이 재수집은 **가격 *값*만** 정확하게 함. **별점·"20% 인하"·"OO원 하락"·다중팩 팩총액 표시·0원 정렬**은 웹 레이어라 그대로 — 별도 웹 수정 PR 필요.
- 재수집 후 priced 커버리지가 줄어드는 건 trust-first 의도된 결과(잘못된 가격 대신 no_offer).
