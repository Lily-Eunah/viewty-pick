# fix/set-classification-evidence-based

세트/이종 판정을 **증거기반(evidence-based)** 으로 정밀화. PR #44(bare "N종"→single) +
PR #45(per-retailer volume) 위에서 3가지를 함께 처리.

## 배경 / 문제

기존 `N_JONG_SET_RE`(N종 + 세트/구성/**기획**/패키지/콜렉션)가 `classifyOfferComposition`
과 packageExtractor `heteroSignal` 양쪽에서 set/heterogeneous를 만들었다. 그래서

- "닥터지 더모이스처 배리어 D 인텐스 크림 **100ml 기획 3종**"(단일 제품·단일 용량)이
  "기획"이라는 모호한 마케팅 단어 때문에 이종으로 잘못 제외(link-only) 되었다.
- "[아벤느] B3 세럼 **30ml +부스트 10ml**"(본품 30ml + 소량 부스트)가 `+`/2용량 때문에
  heterogeneous(inspection) 처리되어 가격이 노출되지 않았다.

## 구현 (3가지)

### A. N종·기획을 증거기반으로
- **증거**가 없으면 N종/기획은 single(가격). 실제 세트는 **명백한 set 복합어**로만.
- `packageExtractor.ts`: `heteroSignal`에서 `N_JONG_SET_RE` 제거 → `SET_COMPOUND_RE`
  (`세트|패키지|콜렉션|컬렉션|기프트`)만 키워드 증거로 사용. 모호한 `기획/선물/구성/N종`은
  제외. heterogeneous = **≥2 비배수 용량** / **set 복합어** / **디바이스·기기**.
- `naver.ts` `classifyOfferComposition`: `N_JONG_SET_RE → set` 라인 제거. 기존
  `SET_KEYWORDS`(선물세트/기획세트/세트구성/패키지/콜렉션/세트…)만으로 set 판정.
- 결과: "100ml 기획 3종" → single(가격). "기획세트/선물세트/2종 세트/3종 패키지" → set 유지.
  "토너100ml+세럼30ml" → set 유지(`+`/비배수 2용량).

### B. 동종 멀티팩(배수 용량)은 이종 아님 → 개당가
- `homogeneousMultipackUnit(amts, title)` 헬퍼: distinct 용량이 **최소 단위의 정수배**이고
  **개수/배수 신호(N개·N팩·×N·더블)** 가 있으면 동종 멀티팩(unit=최소, per-unit).
- addRegex 차이 용량 분기 + `heteroSignal` 진입 전에 적용. 배수 아니면 기존대로 이종.
- 결과: "…30ml 2개 (60ml)" → 30ml×2(개당가). "30ml + 미스트 50ml"(비배수) → 이종.

### C. 본품(DB용량) + 소량 부스트/증정 → add-on strip, 본품 기준 가격
- 앵커 경로에서 DB `volume_ml`/`name`을 `pickAnchoredOffer`로 전달.
- `stripMinorAddOn(title, mainVolumeMl, name)`: 이종 후보일 때 감지 용량 중 하나가 DB용량과
  일치(본품)하고 **나머지가 모두 더 작으면**(부스트/증정) → 이종 아님. 본품=DB용량,
  **번들가 전체를 본품에 귀속**(보수적 → ml당 약간↑, 가짜 최저가 방지), `parsedVolumeRaw=
  DB용량`, status='ok', reliable=true.
- 가드: DB용량 불일치 / add-on ≥ 본품 / form 불일치(`hasFormConflict`) / 디바이스 → 이종 유지.

## 디스코드 확인 알림 (A·C 공통)
- bare "N종" single **또는** 부스트 strip 건은 기존 `nJongVerify` 채널로 통합 — 요약의
  **"🔎 세트/구성 확인 (N종 옵션·본품+부스트, 정보·가격 노출 유지)"** 줄로 모아 알림.
- `OfferMatchResult.nJongVerify` 추가 → Tier-1 anchored 반환에서 `containsBareNJong(title)
  || result.nJongVerify`로 전파.

## 주요 변경 파일
- `crawler/core/packageExtractor.ts` — `SET_COMPOUND_RE`, `homogeneousMultipackUnit`,
  addRegex/heteroSignal 정밀화.
- `crawler/adapters/naver.ts` — `classifyOfferComposition`(N_JONG_SET_RE 제거),
  `stripMinorAddOn`, `pickAnchoredOffer`(DB용량/name 인자 + strip), Tier-1 nJongVerify 전파.
- `crawler/core/notify.ts` — 확인 줄 문구 일반화(N종 + 본품+부스트).
- tests: `packageExtractor.test.ts`(§A 100ml 기획 3종 single, §B 동종 멀티팩/비배수 이종,
  set 복합어), `naver.test.ts`(증거기반 classify, §C strip 4케이스),
  `summary.test.ts`(확인 줄 문구).

## 테스트 결과
- `test:all` ✅ / `typecheck` ✅ / `lint` ✅(기존 무관 warning 1) / `build` ✅
- 회귀: bare N종(#44) single 유지, 디바이스/기기 set, OY "N종 세트" 보류 유지,
  brand-gate(#43)·per-retailer-volume(#45) 영향 0.

## 남은 이슈 / TODO
- merge 후 `crawler:sync`로 (a)더모이스처 100ml 기획 3종 가격, (b)아벤느 B3 네이버 30ml
  개당가, (c)디스코드 "세트/구성 확인" 줄 확인 → `cf:deploy`.
- C의 strip은 휴리스틱(본품=DB용량 + add-on 모두 더 작음). 본품+본품(예: 토너100+세럼30)을
  DB용량과 우연히 일치시키면 strip될 수 있어 디스코드 확인 줄로 사람이 점검하도록 설계.
