# 용량↔개수/매수 오표기 원인 분석 (volume_unit conflation)

> 대상 증상: "200개", "40매", "27매", "185매", "매당 452원", "개당 2098원" 처럼
> **용량(ml/g) 숫자가 매수/개수로 표시**되거나, **ml당 단가가 매당/개당으로 라벨링**되는 문제.
> 2026-07-06 코드베이스 기준 분석.

---

## 1. 신고된 증상 요약

| # | 제품 | 실제 구성 | 화면 표기 | 잘못된 값 |
|---|------|-----------|-----------|-----------|
| A | 오큐라 티타늄셀 4.0 (부스터젤 200ml 2개 포함) — 기기 **1개** | 기기 1대 + 부스터젤 | "개당 419500원 2개 / 개당 2098원", 괄호 **"200개"** | 200 = **200ml**이 200개로, 2098 = ml당(419500/200)이 개당으로 |
| B | 아로셀 보툴케어 콜라겐 겔 마스크 42g, 4개입, 1개 | 마스크 | 쿠팡 **"40매, 매당 452원"** | 40 = 규격(≈42g/40매) 크기값이 매수로, 매당 = ml당 라벨 오류 |
| C | 리얼베리어 익스트림 크림 마스크 (3종 택1) | 1매 3,000원 | **"70매"** (제품 자체가 오매칭 의심) | identity 오매칭 + 매 라벨 혼동 |
| C' | 리얼베리어 익스트림 크림 마스크 27ml, 10개입, 1개 (쿠팡) | 10매입 | **"27매"** | 27 = **27ml**가 27매로 |
| D | [아이소이] 비건 제로 쿠션 **리필** 21호 (리필) 13g | 리필 단품 **1개** | **"2개"** | "리필" 단어를 본품+리필(1+1)로 오독 |
| E | 비플레인 시카테롤 블레미쉬 패드 185ml, 80매입, 1개 | 80매 | **"185매"** | 185 = **185ml**가 185매로 |

두 종류의 서로 다른 결함이 섞여 있다.

- **결함 1 — 단위 혼동(dominant):** A, B, C', E, 그리고 C·D의 "매/개" 라벨. `volume_ml`에 담긴 **ml/g 크기값**을 `volume_unit`('매'/'개') 라벨과 **무검증으로 결합**해 표시·계산한다.
- **결함 2 — 개수 오파싱:** A(200개), D(2개). 용량 숫자 또는 "리필" 단어가 **수량**으로 잘못 해석된다.
- **결함 3 — 제품 오매칭(identity):** C(70매). goodsNo 앵커가 있었음에도 다른 제품이 매칭된 것으로 의심.

---

## 2. 결함 1 — 용량↔단위 혼동 (핵심 원인)

### 2.1 불변식 부재

시스템 어디에도 **"`volume_ml`에 저장된 숫자의 실제 단위 == `volume_unit`"** 이라는 불변식이 없다.
`volume_ml`은 그냥 "숫자"로 취급되고, 표시·단가 계산 시 `volume_unit`(ml/g/매/개)을 **그대로 갖다 붙인다.**

### 2.2 표시 경로

`lib/queries/index.ts`
```ts
// 155
const volumeUnit = prod.volume_unit || 'ml';
// 191  판매처별 용량 = total_ml / 팩수량
const volumeMl = lp.total_ml != null && quantity > 0 ? Math.round(lp.total_ml / quantity) : null;
// 192  ml당 단가(=effective_unit_price/volume_ml) 그대로
const unitPrice = lp.unit_price !== null ? Number(lp.unit_price) : null;
```

`components/product/StorePriceCard.tsx`
```tsx
// 42  용량 라벨 = 크기값 + volume_unit  →  "185매", "200개", "40매"
<span>{store.volumeMl}{store.volumeUnit ?? 'ml'}</span>
// 77  ml당 단가를 volume_unit 라벨로  →  "매당 452원", "개당 2098원"
<span>{perUnit(store.unitPrice, store.volumeUnit)}</span>
```

