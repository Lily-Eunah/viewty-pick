import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import AppShell from '../../components/layout/AppShell';
import Header from '../../components/layout/Header';

export const metadata: Metadata = {
  title: '90초 피부타입 테스트 | 내 피부에 맞는 화장품 찾기 | 뷰티픽',
  description:
    '유분·수분·민감도를 바탕으로 지금의 피부타입과 추가 고민을 확인해보세요. 10문항, 약 90초면 케어 방향과 타입 맞춤 검증템까지 알려드려요.',
  openGraph: {
    title: '화장품 실패를 줄이는 90초 피부타입 테스트',
    description: '기억 속 피부가 아닌, 오늘의 피부 상태를 확인해보세요.',
    images: ['/images/skin-test/v2/base-normal.png'],
  },
};

export default function SkinTestLandingPage() {
  return (
    <AppShell activeTab="home">
      <Header showBack title="내 피부타입 찾기" />

      <section className="bg-background-warm px-4 pt-7 pb-9 border-b border-line rounded-b-[28px] shadow-sm flex flex-col items-center text-center gap-3">
        <span className="px-3 py-1 rounded-pill bg-white text-primary text-[11px] font-black border border-line">
          회원가입 없이 무료 · 10문항 · 약 90초
        </span>
        <h1 className="text-[26px] font-black text-title leading-tight tracking-tight">
          내 피부타입을 모르고<br />화장품을 고르고 계셨나요?
        </h1>
        <p className="text-[12px] text-body opacity-90 font-semibold leading-relaxed">
          &lsquo;나는 원래 지성이야&rsquo;라고 몇 년째 같은 타입으로 알고 있진 않나요?<br />
          반도 못 쓴 화장품이 쌓여간다면, 지금 피부부터 다시 확인해보세요.
        </p>

        <div className="w-full max-w-[310px] h-[166px] mt-1 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/skin-test/v2/landing-hero-group.png"
            alt="피부요정 주위로 투게더, 요맘때, 빵또아, 월드콘 친구들이 다정하게 모여 있는 모습"
            className="w-full h-full object-contain"
          />
        </div>

        <p className="text-[11px] text-primary font-black tracking-tight">
          기본 피부타입 + 지금의 피부 고민 + 케어 방향
        </p>

        <Link
          href="/skin-test/quiz"
          className="w-full max-w-[320px] py-4 rounded-btn bg-primary text-white text-[15px] font-black shadow-[0_10px_24px_rgba(65,0,22,0.25)] active:scale-[0.98] transition-transform"
        >
          90초 만에 내 피부타입 찾기
        </Link>
        <p className="-mt-1 text-[10px] text-sub font-bold">
          기억 속 피부가 아닌, 오늘의 피부를 기준으로 답해주세요.
        </p>
      </section>

      <section className="px-4 py-6 flex flex-col gap-3">
        {[
          ['🪞', '내 피부타입, 언제 확인했나요?', '한번 정한 타입은 계속 그대로 믿기 쉽지만, 유분·수분·민감도와 필요한 케어는 계절과 컨디션에 따라 달라질 수 있어요.'],
          ['💧', '유분·수분·민감도를 함께 확인해요', '겉으로 보이는 번들거림만으로는 수분부족 지성이나 복합성을 구분하기 어려워요.'],
          ['🎁', '90초 뒤 알 수 있어요', '8가지 기본 피부타입과 지금의 추가 고민, 내 피부에 맞는 관리 방향과 검증템을 알려드려요.'],
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
