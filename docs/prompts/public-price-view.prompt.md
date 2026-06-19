# Claude Code 작업 프롬프트 — 공개 가격 뷰 (옵션 C): 가격 렌더링 RLS 블로커 해결

> 목적: 공개 사이트에서 가격이 안 뜨는 문제를 해결한다. UI가 RLS로 잠긴 `price_snapshots`를
> 직접 읽어 anon이 0건을 받는 게 원인. **raw 테이블은 잠근 채로**, "최신 + 안전 컬럼만" 뽑은
> **공개 뷰(옵션 C)**를 만들어 거기에만 anon 읽기를 허용하고 UI를 그 뷰로 재지정한다.
>
> 베이스: 최신 `main`. 신규 분기 `feature/public-price-view`.

---

## 0. 배경 (확정)

- Phase G에서 발견: 상세 페이지 가격이 렌더 안 됨. 원인은 UI가 판매처별 가격을 `price_snapshots`에서 직접 읽는데, 이 테이블은 DESIGN §13대로 **anon read 금지(배치 전용 raw 히스토리)** → anon이 0건.
- **옵션 A(raw 테이블에 직접 anon 정책) 배제**: RLS는 행만 거르고 열은 못 거름 → `source_text`·내부 필드 노출 위험 + DESIGN 의도 위반.
- **옵션 C 채택**: raw 테이블은 그대로 잠그고, 안전한 projection 뷰만 공개.

---

## 1. 구현

### 1.1 마이그레이션 `0008_public_price_view.sql`
- `price_snapshots(listing_id, crawled_at desc)` 인덱스 없으면 추가(최신 1건 조회 최적화).
- 공개 뷰 생성 (security_invoker=false → 소유자 권한 실행, raw RLS 우회 = 의도적):

```sql
create view public.listing_prices_public
with (security_invoker = false)
as
select distinct on (ps.listing_id)
  ps.listing_id, ps.product_id, l.seller_id,
  ps.sale_price, ps.base_unit_price, ps.effective_unit_price,
  case when ps.unit_price_reliable then ps.unit_price end as unit_price,  -- 절충안: 불신뢰 시 null
  ps.promo_type, ps.promo_text, ps.in_stock, ps.shipping_note,
  ps.matched_mall_name, ps.crawled_at
from price_snapshots ps
join listings l on l.id = ps.listing_id and l.is_active
where ps.status = 'ok' and ps.parse_confidence = 'high'   -- 비교 제외 정책 반영
order by ps.listing_id, ps.crawled_at desc;

grant select on public.listing_prices_public to anon, authenticated;
```
- **노출 컬럼은 위 안전 목록만.** `source_text`·`status`·`parse_confidence` 등 내부 필드는 SELECT에 넣지 않는다.
- 정확한 컬럼명은 실제 스키마(0004~0007 반영본)로 확인 후 매핑.

### 1.2 UI 재지정
- 제품 상세의 **판매처별 가격 테이블** 쿼리를 `price_snapshots` → **`listing_prices_public` 뷰**로 변경.
- listings/sellers 조인으로 판매처명·구매링크(`affiliate_url` → `latest_matched_url` 우선순위) 부착.
- 홈/리스트가 `current_prices`(제품당 요약)를 쓰는 경로는 그대로 둔다(역할 분담: 요약=current_prices, 판매처별=이 뷰).

### 1.3 RLS 무변경
- `price_snapshots` RLS는 **그대로 anon 금지**. 정책 안 건드린다.

---

## 2. 보안 체크리스트
- 뷰가 **안전 컬럼만** 노출(내부 필드 없음).
- **listing별 최신 1건만**, 표시 가능한 행만(`status='ok'`·`parse_confidence='high'`·active listing).
- `unit_price_reliable=false`면 `unit_price=null`(용량 절충안 일관), base는 노출.
- raw `price_snapshots`는 anon이 **여전히 0건**임을 확인.
- Supabase advisor가 "security definer view" 경고를 띄울 수 있음 → **의도된 공개 projection**이므로 수용, worklog에 근거 기록.

