# Claude Code 작업 프롬프트 (통합) — 세트/이종 판정 정밀화: N종·기획 증거기반 + 동종 멀티팩 + 소량 부스트 strip

> 한 브랜치로 3가지를 함께 처리. **이미 머지된 PR #44**(bare "N종"→single, `SET_KEYWORDS`에서 2종/3종/4종 제거, `N_JONG_RE`/`N_JONG_SET_RE`/`isBareNJong` 존재)와 **PR #45**(per-retailer volume) 위에서 **추가 정밀화**한다. 이미 된 부분은 다시 만들지 말 것.
> 베이스: 최신 `main`. 분기 `fix/set-classification-evidence-based`.
> 대상: `crawler/core/packageExtractor.ts`(heterogeneous/N종/`+` 처리), `crawler/adapters/naver.ts`(`classifyOfferComposition`, 앵커 경로에서 DB 용량 전달), `normalize.ts`(라벨), `run.ts`/`notify.ts`(디스코드 확인 알림).

---
## A. N종·기획을 "증거기반"으로 (현재 #44의 한계 수정)
현재: `N_JONG_SET_RE`(N종 + 세트/구성/**기획**/패키지/콜렉션)가 `classifyOfferComposition`과 packageExtractor `heteroSignal` 양쪽에서 **set/heterogeneous**로 만듦. → "닥터지 더모이스처 배리어 D 인텐스 크림 **100ml 기획 3종**"(단일 제품·단일 용량)이 잘못 제외(link-only).
변경: **N종은 — 기획/세트-context 단어가 붙어도 — 실제 다중 품목 증거가 없으면 single(가격).**
- `heteroSignal`(packageExtractor ~282)에서 **`N_JONG_SET_RE` 제거** → heterogeneous는 **≥2 distinct 비배수 용량 / 디바이스·기기**로만.
- `classifyOfferComposition`(naver.ts ~207)에서 **`N_JONG_SET_RE → set` 라인 제거**. 대신 **명백 복합어만** set: `SET_KEYWORDS`의 `선물세트|기획세트|세트구성`(이미 존재). 즉 "기획 3종"은 single, "기획세트"는 set.
- `+`/`×N`/`N개·팩(N≥2)`/디바이스 등 기존 set 판정은 유지.
- 결과: "100ml 기획 3종" → single(가격). "선물세트/기획세트" → set 유지. "토너100ml+세럼30ml" → set 유지.

## B. 동종 멀티팩(배수 용량)은 이종 아님 → 개당가
현재: packageExtractor `+` 처리(~99–108)가 용량 다르면 `heterogeneous=true`; `heteroSignal`도 distinct 용량 ≥2면 이종.
변경: distinct 용량들이 **하나의 단위의 정수배 관계**(예: {30,60} where 60=30×2)이고 **개수/배수 신호(N개·N팩·×N)**가 있으면 → **동종 멀티팩**(`heterogeneous=false`, unit=최소용량, per-unit 계산). 배수 아니면 기존대로 이종.
- 예: "…세럼 30ml 2개 (60ml)" → 동종, ml당=가격/(30×2 환산은 개당). "토너100ml + 세럼30ml"(비배수) → 이종 유지.

## C. 본품(DB용량) + 소량 부스트/증정 → add-on strip, 본품 기준 가격
케이스: 네이버 앵커 "[아벤느] 히알루론 액티브 B3 안티에이징 세럼 **30ml +부스트 10ml**" → 30·10 + "+" → 현재 이종(inspection). 10ml는 소량 부스트라 본품(30ml) 기준으로 노출하고 싶음.
변경(앵커 경로에서 **DB `volume_ml` 전달** 후):
- 이종 후보일 때, 감지 용량 중 **하나가 DB volume_ml과 일치(=본품)** 하고 나머지가 **더 작으면**(부스트/증정) → **이종 아님으로 처리**, 본품=DB용량.
  - 가격은 **번들가 전체를 본품에 귀속**(보수적 → ml당 약간↑, 가짜 최저가 방지), `unit_price=가격/DB용량`, reliable=true.
  - 라벨/note "+부스트 10ml 포함" 표기, `status='ok'` 노출.
- **DB용량과 일치하는 용량이 없거나, add-on이 본품 이상이거나, form이 다르면(hasFormConflict)** → 이종 유지(inspection).

## 디스코드 확인 알림 (A·C 공통)
- N종/기획으로 single 처리됐거나 부스트 strip한 건은, 요약에 **"🔎 세트/구성 확인: <제품> @ <판매처> <링크>"** 로 모아 알림(가격 노출하되 사람이 점검). (#44의 N종 알림이 있으면 통합.)

---
## 테스트 (반드시 포함)
- A: "더모이스처 배리어 D 인텐스 크림 100ml 기획 3종" → single·가격(link-only 탈출). "기획세트"/"선물세트" → set. "토너100ml+세럼30ml" → set.
- B: "…30ml 2개 60ml" → 동종 개당가. "…30ml + 미스트 50ml"(비배수) → 이종.
- C: "…세럼 30ml +부스트 10ml" (DB=30) → 본품 30ml 가격·"부스트 포함" note. add-on이 더 크면 이종. DB용량 불일치 → 이종.
- 회귀: bare N종(#44) single 유지, 디바이스/기기 set, brand-gate·per-retailer-volume(#43/#45) 영향 0. `test:all`·typecheck·build·lint green.

## 적용
- `fix/set-classification-evidence-based`: 커밋 의미단위 분리 — `fix(matcher): set/heterogeneous by multi-item evidence (N종·기획 single)`, `fix(matcher): homogeneous multipack per-unit`, `fix(matcher): strip minor +booster, price DB-volume main`, `test`, `docs: worklog`. 영어 PR → CI → merge → `crawler:sync`로 (a)더모이스처 100ml 기획 3종 가격, (b)아벤느 B3 네이버 30ml 개당가, (c)디스코드 확인줄 확인 → `cf:deploy`.
- `git diff --check`(NUL/잘림 점검), 시크릿·`docs/prompts`·`tmp` 비커밋.

## 막히면
- A에서 "기획세트"(복합어)와 "기획 3종"(N종) 구분이 애매하면, **공백 인접 + 세트류 단어 + N종 동시**가 아니라 **명백 복합어(선물세트/기획세트/세트구성)** 만 set으로. 나머지 N종/기획은 single.
- B/C 판정이 불확실하면 보수적으로 이종(inspection) + 디스코드 알림으로 사람이 결정.
