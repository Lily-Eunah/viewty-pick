import React from 'react';
import { won } from '../../lib/format';
import { UIStorePrice } from '../../lib/types';

interface PriceTableProps {
  stores: UIStorePrice[];
}

export default function PriceTable({ stores }: PriceTableProps) {
  return (
    <div className="w-full bg-white border border-line rounded-card overflow-hidden shadow-sm">
      <table className="w-full text-left border-collapse text-[12px] font-bold">
        <thead>
          <tr className="bg-bg-warm border-b border-line text-title text-[11px] font-black uppercase">
            <th className="py-2.5 px-3">판매처</th>
            <th className="py-2.5 px-3 text-right">기본가</th>
            <th className="py-2.5 px-3">혜택</th>
            <th className="py-2.5 px-3 text-right text-price">실질가</th>
            <th className="py-2.5 px-3 text-center">링크</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider text-body">
          {stores.map((store, idx) => {
            const isCheapest = store.isBest;
            const finalPrice = store.effectiveUnitPrice || store.price;

            return (
              <tr
                key={idx}
                className={`transition-colors hover:bg-bg ${
                  isCheapest ? 'bg-accent-soft/40 font-extrabold' : ''
                }`}
              >
                {/* 1. Store Name */}
                <td className="py-3 px-3">
                  <div className="flex flex-col">
                    <span className="font-extrabold text-title flex items-center gap-0.5">
                      {store.isBest && '🏆'} {store.name}
                    </span>
                    {store.isRocket && (
                      <span className="text-[8px] text-sky-600 font-extrabold leading-none mt-0.5">
                        로켓배송
                      </span>
                    )}
                  </div>
                </td>

                {/* 2. Base Price */}
                <td className="py-3 px-3 text-right text-[#888]">
                  {won(store.price)}
                </td>

                {/* 3. Promotion Label */}
                <td className="py-3 px-3 text-[11px] font-extrabold text-[#7A5B00] max-w-[80px] truncate">
                  {store.promoText || '-'}
                </td>

                {/* 4. Effective Price */}
                <td className="py-3 px-3 text-right text-price font-extrabold">
                  {won(finalPrice)}
                  {store.unitPrice !== undefined && store.unitPrice !== null && store.unitPrice > 0 && (
                    <div className="text-[9px] text-sub font-semibold leading-none mt-0.5">
                      ml당 {Math.round(store.unitPrice)}원
                    </div>
                  )}
                </td>

                {/* 5. Direct Link */}
                <td className="py-3 px-3 text-center">
                  <a
                    href={store.url}
                    target="_blank"
                    rel="sponsored nofollow"
                    className={`inline-flex items-center justify-center w-[52px] py-1.5 rounded-md text-[10px] font-black transition-colors ${
                      isCheapest
                        ? 'bg-accent text-[#7A5B00]'
                        : 'bg-primary-light text-primary-dark hover:bg-opacity-90'
                    }`}
                  >
                    이동
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
