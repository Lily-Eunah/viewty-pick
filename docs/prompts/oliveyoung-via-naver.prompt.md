# Claude Code 작업 프롬프트 — 올리브영 가격: 네이버 API 경유 + 큐레이터 게이트 (최종)

> 목적: 크롤 불가(robots `*` Disallow + WAF 403)·공개 API 없음인 올리브영의 가격을,
> **승인된 네이버 쇼핑 검색 API로 "올리브영 = 또 하나의 공식몰"** 로 취급해 수집한다.
> 올영 자사몰은 건드리지 않는다(컴플라이언트). 직전에 만든 네이버 API 매칭 인프라를 재사용.

> 베이스: 네이버 API 어댑터가 병합된 `main`(또는 그 파생 브랜치). 신규 분기 `feature/oliveyoung-via-naver` 권장.

---

## 0. 배경 (확정 — 재논의 불필요)

- 올영 크롤은 정책상 불가: robots.txt `User-agent: * → Disallow: /`(콘텐츠 경로는 검색/AI 봇 화이트리스트 전용) + WAF 403. UA 스푸핑은 배제.
- 올영 공개 가격 API 없음(확인 완료). → **유일한 컴플라이언트 자동 경로 = 네이버 쇼핑 검색 API에 올라온 올영 오퍼를 읽는 것.**
- 우리는 oliveyoung.co.kr에 요청하지 않는다. 네이버 API만 호출 → 올영 robots와 무관.
- 기존 **Playwright 올영 어댑터는 폐기/비활성**한다(크롤 안 함).

---

## 1. 확정 규칙

**구매버튼 = 올영 큐레이터 제휴 링크(수동 입력 `affiliate_url`).** 이게 게이트이자 링크다.

**올영 행 노출 분기 (4단계):**
1. 큐레이터 URL **없음** → 올영 행 **미노출**(그 제품은 올영에 없음).
2. 큐레이터 URL 있음 + 네이버에 올영 오퍼 **있음** → **가격=네이버 올영 오퍼**, 구매링크=큐레이터.
3. 큐레이터 URL 있음 + 네이버 **없음** + `manual_override` **있음** → **가격=수동 입력**, 구매링크=큐레이터.
4. 큐레이터 URL 있음 + 네이버 **없음** + 수동 입력 **전** → **큐레이터 링크만**(가격 미노출).

**핵심 구분:** "큐레이터 URL 있음(=올영에 있음)"은 "네이버 쇼핑에 올영 오퍼가 있음"을 **보장하지 않는다.** 그래서 2↔3·4 분기가 생긴다.

**가격↔링크:** 올영 가격은 네이버 경유, 구매링크는 큐레이터(oliveyoung.co.kr) — 의도된 절충(운영자 확정). "실제 결제가는 판매처 확인" 캐비엇 + 갱신 시각 노출로 신뢰 보강. 올영 가격은 **기준가(기본가)** 로 취급, 올영세일/앱전용가는 안 잡혀도 정상(2트랙 정책과 일치).

---

## 2. 구현

기존 네이버 API 어댑터(`pickOfficialOffer`)와 매칭 인프라를 재사용한다.

1. **allowlist에 올영 추가**: `retailer_allowlist`에 seller=oliveyoung, `allowed_store_name="올리브영"`(정확 표기는 §4 검증으로 확정) 행 추가.
2. **검색 1회 → 다중 몰 추출**: 제품당 네이버 검색 1회(브랜드 공식스토어용으로 어차피 호출). 그 결과에서 `pickOfficialOffer`를 **타깃 몰별로** 호출 — 브랜드 공식스토어 + (큐레이터 URL이 있으면) **올리브영**. 개별 몰 오퍼(`productType ∈ {2,3}`)만, mallName=올리브영, 제목/용량 유사도 게이트.
3. **올영 listing 채움**:
   - 네이버 올영 오퍼 매칭 → price_snapshots에 가격 + `matched_url`/`matched_mall_name` 기록(소스=naver).
   - 매칭 실패 → active `manual_override`(seller=oliveyoung) 있으면 그 가격 사용.
   - 둘 다 없으면 가격 없음(링크만). **리셀러 폴백 금지.**
   - 올영 listing의 리다이렉트는 **항상 `affiliate_url`(큐레이터)** 사용.
