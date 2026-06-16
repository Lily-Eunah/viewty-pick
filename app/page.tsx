import React from 'react';
import AppShell from '../components/layout/AppShell';
import Header from '../components/layout/Header';
import HomeInteractiveSection from '../components/home/HomeInteractiveSection';
import { getHomePageData } from '../lib/queries';

export default async function Home() {
  const { allProducts, recommended, officialPicks } = await getHomePageData();

  return (
    <AppShell activeTab="home">
      <Header />

      <HomeInteractiveSection
        allProducts={allProducts}
        recommended={recommended}
        officialPicks={officialPicks}
      />

      {/* Bottom Legal disclaimer (DESIGN.md §12.3) */}
      <footer className="px-4 py-8 bg-[#F0EEE2] text-center flex flex-col gap-1.5 border-t border-line text-[11px] text-[#A2A08E] font-bold">
        <p>ViewtyPick은 판매처가 아니며, 제휴 수수료를 제공받을 수 있습니다.</p>
        <p>구매 전 최종 결제 가격과 프로모션 조건은 판매처에서 확인 바랍니다.</p>
        <p className="mt-3 text-[10px]">© 2026 ViewtyPick. All rights reserved.</p>
      </footer>
    </AppShell>
  );
}
