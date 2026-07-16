import React from 'react';

// Per-platform 공정위 disclosure. Only the sellers actually present on the page
// are shown — never a generic claim for a platform that isn't there.
const DISCLOSURES: Record<string, string> = {
  naver: '이 포스팅은 네이버 쇼핑 커넥트 활동의 일환으로, 판매 발생 시 수수료를 제공 받습니다.',
  coupang: '이 포스팅은 쿠팡 파트너스 활동의 일환으로 이에 따른 일정액의 수수료를 제공받습니다.',
  oliveyoung: '이 포스팅은 올리브영 쇼핑 큐레이터 활동의 일환으로, 구매 시 일정 금액의 수수료를 제공받습니다.',
};

export default function AffiliateDisclosure({ sellerSlugs }: { sellerSlugs: string[] }) {
  const shown = Array.from(new Set(sellerSlugs)).filter((s) => DISCLOSURES[s]);
  if (shown.length === 0) return null;
  return (
    <div className="bg-[#F0EEE2] border border-line rounded-lg px-3.5 py-2.5 flex flex-col gap-1.5">
      <span className="text-[10px] font-black text-sub tracking-wide">제휴 수수료 고지</span>
      {/* Reassurance: names the buyer's exact suspicion ("링크라서 비싼 것 아냐?") and
          negates it — the commission never changes what the buyer pays. */}
      <p className="flex items-start gap-1.5 text-[11.5px] leading-snug">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0 mt-px text-success">
          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.14-.082l4-5.6Z" clipRule="evenodd" />
        </svg>
        <span className="flex flex-col gap-0.5">
          <span className="font-black text-primary">제휴 링크라고 더 비싸지 않아요.</span>
          <span className="font-semibold text-text-secondary">수수료는 판매처가 부담하며, 구매 금액에는 차이가 없습니다.</span>
        </span>
      </p>
      <p className="text-[10px] text-sub font-semibold leading-snug">
        실제 결제가·프로모션 조건은 판매처에서 최종 확인하세요.
      </p>
      <div className="mt-0.5 pt-1.5 border-t border-line/70 flex flex-col gap-1">
        {shown.map((s) => (
          <p key={s} className="text-[10.5px] text-text-secondary font-semibold leading-snug">
            {DISCLOSURES[s]}
          </p>
        ))}
      </div>
    </div>
  );
}