4. **올영 listing의 `crawl_method`**: 'playwright' 폐기 → 네이버 경유임을 나타내는 값(예: `naver_sourced`). check 제약에 막히면 마이그레이션 `0007`로 enum 값 추가. 수동 보정 시는 normalize에서 manual_override가 우선.
5. **manual_override 지원**: 운영자가 시트 `manual_overrides`(seller=oliveyoung, override_type=price/promo)로 올영 가격을 직접 주입 가능. normalize에서 active override가 네이버 결과를 덮어쓰거나(있을 때), 네이버가 없을 때 가격을 제공. (갱신 주기·TTL은 추후 결정 — `expires_at`은 비워두거나 길게.)
6. **올영 Playwright 어댑터 제거/비활성**: `oliveyoung.ts` 크롤 로직을 파이프라인(run.ts)에서 빼고, 올영 가격은 위 네이버 경유 경로로만.

---

## 3. 데이터/스키마

- `retailer_allowlist`: 올영 mallName 행 추가(데이터).
- `price_snapshots.matched_url/matched_mall_name`, `listings.latest_matched_url`: **기존 0006 재사용**(소스가 올영이어도 동일).
- `listings.crawl_method`에 `naver_sourced` 필요 시 마이그레이션 `0007`(작은 enum 확장).
- 그 외 신규 스키마 없음. 올영 listing은 이미 존재(seller=oliveyoung, affiliate_url=큐레이터).

---

## 4. 라이브 검증 (읽기 전용 — 구현 전/후)

1. **올영 mallName 확정**: 네이버 쇼핑에서 올영이 어떤 `mallName`으로 뜨는지(정확 문자열), 개별 몰 오퍼(type 2/3)로 잡히는지, 리셀러 아닌 올영 공식인지 확인 → allowlist에 반영.
2. **커버리지 측정**: **큐레이터 URL 보유 제품**들 중 네이버에서 올영 오퍼가 잡히는 비율 측정 → 분기 2 vs (3/4) 비율 리포트. 갭 제품 목록(=수동 입력 후보)을 표로.
3. 검색 API productId 미스매칭 없음(올영도 mallName 기반), 잘못된 비공식 올영 매칭 없음 확인.
- 라이브 스크립트는 CI와 분리, 시크릿·개인정보 비커밋.

---

## 5. 테스트 (fixture 단위)

- `pickOfficialOffer`에 올영 케이스: mallName="올리브영" 개별몰 오퍼 채택, catalog/리셀러 제외.
- 4단계 분기 로직: 큐레이터 URL 유무, 네이버 매칭 유무, manual_override 유무 조합 → 올바른 가격 소스/노출 여부.
- 올영 리다이렉트는 항상 affiliate_url(큐레이터).
- 기존 네이버/normalize/redirect 테스트 회귀 통과.
- 각 커밋 전 `npm run lint && npm run typecheck && npm run test:all && npm run build`.

---

## 6. 브랜치 & 커밋 전략 (CLAUDE.md §1~§5 준수)

### 6.1 브랜치
- 베이스: 네이버 API 어댑터가 **병합된 `main`**. (consolidation PR이 아직 머지 전이면 그 브랜치 위에 쌓고, 머지 후 rebase.)
- 작업 브랜치: **`feature/oliveyoung-via-naver`** (기능 단위 분기). 시작 전 `git checkout main && git pull` 로 최신화 후 분기.
- `main` 직접 커밋 금지. force push 금지. 원격 push는 **운영자 승인 후**.

### 6.2 커밋 (의미 단위로 분리 — 서로 다른 목적은 별도 커밋)
아래 순서/단위로 커밋한다. 각 커밋은 **단독으로 빌드·테스트가 통과하는 상태**여야 한다.

