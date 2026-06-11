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

- [app/layout.tsx](file:///c:/Users/yua12/Desktop/Project/viewty-pick/app/layout.tsx): 기본 메타데이터 및 언어 설정 수정
- [app/globals.css](file:///c:/Users/yua12/Desktop/Project/viewty-pick/app/globals.css): Pretendard CDN 로드, Tailwind v4 테마 변수 구성
- [supabase/migrations/0001_init.sql](file:///c:/Users/yua12/Desktop/Project/viewty-pick/supabase/migrations/0001_init.sql): 서비스 데이터 모델 테이블 및 score_config 기본 시드 SQL
- [supabase/migrations/0002_rls.sql](file:///c:/Users/yua12/Desktop/Project/viewty-pick/supabase/migrations/0002_rls.sql): 테이블별 RLS 활성화 및 public read 권한 정책
- [.env.example](file:///c:/Users/yua12/Desktop/Project/viewty-pick/.env.example): 환경 변수 템플릿
- [.env](file:///c:/Users/yua12/Desktop/Project/viewty-pick/.env): 로컬 환경 설정 파일

## 테스트 결과

- `git status` 확인 시 파일들이 의도한 위치에 정상 배치됨.
- Next.js 빌드 시 Tailwind v4 빌드 에러 없이 초기 환경이 설정됨.

## 남은 이슈 / TODO

- [ ] Phase 1: 가격 수집 파이프라인 (crawler 디렉토리 및 types 정의)
- [ ] Phase 2: 사용자 웹 UI 및 API 라우트 연동
- [ ] Phase 3: 데이터 시드 삽입 및 최종 빌드 검증
