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
    <div className="bg-[#F0EEE2] border border-line rounded-lg px-3.5 py-2.5 flex flex-col gap-1">
      <span className="text-[10px] font-black text-sub tracking-wide">제휴 수수료 고지</span>
      {shown.map((s) => (
        <p key={s} className="text-[10.5px] text-text-secondary font-semibold leading-snug">
          {DISCLOSURES[s]}
        </p>
      ))}
    </div>
  );
}