`lib/format.ts`
```ts
// perUnit(2098, '개') → "개당 2098원"   (ml당 값에 '개' 라벨만 바꿔 붙임)
export function perUnit(unitPrice, unit?) {
  const u = unit && unit.trim() ? unit.trim() : 'ml';
  return `${u}당 ${Math.round(unitPrice).toLocaleString('ko-KR')}원`;
}
```

→ `volumeMl`(185)과 `unitPrice`(price/185ml)는 **ml 기준 숫자**인데, 라벨만 '매'로 바뀌어
"185매 / 매당 X원"으로 출력된다. **숫자는 ml, 라벨은 매** — 여기서 혼동이 발생한다.

### 2.3 단가 계산 경로

`crawler/core/normalize.ts`
```ts
// 183  기본값 = DB 대표 용량
let volume_ml = product.volume_ml || 50;
// 188  parsePackage 결과가 high면 그 unitAmount(=제목의 ml/g 숫자)를 volume_ml로 채택
if (ext && ext.detected && ext.confidence === 'high') {
  if (ext.unitAmount !== null) volume_ml = ext.unitAmount;      // 185, 27, 200 …
  else volume_ml = product.volume_ml || 1;
}
// 215
const total_ml = volume_ml * total_quantity;
// 230  ml당 = 개당가 / volume_ml   ← volume_ml이 "매"짜리 제품이어도 ml처럼 나눔
const unit_price = ... effective_unit_price / volume_ml ...;
```

`volume_ml`은 항상 "ml 크기값"으로 다뤄지고 `unit_price`는 그 값으로 나눈 **ml당**이다.
그런데 표시 계층이 `volume_unit='매'`를 붙이면 **매당인 척** 표시된다(실제론 ml당).

### 2.4 존재하지만 새는 정합성 가드

`volume_unit`이 '매'/'개'일 때 ml/g 용량을 제거하는 가드는 **이미 두 곳에 있다.**

- `crawler/core/titleParseGuards.ts:75-87` (LLM 경로)
- `crawler/core/parsePackage.ts:207-221` (게이트 경로)

```ts
} else if (ctx.volumeUnit === '매' || ctx.volumeUnit === 'sheet') {
  if (unitType === 'ml' || unitType === 'g') { volume = null; unitType = 'sheet'; ... }
}
```

그런데도 "185매"가 나오는 이유는 **세 가지 누수 지점** 중 하나다.

1. **DB 대표 용량 자체가 오염:** 가드가 `unitAmount`를 null로 만들면 normalize는
   `volume_ml = product.volume_ml`(2.3의 else 분기)로 폴백한다. 만약 운영자가 시트/기기 제품의
   `volume_ml`에 **185/40/200 같은 ml·규격 숫자를 넣고** `volume_unit`만 '매'/'개'로 뒀다면,
   가드를 통과해도 결국 그 숫자가 그대로 "185매/200개"로 표시된다. → ~~A·B가 이 경우로 유력~~
   **[2026-07-07 검증 결과 기각]** DB 전수 확인(§5-1 수행): 개-단위 7개 제품 전부 `volume_ml=1`,
   매-단위 11개 전부 매수(1~100) — **오염 0건**. A(오큐라 DB=1개)·B(아로셀 DB=4매) 모두 깨끗.
   따라서 실제 원인은 (2) 무가드 regex 폴백 경로다. 상세: `title-parsing-canonical-unit-design.md` §7-b.
2. **normalize의 무가드 regex 폴백(Check 3):** `normalize.ts:204-213`은 `parsedPackage`가 없거나
   저신뢰일 때 `extractPackageFromTitle(sourceText)`로 다시 파싱하는데 **여기엔 volume_unit 정합성
   가드가 없다.** 제목의 185ml를 그대로 `volume_ml=185`로 채택 → "185매".
