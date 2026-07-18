'use client';

import React, { useState } from 'react';

interface ShareButtonProps {
  title: string;
}

export default function ShareButton({ title }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 사용자가 공유 시트를 닫은 경우 등 — 조용히 무시.
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className="flex-1 py-3.5 rounded-btn border border-primary text-primary text-[13px] font-black bg-white active:scale-[0.98] transition-transform"
    >
      {copied ? '링크 복사됨! ✓' : '결과 공유하기'}
    </button>
  );
}