---

## 3. 테스트 / 검증
- anon 키로 뷰 read → 가격 33건(현재 priced) 반환. anon 키로 `price_snapshots` read → 0/거부.
- 뷰가 최신 1건만, `status!=ok`·`parse_confidence=low` 행 제외 확인.
- `unit_price_reliable=false` 케이스 → 뷰의 unit_price가 null.
- UI: 상세 페이지에서 판매처별 가격이 실제 렌더(Phase G 재확인). **tier-4 올영 link-only는 §7.4 미구현이라 여전히 미렌더 — 정상, follow-up.**
- 각 커밋 전 `lint && typecheck && test:all && build`.

---

## 4. 브랜치 & 커밋 (CLAUDE.md)
- 분기 `feature/public-price-view`(최신 main에서). main 직접 커밋·force push 금지.
- 커밋 단위:
  - `feat(db): 0008 public latest-price view + grants`
  - `feat: render store prices from public price view`
  - `test: public price view exposure + anon read checks`
  - `docs: worklog for public-price-view`
- 각 커밋 전후 `git diff --stat`/`git diff --check`/`git show --stat HEAD`. `docs/prompts/`·`tmp/`·시크릿 비커밋.
- 원격 마이그레이션은 **기존 게이트(session pooler로 repair/push, 백업 우선)**로 적용. 적용 계획 보고 후 단일 go.
- 영어 PR(요약·이유·테스트결과 + 보안 노트) → CI green → `gh pr merge --merge --delete-branch`.
- worklog `docs/worklog/feature-public-price-view.md`.

---

## 5. Definition of Done
1. 공개 상세 페이지에서 판매처별 가격이 렌더됨(뷰 경유).
2. raw `price_snapshots`는 anon에 여전히 비공개(0건) — 정책 무변경.
3. 뷰는 최신·안전 컬럼·표시가능 행만 노출, 용량 절충안 반영.
4. 마이그레이션 0008 원격 적용(게이트), UI 재지정, 테스트·빌드 통과.
5. worklog 갱신(보안 노트 + 아래 future 메모 포함).

---

## 6. 나중 확장 메모 (지금 구현 안 함 — 구조 호환성만 확인)

현재 구조(append-only `price_snapshots` + 공개 projection 뷰)는 아래로 **재작업 없이** 확장된다:

- **가격 히스토리 차트(최근 N일)**: 이 뷰의 형제 뷰 `listing_price_history_public` = 최신 1건 대신 `crawled_at >= now - N일` 시리즈를 같은 안전-컬럼/필터/anon-grant 패턴으로. 동일 `price_snapshots`를 읽음.
- **"최저가 갱신" 뱃지**: 스냅샷의 `min(base_unit_price)`(역대 or 윈도우). 즉석 계산 또는 배치 recompute 시 `current_prices`에 `lowest_30d`/`is_lowest` 요약 필드 추가. 새 raw 데이터 불필요.
- **의존성**: 히스토리는 일일 sync의 append 부산물이라 **백필 불가** — 수집 시작 시점부터만 존재. 따라서 (1) 일일 cron 안정화(= fail_count fix 선결), (2) **sync가 가격 변동 없어도 매일 스냅샷을 쓰는지** 확인(차트 연속성)이 전제. 지금은 메모만, 구현은 추후.

---

## 7. 막히면
- 뷰의 security_invoker 동작/owner 권한이 불명확하거나 advisor가 막으면: 멈추고 보고(임의로 raw 테이블 anon 개방 금지).
- UI가 가격을 읽는 곳이 여러 군데면: 판매처별=뷰, 제품 요약=current_prices로 정리하고 변경 지점 보고.
- 원격 마이그레이션 적용 이슈는 기존 런북대로 게이트·보고.