3. **`ctx.volumeUnit` 미전달:** `run.ts:453`은 `product.volume_unit ?? null`을 넘긴다. DB에서
   `volume_unit`이 비어 있으면(→ null) 가드가 발동하지 않아 ml 용량이 살아남는다. 단, 이 경우
   표시 라벨도 `volume_unit || 'ml'` = 'ml'이 되어 "185ml"로 보여야 하므로, **화면에 '매'가
   보인다면 DB에는 '매'가 들어있는 것** → 결국 (1) 또는 (2)가 실제 원인.

또한 `parsedPackage` 주입 자체가 `run.ts:449`의 `if (llmTitleParseOn ...)` 안에서만 일어난다.
`LLM_TITLE_PARSE`가 꺼진 실행에서는 `offer.parsedPackage`가 아예 없어 **항상 (2)의 무가드 regex
폴백**을 타게 된다.

### 2.5 왜 "80매(정답)"가 아니라 "185매"인가

제목 "185ml, 80매입, 1개"에서 **매수 80은 올바르게 파싱되지만 버려진다.**

- 파서는 `unitAmount=185(ml)`, `unitCount=80(매)`을 만든다(`packageExtractor.ts` sheet 분기,
  또는 게이트 sheet 라우트).
- normalize의 수량 블록(`normalize.ts:141-163`)은 `uCount = ext.unitCount`를 쓰되
  `isCountValid = uCount>=1 && uCount<=20`으로 clamp한다. **80 > 20 → 블록 스킵 → `total_quantity=1`.**
- 결과: `total_ml = 185×1 = 185`, `volumeMl = 185/1 = 185` → "185매". 매수 80은 어디에도 반영 안 됨.
- 반대로 C'(27ml, 10개입)는 `uCount=10 ≤ 20`이라 `total_quantity=10`이 되고
  `volumeMl = (27×10)/10 = 27` → "27매". 역시 27은 ml.

즉 **매수(sheet count)를 담을 자리가 파이프라인에 없다.** `total_quantity`는 "팩 개수(개)"용이고,
시트 제품의 "매수"는 `unitCount`에만 잠깐 있다가 20 초과 clamp 또는 표시 미사용으로 소실된다.

---

## 3. 결함 2 — 개수 오파싱

### 3.1 D. 아이소이 "리필" → 2개

`crawler/core/packageExtractor.ts:158-170` (규칙 1b)
```ts
// 리필 / 본품+리필 (1+1) → 2개로 간주
if (/리필|본품\s*\+/.test(cleanTitle)) {
  const volM = cleanTitle.match(/(\d+...)\s*(ml|g)/i);   // 13g 매칭
  return { unitCount: 2, ... };                          // ← 무조건 2개
}
```
제품명 "**비건 제로 쿠션 리필** 21호 (리필) 13g"는 **리필 그 자체가 단품(1개)**인데,
"리필"이라는 단어만 보고 "본품+리필=2개"로 처리한다. 게이트(`parsePackage.ts:95`)도 `/리필/`을
needs-llm으로 보내므로 LLM이 이를 `main_count=2`로 답하면 가드
(`titleParseGuards.ts:90` countHasEvidence는 `리필`을 근거로 인정)를 그대로 통과한다.
→ regex·LLM 양쪽 모두 "리필 단품"과 "본품+리필 1+1"을 구분하지 못한다.

### 3.2 A. "부스터젤 200ml" → 200개 (재확인 필요)

증상의 "괄호 200개 / 개당 2098원"은 **결함 1**로 완전히 설명된다
(`volume_ml=200` + `volume_unit='개'` → 크기값 200이 "200개", ml당 2098이 "개당 2098"). 이 경우
개수 자체는 오파싱이 아니라 **200ml를 '개' 단위로 라벨링**한 것이다. "2개"는 제목 "2개 포함"에서
정상 파싱된 부스터젤 수량일 수 있다. 정확한 판별은 §5의 DB/로그 확인 필요.

---

## 4. 결함 3 — 제품 오매칭 (C. 리얼베리어 70매)

