import 'dotenv/config';
import { supabaseServer } from '../../lib/supabase/server';

async function main() {
  const sellerSlug = process.argv[2]; // 'naver' | 'coupang'
  const sellerId = sellerSlug === 'naver' ? 4 : 3;
  const { data: listings } = await supabaseServer
    .from('listings')
    .select('id,link_key,product_id,seller_id,url,store_name,crawl_method')
    .eq('is_active', true)
    .eq('seller_id', sellerId);

  for (const l of listings || []) {
    const { data: p } = await supabaseServer
      .from('products')
      .select('product_key,name,brand,volume_ml')
      .eq('id', l.product_id)
      .single();
    console.log(JSON.stringify({
      id: l.id, link_key: l.link_key, url: l.url, store_name: l.store_name,
      product_key: p?.product_key, name: p?.name, brand: p?.brand, volume_ml: p?.volume_ml,
    }));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
