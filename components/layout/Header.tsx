'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSelectedSkinType } from '../../lib/hooks/useSelectedSkinType';
import {
  DrySkinIcon,
  OilySkinIcon,
  CombinationSkinIcon,
  SensitiveSkinIcon,
  DehydratedOilyIcon,
} from '../home/BeautyIcons';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  hideSkinSetting?: boolean;
}

export default function Header({
  title,
  subtitle,
  showBack = false,
  rightAction,
  hideSkinSetting = false,
}: HeaderProps) {
  const router = useRouter();
  const [selectedSkin, setSelectedSkin] = useSelectedSkinType();
  const [isSkinModalOpen, setIsSkinModalOpen] = useState(false);

  if (!showBack) {
    // 1. Home / Branding Header (UI_DESIGN.md §4)
    return (
      <>
        <header className="w-full bg-bg px-4 pt-5 pb-3 flex justify-between items-center z-30">
          <div className="flex flex-col">
            <h1 className="text-[22px] font-black text-primary tracking-tight leading-tight">
              ViewtyPick
            </h1>
            <span className="text-[12px] text-sub font-medium leading-none mt-0.5">
              {subtitle || '믿고 사는 뷰티 최저가'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {rightAction !== undefined ? rightAction : (
              !hideSkinSetting && (
                <button
                  onClick={() => setIsSkinModalOpen(true)}
                  className={`px-3 py-1.5 border rounded-full text-[11px] transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer ${
                    selectedSkin
                      ? 'border-accent bg-accent-soft font-black text-primary shadow-[0_2px_8px_rgba(65,0,22,0.06)]'
                      : 'border-line bg-surface font-extrabold text-text-secondary hover:border-accent hover:text-primary'
                  }`}
                  aria-label="피부 타입 설정"
                >
                  {selectedSkin ? (
                    <>
                      {selectedSkin === '건성' && <DrySkinIcon className="w-3.5 h-3.5" />}
                      {selectedSkin === '지성' && <OilySkinIcon className="w-3.5 h-3.5" />}
                      {selectedSkin === '복합성' && <CombinationSkinIcon className="w-3.5 h-3.5" />}
                      {selectedSkin === '민감성' && <SensitiveSkinIcon className="w-3.5 h-3.5" />}
                      {selectedSkin === '수부지' && <DehydratedOilyIcon className="w-3.5 h-3.5" />}
                      <span>{selectedSkin}</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
                      </svg>
                      <span>피부타입 설정</span>
                    </>
                  )}
                </button>
              )
            )}
          </div>
        </header>

        {/* Skin Type Selection Modal */}
        {isSkinModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-line rounded-[28px] max-w-[360px] w-full p-6 shadow-floating animate-in fade-in zoom-in duration-200">
              <div className="flex justify-between items-start mb-2">
                <h4 className="text-[16px] font-black text-primary">내 피부 타입 설정</h4>
                <button
                  onClick={() => setIsSkinModalOpen(false)}
                  className="text-text-secondary hover:text-primary transition-colors cursor-pointer p-0.5"
                  aria-label="닫기"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <p className="text-[11.5px] text-text-secondary font-semibold leading-relaxed mb-5">
                피부 타입을 설정해 두시면 나에게 최적화된 맞춤 제품을 우선적으로 추천해 드려요.
              </p>

              <div className="grid grid-cols-5 gap-1.5 mb-5">
                {[
                  { id: 'dry', label: '건성', icon: DrySkinIcon },
                  { id: 'oily', label: '지성', icon: OilySkinIcon },
                  { id: 'combination', label: '복합성', icon: CombinationSkinIcon },
                  { id: 'sensitive', label: '민감성', icon: SensitiveSkinIcon },
                  { id: 'dehydrated-oily', label: '수부지', icon: DehydratedOilyIcon },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = selectedSkin === item.label;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-label={`${item.label} 피부 타입 선택`}
                      aria-pressed={active}
                      onClick={() => {
                        setSelectedSkin(active ? null : item.label);
                        setIsSkinModalOpen(false);
                      }}
                      className="group flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
                    >
                      <span
                        className={`flex h-[52px] w-[52px] items-center justify-center rounded-full border transition-all duration-200 active:scale-95 ${
                          active
                            ? 'border-accent bg-accent-soft shadow-[0_4px_12px_rgba(65,0,22,0.08)]'
                            : 'border-border bg-surface group-hover:border-accent group-hover:bg-[#FAEEF2]'
                        }`}
                      >
                        <Icon className="h-7 w-7" />
                      </span>

                      <span
                        className={`text-[11px] font-bold transition-colors duration-150 ${
                          active ? 'text-primary font-black' : 'text-text-secondary group-hover:text-primary'
                        }`}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-center border-t border-divider pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSkin(null);
                    setIsSkinModalOpen(false);
                  }}
                  className="text-[11px] text-[#A8A0A0] hover:text-primary font-bold transition-colors cursor-pointer"
                >
                  설정 안 함 (초기화)
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // 2. Subpage Header (with Back button)
  return (
    <header className="w-full h-14 bg-bg border-b border-divider px-4 flex items-center justify-between sticky top-0 z-35">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-1 text-title hover:bg-bg-warm rounded-full transition-colors active:scale-95"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </button>
        {title && (
          <h2 className="text-[17px] font-extrabold text-title tracking-tight truncate max-w-[240px]">
            {title}
          </h2>
        )}
      </div>
      <div className="flex items-center gap-2">
        {rightAction || (
          <button
            onClick={() => alert('공유 기능은 준비 중입니다!')}
            className="p-2 text-title hover:text-primary active:scale-95 transition-transform"
            aria-label="Share"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}
