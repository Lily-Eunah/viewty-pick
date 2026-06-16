import React from 'react';
import { won, perMl } from '../../lib/format';
import { UIStorePrice } from '../../lib/types';

interface PriceTableProps {
  stores: UIStorePrice[];
}

// Columns reflect ONLY scraped data: 판매처 · 가격 · 개당가 · 구성 · 구매.
// No 배송 column (shipping is not collected — never show blank/fake shipping).
// Per-unit (개당가) is shown for multipacks; ml당 only when reliable. Link-only
// sellers (no price) still render with a "보기" link instead of being dropped.
export default function PriceTable({ stores }: PriceTableProps) {
  return (
    <div className="w-full bg-white border border-line rounded-card overflow-hidden shadow-sm">
      <table className="w-full text-left border-collapse text-[12px] font-bold">
        <thead>
          <tr className="bg-bg-warm border-b border-line text-title text-[11px] font-black uppercase">
            <th className="py-2.5 px-3">판매처</th>
            <th className="py-2.5 px-3 text-right">가격</th>
            <th className="py-2.5 px-3 text-right text-price">개당가</th>
            <th className="py-2.5 px-3">구성</th>
            <th className="py-2.5 px-3 text-center">구매</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider text-body">
          {stores.map((store, idx) => {
            const linkOnly = store.hasPrice === false;
            const qty = store.quantity ?? 1;
            const isMultipack = qty > 1 && store.effectiveUnitPrice != null;
            return (
              <tr key={idx} className={`transition-colors hover:bg-bg ${store.isBest ? 'bg-accent-soft/40 font-extrabold' : ''}`}>
                {/* 판매처 */}
                <td className="py-3 px-3">
                  <span className="font-extrabold text-title flex items-center gap-1 flex-wrap">
                    {store.isBest && '🏆'} {store.name}
                    {store.isOfficial && (
                      <span className="text-[8px] bg-primary-soft text-primary font-extrabold px-1 py-0.5 rounded-[2px] leading-none">공식</span>
                    )}
                  </span>
                </td>

                {/* 가격 (pack total for multipacks) */}
                <td className="py-3 px-3 text-right text-[#555]">
                  {linkOnly ? '—' : (
                    <>
                      {won(store.price)}
                      {isMultipack && <div className="text-[9px] text-sub font-semibold leading-none mt-0.5">{qty}개 묶음</div>}
                    </>
                  )}
                </td>

                {/* 개당가 (+ ml당 when reliable) */}
                <td className="py-3 px-3 text-right text-price font-extrabold">
                  {linkOnly ? '—' : isMultipack ? (
                    <>
                      {won(store.effectiveUnitPrice!)}<span className="text-[9px] font-bold">/개</span>
                      {store.unitPrice != null && store.unitPrice > 0 && (
                        <div className="text-[9px] text-sub font-semibold leading-none mt-0.5">{perMl(store.unitPrice)}</div>
                      )}
                    </>
                  ) : store.unitPrice != null && store.unitPrice > 0 ? (
                    <span className="text-[10px] text-sub font-semibold">{perMl(store.unitPrice)}</span>
                  ) : '–'}
                </td>

                {/* 구성 (promo + 로켓) */}
                <td className="py-3 px-3 text-[10.5px] font-extrabold max-w-[88px]">
                  {linkOnly ? (
                    <span className="text-sub">가격 확인</span>
                  ) : (
                    <span className="flex items-center gap-1 flex-wrap">
                      {store.composition && <span className="text-[#7A5B00] truncate">{store.composition}</span>}
                      {store.isRocket && <span className="text-[8px] bg-sky-100 text-sky-700 px-1 py-0.5 rounded-[2px] leading-none">로켓</span>}
                      {!store.composition && !store.isRocket && '-'}
                    </span>
                  )}
                </td>

                {/* 구매 / 보기 */}
                <td className="py-3 px-3 text-center">
                  <a
                    href={store.url}
                    target="_blank"
                    rel="sponsored nofollow"
                    className={`inline-flex items-center justify-center w-[52px] py-1.5 rounded-md text-[10px] font-black transition-colors ${
                      store.isBest ? 'bg-accent text-[#7A5B00]' : 'bg-primary-light text-primary-dark hover:bg-opacity-90'
                    }`}
                  >
                    {linkOnly ? '보기' : '이동'}
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
