import React from 'react';
import { loadMockDB } from '../../../lib/supabase/mockDb';

export default async function AdminStatusPage() {

  // Load status metrics from Mock Database
  const db = loadMockDB();
  const totalProducts = db.products.length;
  const activeProducts = db.products.filter(p => p.is_active).length;
  const totalListings = db.listings.length;
  const activeListings = db.listings.filter(l => l.is_active).length;
  const totalOverrides = db.manual_overrides.length;
  
  // Last snapshots stats
  const snaps = db.price_snapshots;
  const okSnaps = snaps.filter(s => s.status === 'ok').length;
  const warningSnaps = snaps.filter(s => s.status === 'warning').length;
  const successRate = snaps.length > 0 ? Math.round(((okSnaps + warningSnaps) / snaps.length) * 100) : 100;

  return (
    <div className="w-full min-h-screen bg-[#F8F6EE] px-4 py-8 font-sans flex flex-col items-center">
      <div className="w-full max-w-xl flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-white border border-[#E4E0D2] rounded-[20px] p-5 shadow-sm">
          <div className="flex flex-col">
            <h1 className="text-[18px] font-black text-primary-dark tracking-tight">
              ViewtyPick Admin Status
            </h1>
            <span className="text-[12px] text-sub font-semibold">
              시스템 가격 수집 파이프라인 관리 모니터
            </span>
          </div>
          <span className="text-xs bg-primary-light text-primary-dark font-extrabold px-3 py-1 rounded-full">
            Online (Mock DB)
          </span>
        </div>

        {/* 1. Core Metrics Summary Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-[#E4E0D2] rounded-[20px] p-4 shadow-sm flex flex-col">
            <span className="text-[11px] text-sub font-black">전체 상품 (활성)</span>
            <span className="text-[22px] font-black text-title mt-1">
              {totalProducts}개 <span className="text-sm font-semibold text-primary-dark">({activeProducts})</span>
            </span>
          </div>
          <div className="bg-white border border-[#E4E0D2] rounded-[20px] p-4 shadow-sm flex flex-col">
            <span className="text-[11px] text-sub font-black">수집 대상 링크 (활성)</span>
            <span className="text-[22px] font-black text-title mt-1">
              {totalListings}개 <span className="text-sm font-semibold text-primary-dark">({activeListings})</span>
            </span>
          </div>
          <div className="bg-white border border-[#E4E0D2] rounded-[20px] p-4 shadow-sm flex flex-col">
            <span className="text-[11px] text-sub font-black">크롤링 성공률</span>
            <span className="text-[22px] font-black text-price mt-1">
              {successRate}%
            </span>
          </div>
          <div className="bg-white border border-[#E4E0D2] rounded-[20px] p-4 shadow-sm flex flex-col">
            <span className="text-[11px] text-sub font-black">수동 가격 보정</span>
            <span className="text-[22px] font-black text-title mt-1">
              {totalOverrides}건
            </span>
          </div>
        </div>

        {/* 2. Manual Overrides Table */}
        <div className="bg-white border border-[#E4E0D2] rounded-[20px] p-4 shadow-sm flex flex-col gap-2.5">
          <h2 className="text-[14px] font-black text-title">수동 가격/프로모션 보정 목록 (manual_overrides)</h2>
          {db.manual_overrides.length === 0 ? (
            <div className="text-center py-4 text-[12px] text-sub">
              등록된 수동 보정 항목이 없습니다.
            </div>
          ) : (
            <div className="flex flex-col gap-2 divide-y divide-line">
              {db.manual_overrides.map((o) => {
                const prod = db.products.find(p => p.id === o.product_id);
                const seller = db.sellers.find(s => s.id === o.seller_id);
                return (
                  <div key={o.id} className="pt-2 flex justify-between items-start text-[12px] font-bold">
                    <div className="flex flex-col">
                      <span className="text-title">{prod?.name || '제품명 미정'}</span>
                      <span className="text-[11px] text-sub mt-0.5">{seller?.name} · {o.override_type} ({o.value})</span>
                    </div>
                    <span className="text-[11px] text-[#A2A08E]">{o.reason || '사유 없음'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Retailer Allowlist Stores */}
        <div className="bg-white border border-[#E4E0D2] rounded-[20px] p-4 shadow-sm flex flex-col gap-2.5">
          <h2 className="text-[14px] font-black text-title">신뢰 판매자 허용 스토어 (retailer_allowlist)</h2>
          {db.retailer_allowlist.length === 0 ? (
            <div className="text-center py-4 text-[12px] text-sub">
              등록된 허용 스토어가 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {db.retailer_allowlist.map((al) => {
                const seller = db.sellers.find(s => s.id === al.seller_id);
                return (
                  <div key={al.id} className="bg-bg p-2.5 rounded-lg text-[12px] font-bold flex flex-col">
                    <span className="text-title">{al.allowed_store_name}</span>
                    <span className="text-[10px] text-sub mt-1">{seller?.name} · {al.brand}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. Click Redirections Stats */}
        <div className="bg-white border border-[#E4E0D2] rounded-[20px] p-4 shadow-sm flex flex-col gap-2.5 mb-10">
          <h2 className="text-[14px] font-black text-title">최근 제휴클릭 로그 (affiliate_clicks)</h2>
          {db.affiliate_clicks.length === 0 ? (
            <div className="text-center py-4 text-[12px] text-sub">
              제휴 이동 이력이 없습니다.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {db.affiliate_clicks.slice(-5).reverse().map((click) => {
                const product = db.products.find(p => p.id === click.product_id);
                return (
                  <div key={click.id} className="text-[12px] font-bold flex justify-between items-start">
                    <div className="flex flex-col max-w-[340px]">
                      <span className="text-title truncate">{product?.name || '제품'}</span>
                      <span className="text-[10px] text-sub mt-0.5">{click.seller_code} · {click.page_path}</span>
                    </div>
                    <span className="text-[10px] text-sub shrink-0">
                      {new Date(click.clicked_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
export const dynamic = 'force-dynamic';
