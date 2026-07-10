# SEO 검색 노출 런북 (operator)

ViewtyPick를 네이버·구글·다음·빙에 노출시키는 절차. 코드 인프라(robots·sitemap·JSON-LD·
canonical·검증 메타태그·IndexNow)는 전부 구현돼 있고 **`SITE_INDEXABLE` 스위치 하나에** 걸려 있다.
이 문서는 그 스위치를 켜고 각 엔진에 등록하는 순서.

> ⚠️ **`SITE_INDEXABLE=true`는 사실상 공개 런칭 결정이다.** 켜는 순간 전 페이지가 index+follow로
> 바뀌고 sitemap이 채워진다. 켜기 전 이 체크리스트를 한 번에 진행할 준비가 됐는지 확인.

---

## Phase 0 — 켜기 전 준비 (계정·토큰 발급)

각 서비스에 가입해 **소유확인 토큰**만 먼저 받아둔다 (아직 사이트에 넣지 않아도 됨):

- **네이버 서치어드바이저** (searchadvisor.naver.com) → 사이트 등록 → 소유확인 → **HTML 태그** 방식 선택 →
  `<meta name="naver-site-verification" content="**여기 토큰**">` 의 토큰 값
- **Google Search Console** (search.google.com/search-console) → 속성 추가 →
  - 권장: **도메인 속성** (Cloudflare DNS에 TXT 레코드 추가로 확인 — 서브도메인 전체 커버)
  - 또는: URL 접두어 속성 → **HTML 태그** → `google-site-verification` 토큰 값
- **IndexNow 키** 생성: 8–128자 hex 문자열 아무거나 (예: `openssl rand -hex 16`)

## Phase 1 — 스위치 온 (env 설정 + 배포)

Cloudflare Worker 시크릿(런타임) + 로컬 `.env`(빌드타임 인라인) **양쪽에** 설정 후 `cf:deploy`:

| 키 | 값 | 어디에 |
|---|---|---|
| `SITE_INDEXABLE` | `true` | Worker 시크릿 + `.env` |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | (URL접두어 속성일 때만) 구글 토큰 | Worker 시크릿 + `.env` |
| `NEXT_PUBLIC_NAVER_SITE_VERIFICATION` | 네이버 토큰 | Worker 시크릿 + `.env` |
| `INDEXNOW_KEY` | 생성한 hex 키 | Worker 시크릿 + `.env` + **GitHub Actions 시크릿** |

> `NEXT_PUBLIC_*`는 **빌드타임에 인라인**되므로 `.env`에 있어야 메타태그가 HTML에 박힌다.
> Worker 시크릿만 설정하면 런타임엔 반영 안 됨. (과거 Supabase env 이슈와 동일 함정)

```bash
# Worker 시크릿 (런타임)
npx wrangler secret put SITE_INDEXABLE          # true
npx wrangler secret put NEXT_PUBLIC_NAVER_SITE_VERIFICATION
npx wrangler secret put INDEXNOW_KEY
# 로컬 .env 에도 동일하게 넣고
npm run cf:deploy
```

GitHub Actions 시크릿(크롤러 IndexNow용): `INDEXNOW_KEY`, `SITE_INDEXABLE=true`, `NEXT_PUBLIC_SITE_URL`.

### 배포 후 확인
```bash
curl -s https://viewtypick.com/robots.txt        # Disallow:/ 가 아니라 Allow + Sitemap: 줄
curl -s https://viewtypick.com/sitemap.xml | head # <url> 항목 ~70+개 (홈·/best·가이드 59·카테고리·상품)
curl -s https://viewtypick.com/best | grep robots # "index, follow"
curl -s https://viewtypick.com/indexnow.txt       # 설정한 키가 그대로 출력
curl -s https://viewtypick.com/ | grep verification  # naver/google 메타태그
```

## Phase 2 — 엔진별 등록

1. **네이버** — 서치어드바이저에서 소유확인 완료 → **요청 > 사이트맵 제출**: `https://viewtypick.com/sitemap.xml`
   → **웹페이지 수집** 요청으로 핵심 URL(홈, /best, 대표 가이드 5~10개) 수동 제출
2. **구글** — Search Console 소유확인 완료 → **Sitemaps > 새 사이트맵 추가**: `sitemap.xml`
   → **URL 검사**로 `/best` + 대표 가이드 색인 요청
3. **다음/카카오** — register.search.daum.net 에서 사이트 등록 신청 (폼 1회)
4. **빙** — Bing Webmaster Tools (bing.com/webmasters) → **"Import from GSC"** 원클릭 (구글 등록 후)
   → sitemap 자동 인식. ChatGPT Search 등도 Bing 인덱스 기반

## Phase 3 — 자동 재색인 (이미 코드에 있음, Phase 1 완료 시 자동 작동)

- 매일 새벽 크롤러가 가격 갱신 → revalidate → **IndexNow ping** (crawler Step 8.1) →
  Bing·Naver·Yandex에 변경 URL 즉시 전파. `INDEXNOW_KEY` + `SITE_INDEXABLE=true` 둘 다 있을 때만 작동.
- 구글은 IndexNow 미지원 → sitemap `changeFrequency: daily` 크롤에 의존.

## Phase 4 — 모니터링 (주간)

- GSC: 색인 생성 범위(색인됨 vs 제외 + 사유), 검색 성능(노출·클릭·CTR·평균순위)
- 네이버 서치어드바이저: 수집 현황, 검색 반영
- thin content로 제외되는 가이드 있으면 → 제품 보강 or 스펙 조정 (MIN_SEO_PRODUCTS=4 게이트)

---

## 롤백
`SITE_INDEXABLE`를 제거/`false`로 되돌리고 재배포하면 즉시 전 페이지 noindex + robots Disallow +
빈 sitemap으로 복귀 (robots.ts는 `force-dynamic`이라 재배포 없이도 robots는 즉시 반영).
