# ViewtyPick — 이력서용 프로젝트 요약

## 한 줄 소개
디렉터파이·화해 등에서 추천된 화장품을 **네이버·쿠팡·올리브영 가격을 매일 자동 수집·비교**해 "공식몰 대비 최저가"를 보여주는 **화장품 가격비교·큐레이션 커머스 MVP** (개인 프로젝트, viewtypick.com).

## 기술 스택
- **프론트엔드**: Next.js 16 (App Router, SSR/ISR), TypeScript, Tailwind CSS
- **백엔드·데이터**: Supabase (PostgreSQL, Row-Level Security), Google Sheets (운영 소스)
- **인프라/배포**: Cloudflare Workers (OpenNext), GitHub Actions (CI + 일일 cron)
- **수집/연동**: 네이버 쇼핑 Open API, 쿠팡 파트너스 API (HMAC-SHA256), Playwright(헤드리스 크롤), Discord 웹훅 알림

## 핵심 성과 (이력서 bullet — 국문)
- **3개 플랫폼(네이버·쿠팡·올리브영) 가격을 매일 자동 수집·정규화하는 데이터 파이프라인을 단독 설계·구축**하고, 제품 단위 가격 커버리지 **91%(41/45)** 달성.
- **"신뢰 우선(trust-first)" 가격 매칭 엔진 구현** — 큐레이트 상품번호 앵커링 + 다중 쿼리 recall + 증정/번들 분리(개당가 환산) + 크로스셀러 가격 outlier 제거 + 신뢰 밴드로, **다른 상품 가격이 잘못 노출되는 오매칭을 0으로** 통제.
- **직접 크롤이 막힌 채널을 우회 연동** — 쿠팡 파트너스 HMAC-SHA256 서명·레이트리밋 처리, 크롤 불가한 올리브영을 네이버 쇼핑 mallName 매칭으로 가격 확보, 대형 브랜드 정가(할인 전)는 Playwright로 공식몰 페이지에서 수집.
- **운영자 친화 데이터 모델 설계** — Google Sheets를 단일 소스로 두고 중복 제거·reconcile import로 Supabase 동기화. 안정 키(product_key) 동결로 **상품명이 바뀌어도 깨지지 않는 조인**, 대분류/소분류 2단계 카테고리, 소스별 wide 뱃지 구조.
- **인프라 전환·보안** — Vercel→Cloudflare Workers(OpenNext) 마이그레이션, RLS + 보안 읽기 뷰로 공개 데이터 경로 잠금, env 기반 noindex, **프로덕션 쓰기 가드**로 테스트 데이터의 라이브 오염 방지.
- **데이터 무결성** — 2-track 가격(기본가 + ml당 개당가, 신뢰 플래그), 용량 불일치 자동 알람, 가짜/목업 UI 값(별점·할인율) 전면 제거.

## Key accomplishments (English)
- Designed and built a **daily automated price pipeline across 3 marketplaces** (Naver, Coupang, OliveYoung), reaching **91% product-level price coverage**.
- Implemented a **trust-first price-matching engine** (curated product-ID anchoring, multi-query recall, gift/bundle stripping with per-unit pricing, cross-seller price-outlier rejection, confidence bands) that **eliminated wrong-product price mismatches**.
- Integrated platforms despite hard limits: **Coupang Partners API (HMAC-SHA256 auth + rate limiting)**, priced the un-crawlable OliveYoung via Naver mall-name matching, and used **Playwright to scrape official-store list prices** big brands' price-comparison catalogs hide from the API.
- Built an **operator-friendly Google-Sheets-as-source pipeline** with dedup/reconcile import to Supabase, **rename-safe stable-key joins**, 2-tier categories, and per-source badge schema.
- Migrated hosting **Vercel → Cloudflare Workers (OpenNext)**; locked the public read path with **Postgres RLS + a security view**; added a **production-write guard** preventing test data from clobbering live data.

## 규모·지표
- 큐레이트 상품 ~45개 / listing ~138개 / 3~5개 판매 플랫폼
- 일일 자동 가격 동기화(GitHub Actions cron) + 변경 시 Cloudflare 재배포
- 가격 커버리지 91%, 오매칭 0 (수집 검증 기준)

## 기술적 챌린지 (면접 토킹 포인트)
- **API의 구조적 한계 우회**: 네이버 오픈 API가 대형 브랜드를 "가격비교 카탈로그"로 묶어 개별 스토어 상품번호를 안 주는 문제 → 페이지 크롤로 정가 확보. 쿠팡 파트너스가 검색(키워드)만 지원·최대 10건 → 앵커 productId 매칭 전략.
- **정확도 vs 커버리지 트레이드오프**: "틀린 가격을 보여주느니 가격을 안 보여준다"는 trust-first 원칙과 신뢰 밴드·검토(warning) 큐 설계.
- **멱등·안전한 데이터 동기화**: 시트→DB import의 dedup/reconcile, 안정 키 동결, 프로덕션 쓰기 가드.
- **공정거래/제휴 고지·법적 고려**: 판매처별 제휴(공정위) 문구, robots.txt·ToS 트레이드오프 판단.

## 표기 팁
- 본인이 실제로 한 역할(기획·아키텍처·DB 스키마·크롤러/매처 로직·배포 의사결정·디버깅·검증) 중심으로 기술하세요.
- 위 수치(91%, 오매칭 0 등)는 빌드 시점 검증값이라, 면접에서 "어떻게 측정/검증했는지" 설명할 수 있게 근거(검증 스크립트·재수집 로그)를 함께 기억해두면 좋아요.
- 핵심 한 줄로 압축하면: *"3개 커머스 플랫폼 가격을 매일 수집·정규화해 신뢰 우선 매칭으로 비교하는 화장품 가격비교 서비스를 Next.js·Supabase·Cloudflare로 단독 설계·구축."*
