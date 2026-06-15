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
  SerumIcon,
  CleansingIcon,
  MaskIcon,
  MoreGridIcon,
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

const categories = [
  { id: "sunscreen", label: "선크림", icon: SunscreenIcon, path: "/c/sunscreen" },
  { id: "toner", label: "스킨/토너", icon: TonerIcon, path: "/c/toner" },
  { id: "lotion", label: "로션", icon: LotionIcon, path: "alert" },
  { id: "cream", label: "크림", icon: CreamIcon, path: "/c/cream" },
  { id: "serum", label: "세럼", icon: SerumIcon, path: "/c/serum" },
  { id: "cleansing", label: "클렌징", icon: CleansingIcon, path: "/c/cleansing" },
  { id: "mask", label: "마스크", icon: MaskIcon, path: "alert" },
  { id: "more", label: "더보기", icon: MoreGridIcon, path: "alert" },
];

export function SkinTypeAndCategorySection({
  selectedSkin,
  onSkinSelect,
}: SkinTypeAndCategorySectionProps) {
  
  const handleCategoryClick = (e: React.MouseEvent, path: string, label: string) => {
    if (path === 'alert') {
      e.preventDefault();
      alert(`"${label}" 카테고리는 준비 중입니다! (Phase 5 출시 예정)`);
    }
  };

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
            const isAlert = item.path === 'alert';

            return (
              <Link
                key={item.id}
                href={isAlert ? '#' : item.path}
                onClick={(e) => isAlert && handleCategoryClick(e, item.path, item.label)}
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
