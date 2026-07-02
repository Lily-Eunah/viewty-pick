'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export interface DrillItem {
  slug: string;
  label: string; // product-type label (토너/세럼/크림…)
  n: number;
}

export interface DrillGroup {
  key: string;
  label: string; // 진정·시카 / 건성 추천
  short: string; // 진정 / 건성 (tile label)
  emoji: string; // /emoji/xxxx.svg
  items: DrillItem[];
}

// 'concern' = mauve, 'skin' = blue — matches the section accent.
const THEME = {
  concern: { on: 'bg-accent-soft border-accent', panel: 'bg-accent-light', text: '#8A1238' },
  skin: { on: 'bg-secondary-soft border-secondary', panel: 'bg-secondary-soft', text: '#1E4A5C' },
} as const;

export default function DrillSection({ groups, accent }: { groups: DrillGroup[]; accent: 'concern' | 'skin' }) {
  const [sel, setSel] = useState<string | null>(null);
  const t = THEME[accent];

  return (
    <div className="mt-3">
      {/* Square emoji tiles — wraps to 2 rows when there are many. */}
      <ul className="grid grid-cols-4 gap-2">
        {groups.map((g) => {
          const on = sel === g.key;
          return (
            <li key={g.key}>
              <button
                type="button"
                onClick={() => setSel(on ? null : g.key)}
                aria-expanded={on}
                className={`w-full aspect-square flex flex-col items-center justify-center gap-1 rounded-2xl border transition-all active:scale-[0.97] ${on ? t.on : 'bg-surface border-line'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.emoji} alt="" width={30} height={30} className="w-[30px] h-[30px]" />
                <span className="text-[10px] font-black text-title leading-none">{g.short}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Panels stay in the DOM (crawlable) — only the selected one expands. */}
      <div className="flex flex-col">
        {groups.map((g) => {
          const on = sel === g.key;
          return (
            <div
              key={g.key}
              className="overflow-hidden transition-all duration-200 ease-out"
              style={{ maxHeight: on ? 320 : 0, opacity: on ? 1 : 0 }}
            >
              <div className="pt-2">
                <div className={`rounded-2xl ${t.panel} p-3`}>
                  <p className="text-[10px] font-black mb-2" style={{ color: t.text }}>{g.label} · 제품 유형</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {g.items.map((it) => (
                      <li key={it.slug}>
                        <Link
                          href={`/best/${it.slug}`}
                          className="inline-flex items-center gap-1.5 bg-surface border border-line rounded-full px-3 py-1.5 active:scale-[0.97] transition-transform"
                        >
                          <span className="text-[11px] font-bold text-title">{it.label}</span>
                          <span className="text-[10px] text-sub font-semibold">{it.n}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
