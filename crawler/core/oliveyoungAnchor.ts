/**
 * OliveYoung goodsNo 앵커 — 올리브영을 제목 유사도가 아니라 **goodsNo 동일성**으로 고정.
 *
 * 두 쪽 모두 goodsNo(예: A000000184222)를 얻을 수 있음을 확인(probe):
 *  - 네이버 올영 offer link: `...partner.do?...&sndType=goods&sndVal=A000000184222`
 *    → URL에 goodsNo가 들어있어 **페치 불필요**(goodsNoFromOyOfferLink, 순수).
 *  - 큐레이션 oy.run 단축링크: 200 OK 본문에 `getGoodsDetail.do?goodsNo=A000000235913`
 *    → 1회 페치로 추출(resolveCuratedOyGoodsNo, 캐시 + 상한). oliveyoung.co.kr 페이지는
 *      WAF 403이지만 우리가 보는 건 oy.run 인터스티셜 본문이라 무관.
 *
 * 매처는 큐레이션 goodsNo == offer goodsNo 인 offer를 정확 SKU로 채택, 미해석/불일치 시
 * 기존 느슨 매칭으로 폴백.
 */

/** OY 관련 URL/문자열에서 goodsNo(A0…) 추출. 네이버 offer는 sndType=goods의 sndVal. */
export function goodsNoFromOyOfferLink(link: string | null | undefined): string | null {
  if (!link) return null;
  const g = link.match(/goodsNo=([A-Za-z0-9]{6,})/i);
  if (g) return g[1];
  if (/sndType=goods/i.test(link)) {
    const s = link.match(/sndVal=([A-Za-z0-9]{6,})/i);
    if (s) return s[1];
  }
  return null;
}

function isMock(): boolean {
  return (
    process.env.VIEWTYPICK_MOCK_MODE === 'true' ||
    process.env.CRAWLER_MODE === 'mock' ||
    process.env.NODE_ENV === 'test'
  );
}

// oy.run 단축링크 해석은 1회 페치(캐시) + 전체 상한(비용/차단 방지). resolveCuratedProductNo와 동일 취지.
const curatedCache = new Map<string, string | null>();
let resolves = 0;
const MAX_RESOLVES = 80;

export function clearOyAnchorCache(): void {
  curatedCache.clear();
  resolves = 0;
}

/**
 * 큐레이션 OY 링크(oy.run 단축 또는 직접 URL) → goodsNo. 직접 URL에 goodsNo/sndVal이 있으면
 * 즉시 추출, 없으면 oy.run 본문을 1회 페치해 추출. mock/test/비-OY/상한초과/오류 → null.
 */
export async function resolveCuratedOyGoodsNo(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  const direct = goodsNoFromOyOfferLink(url);
  if (direct) return direct;
  if (isMock()) return null;
  if (curatedCache.has(url)) return curatedCache.get(url)!;
  if (!/oy\.run\/|oliveyoung\.co\.kr/i.test(url)) {
    curatedCache.set(url, null);
    return null;
  }
  if (resolves >= MAX_RESOLVES) return null;
  resolves++;
  let goodsNo: string | null = null;
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(12000) });
    if (res.ok) {
      const body = await res.text();
      goodsNo = goodsNoFromOyOfferLink(body) ?? (body.match(/goodsNo=([A-Za-z0-9]{6,})/i)?.[1] ?? null);
    }
  } catch {
    goodsNo = null;
  }
  curatedCache.set(url, goodsNo);
  return goodsNo;
}
