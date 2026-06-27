/**
 * titleParseCache — 제목 파싱 결과의 영속 캐시(`title_parse_cache` 테이블, migration 0018).
 *
 * 조회 우선순위(설계 stage-2 §4):
 *   1) source='manual'(검수 O 확정) → 항상 사용, LLM/규칙 무시.
 *   2) source='llm' AND prompt_version 일치 → 재사용(0콜).
 *   3) 그 외(미스/stale) → null → parsePackage가 LLM 호출.
 * set()은 LLM 결과만 기록하며 **manual 행은 절대 덮지 않는다**. mock/미구성 시 no-op.
 */
import { isSupabaseServerConfigured, supabaseServer } from '../../lib/supabase/server';
import { LLM_PROMPT_VERSION, getLlmModel } from './llmTitleParse';
import { hashTitleForCache } from './titleHash';
import type { ParseCache, ParsePackageResult } from './parsePackage';

const TABLE = 'title_parse_cache';

// run 내 중복 DB 조회 방지(같은 제목 1회만 읽음).
const memo = new Map<string, ParsePackageResult | null>();
export function clearParseCacheMemo(): void {
  memo.clear();
}

/** DB 백엔드 ParseCache. parsePackage(title, ctx, llmExtract, makeDbParseCache())로 주입. */
export function makeDbParseCache(): ParseCache {
  return {
    async get(title: string): Promise<ParsePackageResult | null> {
      if (!isSupabaseServerConfigured()) return null;
      const h = hashTitleForCache(title);
      if (memo.has(h)) return memo.get(h)!;
      let out: ParsePackageResult | null = null;
      try {
        const { data } = await supabaseServer
          .from(TABLE)
          .select('result_json, source, prompt_version')
          .eq('title_hash', h)
          .maybeSingle();
        if (data) {
          if (data.source === 'manual') out = data.result_json as ParsePackageResult;
          else if (data.source === 'llm' && data.prompt_version === LLM_PROMPT_VERSION) out = data.result_json as ParsePackageResult;
        }
      } catch {
        out = null;
      }
      memo.set(h, out);
      return out;
    },
    async set(title: string, result: ParsePackageResult): Promise<void> {
      if (!isSupabaseServerConfigured()) return;
      const h = hashTitleForCache(title);
      try {
        // manual(확정) 행은 절대 덮지 않는다.
        const { data: existing } = await supabaseServer.from(TABLE).select('source').eq('title_hash', h).maybeSingle();
        if (existing && existing.source === 'manual') {
          memo.set(h, result);
          return;
        }
        await supabaseServer.from(TABLE).upsert(
          {
            title_hash: h,
            title,
            result_json: result,
            source: 'llm',
            model: getLlmModel(),
            prompt_version: LLM_PROMPT_VERSION,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'title_hash' }
        );
        memo.set(h, result);
      } catch {
        /* best-effort: 캐시 저장 실패는 무시 */
      }
    },
  };
}

/**
 * 검수 O/X 확정 파싱 기록(stage-2 §2 — inspection O 시 호출). source='manual'로 박아
 * 이후 LLM/규칙이 덮어쓰지 않고 재호출도 하지 않는다.
 */
export async function setManualParse(title: string, result: ParsePackageResult): Promise<void> {
  if (!isSupabaseServerConfigured()) return;
  const h = hashTitleForCache(title);
  try {
    await supabaseServer.from(TABLE).upsert(
      {
        title_hash: h,
        title,
        result_json: result,
        source: 'manual',
        confirmed_ox: true,
        prompt_version: LLM_PROMPT_VERSION,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'title_hash' }
    );
    memo.set(h, result);
  } catch {
    /* best-effort */
  }
}
