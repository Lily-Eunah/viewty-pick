'use client';

import React from 'react';
import Link from 'next/link';
import AppShell from '../../components/layout/AppShell';
import Header from '../../components/layout/Header';
import {
  SunscreenIcon,
  TonerIcon,
  CleansingIcon,
  MaskIcon,
  LotionIcon,
  CreamIcon,
} from '../../components/home/BeautyIcons';

const categories = [
  { id: "suncare", label: "선케어", icon: SunscreenIcon, path: "/c/suncare", desc: "선크림 / 선스틱 / 선쿠션" },
  { id: "skincare", label: "스킨케어", icon: TonerIcon, path: "/c/skincare", desc: "토너 / 로션 / 에센스 / 크림" },
  { id: "cleansing-care", label: "클렌징", icon: CleansingIcon, path: "/c/cleansing-care", desc: "폼클렌징 / 필링 / 오일" },
  { id: "maskpack", label: "마스크팩", icon: MaskIcon, path: "/c/maskpack", desc: "시트팩 / 패드 / 워시오프" },
  { id: "bodycare", label: "바디케어", icon: LotionIcon, path: "/c/bodycare", desc: "바디로션 / 보습 / 샤워" },
  { id: "base-makeup", label: "베이스 메이크업", icon: CreamIcon, path: "/c/base-makeup", desc: "쿠션 / 파운데이션 / 비비" },
];

export default function CategoriesExplorerPage() {
  return (
    <AppShell activeTab="category">
      <Header title="카테고리 탐색" />

      {/* Header Message */}
      <section className="bg-bg px-4 py-6 border-b border-line">
        <h2 className="text-[20px] font-black text-title leading-tight tracking-tight">
          전체 카테고리
        </h2>
        <p className="text-[12px] text-body opacity-85 mt-1 font-semibold">
          원하시는 카테고리를 선택해 판매처별 최저가 비교 목록을 탐색하세요.
        </p>
      </section>

      {/* Categories Grid */}
      <section className="px-4 py-5 bg-bg flex-grow">
        <div className="grid grid-cols-2 gap-4">
          {categories.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.id}
                href={item.path}
                aria-label={`${item.label} 카테고리 보기`}
                className="group flex flex-col justify-between rounded-[22px] border border-line bg-surface p-4 shadow-[0_8px_24px_rgba(65,0,22,0.05)] transition-all duration-250 hover:-translate-y-0.5 hover:border-accent active:scale-[0.97] min-h-[140px]"
              >
                <div className="flex justify-between items-start">
                  <span className="text-[14px] font-black text-title group-hover:text-primary transition-colors">
                    {item.label}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3.5 h-3.5 text-text-muted group-hover:text-primary transition-colors">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </div>

                <div className="flex items-end justify-between mt-4">
                  <span className="text-[10px] text-text-secondary font-bold leading-relaxed max-w-[70%]">
                    {item.desc}
                  </span>
                  <Icon className="h-12 w-12 transition-transform duration-200 group-hover:scale-105 shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
