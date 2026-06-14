/**
 * LIVE Naver parse validation — NOT a CI test (needs network + Playwright).
 * Run: npm run live-check:naver [-- --limit=5]
 *
 * Policy (DESIGN §4.2 + prompt §1.1): respect robots.txt. We do NOT crawl any
 * path that robots.txt disallows. This script performs the SAME robots.txt
 * check the adapter uses, against the real Naver listing hosts, and reports
 * whether a live crawl is permitted. If disallowed, we STOP (no crawl, no
 * fabricated ground truth) and report "verification blocked + reason".
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { supabaseServer } from '../../lib/supabase/server';

const EXP_DIR = path.join(__dirname, 'expectations');

// Mirror of NaverAdapter.checkRobotsTxt (kept in sync intentionally)
async function checkRobotsTxt(targetUrl: string, ua: string): Promise<{ allowed: boolean; rule: string }> {
  const url = new URL(targetUrl);
  const robotsUrl = `${url.protocol}//${url.host}/robots.txt`;
  const res = await fetch(robotsUrl, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return { allowed: true, rule: `robots.txt HTTP ${res.status} (treated as allow)` };
  const text = await res.text();
  const lines = text.split('\n');
  let applies = false;
  let matchedAgent = '';
  for (const line of lines) {
    const l = line.trim().toLowerCase();
    if (l.startsWith('user-agent:')) {
      const agent = l.replace('user-agent:', '').trim();
      applies = agent === '*' || agent === ua.toLowerCase();
      if (applies) matchedAgent = agent;
    }
    if (applies && l.startsWith('disallow:')) {
      const p = l.replace('disallow:', '').trim();
      if (p === '/' || (p && url.pathname.startsWith(p))) {
        return { allowed: false, rule: `User-agent: ${matchedAgent} → Disallow: ${p}` };
      }
    }
  }
  return { allowed: true, rule: 'no matching disallow' };
}

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 5;
  const ua = (process.env.CRAWLER_USER_AGENT || 'ViewtyPickBot').split('/')[0].split(' ')[0];

  fs.mkdirSync(EXP_DIR, { recursive: true });

  const { data: listings } = await supabaseServer
    .from('listings')
    .select('id,link_key,url,product_id')
    .eq('is_active', true)
    .eq('seller_id', 4)
    .limit(50);

  const seen = new Set<string>();
  const picked = (listings || []).filter((l) => {
    let host = '';
    try { host = new URL(l.url).host; } catch { return false; }
    const key = host; // one check per host is enough; keep variety
    if (seen.has(key) && seen.size >= 2) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);

  const results: Record<string, unknown>[] = [];
  for (const l of picked) {
    const { data: product } = await supabaseServer
      .from('products').select('name,volume_ml').eq('id', l.product_id).single();
    let host = '';
    try { host = new URL(l.url).host; } catch { host = '(invalid)'; }

    let verdict: { allowed: boolean; rule: string };
    try {
      verdict = await checkRobotsTxt(l.url, ua);
    } catch (e) {
      verdict = { allowed: true, rule: `robots fetch error: ${e instanceof Error ? e.message : e}` };
    }

    console.log(`${l.link_key} host=${host} product="${product?.name}"`);
    console.log(`  robots: ${verdict.allowed ? 'ALLOWED' : 'BLOCKED'} — ${verdict.rule}`);
    console.log(`  → ${verdict.allowed ? 'would crawl' : 'SKIP crawl (policy: respect robots.txt)'}`);

    results.push({
      link_key: l.link_key, host, product: product?.name,
      ua, robots_allowed: verdict.allowed, robots_rule: verdict.rule,
      crawled: false,
      note: verdict.allowed ? 'allowed but crawl not executed in this run' : 'verification blocked by robots.txt',
    });
  }

  fs.writeFileSync(path.join(EXP_DIR, 'naver.json'), JSON.stringify(results, null, 2));
  const blocked = results.filter((r) => !r.robots_allowed).length;
  console.log(`\nSummary: ${blocked}/${results.length} hosts BLOCKED by robots.txt → live crawl not permitted.`);
  console.log('Saved → expectations/naver.json');
}
main().catch((e) => { console.error(e); process.exit(1); });
