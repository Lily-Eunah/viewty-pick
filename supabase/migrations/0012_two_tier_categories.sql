-- 2-tier categories (대분류/소분류).
--
-- categories gains a self-referential parent_id + a level. Majors (대분류) have
-- parent_id=null, level='major'; minors (소분류) point at their major. products
-- .category_id references a MINOR; the major is derived via parent_id.
--
-- The six existing flat categories (sunscreen/toner/cream/serum/cleansing/cushion)
-- are KEPT as minors (slugs unchanged) so existing products.category_id stays
-- valid; they are re-parented + renamed, and the new majors/minors are seeded.

alter table categories
  add column if not exists parent_id bigint references categories(id) on delete set null,
  add column if not exists level text check (level in ('major','minor')) default 'minor';

-- ── 1. Major categories (대분류) ────────────────────────────────────────────────
insert into categories (slug, name, sort_order, level, parent_id) values
  ('suncare',      '선케어',        1, 'major', null),
  ('skincare',     '스킨케어',      2, 'major', null),
  ('cleansing-care','클렌징',       3, 'major', null),
  ('maskpack',     '마스크팩',      4, 'major', null),
  ('bodycare',     '바디케어',      5, 'major', null),
  ('base-makeup',  '베이스 메이크업', 6, 'major', null)
on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order, level = 'major', parent_id = null;

-- ── 2. Re-parent + rename the existing flat categories as minors ────────────────
update categories set level='minor', sort_order=1, name='선크림',          parent_id=(select id from categories where slug='suncare')       where slug='sunscreen';
update categories set level='minor', sort_order=1, name='스킨/토너',        parent_id=(select id from categories where slug='skincare')      where slug='toner';
update categories set level='minor', sort_order=3, name='에센스/세럼/앰플', parent_id=(select id from categories where slug='skincare')      where slug='serum';
update categories set level='minor', sort_order=5, name='크림',            parent_id=(select id from categories where slug='skincare')      where slug='cream';
update categories set level='minor', sort_order=1, name='클렌징폼/젤',      parent_id=(select id from categories where slug='cleansing-care') where slug='cleansing';
update categories set level='minor', sort_order=1, name='쿠션',            parent_id=(select id from categories where slug='base-makeup')   where slug='cushion';

-- ── 3. New minor categories (소분류) ────────────────────────────────────────────
insert into categories (slug, name, sort_order, level, parent_id) values
  ('sunstick',        '선스틱',       2, 'minor', (select id from categories where slug='suncare')),
  ('suncushion',      '선쿠션',       3, 'minor', (select id from categories where slug='suncare')),
  ('lotion',          '로션',         2, 'minor', (select id from categories where slug='skincare')),
  ('allinone',        '올인원',       4, 'minor', (select id from categories where slug='skincare')),
  ('cleansing-oil',   '오일/밤',      2, 'minor', (select id from categories where slug='cleansing-care')),
  ('cleansing-water', '워터/밀크',    3, 'minor', (select id from categories where slug='cleansing-care')),
  ('sheet-mask',      '시트팩',       1, 'minor', (select id from categories where slug='maskpack')),
  ('pad',             '패드',         2, 'minor', (select id from categories where slug='maskpack')),
  ('shower',          '샤워/입욕',    1, 'minor', (select id from categories where slug='bodycare')),
  ('body-lotion',     '바디로션/크림', 2, 'minor', (select id from categories where slug='bodycare'))
on conflict (slug) do update set name=excluded.name, sort_order=excluded.sort_order, level='minor', parent_id=excluded.parent_id;