"3종 택1(장벽/수분/쿨링)" 큐레이션 제품에 **다른 규격(70매)** 제품이 붙은 정황.
올리브영 goodsNo 앵커가 도입됐는데도 오매칭된다면 후보 원인:

- 앵커 대상 URL이 **올리브영이 아닌 네이버/쿠팡 오퍼**여서 goodsNo 앵커 경로를 안 탐
  (`crawler/core/oliveyoungAnchor.ts`의 `goodsNoFromOyOfferLink`/`resolveCuratedOyGoodsNo`는
  올영 링크에서만 goodsNo를 뽑는다).
- 큐레이션 링크에 `goodsNo`/`sndVal`이 없어 앵커 미확보 → 이름 기반 매칭으로 폴백 → 이웃 SKU 선택.
- "3종 택1" 옵션 페이지가 하나의 goodsNo인데, 화면에 붙은 가격/규격이 옵션 중 다른 상품 것.

이 건은 결함 1/2와 별개이며, 해당 제품의 **매칭 로그(goodsNo 확보 여부·매칭 소스)** 확인이 필요하다.

---

## 5. 확인 필요 (DB / 크롤 로그)

코드 경로상 원인은 위와 같으나, "DB 오염 vs 파싱 누수"의 최종 판별에는 아래 데이터가 필요하다.
(모두 **읽기 전용 SELECT** — prod 쓰기 없음.)

1. 대상 제품들의 `products.volume_ml`, `volume_unit` 실제 값
   → A/B가 §2.4-(1)(DB에 ml/규격 숫자 + 매·개 단위)인지 확정.
2. 대상 리스팅의 매칭 소스(`listings.latest_matched_url`)와 크롤 시점 `sourceText`(제목)
   → C의 오매칭·앵커 확보 여부, D의 파싱 method(regex 1b vs LLM) 확정.
3. `listing_prices`의 `total_ml`, `total_quantity`, `unit_price`, `effective_unit_price`
   → "185매/200개/2098" 각 숫자가 어느 계산에서 나왔는지 역추적.

---

## 6. 개선 제안 (우선순위)

### P0 — 단위 정합 불변식 강제 (결함 1의 근본)
- `volume_unit`이 **매/개/장**인 제품은 `volume_ml`이 **개수/매수**여야 한다는 규칙을 한 곳에서 강제.
  - 표시: `StorePriceCard.tsx:42/77`에서 `volume_unit`이 매/개면 **ml당 단가·ml 라벨을 아예 표시하지
    않거나**, 매수 기반 값으로만 표시.
  - normalize: `normalize.ts` Check 3(regex 폴백, 204-213)에도 §2.4의 volume_unit 정합성 가드를
    적용해 매/개 제품의 ml 용량을 null 처리(현재 가드 누락 지점).
- DB 데이터 정리: 매/개 제품의 `volume_ml`에 들어간 ml/규격 숫자를 **실제 매수/개수**로 교정하거나,
  ml 규격은 별도 컬럼으로 분리.

### P1 — 매수(sheet count)를 파이프라인에 보존
- `total_quantity`(팩 개수)와 별개로 **sheet count(매수)** 를 normalize→listing_prices→UI까지 전달.
  현재 `unitCount`가 20 초과 clamp(`normalize.ts:146`)로 사라지는 문제(§2.5) 해결.
- 시트 제품의 "매당" 단가 = 개당가 / 매수 로 계산(ml당과 분리).

### P2 — "리필 단품" 판별 (결함 2, D)
- `packageExtractor.ts:158` 규칙 1b: 제품명이 **리필 그 자체**(예: "쿠션 리필", "(리필)")인 경우와
  "본품+리필" 1+1을 구분. LLM 프롬프트에도 "제품명이 리필 단품이면 main_count=1" 규칙 추가.

### P3 — 올리브영 goodsNo 앵커 커버리지 점검 (결함 3, C)
- 큐레이션 URL에서 goodsNo가 실제로 확보되는지, 앵커 실패 시 오매칭 대신 **inspection/link_only로
  라우팅**되는지 §5-2 로그로 확인 후 보강.
```
