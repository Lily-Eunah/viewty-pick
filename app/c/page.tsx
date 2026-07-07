'use client';

import React from 'react';
import Link from 'next/link';
import AppShell from '../../components/layout/AppShell';
import Header from '../../components/layout/Header';
import {
  SuncareImageIcon,
  SkincareImageIcon,
  CleansingCareImageIcon,
  MaskpackImageIcon,
  BodycareImageIcon,
  BaseMakeupImageIcon,
  HaircareImageIcon,
  FeminineHygieneImageIcon,
} from '../../components/home/BeautyIcons';

const categories = [
  { id: "suncare", label: "선케어", icon: SuncareImageIcon, path: "/c/suncare", desc: ["선크림", "선스틱", "선쿠션"] },
  { id: "skincare", label: "스킨케어", icon: SkincareImageIcon, path: "/c/skincare", desc: ["스킨·토너", "로션", "에센스·세럼", "올인원", "크림", "디바이스"] },
  { id: "cleansing-care", label: "클렌징", icon: CleansingCareImageIcon, path: "/c/cleansing-care", desc: ["클렌징폼·젤", "오일·밤", "워터·밀크", "립&아이 리무버"] },
  { id: "maskpack", label: "마스크팩", icon: MaskpackImageIcon, path: "/c/maskpack", desc: ["시트팩", "패드"] },
  { id: "bodycare", label: "바디케어", icon: BodycareImageIcon, path: "/c/bodycare", desc: ["샤워·입욕", "바디로션·크림", "쉐이빙폼·젤·크림", "태닝·애프터선"] },
  { id: "base-makeup", label: "베이스 메이크업", icon: BaseMakeupImageIcon, path: "/c/base-makeup", desc: ["쿠션", "파운데이션", "BB·CC", "컨실러"] },
  { id: "haircare", label: "헤어케어", icon: HaircareImageIcon, path: "/c/haircare", desc: ["샴푸/스케일러", "두피에센스"] },
  { id: "Feminine Hygiene", label: "위생용품", icon: FeminineHygieneImageIcon, path: "/c/Feminine%20Hygiene", desc: ["Y존케어"] },
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

                <div className="flex items-end justify-between mt-4 gap-2">
                  {/* Sub-category list with whitespace-nowrap wrapping units */}
                  <div className="flex flex-wrap gap-x-1 gap-y-0.5 max-w-[70%]">
                    {item.desc.map((sub, idx) => (
                      <React.Fragment key={sub}>
                        <span className="text-[10px] text-text-secondary font-bold whitespace-nowrap">
                          {sub}
                        </span>
                        {idx < item.desc.length - 1 && (
                          <span className="text-[9px] text-[#A8A0A0] select-none">·</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                  
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
