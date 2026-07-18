'use client';

import React, { useState } from 'react';

/**
 * 문항 일러스트 드롭 존 — public/images/skin-test/questions/에 파일을 넣으면
 * 자동으로 표시되고, 없으면 파스텔 이모지 플레이스홀더로 폴백한다.
 * (파일명 규칙은 같은 폴더 README.md 참고)
 */
interface QuestionIllustrationProps {
  src: string;
  fallbackEmoji: string;
  alt?: string;
}

export default function QuestionIllustration({ src, fallbackEmoji, alt = '' }: QuestionIllustrationProps) {
  const [missing, setMissing] = useState(false);

  if (missing) {
    return (
      <div className="w-24 h-24 mx-auto rounded-full bg-accent-light border border-line flex items-center justify-center">
        <span className="text-[44px] leading-none" aria-hidden>
          {fallbackEmoji}
        </span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="w-28 h-28 mx-auto object-contain"
      onError={() => setMissing(true)}
    />
  );
}
