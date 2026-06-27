/**
 * title-parse-shadow — READ-ONLY shadow 하베스트 (DB/시트/sync 무변경).
 *
 * price_snapshots.source_text(=매칭된 판매처 offer 제목)를 읽어, 각 제목에
 * 기존 regex(extractPackageFromTitle) 와 새 parsePackage(게이트+LLM) 를 나란히 돌려
 * 개수/용량/구성 차이를 docs/worklog/title-parse-shadow.md 로 리포트한다.
 * 표시(production)에는 전혀 영향 없음 — 비교 리포트만 출력한다.
 *
 *   - LLM: GEMINI_API_KEY 있으면 실제 Gemini 호출, 없으면 needs-llm은 regex 폴백으로 표시.
 *   - 쓰기 없음: price_snapshots/current_prices/listings/sheet 미변경.
 *
 * Run: npx tsx -r dotenv/config scripts/ops/title-parse-shadow.ts [--limit=200]
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { supabaseServer, isSupabaseServerConfigured } from '../../lib/supabase/server';
import { extractPackageFromTitle } from '../../crawler/core/packageExtractor';
import { parsePackage } from '../../crawler/core/parsePackage';
import type { ParseContext, LlmExtractFn } from '../../crawler/core/parsePackage';
import { llmExtractTitle, LLM_PROMPT_VERSION } from '../../crawler/core/llmTitleParse';
import type { LlmTitleResult } from '../../crawler/core/titleParseGuards';
import { Product } from '../../lib/types';

const LIMIT = parseInt(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || '300', 10);
const LLM_DELAY_MS = parseInt(process.env.LLM_SHADOW_DELAY_MS || '1200', 10);
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 영속 디스크 캐시(쿼터 보호): 성공한 LLM 추출만 model+prompt버전+제목 키로 저장.
// 같은 제목 재실행은 0콜. 실패(null)는 저장하지 않아 다음 run에서 재시도. .cache/는 gitignore.
const CACHE_FILE = path.join(process.cwd(), '.cache', 'title-parse-llm.json');
function loadDiskCache(): Record<string, LlmTitleResult> {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { return {}; }
}
function saveDiskCache(c: Record<string, LlmTitleResult>): void {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(c, null, 0), 'utf8');
}

/** source_text에서 비-제품 항목을 거르고 순수 offer 제목을 추출. */
function extractRawTitle(src: string | null): string | null {
  if (!src) return null;
  let s = src.trim();
  if (/excluded|no Naver offer|no curator|not in search results|제품 URL 필요|^\[mock\]|row hidden|tier 3|tier 4|link-only/i.test(s)) {
    return null;
  }
  s = s
    .replace(/^Naver-sourced OliveYoung offer:\s*/i, '')
    .replace(/^Naver API match:\s*/i, '')
    .replace(/^Naver official-store (?:fallback|match)[^:]*:\s*/i, '')
    .replace(/^Naver catalog lprice fallback[^:]*:\s*/i, '')
    .replace(/^Naver page crawl:\s*/i, '')
    .replace(/^\[manual_override price\]\s*/i, '');
  s = s.replace(/\s+—\s+.*$/, '').replace(/\s*\(\d{3,}\)\s*$/, '').trim();
  return s || null;
}

const cnt = (n: number | null | undefined) => (n == null ? 1 : n);
const amt = (n: number | null | undefined) => (n == null ? '—' : String(n));

