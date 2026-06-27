-- 0018: title_parse_cache — 제목 구성 파싱(개수/용량/구성) 결과의 영속 캐시.
--
-- WHY: stage-2에서 offer 제목을 LLM(또는 게이트)로 파싱한 결과를 제목 단위로 저장해
-- "제목이 바뀔 때만" LLM을 호출한다(무료 쿼터 보호 + run마다 표시 흔들림 방지). 또
-- 검수 O/X로 운영자가 확정한 파싱은 source='manual'로 박아 두어 LLM/규칙이 절대
-- 덮어쓰지 않게 한다(조회 우선순위 manual > llm[같은 prompt_version] > 재호출).
--
-- 배치(service role) 전용 테이블 — 웹/anon은 읽을 필요 없음. RLS를 켜고 정책을 두지
-- 않아 anon은 deny-by-default(서비스 롤은 RLS 우회). crawl_errors 등 배치 테이블과 동일 취지.

create table if not exists title_parse_cache (
  title_hash      text primary key,          -- sha256(raw offer title)
  title           text not null,             -- 원문(디버깅/감사)
  result_json     jsonb not null,            -- ParsePackageResult (개수/용량/구성/method/…)
  source          text not null default 'llm', -- 'manual' | 'llm' | 'regex'
  model           text,                      -- LLM 결과의 모델
  prompt_version  text,                      -- LLM 프롬프트 버전(불일치 시 stale → 재호출)
  confirmed_ox    boolean not null default false, -- 검수 O로 확정됨(manual과 함께)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table title_parse_cache enable row level security;
-- (정책 없음 = anon deny-by-default; 배치 service role만 read/write)
