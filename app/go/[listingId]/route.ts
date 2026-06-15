import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { isSupabaseServerConfigured, supabaseServer } from '../../../lib/supabase/server';
import { loadMockDB, saveMockDB } from '../../../lib/supabase/mockDb';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  const resolvedParams = await params;
  const listingIdStr = resolvedParams.listingId;
  const listingId = parseInt(listingIdStr, 10);

  if (isNaN(listingId)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const useSupabase = isSupabaseServerConfigured();
  let affiliateUrl: string | null = null;
  let productId: number | null = null;
  let sellerCode: string | null = null;

  // Track click details
  const referrer = request.headers.get('referer') || '';
  const pagePath = request.nextUrl.pathname;
  const userAgent = request.headers.get('user-agent') || '';
  const userAgentHash = crypto.createHash('md5').update(userAgent).digest('hex');
  const sessionId = request.cookies.get('sb-access-token')?.value || 'anonymous-session';

  if (useSupabase) {
    try {
      // Fetch listing details
      const { data: listing } = await supabaseServer
        .from('listings')
        .select('*, sellers(slug)')
        .eq('id', listingId)
        .single();

      if (listing) {
        // Redirect priority (spec §3): affiliate_url → latest_matched_url → none.
        affiliateUrl = listing.affiliate_url || listing.latest_matched_url || null;
        productId = listing.product_id;
        sellerCode = (listing.sellers as { slug?: string })?.slug || 'unknown';

        // Log click
        await supabaseServer.from('affiliate_clicks').insert({
          product_id: productId,
          listing_id: listingId,
          seller_code: sellerCode,
          referrer,
          page_path: pagePath,
          user_agent_hash: userAgentHash,
          session_id: sessionId,
        });
      }
    } catch (e) {
      console.error('[Redirect] Failed logging to Supabase:', e);
    }
  } else {
    // Local DB Redirect Sync
    console.log(`[Redirect] Simulating click log for Listing ID ${listingId} in Mock DB...`);
    const db = loadMockDB();
    const listing = db.listings.find((l) => l.id === listingId);
    if (listing) {
      const seller = db.sellers.find((s) => s.id === listing.seller_id);
      
      affiliateUrl = listing.affiliate_url || listing.latest_matched_url || null;
      productId = listing.product_id;
      sellerCode = seller?.slug || 'unknown';

      // Log click to mock DB snapshots array for debug
      const clickId = db.affiliate_clicks.length + 1;
      db.affiliate_clicks.push({
        id: clickId,
        product_id: productId,
        listing_id: listingId,
        seller_code: sellerCode,
        clicked_at: new Date().toISOString(),
        referrer,
        page_path: pagePath,
        user_agent_hash: userAgentHash,
        session_id: sessionId,
      });
      saveMockDB(db);
    }
  }

  // Redirect target
  const targetUrl = affiliateUrl || '/';
  console.log(`[Redirect] Redirecting User to: ${targetUrl}`);
  
  return NextResponse.redirect(new URL(targetUrl, request.url));
}
export const dynamic = 'force-dynamic';
