'use client';

import React from 'react';

/**
 * 아이스크림 프로그레스바 — 답할 때마다 트랙이 차오르고, 맨 앞의 아이스크림이
 * 파트를 지날 때마다 다른 맛으로 변신한다. 고민 토핑(마지막)·보너스는 전용 이모지.
 */
const PART_EMOJI = ['🍦', '🍧', '🍨', '🍡'];

interface IceCreamProgressProps {
  /** 현재 문항 인덱스(0-based). */
  step: number;
  /** 전체 문항 수(보너스 포함 시 +1). */
  total: number;
  /** 마지막(토핑)·보너스 등 전용 이모지 덮어쓰기. */
  emoji?: string;
}

export default function IceCreamProgress({ step, total, emoji }: IceCreamProgressProps) {
  const pct = Math.min(100, Math.round(((step + 1) / total) * 100));
  const icon = emoji ?? PART_EMOJI[Math.min(Math.floor((step / total) * PART_EMOJI.length), PART_EMOJI.length - 1)];

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-grow h-3 rounded-pill bg-white border border-line overflow-visible">
        <div
          className="h-full rounded-pill bg-gradient-to-r from-[#F3BCCC] to-accent transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-500 ease-out"
          style={{ left: `${pct}%` }}
        >
          {/* key 리마운트로 맛이 바뀔 때마다 팝 애니메이션 */}
          <span
            key={icon}
            className="animate-pop block text-[22px] leading-none drop-shadow-[0_2px_3px_rgba(65,0,22,0.25)]"
            aria-hidden
          >
            {icon}
          </span>
        </div>
      </div>
      <span className="shrink-0 text-[12px] font-black text-primary tabular-nums" aria-label={`진행 ${step + 1} / ${total}`}>
        {step + 1}<span className="text-sub font-bold"> / {total}</span>
      </span>
    </div>
  );
}
