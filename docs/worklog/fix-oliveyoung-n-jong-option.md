# fix/oliveyoung-n-jong-option

## 문제
올리브영 "N종"(2종/3종/4종) 상품이 **세트로 오판정**되어 가격에서 제외(보류)됨.
"N종"은 대개 물리적 세트가 아니라 **"N종 중 택1" 옵션선택 페이지(단품 구매)**이므로
정상 매칭되어야 한다. 다만 진짜 세트일 수도 있으니 운영자가 디스코드로 확인할 수 있게 한다.

## 원인 (프롬프트 가정과 실제 코드 차이)
프롬프트는 올리브영 매처가 `classifyOfferComposition`(SET_KEYWORDS의 `2종|3종|4종`)으로
N종을 거른다고 봤으나, 실제 올리브영 경로(`pickOliveYoungOffer`)는 그 함수를 쓰지 않는다.
실제 배제 지점은 **`packageExtractor.ts`의 heterogeneous 게이트**:

```
const heteroSignal = ... || /\d+\s*종/.test(cleanTitle) || ...;
```

`pickOliveYoungOffer`는 `extractPackageFromTitle(t).heterogeneous`가 true이면 auto-price에서
제외하고 `needsInspection`(hold)으로 보낸다. 즉 **단독 "N종"도 무조건 heterogeneous로 보류**되었다.
→ 두 곳을 모두 고치되, N종 판정을 **단일 소스(packageExtractor)**로 통일.

## 변경
### 1. 단독 "N종"은 세트로 보지 않기 (단일 소스)
- `crawler/core/packageExtractor.ts`:
  - `N_JONG_RE` / `N_JONG_SET_RE` / `isBareNJong()` 추가·export.
  - `N_JONG_SET_RE`: `N종 세트/구성/기획/패키지/콜렉션/컬렉션/기프트/선물` (또는 그 단어가 N종 앞)일 때만 세트.
  - heterogeneous 게이트를 `/\d+\s*종/` → `N_JONG_SET_RE`로 교체. **단독 N종은 heterogeneous 아님 → 단품 가격 산정.**
- `crawler/adapters/naver.ts`:
  - 로컬 중복 정의 제거, `N_JONG_SET_RE`/`isBareNJong`를 packageExtractor에서 import.
  - `classifyOfferComposition`의 `SET_KEYWORDS`에서 `2종|3종|4종` 제거, `N_JONG_SET_RE` 분기 추가
    (naver strict 경로 `pickOfficialOffer`도 동일 정책 적용).
  - 기존 세트 판정(`+`결합, `×N`, `N개/팩/병/입/매(N≥2)`, 선물/기획세트/더블팩/리필/디바이스 등)은 그대로 유지.

### 2. "N종" 매칭 건 디스코드 확인 알림 (정보성)
- `containsBareNJong(title)` (naver.ts, `isBareNJong` 래퍼) — 가격 잡힌 오퍼 title의 단독 N종 감지.
- `PriceOffer.nJongVerify?: boolean` 추가 — 올리브영/네이버 어댑터의 **가격 매칭 반환**에 세팅
  (OY 매칭, Naver Tier-1 앵커, Tier-2/3 fallback, page-crawl).
- `run.ts`: 가격 반영(ok/warning) 시 `nJongVerifyItems`에 `제품 @ 판매처 링크` 수집 → 일일 요약 전달.
- `notify.ts`: `🔎 N종 옵션 링크 — 세트 여부 확인 (정보, 가격 노출 유지)` 줄 추가.
  **가격 노출은 막지 않음**(inspection hold 아님). 운영자가 보고 진짜 세트면 그때 조치.

## 주요 변경 파일
- `crawler/core/packageExtractor.ts` — N종 단일 소스 + heterogeneous 게이트 완화
- `crawler/adapters/naver.ts` — import 통일, classifyOfferComposition/SET_KEYWORDS, containsBareNJong, nJongVerify 세팅
- `crawler/adapters/oliveyoung.ts` — 매칭 반환에 nJongVerify
- `crawler/adapters/index.ts` — `PriceOffer.nJongVerify`
- `crawler/core/notify.ts` — `nJongVerifyItems` + 요약 줄
- `crawler/run.ts` — 수집·전달
- 테스트: `naver.test.ts`, `packageExtractor.test.ts`, `summary.test.ts`

## 테스트 결과
- `test:naver` / `test:oliveyoung` / `test:summary` / `package:extract:test` green
  - 단독 "쿠션 2종" → single / OY auto-price / containsBareNJong=true
  - "2종 세트", "기획 3종 구성", "3종 패키지" → set / OY hold / containsBareNJong=false
  - "2종 기획"(기존 케이스) → heterogeneous 유지(회귀 0)
  - "1+1", "×2", "N개" 등 기존 세트 회귀 0
- `npm run test:all` green
- `typecheck` / `lint`(기존 무관 warning 1건 외 0) / `build` green

## 회귀 확인 (naver 경로)
단독 N종 완화는 공유 분류기/extractor를 통해 naver에도 적용됨. 진짜 "N종 세트"는
세트어 동반 규칙(`N_JONG_SET_RE`)으로 계속 세트 처리됨을 케이스로 검증.

## 남은 이슈 / TODO
- merge 후 `crawler:sync`로 올리브영 N종 제품 가격이 실제로 잡히는지 + 디스코드 확인줄 노출 확인.
- 디스코드 확인줄에서 진짜 세트로 판명된 건은 운영자가 시트/단품 링크로 조치(옵션선택이 아닌 세트 페이지면 링크 교체).
