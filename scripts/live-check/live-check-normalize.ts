/**
 * LIVE normalize validation — feeds REAL captured Coupang responses through
 * normalizePrice() to confirm the gating policy works once the coupang field
 * mapping is corrected (productPrice → salePrice).
 *
 * Validates: bundle math (N개), per-ml price, volume-mismatch gate
 * (parse_confidence=low), conditional-benefit separation.
 *
 * Run: npm run live-check:normalize
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { normalizePrice } from '../../crawler/core/normalize';
import { PriceOffer } from '../../crawler/adapters';
import { Product } from '../../lib/types';

const ART_DIR = path.join(__dirname, 'artifacts', 'coupang');

function fakeProduct(volume_ml: number, name: string): Product {
  return {
    id: 1, slug: 's', product_key: 'k', name, brand: '브랜드', category_id: null,
    volume_ml, image_url: null, features: null, skin_types: [], hwahae_url: null,
    official_info_url: null, viewty_score: 0, source: 'sheet', is_active: true,
  };
}

// CORRECTED mapping of a real Coupang search item → PriceOffer
function mapCorrected(raw: Record<string, unknown>): PriceOffer {
  return {
    regularPrice: null,
    salePrice: typeof raw.productPrice === 'number' ? raw.productPrice : null, // FIX: productPrice
    inStock: true,
    promoType: 'none',
    promoText: null,
    sourceText: String(raw.productName ?? ''),
    storeName: raw.isRocket ? '쿠팡 로켓배송' : '쿠팡',
    parsedVolumeRaw: null, // let normalize derive from title
    shippingNote: raw.isRocket ? '로켓배송' : null,
  };
}

function run(label: string, raw: Record<string, unknown>, dbVolume: number) {
  const offer = mapCorrected(raw);
  const product = fakeProduct(dbVolume, String(raw.productName ?? ''));
  const n = normalizePrice(product, offer);
  console.log(`\n=== ${label} ===`);
  console.log(`  title: ${raw.productName}`);
  console.log(`  productPrice(real): ${raw.productPrice}  | DB volume_ml: ${dbVolume}`);
  console.log(`  → base_unit_price=${n.base_unit_price} effective_unit_price=${n.effective_unit_price}`);
  console.log(`    total_quantity=${n.total_quantity} total_ml=${n.total_ml} unit_price(per ml)=${n.unit_price}`);
  console.log(`    promo_type=${n.promo_type} parse_confidence=${n.parse_confidence} volume_mismatch=${n.volume_mismatch}`);
  console.log(`    shipping_note=${n.shipping_note} (label only — not in any price field)`);
  return n;
}

function main() {
  // Real captured items (DB catalog products are all 50ml singles)
  const files = fs.existsSync(ART_DIR) ? fs.readdirSync(ART_DIR).filter((f) => f.endsWith('.json')) : [];
  for (const f of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(ART_DIR, f), 'utf-8'));
    run(f.replace('.json', ''), raw, 50);
  }

  // Synthetic-from-real: the deeplink target of LINK_COUPANG_1 (productId 5529437152)
  // is actually a 60ml 1+1 baby sunscreen — demonstrates volume-mismatch gate.
  run('DEEPLINK_TARGET_5529437152 (1+1 60ml vs DB 50ml)', {
    productName: '[6개월 이상 첫 선케어] [1+1] 몽디에스 아기/유아 무기자차 선크림 SPF30 PA+++ 60ml',
    productPrice: 33000, isRocket: false,
  }, 50);

  console.log('\n--- Policy checks ---');
  console.log('• 5개 bundle → effective = total/5, parse_confidence=high when title ml == DB ml');
  console.log('• 60ml title vs 50ml DB → volume_mismatch=true, parse_confidence=low → excluded from comparison');
  console.log('• shipping_note carries 로켓배송 label only; base/effective prices never include shipping');
}
main();
