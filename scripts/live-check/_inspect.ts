import 'dotenv/config';
import { supabaseServer, isSupabaseServerConfigured } from '../../lib/supabase/server';

async function main() {
  if (!isSupabaseServerConfigured()) { console.log('SUPABASE NOT CONFIGURED'); process.exit(2); }
  const { data: sellers, error: se } = await supabaseServer.from('sellers').select('id,slug,name');
  if (se) { console.log('sellers error', se.message); process.exit(1); }
  console.log('SELLERS:', JSON.stringify(sellers));
  const { data: listings, error: le } = await supabaseServer
    .from('listings')
    .select('id,link_key,product_id,seller_id,url,store_name,crawl_method,is_active,crawl_enabled')
    .eq('is_active', true);
  if (le) { console.log('listings error', le.message); process.exit(1); }
  console.log('ACTIVE LISTINGS COUNT:', listings?.length);
  const bySeller: Record<string, number> = {};
  for (const l of listings || []) bySeller[l.seller_id] = (bySeller[l.seller_id] || 0) + 1;
  console.log('BY SELLER_ID:', JSON.stringify(bySeller));
  for (const l of listings || []) {
    let host = '';
    try { host = new URL(l.url).host; } catch { host = '(invalid)'; }
    console.log(`listing#${l.id} seller=${l.seller_id} method=${l.crawl_method} host=${host} link_key=${l.link_key}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
