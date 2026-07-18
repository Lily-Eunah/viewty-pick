# feature/skin-type-survey — 피부 아이스크림 테스트

## 배경

홍보용 피부타입 서베이. 유분(Q1~4)·수분(Q5~6)·민감(Q7~9) 3축 + 고민 토핑 자가선택(Q10),
결과는 아이스크림 캐릭터 8종 × 고민 펫 5종(+없음)으로, 타입 맞춤 검증템 최저가 칩과
스킨 허브 CTA로 이어지는 전환 퍼널. 문항·배점·라우팅 설계는 세션에서 피부과 관점
리뷰(워시테스트 리프레임, 민감-트러블 분리, 수부지 2문항 등)를 거쳐 확정.

## 변경

- `lib/skin-test/` — quizData(10문항+조건부 보너스), scoring(위계: 민감≥4 최우선 →
  수분≥3 분기, 유분 동점 규칙), results(8베이스×5토핑 카피·에셋·허브 매핑)
- `components/skin-test/` — QuizClient(탭 자동 진행·이전·보너스 분기),
  IceCreamProgress(파트별 이모지 변신 프로그레스), QuestionIllustration(일러스트
  드롭 존 + 이모지 폴백), CareNotice(sessionStorage 개인화 멘트 — 공유 링크에선
  미표시), ShareButton(navigator.share→클립보드 폴백)
- `app/skin-test/` — 랜딩(index 허용) · quiz(noindex) · result/[base]/[topping]
  (**gSP 8×6=48경로 + revalidate 86400 + dynamicParams=false** — Workers 10ms CPU
  가드, #110 패턴), 결과 og:image=캐릭터 PNG
- `public/images/skin-test/` — 캐릭터 누끼 에셋 13종(시트에서 컷아웃) +
  `questions/README.md`(운영자 일러스트 파일명 규칙)
- sitemap에 `/skin-test` 추가, globals.css에 vp-pop/vp-rise 유틸(+reduced-motion),
  package.json `test:skintest` → test:all 체인

## 검증

- 채점 단위테스트 25건(라우팅 위계·동점·경계값·오염 방지) green, test:all 전체 green
- lint: skin-test 파일 클린(main 기존 `scripts/ops/_probe_*` 에러 7건은 무관),
  typecheck: check-robots 중복 함수 에러는 알려진 로컬 노이즈(CI green)
- `next build`: /skin-test ○, 결과 **SSG 48/48** 프리렌더 확인
- 실런타임(dev, 실 Supabase read): 수부지+모공 완주 → `/result/oily-dehydrated/pores`
  도달, 개인화 멘트(hintMatched)·수부지 필터 제품칩 3종(할인율·최저가)·이미지 13종
  로드 확인. 민감 플로우 → 보너스 문항 경유 `recentSensitive:true` +
  `/result/dry-sensitive/trouble` 확인. 콘솔 에러 0.
- 미실시: workerd(cf:preview) 확인 — 배포 전 권장(정적 48경로라 리스크 낮음)

## 리스크 / 주의

- 캐릭터가 실제 제품(투게더·빵또아 등) 모티브 — 홍보 게시 전 상표 사용 검토 필요
- 결과 페이지는 noindex(thin content 방지), 랜딩만 색인
- 문항 일러스트는 미제작 — README 규칙대로 파일만 넣으면 자동 표시(코드 수정 불필요)
- 캐릭터 에셋은 1024px 시트 기준 1x — 레티나 선명도 원하면 2048 시트로 재컷아웃

## 다음 스텝

- [ ] 운영자: 문항 일러스트 11종 생성 → `public/images/skin-test/questions/` 드롭
- [ ] 홈/헤더에 테스트 진입점 노출(별도 PR)
- [ ] 결과 공유용 OG 이미지 디자인(현재는 캐릭터 PNG 단독) — 선택
- [ ] merge 전 cf:preview 1회 확인 권장

## 2026-07-18 펫 배치 조정

- 결과 히어로의 공통 펫 위치를 펫별 `heroClassName` 메타데이터로 분리했다.
- 별난바는 손 옆에 살짝 높게, 돼지바·찰떡 트윈스는 수평으로, 쿠키오는 더 작고 낮게,
  수박바는 본체 가까이에 수직으로 배치했다.
- 인앱 브라우저에서 5종 전체와 좁은 폴라포·넓은 빵또아·월드콘 조합을 교차 확인했다.
- 검증: 수정 파일 ESLint, `npm run typecheck`, `npm run test:skintest`, `npm run build` 통과.
  브라우저 콘솔 오류 0. build의 기존 middleware deprecation 경고만 남았다.

## 2026-07-18 v2 캐릭터·랜딩 확정

- 기본 피부타입 8종과 추가 고민 펫 5종을 외곽선·캔버스 크기가 통일된 v2 자산으로 교체했다.
- 문항 일러스트를 모바일 144px, 넓은 화면 160px로 확대하고 대체 아이콘 크기도 맞췄다.
- 첫 화면을 화장품 실패와 오래된 피부타입 인식을 환기하는 카피로 개편하고, 결과의 실질적 이득을 앞세웠다.
- 피부요정을 중심으로 투게더·요맘때·빵또아·월드콘이 좌우 균형을 이루는 단일 투명 히어로 이미지를 제작했다.
- 인앱 브라우저에서 586×642 뷰포트 기준 이미지 로드, CTA 노출, 좌우 균형을 확인했다.
- 검증: 변경 파일 ESLint, `npm run typecheck`, `npm run test:all`, `npm run build` 통과.
- 전체 `npm run lint`는 이번 브랜치에서 수정하지 않은 `scripts/ops/_probe_*` 3개 파일의 기존
  `@typescript-eslint/no-explicit-any` 오류 7건으로 실패한다.
