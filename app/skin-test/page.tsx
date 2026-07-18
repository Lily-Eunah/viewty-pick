import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import AppShell from '../../components/layout/AppShell';
import Header from '../../components/layout/Header';

export const metadata: Metadata = {
  title: '내 피부는 무슨 아이스크림 맛? | 뷰티픽 피부타입 테스트',
  description:
    '유분·수분·민감 3축 10문항, 90초 피부타입 테스트. 내 피부 아이스크림 캐릭터와 타입 맞춤 검증템 최저가까지 한 번에 확인하세요.',
  openGraph: {
    title: '내 피부는 무슨 아이스크림 맛?',
    description: '10문항 90초 — 피부타입 캐릭터 테스트',
    images: ['/images/skin-test/base-normal.png'],
  },
};

// 랜딩 히어로에 세워둘 캐릭터 미리보기(결과 스포일러를 줄이려 4종만).
const HERO_CHARACTERS = [
  { src: '/images/skin-test/base-normal.png', alt: '투게더 바닐라 캐릭터', cls: 'h-20 -rotate-6' },
  { src: '/images/skin-test/base-oily.png', alt: '폴라포 캐릭터', cls: 'h-24 translate-y-1' },
  { src: '/images/skin-test/base-dry.png', alt: '빵또아 캐릭터', cls: 'h-22 rotate-3' },
  { src: '/images/skin-test/base-combo.png', alt: '월드콘 캐릭터', cls: 'h-24 rotate-6 translate-y-0.5' },
];

export default function SkinTestLandingPage() {
  return (
    <AppShell activeTab="home">
      <Header showBack title="피부 아이스크림 테스트" />

      <section className="bg-background-warm px-4 pt-8 pb-10 border-b border-line rounded-b-[28px] shadow-sm flex flex-col items-center text-center gap-4">
        <span className="px-3 py-1 rounded-pill bg-white text-primary text-[11px] font-black border border-line">
          10문항 · 90초
        </span>
        <h1 className="text-[26px] font-black text-title leading-tight tracking-tight">
          내 피부는<br />무슨 아이스크림 맛?
        </h1>
        <p className="text-[12px] text-body opacity-85 font-semibold leading-relaxed">
          유분·수분·민감 3축으로 알아보는 내 피부 타입.<br />
          결과에서 타입 맞춤 <b>검증템 최저가</b>까지 바로 이어져요.
        </p>

        <div className="flex items-end justify-center gap-1.5 mt-2">
          {HERO_CHARACTERS.map((c) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={c.src} src={c.src} alt={c.alt} className={`w-auto object-contain ${c.cls}`} />
          ))}
        </div>

        <Link
          href="/skin-test/quiz"
          className="w-full max-w-[320px] mt-3 py-4 rounded-btn bg-primary text-white text-[15px] font-black shadow-[0_10px_24px_rgba(65,0,22,0.25)] active:scale-[0.98] transition-transform"
        >
          테스트 시작하기 🍦
        </Link>
      </section>

      <section className="px-4 py-6 flex flex-col gap-3">
        {[
          ['🍦', '8가지 아이스크림 캐릭터', '유분×수분×민감 조합으로 내 피부를 캐릭터 하나로 정리해줘요.'],
          ['🐷', '고민 토핑 펫', '트러블·모공·각질·홍조·탄력 — 요즘 최대 고민이 작은 펫으로 붙어요.'],
          ['🏷️', '결과 맞춤 검증템 최저가', '내 타입에 맞는 검증 제품의 오늘 최저가를 결과에서 바로 비교해요.'],
        ].map(([emoji, title, desc]) => (
          <div key={title} className="flex items-start gap-3 bg-surface border border-line rounded-card p-4 shadow-sm">
            <span className="text-[24px] leading-none" aria-hidden>{emoji}</span>
            <div className="flex flex-col gap-0.5">
              <h3 className="text-[13px] font-black text-title">{title}</h3>
              <p className="text-[12px] text-body opacity-85 font-semibold leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </section>

      <p className="px-4 pb-8 text-center text-[10px] text-sub font-semibold">
        재미로 보는 참고용 테스트로, 의학적 진단이 아니에요.
      </p>
    </AppShell>
  );
}
