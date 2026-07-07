'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';

export interface EditorCard {
  slug: string;
  label: string; // 여름 필수 / 요즘 뜨는 성분
  emoji: string; // /emoji/xxxx.svg (theme)
  tint: string; // top area bg
  pillBg: string;
  pillColor: string;
  hook: string; // may contain \n (2 lines)
  n: number;
  brand: string | null;
  name: string | null;
  image: string | null; // real product photo
  price: number | null;
  regularPrice: number | null;
  discountPct: number | null;
  storeName: string | null;
  storeSlug: string | null;
}

const STORE_COLOR: Record<string, string> = {
  coupang: '#FF6B35',
  naver: '#03C75A',
  oliveyoung: '#007556',
};

const CARD_STEP = 310; // 300px card + 10px gap

export default function EditorPickCarousel({ cards }: { cards: EditorCard[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const onScroll = () => {
    const el = railRef.current;
    if (!el) return;
    setActive(Math.round(el.scrollLeft / CARD_STEP));
  };

  return (
    <div>
      <div
        ref={railRef}
        onScroll={onScroll}
        className="flex gap-2.5 overflow-x-auto no-scrollbar snap-x snap-mandatory px-4 pt-0.5"
      >
        {cards.map((c) => {
          const won = (v: number) => v.toLocaleString('ko-KR');
          const showReg = c.regularPrice != null && c.price != null && c.regularPrice > c.price;
          const dot = (c.storeSlug && STORE_COLOR[c.storeSlug]) || '#8A8877';
          return (
            <Link
              key={c.slug}
              href={`/best/${c.slug}`}
              className="min-w-[300px] max-w-[300px] shrink-0 snap-start bg-surface border border-line rounded-[20px] overflow-hidden active:scale-[0.99] transition-transform"
            >
              <div className="relative flex items-center gap-3.5 px-4 h-[116px]" style={{ background: c.tint }}>
                {c.discountPct != null && c.discountPct > 0 && (
                  <span className="absolute top-3 right-3.5 bg-[#8A1238] text-white text-[12px] font-black rounded-[9px] px-2 py-1">{Math.round(c.discountPct)}%↓</span>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.image ?? c.emoji}
                  alt=""
                  width={86}
                  height={86}
                  className={c.image ? 'w-[86px] h-[86px] shrink-0 rounded-2xl object-cover bg-white border border-[#EFE6DF]' : 'w-[52px] h-[52px] shrink-0'}
                />
                <div className="flex-1 min-w-0">
                  <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[9.5px] font-extrabold mb-1.5" style={{ background: c.pillBg, color: c.pillColor }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.emoji} alt="" width={12} height={12} className="w-3 h-3" />
                    {c.label}
                  </span>
                  <div className="text-[14px] font-black text-title leading-[1.32] tracking-tight whitespace-pre-line">{c.hook}</div>
                </div>
              </div>

              <div className="px-4 py-3 border-t border-[#F0EBE3]">
                {c.brand && <div className="text-[11px] font-extrabold text-[#A2907E]">{c.brand}</div>}
                {c.name && <div className="text-[12px] font-bold text-body truncate mb-2">{c.name}</div>}
                <div className="flex items-baseline gap-1.5 mb-2.5">
                  {c.price != null ? (
                    <>
                      <span className="text-[20px] font-black text-primary tracking-tight">{won(c.price)}</span>
                      <span className="text-[12px] font-black text-primary">원</span>
                      {showReg && <span className="text-[11px] text-[#B4AFA2] line-through">{won(c.regularPrice!)}원</span>}
                    </>
                  ) : (
                    <span className="text-[13px] font-bold text-sub">가격 준비 중</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#4E5A66]">
                    <span className="w-3 h-3 rounded-full" style={{ background: dot }} />
                    {c.storeName ? `${c.storeName} 최저` : '최저가 비교'}
                  </span>
                  <span className="text-[10.5px] font-black text-sub">{c.n}개 비교 →</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {cards.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {cards.map((c, i) => (
            <span
              key={c.slug}
              className="h-1.5 rounded-full transition-all duration-200"
              style={{ width: i === active ? 18 : 6, background: i === active ? '#410016' : '#DDD5C8' }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
