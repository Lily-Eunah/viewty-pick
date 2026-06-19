# Claude Code 작업 프롬프트 — 이미지 로딩 성능 개선 (next/image · lazy-load · 최적화)

> 문제(라이브 QA): viewtypick 접속 시 사진 로딩이 느림. 원인: 제품 이미지가 전부 **외부 쿠팡 CDN raw `<img>`**(~53개), **최적화·리사이즈·lazy-load 없음** → 초기 렌더에 외부 풀사이즈 이미지 다수 동시 로드.
> 베이스: 최신 `main`. 분기 `perf/image-optimization`. 대상: 이미지 렌더 컴포넌트(`ProductImageWithFallback`/카드/`/p` 상세), `next.config`, Cloudflare/OpenNext 이미지 설정.

## 변경 (우선순위 순)
1. **lazy-load + 치수 명시 (즉시·저비용)**: 모든 제품 `<img>`에 `loading="lazy"` + `decoding="async"` + 명시적 `width/height`(또는 aspect-ratio)로 CLS 제거. 첫 화면 밖 이미지는 지연 로드.
2. **next/image 도입 (핵심)**: 제품 이미지를 `next/image`로 전환 → 자동 리사이즈·`AVIF/WebP`·반응형 `sizes`·lazy + blur placeholder.
   - **Cloudflare(OpenNext) 이미지 최적화 설정 필요**: OpenNext용 image loader 또는 Cloudflare Image Resizing 연결. (Workers 환경에서 기본 Next 옵티마이저가 안 도니, OpenNext 권장 loader/`images.loader` 설정.)
   - `next.config`의 `images.remotePatterns`에 **`ads-partners.coupang.com`, `*.coupang.com`, `shopping-phinf.pstatic.net`(네이버 이미지)** 등 허용.
3. **요청 크기 축소**: 카드 썸네일은 작은 사이즈로(렌더 폭에 맞는 `sizes`), 상세는 중간 사이즈. 풀사이즈 원본 직접 로드 금지.
4. **(선택) 캐싱**: Cloudflare가 외부 이미지를 캐시/프록시하도록(반복 방문 시 외부 왕복 제거).

## 주의
- 이전에 placeholder 폴백(onError) 동작 유지 — 이미지 실패 시 placeholder. next/image 전환 시에도 폴백 유지.
- 단일 1:1 placeholder·카드 높이 균일(기존 web-layer 규칙) 유지.
- OpenNext/Workers에서 next/image loader가 까다로우면, **1번(lazy+치수)+3번(작은 사이즈)만 먼저** 적용해도 체감 개선 큼 → next/image는 loader 설정 확인 후.

## 테스트/검증
- Lighthouse/네트워크: 초기 로드 이미지 수·바이트 감소, LCP/CLS 개선.
- 이미지 폴백(실패→placeholder) 회귀 없음.
- `test:all`·typecheck·build·lint green.

## 적용
- `perf/image-optimization`: `perf: lazy-load + sized product images`, `perf: next/image + cloudflare image optimization + remotePatterns`, `docs: worklog`. 영어 PR → CI → merge → `cf:deploy` → 라이브에서 로딩 속도·CLS 재확인.

## 막히면
- OpenNext에서 next/image 옵티마이저가 동작 안 하면(Workers 제약) → Cloudflare Image Resizing 또는 외부 loader로, 그것도 어려우면 1·3번(lazy+치수+작은사이즈)만으로 1차 개선하고 next/image는 후속 보고.
