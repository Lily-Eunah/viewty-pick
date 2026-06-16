"use client";

import React from 'react';
import Link from 'next/link';
import {
  DrySkinIcon,
  OilySkinIcon,
  CombinationSkinIcon,
  SensitiveSkinIcon,
  DehydratedOilyIcon,
  SunscreenIcon,
  TonerIcon,
  LotionIcon,
  CreamIcon,
  CleansingIcon,
  MaskIcon,
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

// 대분류(major) entry points — each opens /c/[major] with 소분류 sub-filter chips.
const categories = [
  { id: "suncare", label: "선케어", icon: SunscreenIcon, path: "/c/suncare" },
  { id: "skincare", label: "스킨케어", icon: TonerIcon, path: "/c/skincare" },
  { id: "cleansing-care", label: "클렌징", icon: CleansingIcon, path: "/c/cleansing-care" },
  { id: "maskpack", label: "마스크팩", icon: MaskIcon, path: "/c/maskpack" },
  { id: "bodycare", label: "바디케어", icon: LotionIcon, path: "/c/bodycare" },
  { id: "base-makeup", label: "베이스 메이크업", icon: CreamIcon, path: "/c/base-makeup" },
];

export function SkinTypeAndCategorySection({
  selectedSkin,
  onSkinSelect,
}: SkinTypeAndCategorySectionProps) {
  return (
    <section className="space-y-7 px-4 py-3 bg-bg">
      {/* 1. 피부 타입 */}
      <div>
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-[14px] font-black text-title">내 피부 타입은?</h2>
          <button
            type="button"
            className="text-[11px] font-bold text-text-secondary hover:text-primary transition-colors cursor-pointer"
          >
            수정 &gt;
          </button>
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

      {/* 2. 카테고리 */}
      <div>
        <div className="mb-3 px-1">
          <h2 className="text-[14px] font-black text-title">카테고리</h2>
        </div>

        <div className="grid grid-cols-4 gap-2.5">
          {categories.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.id}
                href={item.path}
                aria-label={`${item.label} 카테고리 보기`}
                className="group flex min-h-[96px] flex-col items-center justify-center rounded-[18px] border border-line bg-surface px-2 py-3 shadow-[0_8px_24px_rgba(65,0,22,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:bg-accent-soft/10 active:scale-[0.96] text-center"
              >
                <Icon className="h-[48px] w-[48px] transition-transform duration-200 group-hover:scale-105" />
                <span className="mt-2 text-[12px] font-black leading-none text-text-secondary group-hover:text-primary transition-colors duration-150 truncate w-full">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
