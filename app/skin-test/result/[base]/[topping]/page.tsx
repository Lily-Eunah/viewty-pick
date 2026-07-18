import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import AppShell from '../../../../../components/layout/AppShell';
import Header from '../../../../../components/layout/Header';
import ProductListCard from '../../../../../components/product/ProductListCard';
import CareNotice from '../../../../../components/skin-test/CareNotice';
import ShareButton from '../../../../../components/skin-test/ShareButton';
import { getProducts } from '../../../../../lib/queries';
import { BaseKey, ToppingKey } from '../../../../../lib/skin-test/quizData';
import { BASE_KEYS, BASE_RESULTS, TOPPING_RESULTS, TOPPING_SLUGS } from '../../../../../lib/skin-test/results';

// 8베이스 × 6토핑 = 48경로 전부 빌드 타임 프리렌더. gSP 없이 revalidate만 걸면
// 매 요청 SSR로 Workers free-plan 10ms CPU를 넘길 수 있다(1102 재발 방지).
export async function generateStaticParams() {
  return BASE_KEYS.flatMap((base) => TOPPING_SLUGS.map((topping) => ({ base, topping })));
}
export const dynamicParams = false;

// ISR: 제품 칩 가격은 전역 일1회 캐시(getProducts)를 따라 하루 주기로 갱신.
export const revalidate = 86400;

interface PageProps {
  params: Promise<{ base: string; topping: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { base } = await params;
  const meta = BASE_RESULTS[base as BaseKey];
  if (!meta) return {};
  return {
    title: `나는 ${meta.flavor}! ${meta.typeName} 피부 | 뷰티픽`,
    description: `${meta.tagline} — 뷰티픽 피부 아이스크림 테스트 결과와 ${meta.skinName ?? '내'} 피부 맞춤 검증템 최저가.`,
    robots: { index: false, follow: true },
    openGraph: {
      title: `나는 ${meta.flavor}! (${meta.typeName})`,
      description: meta.tagline,
      images: [meta.asset],
    },
  };
}

export default async function SkinTestResultPage({ params }: PageProps) {
  const { base, topping } = await params;
  const baseMeta = BASE_RESULTS[base as BaseKey];
  if (!baseMeta) notFound();
  const toppingMeta = topping !== 'none' ? TOPPING_RESULTS[topping as ToppingKey] : null;
  if (topping !== 'none' && !toppingMeta) notFound();

  const products = (
    await getProducts({ skinType: baseMeta.skinName ?? undefined, sortBy: 'recommend' })
  ).slice(0, 3);

  return (
    <AppShell activeTab="home">
      <Header showBack title="피부 아이스크림 테스트" />

      {/* 결과 히어로 */}
      <section className="bg-background-warm px-4 pt-7 pb-8 border-b border-line rounded-b-[28px] shadow-sm flex flex-col items-center text-center gap-2">
        <span className="px-3 py-1 rounded-pill bg-white text-primary text-[11px] font-black border border-line">
          {baseMeta.typeName}
        </span>
        <h1 className="text-[26px] font-black text-title leading-tight tracking-tight">
          나는 {baseMeta.flavor}!
        </h1>
        <p className="text-[12px] text-body opacity-85 font-bold">{baseMeta.tagline}</p>

        <div className="relative mt-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={baseMeta.asset} alt={`${baseMeta.flavor} 캐릭터`} className="h-44 w-auto object-contain drop-shadow-[0_12px_20px_rgba(65,0,22,0.15)]" />
          {toppingMeta && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={toppingMeta.asset}
              alt={`${toppingMeta.petName} 펫`}
              className="absolute -right-12 bottom-0 h-20 w-auto object-contain rotate-6 drop-shadow-[0_6px_10px_rgba(65,0,22,0.15)]"
            />
          )}
        </div>
        {toppingMeta && (
          <p className="text-[11px] text-primary font-black mt-1">+ 고민 토핑 · {toppingMeta.petName}</p>
        )}
      </section>

      <div className="px-4 py-5 flex flex-col gap-4">
        {/* 타입 해설 */}
        <div className="bg-surface border border-line rounded-card p-4 shadow-sm flex flex-col gap-1.5">
          <h2 className="text-[13px] font-black text-title">나는 이런 피부</h2>
          <p className="text-[12px] text-body opacity-90 font-semibold leading-relaxed">{baseMeta.desc}</p>
        </div>

        {/* 방금 응답 기반 개인화 멘트(본인에게만 표시) */}
        <CareNotice />

        {/* 케어 우선순위 — 실제 우선순서라 번호를 쓴다 */}
        <div className="bg-surface border border-line rounded-card p-4 shadow-sm flex flex-col gap-2.5">
          <h2 className="text-[13px] font-black text-title">케어 우선순위 TOP {baseMeta.care.length}</h2>
          <ol className="flex flex-col gap-2">
            {baseMeta.care.map((tip, i) => (
              <li key={tip} className="flex items-start gap-2.5">
                <span className="shrink-0 w-5 h-5 rounded-md bg-accent-soft text-primary text-[11px] font-black flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="text-[12px] text-body opacity-90 font-semibold leading-relaxed">{tip}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* 고민 토핑 펫 카드 */}
        {toppingMeta && (
          <div className="bg-surface border border-line rounded-card p-4 shadow-sm flex items-start gap-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={toppingMeta.asset} alt="" className="h-16 w-16 object-contain shrink-0" />
            <div className="flex flex-col gap-1">
              <h2 className="text-[13px] font-black text-title">
                {toppingMeta.petName} <span className="text-sub font-bold">· {toppingMeta.concern}</span>
              </h2>
              <p className="text-[12px] text-body opacity-90 font-semibold leading-relaxed">{toppingMeta.copy}</p>
            </div>
          </div>
        )}

        {/* 타입 맞춤 검증템 — 뷰티픽만 줄 수 있는 결과 */}
        <div className="flex flex-col gap-3 mt-1">
          <h2 className="text-[15px] font-black text-title tracking-tight">
            {baseMeta.skinName ? `${baseMeta.skinName} 피부 검증템 최저가 TOP 3` : '지금 인기 검증템 최저가 TOP 3'}
          </h2>
          {products.map((prod, idx) => (
            <ProductListCard key={prod.id} product={prod} rank={idx + 1} />
          ))}
          {products.length === 0 && (
            <div className="w-full text-center py-10 text-sub font-bold border border-dashed border-line rounded-card bg-white">
              추천 제품을 준비하고 있어요.
            </div>
          )}
        </div>

        {/* CTA */}
        <Link
          href={baseMeta.skinSlug ? `/skin/${baseMeta.skinSlug}/sunscreen` : '/best'}
          className="w-full py-4 rounded-btn bg-primary text-white text-[14px] font-black text-center shadow-[0_10px_24px_rgba(65,0,22,0.25)] active:scale-[0.98] transition-transform"
        >
          {baseMeta.skinName ? `${baseMeta.skinName} 피부 검증템 전체 보기` : '전체 인기 검증템 보기'}
        </Link>
        <div className="flex gap-2.5">
          <Link
            href="/skin-test/quiz"
            className="flex-1 py-3.5 rounded-btn border border-line text-body text-[13px] font-black bg-white text-center active:scale-[0.98] transition-transform"
          >
            다시 하기
          </Link>
          <ShareButton title={`나는 ${baseMeta.flavor}! (${baseMeta.typeName})`} />
        </div>

        <p className="text-center text-[10px] text-sub font-semibold pb-4">
          재미로 보는 참고용 테스트로, 의학적 진단이 아니에요.
        </p>
      </div>
    </AppShell>
  );
}
