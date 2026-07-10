# AGENTS.md / Project AI Guidelines

Single source of AI-assistant guidance for this repo. `CLAUDE.md` / `GEMINI.md` point here; Codex/Cursor read this file natively.

> 공통 작업 규율(git 워크플로·검증·시크릿·언어·PowerShell 인코딩)은 **전역 설정이 담당**한다 (`~/.claude/rules`, `~/.codex/AGENTS.md`, `~/.gemini/GEMINI.md`). 이 파일에는 **프로젝트 고유만** 둔다.

## Overview

ViewtyPick — 검증된 화장품만 선별해 검증된 판매처(올리브영·쿠팡·네이버 등) 기준 "신뢰 가능한 최저가"를 보여주는 모바일·SEO 큐레이션/가격비교. Next.js(App Router) + Cloudflare Workers(OpenNext) + Supabase + 크롤러. **비용 0 수렴이 설계 제1원칙.**

## ⚠️ Next.js

This is NOT the Next.js you know — APIs/conventions may differ from training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing code; heed deprecation notices.

## Commands

- **검증 게이트 (커밋 전)**: `npm run lint && npm run typecheck && npm run test:all && npm run build`. 배포-결정적이면 `+ npm run cf:build`.
- **크롤러**: `npm run crawler:sync` — ⚠️ **prod Supabase 기록. 로컬에서 실제 `.env`로 실행 금지** (mock/CI·`workflow_dispatch`만). `crawler:test`=mock. `sheets:import`, `ops:backup`(prod 쓰기 전 백업), `ops:dryrun-import`.
- **라이브 검증** (CI 밖, 수동): `npm run live-check:*`. shadow 평가: `npm run shadow:title-parse`.

## Architecture

`app/`(App Router) · `crawler/`(adapters: naver·coupang·oliveyoung / core: normalize·parsePackage·toCanonicalQuantity) · `lib/queries/`(공개 가격 projection view) · `components/` · `supabase/migrations/` · `scripts/ops/`·`scripts/live-check/` · `docs/worklog/`.

## 도메인 규칙 (viewty-pick 고유)

- **데이터 신뢰 (돈·비교)** — 잘못된 가격은 no-price보다 나쁘다. 불확실하면 격리 + 검수 큐(inspection O/X)/Discord 알림, **더 나쁜 소스로 폴백 금지**. 오류 비용 큰 곳(가격·제품 정체성)은 엄격, 싼 곳(이미지)은 관대.
- **규정 준수 수집** — robots·rate limit·랜덤 지연 준수, UA 스푸핑 금지, 로그 URL 마스킹.
- **실제 런타임 검증** — `next dev`로는 안 잡히는 버그가 있다. workerd/miniflare 프리뷰(`cf:preview`)로 확인.
- **canonical-unit** — 수량/용량은 `toCanonicalQuantity` 단일 게이트웨이. 스키마/이름 변경은 expand→migrate→contract, 로직과 분리한 별도 PR.
- **worklog** — 머지 전 `docs/worklog/<branch>.md` 작성.

## 유용한 skill

- 큰 스펙 멀티-PR 구현: `four-role-team` · 중단 세션 복구/핸드오프: `handoff-recovery` · UI: `frontend-design`
