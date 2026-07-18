'use client';

import React, { useMemo, useSyncExternalStore } from 'react';
import { FLAGS_STORAGE_KEY } from './QuizClient';

interface Flags {
  careAdvised?: boolean;
  waterHint?: boolean;
  hintMatched?: boolean;
  recentSensitive?: boolean;
}

// sessionStorage는 마운트 이후 바뀌지 않으므로 구독은 no-op. 서버 스냅샷 null →
// 프리렌더/하이드레이션 시점엔 아무것도 그리지 않아 48경로 정적 생성과 안전하게 공존.
const subscribe = () => () => {};
const getSnapshot = () => {
  try {
    return sessionStorage.getItem(FLAGS_STORAGE_KEY);
  } catch {
    return null;
  }
};
const getServerSnapshot = () => null;

/**
 * 방금 테스트를 마친 본인에게만 보이는 개인화 멘트(sessionStorage 기반).
 * 결과 페이지는 정적 생성이라 응답 의존 문구는 클라이언트에서만 그린다 —
 * 공유 링크로 들어온 사람에게는 아무것도 표시되지 않는 것이 의도.
 */
export default function CareNotice() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const flags = useMemo<Flags | null>(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Flags;
    } catch {
      return null;
    }
  }, [raw]);

  if (!flags) return null;
  const notes: { emoji: string; text: string; strong?: boolean }[] = [];
  if (flags.careAdvised) {
    notes.push({
      emoji: '🏥',
      text: '화끈거림·따가움이 잦다고 답하셨어요. 증상이 반복된다면 제품보다 피부과 상담이 먼저예요.',
      strong: true,
    });
  }
  if (flags.recentSensitive) {
    notes.push({
      emoji: '⏳',
      text: '최근 생긴 예민함은 타입이 아니라 일시적 장벽 손상일 수 있어요. 2~4주 진정 케어 후 다시 테스트해보세요.',
    });
  }
  if (flags.waterHint) {
    notes.push({ emoji: '💧', text: '살짝 속건조 기미도 보였어요. 가벼운 수분 레이어링을 곁들이면 좋아요.' });
  }
  if (flags.hintMatched) {
    notes.push({ emoji: '🔎', text: '고른 고민, 앞 문항 응답 곳곳에서도 같은 신호가 보였어요. 제대로 짚으셨네요.' });
  }
  if (notes.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {notes.map((n) => (
        <div
          key={n.emoji}
          className={`flex items-start gap-2.5 rounded-card border p-3.5 text-[12px] font-semibold leading-relaxed ${
            n.strong ? 'border-warning bg-[#FBF3E4] text-[#7A5A24]' : 'border-line bg-surface text-body'
          }`}
        >
          <span className="text-[16px] leading-none mt-0.5" aria-hidden>{n.emoji}</span>
          <p>{n.text}</p>
        </div>
      ))}
    </div>
  );
}