| # | 커밋 메시지 | 범위 |
|---|---|---|
| 1 | `refactor: retire oliveyoung playwright crawler from pipeline` | run.ts에서 올영 크롤 제거/비활성, `oliveyoung.ts` 크롤 로직 정리 |
| 2 | `feat(db): 0007 add naver_sourced crawl_method` | (필요 시) crawl_method enum 확장 마이그레이션 |
| 3 | `feat: register oliveyoung mallName in retailer_allowlist` | allowlist 올영 행(시트/시드). mallName은 §4 검증값 |
| 4 | `feat: extract oliveyoung offer via naver pickOfficialOffer` | 검색 1회 → 다중 몰 추출(브랜드+올영) 매칭 |
| 5 | `feat: oliveyoung display tiers (curator-gate, naver/manual/link-only)` | 4단계 분기 + 리다이렉트 항상 affiliate_url |
| 6 | `feat: manual_override fallback for oliveyoung price` | 네이버 갭 시 수동 가격 주입 경로 |
| 7 | `test: oliveyoung via-naver matching and display tiers` | fixture 단위 테스트 |
| 8 | `docs: worklog for feature-oliveyoung-via-naver` | worklog + 커버리지 리포트 |

- 커밋 메시지 형식 `<type>: <요약>` (`feat`/`fix`/`refactor`/`docs`/`test`/`chore`). 요약은 무엇을/왜.
- 한 커밋에 너무 많은 파일/목적을 담지 않는다(예: 기능 추가 + 리팩토링 분리).

### 6.3 커밋 전후 검증 / 무결성 (CLAUDE.md §4)
- **각 커밋 전**: `npm run lint && npm run typecheck && npm run test:all && npm run build` 통과. `git status`로 의도한 변경만인지, `git diff --stat`·`git diff --check`로 잘림/0바이트/깨진 줄 없는지 확인. 마이그레이션 SQL·어댑터 파일 끝이 온전한지 직접 확인.
- **각 커밋 후**: `git show --stat HEAD`로 커밋 내용 재확인.
- **비커밋 대상**: `docs/prompts/`, `tmp/`, `.env`, 시크릿·스크린샷/HTML 덤프. `git status`로 혼입 여부 확인.

### 6.4 Push / PR / Merge (CLAUDE.md §3)
- push 전 전체 테스트 통과 재확인 → `git push -u origin feature/oliveyoung-via-naver`.
- PR 생성: **제목·본문 영어**, 변경 요약·변경 이유·테스트 방법/결과 포함. follow-up(커버리지 갭/수동 입력 비중, 갱신 주기 미정)을 본문에 명시.
- worklog(`docs/worklog/feature-oliveyoung-via-naver.md`)는 **merge 전 작성 완료**(구현 요약·주요 변경 파일·테스트 결과·커버리지·남은 TODO).
- CI green 확인 후 merge(`gh pr merge --merge --delete-branch`, 기존 관례). 실패 시 merge 금지·보고.

---

## 7. Definition of Done

1. 올영 가격이 **네이버 API 경유**로 수집되고, **큐레이터 URL이 있는 제품만** 올영 행 노출(4단계 분기 구현).
2. 올영 Playwright 크롤 폐기, oliveyoung.co.kr 직접 요청 없음(컴플라이언트).
3. 가격=네이버(또는 manual_override), 구매링크=항상 큐레이터. 갱신 시각·결제가 확인 캐비엇 노출.
4. manual_override로 올영 가격 수동 주입 가능(네이버 갭 보강), 입력 전엔 링크만.
5. allowlist 올영 mallName 확정 + **커버리지 리포트**(큐레이터 URL 제품 중 네이버 매칭 비율, 갭 목록) 제출.
6. fixture 단위 테스트 통과, 빌드·타입·린트 통과, worklog 작성, 시크릿 비노출.

---

## 8. 막히면

- 네이버에서 올영이 개별 몰 오퍼로 안 뜨고 catalog로만 잡히거나 mallName이 모호하면: 표기 후보를 보고하고 allowlist 확정을 운영자에게 요청(추측 매칭 금지).
- `crawl_method` enum 외 추가 스키마가 필요해지면 멈추고 보고.
- 커버리지가 매우 낮으면(예: 큐레이터 제품 다수가 네이버에 없음): 수동 입력 비중이 커지므로 결과를 보고하고 운영 부담을 운영자와 논의.
