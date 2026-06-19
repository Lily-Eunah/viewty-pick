'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AppShell from '../layout/AppShell';
import Header from '../layout/Header';
import ProductListCard from './ProductListCard';
import Badge from '../common/Badge';
import { useFavorites } from '../../lib/favorites';
import { UIProduct } from '../../lib/types';

interface WishlistClientProps {
  products: UIProduct[];
}

export default function WishlistClient({ products }: WishlistClientProps) {
  const { favorites, isMounted } = useFavorites();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [consentService, setConsentService] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter products by favorite status and keep the exact favorite order (recently added first)
  const favoritedProducts = React.useMemo(() => {
    if (!isMounted) return [];
    return favorites
      .map((slug) => products.find((p) => p.slug === slug))
      .filter((p): p is UIProduct => !!p);
  }, [favorites, products, isMounted]);

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg('이메일을 입력해주세요.');
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      setErrorMsg('올바른 이메일 형식이 아닙니다.');
      return;
    }

    if (!consentService) {
      setErrorMsg('할인 알림 수신 동의(필수)는 필수 사항입니다.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          intent: 'price_alert',
          wishlist_slugs: favorites,
          consent_service: true,
          consent_marketing: consentMarketing,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMsg(data.error || '신청 중 오류가 발생했습니다.');
      } else {
        setSuccessMsg(data.message || '신청 완료 — 가격 할인 알림이 신청되었습니다.');
        setEmail('');
      }
    } catch {
      setErrorMsg('네트워크 연결 상태를 확인 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell activeTab="wishlist">
      <Header showBack title="관심상품" rightAction={<div className="w-5" />} />

      {isMounted && favoritedProducts.length > 0 ? (
        <>
          {/* SEO Curation Banner */}
          <section className="bg-background-warm px-4 py-8 border-b border-line rounded-b-[28px] shadow-sm">
            <div className="flex flex-col gap-1.5">
              <Badge type="accent" className="w-fit">
                관심상품
              </Badge>
              <h2 className="text-[22px] font-black text-title leading-tight tracking-tight mt-1">
                내가 찜한 뷰티픽<br />
                실시간 최저가 비교
              </h2>
              <p className="text-[12px] text-body opacity-85 mt-2 font-semibold leading-relaxed">
                광고 없는 성분 검증 추천 픽! 찜해둔 제품들의 판매처별 실시간 최저가를 모아봅니다. 매일 아침 가격비교 자동 갱신.
              </p>
            </div>
          </section>

          {/* Price Alert CTA */}
          <section className="px-4 pt-5 pb-1">
            <div className="bg-primary-soft border border-accent/20 rounded-card p-4 flex flex-col gap-3 shadow-[0_4px_12px_rgba(65,0,22,0.02)]">
              <div className="flex items-start gap-3">
                <div className="text-primary mt-0.5 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5.5 h-5.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a9.04 9.04 0 0 1-5.137 0M15 10.25a3 3 0 1 1-6 0M18 10.25a9 9 0 1 1-18 0M3.75 20.25h16.5" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-[13px] font-black text-primary leading-tight">찜한 상품 할인 알림 신청</h4>
                  <p className="text-[11px] text-body mt-1 leading-relaxed font-medium">
                    관심상품들의 최저가 하락이나 특별 혜택 소식을 가장 먼저 받아보실 수 있습니다.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full h-10 bg-primary text-white text-[12px] font-black rounded-btn hover:bg-primary-hover active:scale-[0.98] transition-all shadow-[0_2px_8px_rgba(65,0,22,0.08)] cursor-pointer"
              >
                가격 할인 알림 받기
              </button>
            </div>
          </section>

          {/* Product List */}
          <section className="px-4 py-5 bg-bg flex flex-col gap-3.5 pb-24">
            <h3 className="text-[15px] font-black text-title tracking-tight">
              찜한 상품 ({favoritedProducts.length}개)
            </h3>

            <div className="flex flex-col gap-3">
              {favoritedProducts.map((prod) => (
                <ProductListCard key={prod.id} product={prod} />
              ))}
            </div>
          </section>
        </>
      ) : (
        /* Empty State (shown after mount if empty, or during SSR/mount loading to avoid layout shifts) */
        <div className="flex-grow flex flex-col items-center justify-center py-24 px-4 text-center bg-bg min-h-[50vh]">
          <div className="w-16 h-16 rounded-full bg-accent-soft flex items-center justify-center text-[#DE4B6C] mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-8 h-8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
              />
            </svg>
          </div>
          <h3 className="text-[16px] font-black text-title">관심상품이 없어요</h3>
          <p className="text-[12px] text-sub font-semibold mt-1.5 max-w-[240px] leading-relaxed">
            마음에 드는 제품의 하트 단추를 눌러 관심상품으로 추가해 보세요!
          </p>
          <Link
            href="/"
            className="mt-6 px-6 py-3 bg-primary text-white font-black text-[12px] rounded-btn shadow-[0_4px_12px_rgba(65,0,22,0.15)] hover:bg-primary-hover active:scale-95 transition-all duration-200"
          >
            제품 둘러보러 가기
          </Link>
        </div>
      )}

      {/* Modal Dialog overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-card-lg border border-line w-full max-w-[380px] p-5 shadow-2xl flex flex-col gap-4 relative animate-scale-up">
            {/* Close button */}
            <button
              onClick={() => {
                setIsModalOpen(false);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="absolute top-4 right-4 p-1.5 text-[#A8A0A0] hover:text-[#29272A] hover:bg-bg rounded-full transition-colors cursor-pointer"
              aria-label="닫기"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex flex-col gap-1 pr-6">
              <Badge type="accent" className="w-fit">
                알림 사전 예약
              </Badge>
              <h3 className="text-[16px] font-black text-title leading-tight mt-1">
                가격 할인 알림 받기
              </h3>
              <p className="text-[11px] text-body leading-relaxed font-semibold">
                현재 찜한 상품 <strong className="text-primary font-black">{favoritedProducts.length}개</strong>에 대한 맞춤 할인 알림이 신청됩니다.
              </p>
            </div>

            {successMsg ? (
              <div className="py-4 text-center flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center text-success mb-1">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </div>
                <h4 className="text-[14px] font-black text-title">알림 신청 완료!</h4>
                <p className="text-[11px] text-body font-semibold max-w-[240px] leading-relaxed">
                  {successMsg}
                </p>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setSuccessMsg(null);
                  }}
                  className="mt-3 px-5 py-2 bg-primary text-white font-black text-[12px] rounded-btn hover:bg-primary-hover active:scale-95 transition-colors cursor-pointer"
                >
                  닫기
                </button>
              </div>
            ) : (
              <form onSubmit={handleModalSubmit} className="flex flex-col gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="modal-email" className="text-[11px] font-bold text-title">
                    이메일 주소 <span className="text-error font-black">*</span>
                  </label>
                  <input
                    id="modal-email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="w-full h-10 px-3 bg-bg rounded-btn border border-line focus:outline-none focus:border-primary text-[12px] text-title font-semibold placeholder:text-[#A8A0A0] transition-colors disabled:opacity-60"
                  />
                </div>

                {/* Consent checkboxes */}
                <div className="flex flex-col gap-2.5 border-t border-divider pt-3">
                  <label className="flex items-start gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={consentService}
                      onChange={(e) => setConsentService(e.target.checked)}
                      disabled={loading}
                      className="mt-0.5 w-3.5 h-3.5 rounded text-primary focus:ring-primary accent-primary"
                    />
                    <div className="text-[11px]">
                      <span className="font-extrabold text-title">[필수]</span>{' '}
                      <span className="font-bold text-body">할인 알림 수신 동의</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={consentMarketing}
                      onChange={(e) => setConsentMarketing(e.target.checked)}
                      disabled={loading}
                      className="mt-0.5 w-3.5 h-3.5 rounded text-primary focus:ring-primary accent-primary"
                    />
                    <div className="text-[11px]">
                      <span className="font-extrabold text-[#6F6667]">[선택]</span>{' '}
                      <span className="font-bold text-[#6F6667]">마케팅 정보 및 추천 알림 동의</span>
                    </div>
                  </label>
                </div>

                {/* Error message */}
                {errorMsg && (
                  <div className="text-[10px] text-error font-extrabold flex items-center gap-1 bg-error/5 p-2 rounded-lg border border-error/15">
                    <span>⚠️ {errorMsg}</span>
                  </div>
                )}

                {/* Privacy summary */}
                <div className="bg-bg rounded-btn border border-line p-2.5 text-[9px] text-sub font-semibold leading-relaxed flex flex-col gap-0.5">
                  <span className="font-extrabold text-body">[개인정보 수집 및 동의]</span>
                  <p>• 항목/목적: 이메일 주소 / 찜한 제품의 가격 할인 알림 및 서비스 홍보</p>
                  <p>• 보유 기간: 신청 철회 또는 목적 달성 시 즉시 파기</p>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-primary text-white font-black text-[12.5px] rounded-btn shadow-[0_2px_8px_rgba(65,0,22,0.1)] hover:bg-primary-hover active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? '신청 중...' : '알림 신청 완료하기'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

