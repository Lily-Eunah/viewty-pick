import React from 'react';

/**
 * Coupang Partners disclosure (DESIGN §12). Required on any page that shows a
 * Coupang link or Coupang-sourced image (productImage). Rendered site-wide via
 * AppShell so the requirement is met wherever Coupang content can appear.
 */
export default function CoupangPartnersNotice() {
  return (
    <p className="px-4 py-3 text-center text-[10px] leading-relaxed text-[#A2A08E] font-semibold bg-[#F0EEE2] border-t border-line">
      이 페이지는 쿠팡 파트너스 활동의 일환으로, 이에 따라 일정액의 수수료를 제공받습니다.
    </p>
  );
}
