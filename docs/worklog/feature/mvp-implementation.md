# Worklog: feature/mvp-implementation

이 로그는 `feature/mvp-implementation` 브랜치의 개발 진행 및 변경점을 추적합니다.

## 구현한 기능 요약

### 1. Phase 0: 프로젝트 환경 및 기반 설정 완료
- Next.js 14+ scaffold (App Router, TS, Tailwind CSS v4, ESLint)를 루트 디렉토리에 초기화 및 설정 완료.
- `@theme`을 사용하는 Tailwind CSS v4에 맞춰 디자인 토큰 및 CSS 변수 설정을 `app/globals.css`에 구축 완료.
- 한글 최적화 서체인 Pretendard CDN 로드를 전역 설정.
- 데이터베이스 마이그레이션 SQL 파일 생성 완료 (`0001_init.sql`, `0002_rls.sql`).
- 환경 설정 템플릿 `.env.example` 및 로컬 개발용 `.env` 생성 완료.

## 주요 변경 파일

- [lib/types.ts](file:///c:/Users/yua12/Desktop/Project/viewty-pick/lib/types.ts): ViewtyPick MVP 통합 TypeScript 타입 및 인터페이스
- [lib/supabase/mockDb.ts](file:///c:/Users/yua12/Desktop/Project/viewty-pick/lib/supabase/mockDb.ts): Supabase 미연결 시 fallback 동작하는 로컬 JSON DB 엔진
- [crawler/sheets/validate.ts](file:///c:/Users/yua12/Desktop/Project/viewty-pick/crawler/sheets/validate.ts): 구글 시트 레코드에 대한 Zod 유효성 검증 스키마
- [crawler/sheets/import.ts](file:///c:/Users/yua12/Desktop/Project/viewty-pick/crawler/sheets/import.ts): 시트 원본 데이터를 정규형 테이블 구조로 로드/임포트하는 모듈
- [crawler/adapters/](file:///c:/Users/yua12/Desktop/Project/viewty-pick/crawler/adapters): 올리브영(Playwright), 네이버(API), 쿠팡(Partners Stub) 수집 어댑터
- [crawler/core/](file:///c:/Users/yua12/Desktop/Project/viewty-pick/crawler/core): 가격 정규화, 실효가 변환, 아웃라이어 차단, 스코어링 알고리즘 및 Discord 알림 처리부
- [crawler/run.ts](file:///c:/Users/yua12/Desktop/Project/viewty-pick/crawler/run.ts): 일일 수집 및 동기화 파이프라인 통합 실행 스크립트
- [components/](file:///c:/Users/yua12/Desktop/Project/viewty-pick/components): 검색 바, 탭 바, 제품 카드, 가격 비교 테이블 등 공통 UI 컴포넌트 세트
- [app/](file:///c:/Users/yua12/Desktop/Project/viewty-pick/app): 메인 홈, 카테고리별 목록, 제품 디테일, 추천 가이드 및 고민해결 SEO 랜딩 페이지군, 어피리에이트 클릭 트래커 라우트(`/go/`), 관리자 현황 대시보드(`/admin/status`)

## 테스트 결과

- `npm run sheets:import` 실행 시 원본 시트 시드 데이터 검증 및 DB 로드가 정상 완료됨.
- `npm run crawler:sync` 실행 시 Playwright 스크래퍼 및 가격 파싱, 스코어 갱신 연산이 성공적으로 수행되어 [db_mock.json](file:///c:/Users/yua12/Desktop/Project/viewty-pick/lib/data/db_mock.json)에 병합됨.
- `npm run build` 실행 시 Turbopack/TypeScript 타입 검사 및 정적/동적 컴파일 빌드가 정상 통과됨.

## 남은 이슈 / TODO

- [ ] Phase 4: 운영 서버 배포 및 실제 Supabase 원격 DB 인스턴스 연동
- [ ] Phase 5: 검색창 자동완성 및 제품 검색 기능 구현
- [x] Phase 1: 가격 수집 파이프라인 (crawler 디렉토리 및 types 정의) 완료
- [x] Phase 2: 사용자 웹 UI 및 API 라우트 연동 완료
- [x] Phase 3: 데이터 시드 삽입 및 최종 빌드 검증 완료

## Security Hardening & Price Filtering Pass (2026-06-12)

Phase 3 검토 과정에서 발견된 보안 취약점 수정 및 가격 노출 정합성을 위한 보완 패스를 완료하였습니다.

### 주요 반영 사항
- **어드민 Basic Auth 구현 및 하드코딩 제거**: Next.js 16 `proxy.ts` 표준 named export 규격에 맞추어 `/admin/status/:path*` 경로 전체 진입 시 Basic Auth 검증 레이어를 태웠습니다. 환경변수 미등록/기본값 지정 시 fail-closed(401) 처리 및 malformed header 예외처리를 보완했습니다.
- **재밸리데이션 검증 강화**: `/api/revalidate`에서 사용되던 기본 디폴트 토큰을 삭제하고, 배포 환경에서 유효한 비밀키 미입력 시 접근 불허(401) 처리하도록 차단했습니다.
- **최저가 필터링 및 노출 정합성 구현**: 품절 상품(`in_stock: false`), 수집 오류(`status !== 'ok'`), 수집 정확도 낮음(`parse_confidence: 'low'`), 미활성 스토어 등은 모든 최저가 계산(UI 상품 카드, 가격 테이블 하이라이트, JSON-LD)에서 완전히 제외했습니다. 
- **기본가 중심 노출 및 미수집 대응**: 대표 최저가는 수수료/쿠폰 혜택가가 아닌 '기본가'로만 표기하고 혜택가는 라벨로 분리 표기했습니다. 표시 가능한 유효 스토어가 없을 경우 `0원`이 아닌 `"가격 확인 중"`으로 렌더링하도록 헬퍼 포맷을 개선했습니다.
- **SEO & JSON-LD 대응**: 제품 상세 페이지(`app/p/[slug]/page.tsx`)를 Server Component로 유지하고 canonical alternates 메타태그를 자동 주입했습니다. 유효 가격이 존재할 때만 JSON-LD AggregateOffer를 렌더링하고, 가격이 없을 경우 offers 객체 생략 후 단일 Product Schema만 출력하도록 처리했습니다.
- **로컬/MOCK 모드 오프라인 안전 장치**: 올리브영 플레이라이트 크롤러, 네이버 API, 쿠팡 API, 디스코드 알람 코드 전반에 `dummy`/`example` 감지 기능을 추가하여 오프라인 검증 시 실제 네트워크 호출 및 외부 트래픽 전송이 100% 차단되도록 방어했습니다.

### 최종 검증 결과
- `npm run typecheck`: 통과 (오류 0)
- `npm run lint`: 통과 (오류 0, 기존 스타일 워닝 2)
- `npm run build`: Next.js 16 Turbopack 빌드 성공
- `npm run crawler:test`: 모의 가격 동기화 및 가상 디스코드 알람 로그 출력 테스트 정상 수행 (외부 연결 없음)
