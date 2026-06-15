/**
 * Robots.txt preflight for the Playwright crawl sellers (spec §5).
 * Read-only: resolves redirects, fetches {origin}/robots.txt, and reports the
 * `*` user-agent rules + whether the target path is disallowed. No crawling.
 * Run: npx tsx scripts/live-check/check-robots.ts
 */
const TARGETS: { label: string; url: string }[] = [
  { label: 'oliveyoung', url: 'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000123456' },
  { label: 'zigzag', url: 'https://store.zigzag.kr/' },
  { label: 'ably', url: 'https://m.a-bly.com/' },
];

function rulesForStar(robots: string): { disallow: string[]; allow: string[] } {
  const lines = robots.split('\n');
  let applies = false;
  const disallow: string[] = [];
  const allow: string[] = [];
  for (const line of lines) {
    const l = line.trim().toLowerCase();
    if (l.startsWith('user-agent:')) applies = l.replace('user-agent:', '').trim() === '*';
    if (!applies) continue;
    if (l.startsWith('disallow:')) disallow.push(l.replace('disallow:', '').trim());
    if (l.startsWith('allow:')) allow.push(l.replace('allow:', '').trim());
  }
  return { disallow, allow };
}

async function main() {
  for (const t of TARGETS) {
    let resolved = t.url;
    try {
      const r = await fetch(t.url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(10000) });
      resolved = r.url || t.url;
    } catch (e) {
      console.log(`\n[${t.label}] redirect resolve failed: ${e instanceof Error ? e.message : e}`);
    }
    const u = new URL(resolved);
    const robotsUrl = `${u.protocol}//${u.host}/robots.txt`;
    console.log(`\n=== ${t.label} ===`);
    console.log(`resolved: ${resolved}`);
    console.log(`robots:   ${robotsUrl}`);
    try {
      const res = await fetch(robotsUrl, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) {
        console.log(`  HTTP ${res.status} → no robots restriction (treated as allow)`);
        continue;
      }
      const text = await res.text();
      const { disallow } = rulesForStar(text);
      const blanket = disallow.includes('/');
      const pathBlocked = disallow.some((d) => d && d !== '/' && u.pathname.startsWith(d));
      console.log(`  User-agent: * Disallow → ${JSON.stringify(disallow.slice(0, 25))}`);
      console.log(`  blanket Disallow: / → ${blanket ? 'YES (all crawling blocked)' : 'no'}`);
      console.log(`  target path "${u.pathname}" blocked → ${blanket || pathBlocked ? 'YES' : 'no'}`);
    } catch (e) {
      console.log(`  robots fetch error: ${e instanceof Error ? e.message : e}`);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
