# feature/nightly-deploy-after-crawl — 크롤 후 야간 자동 재빌드+배포

## 배경 (왜)

Workers **Free 플랜은 요청당 CPU 10ms**라 Worker 위에서 도는 ISR 재검증(self-reference
fetch를 통한 백그라운드 재렌더)도 10ms 예산이며, 성공이 복불복이다. 즉 크롤이
`revalidateTag('products')`를 쏴도 **새 가격이 캐시에 반영될지는 운에 달려 있었다**
(실패 시 에러 없이 stale 가격이 계속 서빙됨).

반면 빌드는 CI에서 돌므로 CPU 한도가 없다. 데이터는 하루 1회(새벽 크롤)만 바뀌므로,
**크롤 직후 CI에서 전 카탈로그를 프리렌더해 배포**하면 Worker는 캐시 서빙(~1–2ms)만
하게 되어 Free 플랜 제약과 서비스 특성이 정확히 맞아떨어진다.

## 구현 (crawl.yml 재구성)

기존 단일 `crawl` job → 3 job 파이프라인:

1. **crawl** — 기존 크롤러 실행 (변경 없음, warmup 스텝만 분리)
2. **deploy** (신규, `needs: crawl`) — `npm run cf:deploy`로 재빌드+배포
   - `CLOUDFLARE_API_TOKEN` 미설정 시 경고만 남기고 **graceful skip** (시크릿 추가 전
     워크플로가 빨갛게 되지 않도록 게이트 스텝)
   - 빌드 env: `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`(읽기 전용 프리렌더),
     `CLOUDFLARE_ACCOUNT_ID`, `SITE_INDEXABLE`(현재 미설정=noindex 유지, 런칭 때 시크릿 추가)
3. **verify** (기존 warmup 스텝을 job으로 이동, `needs: [crawl, deploy]` +
   `if: always() && crawl 성공`) — 배포 성공/스킵/실패와 무관하게 주요 라우트 워밍업 +
   500 발견 시 revalidate 재발사 self-heal (기존 로직 그대로)

## 필요한 신규 GitHub Secrets (operator 작업)

| Secret | 값 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Workers Scripts/KV/R2 Edit 권한 커스텀 토큰 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 계정 ID |
| `SITE_INDEXABLE` | (지금은 추가하지 않음 — 퍼블릭 런칭 때 `true`) |

## 주요 변경 파일

- `.github/workflows/crawl.yml`

## 테스트 결과

- js-yaml 파싱 ✅ (jobs: crawl, deploy, verify)
- 실 배포 검증은 시크릿 추가 후 `workflow_dispatch` 수동 실행으로 확인 예정
  (게이트 덕에 시크릿 없이도 워크플로 자체는 green)

## 남은 이슈 / TODO

- operator: 토큰 발급 + 시크릿 2종 추가 후 Actions에서 수동 실행(workflow_dispatch)으로
  deploy job 검증
- 퍼블릭 런칭 시 `SITE_INDEXABLE=true` 시크릿 추가 (빌드 타임에 robots meta로 박제됨)
