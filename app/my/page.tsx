'use client';

import React, { useState } from 'react';
import AppShell from '../../components/layout/AppShell';
import Header from '../../components/layout/Header';
import Badge from '../../components/common/Badge';

export default function MyPage() {
  const [email, setEmail] = useState('');
  const [consentService, setConsentService] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Clientside validations
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
      setErrorMsg('서비스 출시 및 기능 알림 수신 동의(필수)는 필수 사항입니다.');
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
          intent: 'launch',
          consent_service: true,
          consent_marketing: consentMarketing,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMsg(data.error || '신청 중 오류가 발생했습니다.');
      } else {
        setSuccessMsg(data.message || '신청 완료 — 출시되면 알려드릴게요.');
        // Clean email input but preserve consent values
        setEmail('');
      }
    } catch {
      setErrorMsg('네트워크 연결 상태를 확인 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell activeTab="my">
      <Header title="마이" showBack={false} />

      <div className="flex-grow bg-bg px-4 py-6 flex flex-col gap-6">
        {/* Hero Section */}
        <section className="bg-background-warm p-5 rounded-card border border-line shadow-[0_4px_12px_rgba(65,0,22,0.02)]">
          <Badge type="accent" className="w-fit">
            사전 신청 접수 중
          </Badge>
          <h2 className="text-[20px] font-black text-title leading-tight tracking-tight mt-2.5">
            마이 & 알림 기능 오픈 알림 신청
          </h2>
          <p className="text-[12px] text-body mt-2 leading-relaxed font-medium">
            내가 찜한 뷰티 아이템의 최저가 할인 알림, 개인 맞춤 스킨케어 추천 등 더 편리한 기능들을 준비하고 있습니다. 서비스가 공식 출시되면 알려드릴게요!
          </p>
        </section>

        {/* Waitlist Form Card */}
        <section className="bg-surface rounded-card border border-line p-5 shadow-sm">
          {successMsg ? (
            <div className="py-4 text-center flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center text-success mb-1">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="text-[16px] font-black text-title">사전 신청 완료!</h3>
              <p className="text-[12px] text-body font-semibold max-w-[280px] leading-relaxed">
                {successMsg}
              </p>
              <button
                onClick={() => setSuccessMsg(null)}
                className="mt-4 px-5 py-2.5 bg-accent-soft text-primary font-black text-[12px] rounded-btn border border-primary-light hover:bg-primary-soft transition-colors active:scale-95"
              >
                다른 이메일로 추가 신청
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="waitlist-email" className="text-[12px] font-bold text-title">
                  이메일 주소 <span className="text-error font-black">*</span>
                </label>
                <input
                  id="waitlist-email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="w-full h-11 px-3.5 bg-bg rounded-btn border border-line focus:outline-none focus:border-primary text-[13px] text-title font-semibold placeholder:text-[#A8A0A0] transition-colors disabled:opacity-60"
                />
              </div>

              {/* Checkboxes */}
              <div className="flex flex-col gap-3.5 mt-1 border-t border-divider pt-4">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={consentService}
                    onChange={(e) => setConsentService(e.target.checked)}
                    disabled={loading}
                    className="mt-0.5 w-4 h-4 rounded text-primary focus:ring-primary accent-primary"
                  />
                  <div className="text-[12px]">
                    <span className="font-extrabold text-title">[필수]</span>{' '}
                    <span className="font-bold text-body">서비스 출시 및 기능 알림 수신 동의</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={consentMarketing}
                    onChange={(e) => setConsentMarketing(e.target.checked)}
                    disabled={loading}
                    className="mt-0.5 w-4 h-4 rounded text-primary focus:ring-primary accent-primary"
                  />
                  <div className="text-[12px]">
                    <span className="font-extrabold text-[#6F6667]">[선택]</span>{' '}
                    <span className="font-bold text-[#6F6667]">마케팅 정보 수신 및 광고성 알림 동의</span>
                  </div>
                </label>
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="text-[11px] text-error font-extrabold flex items-center gap-1 mt-1 bg-error/5 p-2 rounded-lg border border-error/15">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                  </svg>
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Privacy Policy summary */}
              <div className="bg-bg rounded-btn border border-line p-3 text-[10px] text-sub font-semibold leading-relaxed flex flex-col gap-1">
                <span className="font-extrabold text-body">[개인정보 수집 및 이용 안내]</span>
                <p>• 수집 항목: 이메일 주소</p>
                <p>• 수집 및 이용 목적: 서비스 출시/새로운 기능 출시 정보 발송, 신규 제휴/할인 마케팅 안내(마케팅 수신동의 시)</p>
                <p>• 보유 및 이용 기간: <strong>목적 달성 시 또는 신청 철회 요청 시 즉시 파기</strong></p>
                <p>• 동의 철회 방법: 고객센터 메일(support@viewtypick.com)로 사전신청 철회 신청 시 즉각적인 정보 파기 처리를 해 드립니다.</p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-primary text-white font-black text-[13px] rounded-btn shadow-[0_4px_12px_rgba(65,0,22,0.1)] hover:bg-primary-hover active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>처리 중...</span>
                  </>
                ) : (
                  <span>사전 신청 완료하고 알림 받기</span>
                )}
              </button>
            </form>
          )}
        </section>
      </div>
    </AppShell>
  );
}