async function main() {
  if (!isSupabaseServerConfigured()) {
    console.error('Supabase not configured — aborting (READ-ONLY harness needs DB read).');
    process.exit(2);
  }
  const hasKey = !!process.env.GEMINI_API_KEY;
  console.log(`[shadow] LLM ${hasKey ? `ON (${MODEL}) prompt=${LLM_PROMPT_VERSION}` : 'OFF (no GEMINI_API_KEY → needs-llm은 regex 폴백 표시)'}`);

  // 디스크 캐시로 감싼 추출기: 캐시 히트면 네트워크 0콜. 미스(=실제 호출)만 카운트.
  const diskCache = loadDiskCache();
  let cacheHits = 0;
  let networkCalls = 0;
  const cachedExtract: LlmExtractFn = async (title, ctx) => {
    const k = `${MODEL}|${LLM_PROMPT_VERSION}|${title}`;
    if (k in diskCache) { cacheHits++; return diskCache[k]; }
    networkCalls++;
    const r = await llmExtractTitle(title, ctx);
    if (r) { diskCache[k] = r; if (networkCalls % 5 === 0) saveDiskCache(diskCache); }
    return r;
  };

  // 최신 스냅샷에서 제목 수집(읽기 전용). 제품 컨텍스트(brand/name/volume) 조인.
  const { data: snaps } = await supabaseServer
    .from('price_snapshots')
    .select('product_id, source_text, crawled_at')
    .order('crawled_at', { ascending: false })
    .limit(2000);
  const { data: products } = await supabaseServer.from('products').select('*');
  const prodById = new Map<number, Product>((products || []).map((p: Product) => [p.id, p]));

  // 제목 dedup(동일 제목 1회만; LLM 호출/리포트 중복 방지).
  const seen = new Set<string>();
  type Item = { title: string; ctx: ParseContext };
  const items: Item[] = [];
  for (const s of snaps || []) {
    const title = extractRawTitle(s.source_text);
    if (!title || seen.has(title)) continue;
    seen.add(title);
    const p = prodById.get(s.product_id);
    items.push({
      title,
      ctx: {
        volumeMl: p?.volume_ml ?? null,
        volumeUnit: p?.volume_unit ?? null,
        productName: p?.name ?? null,
        brand: p?.brand ?? null,
      },
    });
    if (items.length >= LIMIT) break;
  }
  console.log(`[shadow] ${items.length} distinct titles (limit ${LIMIT})`);

  type Row = {
    title: string;
    oldCount: number; oldVol: string; oldHetero: boolean;
    route: string; method: string; conf: string;
    newCount: number; newVol: string; newHetero: boolean; newInspect: boolean;
    agree: boolean; note: string;
  };
  const rows: Row[] = [];
  const routeDist: Record<string, number> = {};
  let llmCalls = 0;

  for (const [i, it] of items.entries()) {
    process.stderr.write(`\r[${i + 1}/${items.length}] ${it.title.slice(0, 28)}            `);
    const oldR = extractPackageFromTitle(it.title);
    const netBefore = networkCalls;
    const newR = await parsePackage(it.title, it.ctx, cachedExtract);
    routeDist[newR.route] = (routeDist[newR.route] || 0) + 1;
    if (newR.method === 'llm') llmCalls++;
    const didNetworkCall = networkCalls > netBefore;

    const oldCount = cnt(oldR.unitCount);
    const newCount = cnt(newR.unitCount);
    const agree =
      oldCount === newCount &&
      (oldR.unitAmount ?? null) === (newR.unitAmount ?? null) &&
      !!oldR.heterogeneous === !!newR.heterogeneous;

    rows.push({
      title: it.title,
      oldCount, oldVol: amt(oldR.unitAmount), oldHetero: !!oldR.heterogeneous,
      route: newR.route, method: newR.method, conf: newR.confidence,
      newCount, newVol: amt(newR.unitAmount), newHetero: !!newR.heterogeneous, newInspect: !!newR.needsInspection,
      agree, note: newR.evidence || '',
    });

    if (didNetworkCall) await sleep(LLM_DELAY_MS); // 실제 호출에만 throttle (캐시 히트는 즉시)
  }
  process.stderr.write('\n');
  saveDiskCache(diskCache);
  console.log(`[shadow] LLM network calls: ${networkCalls} · cache hits: ${cacheHits} (cache: ${CACHE_FILE})`);

  // ── 리포트 ──
  const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const out: string[] = [];
  out.push('# 제목 파싱 shadow 비교 (READ-ONLY)');
  out.push('');
  out.push(`- 일자: ${new Date().toISOString().slice(0, 19)}Z`);
  out.push(`- LLM: ${hasKey ? `ON · ${MODEL} · prompt=${LLM_PROMPT_VERSION}` : 'OFF (regex 폴백)'}`);
  out.push(`- 대상 distinct 제목: ${rows.length} · LLM 채택: ${llmCalls} · 실제 호출: ${networkCalls} · 캐시 히트: ${cacheHits}`);
  out.push(`- route 분포: ${JSON.stringify(routeDist)}`);
  out.push(`- 불일치(old≠new): **${rows.filter((r) => !r.agree).length}** / ${rows.length}`);
  out.push('');
  out.push('> old = 기존 extractPackageFromTitle, new = parsePackage(게이트+LLM). count=개수, vol=본품용량(ml/g), H=heterogeneous, I=needsInspection.');
  out.push('');

  const table = (title: string, list: Row[]) => {
    out.push(`## ${title} (${list.length})`);
    if (list.length === 0) { out.push('_없음_', ''); return; }
    out.push('| 제목 | old(cnt/vol/H) | route·method·conf | new(cnt/vol/H/I) | 근거 |');
    out.push('|---|---|---|---|---|');
    for (const r of list) {
      out.push(
        `| ${esc(r.title).slice(0, 52)} | ${r.oldCount}/${r.oldVol}/${r.oldHetero ? 'H' : '-'} | ${r.route}·${r.method}·${r.conf} | ${r.newCount}/${r.newVol}/${r.newHetero ? 'H' : '-'}/${r.newInspect ? 'I' : '-'} | ${esc(r.note).slice(0, 30)} |`
      );
    }
    out.push('');
  };

  table('🔴 불일치 — old vs new 결과가 다른 케이스 (검토 핵심)', rows.filter((r) => !r.agree));
  table('🟢 일치 — 동일 결과', rows.filter((r) => r.agree));

  const file = path.join(process.cwd(), 'docs/worklog/title-parse-shadow.md');
  fs.writeFileSync(file, out.join('\n'), 'utf8');
  console.log(`[shadow] route dist: ${JSON.stringify(routeDist)} · llm adopted: ${llmCalls} · disagreements: ${rows.filter((r) => !r.agree).length}`);
  console.log(`[shadow] report → ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
