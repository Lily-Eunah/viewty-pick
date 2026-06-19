"use client";

import React from 'react';
import {
  DrySkinIcon,
  OilySkinIcon,
  CombinationSkinIcon,
  SensitiveSkinIcon,
  DehydratedOilyIcon,
} from "./BeautyIcons";

interface SkinTypeAndCategorySectionProps {
  selectedSkin: string | null;
  onSkinSelect: (skin: string) => void;
}

const skinTypes = [
  { id: "dry", label: "건성", icon: DrySkinIcon },
  { id: "oily", label: "지성", icon: OilySkinIcon },
  { id: "combination", label: "복합성", icon: CombinationSkinIcon },
  { id: "sensitive", label: "민감성", icon: SensitiveSkinIcon },
  { id: "dehydrated-oily", label: "수부지", icon: DehydratedOilyIcon },
];

export function SkinTypeAndCategorySection({
  selectedSkin,
  onSkinSelect,
}: SkinTypeAndCategorySectionProps) {
  return (
    <section className="px-4 py-3 bg-bg">
      {/* 1. 피부 타입 */}
      <div>
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-[14px] font-black text-title">내 피부 타입은?</h2>
        </div>

        <div className="rounded-[22px] border border-line bg-surface px-3 py-4 shadow-[0_8px_24px_rgba(65,0,22,0.06)]">
          <div className="grid grid-cols-5 gap-1">
            {skinTypes.map((item) => {
              const Icon = item.icon;
              const active = selectedSkin === item.label;

              return (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`${item.label} 피부 타입 선택`}
                  aria-pressed={active}
                  onClick={() => onSkinSelect(item.label)}
                  className="group flex flex-col items-center gap-2 focus:outline-none cursor-pointer"
                >
                  <span
                    className={[
                      "flex h-[54px] w-[54px] items-center justify-center rounded-full border transition-all duration-200 active:scale-95",
                      active
                        ? "border-accent bg-accent-soft shadow-[0_4px_12px_rgba(65,0,22,0.08)]"
                        : "border-border bg-surface group-hover:border-accent group-hover:bg-[#FAEEF2]",
                    ].join(" ")}
                  >
                    <Icon className="h-8 w-8" />
                  </span>

                  <span
                    className={[
                      "text-[12px] font-bold transition-colors duration-150",
                      active ? "text-primary font-black" : "text-text-secondary group-hover:text-primary",
                    ].join(" ")}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

