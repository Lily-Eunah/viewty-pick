/**
 * PR-5 전환기 컬럼 호환 (volume_ml→unit_size, volume_unit→size_unit rename).
 *
 * products의 두 컬럼을 rename하는 동안 "코드 배포 ↔ DB 마이그레이션" 시차를 무해하게 만든다.
 * 모든 products 조회는 `select('*')`이므로 rename 전에는 row에 volume_ml/volume_unit이,
 * rename 후에는 unit_size/size_unit이 담긴다. 이 헬퍼는 어느 쪽이 오든 코드가 계속 쓰는
 * volume_ml/volume_unit 필드로 정규화해 downstream을 무변경으로 둔다.
 *
 * ⚠️ 조회(READ)만 호환된다. 쓰기(import upsert)는 컬럼명을 관용할 수 없어 새 이름(unit_size)으로
 *    쓰며, 반드시 마이그레이션 적용 "후"에 실행해야 한다(운영 순서 문서 참조). daily 크롤은
 *    products를 READ만 하므로(점수/이미지 update는 volume 컬럼 미포함) 이 호환으로 무중단이다.
 */
export function productRowCompat<T>(r: T): T {
  if (!r || typeof r !== 'object') return r;
  const row = r as unknown as Record<string, unknown>;
  if (row.volume_ml == null && row.unit_size != null) row.volume_ml = row.unit_size;
  if (row.volume_unit == null && row.size_unit != null) row.volume_unit = row.size_unit;
  return r;
}

export function productRowsCompat<T>(rows: T[] | null | undefined): T[] {
  return (rows ?? []).map(productRowCompat);
}
