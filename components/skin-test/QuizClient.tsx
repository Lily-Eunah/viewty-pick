'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import IceCreamProgress from './IceCreamProgress';
import QuestionIllustration from './QuestionIllustration';
import { BONUS_QUESTION, BonusAnswer, QUESTIONS, QuizQuestion } from '../../lib/skin-test/quizData';
import { computeResult, resultPath, SENSITIVE_THRESHOLD } from '../../lib/skin-test/scoring';

/** 결과 페이지의 CareNotice가 읽는 개인화 플래그(sessionStorage) 키. */
export const FLAGS_STORAGE_KEY = 'vp-skin-test-flags';

const PART_LABEL: Record<QuizQuestion['part'], string> = {
  oil: 'PART 1 · 유분 밸런스',
  water: 'PART 2 · 속수분',
  sensitive: 'PART 3 · 민감 반응',
  topping: '마지막 · 고민 픽',
};

const ADVANCE_DELAY_MS = 260;

export default function QuizClient() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<'main' | 'bonus'>('main');
  const [picks, setPicks] = useState<(number | null)[]>(Array(QUESTIONS.length).fill(null));
  const [locked, setLocked] = useState(false);

  const sensitiveScore = (answers: (number | null)[]) =>
    QUESTIONS.reduce((sum, q, i) => {
      const pick = answers[i];
      if (q.part !== 'sensitive' || pick === null) return sum;
      return sum + (q.options[pick].effect.sensitive ?? 0);
    }, 0);

  const finish = (answers: number[], bonus: BonusAnswer | null) => {
    const result = computeResult(answers, bonus);
    try {
      sessionStorage.setItem(
        FLAGS_STORAGE_KEY,
        JSON.stringify({
          careAdvised: result.careAdvised,
          waterHint: result.waterHint,
          hintMatched: result.hintMatched,
          recentSensitive: result.recentSensitive,
        }),
      );
    } catch {
      // 시크릿 모드 등 storage 불가 — 개인화 멘트만 빠지고 결과는 정상.
    }
    router.push(resultPath(result.base, result.topping));
  };

  const selectMain = (idx: number) => {
    if (locked) return;
    const next = [...picks];
    next[step] = idx;
    setPicks(next);
    setLocked(true);
    setTimeout(() => {
      setLocked(false);
      if (step < QUESTIONS.length - 1) {
        setStep(step + 1);
        return;
      }
      // 10문항 완료 — 민감 ON일 때만 보너스 문항, 아니면 바로 결과.
      if (sensitiveScore(next) >= SENSITIVE_THRESHOLD) setPhase('bonus');
      else finish(next as number[], null);
    }, ADVANCE_DELAY_MS);
  };

  const selectBonus = (value: BonusAnswer) => {
    if (locked) return;
    setLocked(true);
    finish(picks as number[], value);
  };

  if (phase === 'bonus') {
    return (
      <div className="flex flex-col flex-grow">
        <div className="px-4 pt-4">
          <IceCreamProgress step={QUESTIONS.length} total={QUESTIONS.length + 1} emoji="🍓" />
        </div>
        <section key="bonus" className="animate-rise px-4 py-6 flex flex-col gap-5">
          <span className="w-fit px-2.5 py-1 rounded-pill bg-accent-soft text-primary text-[11px] font-black">
            보너스 · 예민함의 역사
          </span>
          <h2 className="text-[19px] font-black text-title leading-snug whitespace-pre-line">
            {BONUS_QUESTION.title}
          </h2>
          <QuestionIllustration src={BONUS_QUESTION.illustration} fallbackEmoji={BONUS_QUESTION.fallbackEmoji} />
          <div className="flex flex-col gap-2.5">
            {BONUS_QUESTION.options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={locked}
                onClick={() => selectBonus(opt.value)}
                className="w-full text-left rounded-card border border-line bg-surface px-4 py-4 text-[13px] font-bold text-body leading-snug shadow-sm active:scale-[0.98] transition-all"
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPhase('main')}
            className="self-start text-[12px] font-bold text-sub underline underline-offset-2"
          >
            ← 이전 문항으로
          </button>
        </section>
      </div>
    );
  }

  const q = QUESTIONS[step];
  const isTopping = q.part === 'topping';

  return (
    <div className="flex flex-col flex-grow">
      <div className="px-4 pt-4">
        <IceCreamProgress step={step} total={QUESTIONS.length} emoji={isTopping ? '🍒' : undefined} />
      </div>

      <section key={q.id} className="animate-rise px-4 py-6 flex flex-col gap-5">
        <span className="w-fit px-2.5 py-1 rounded-pill bg-accent-soft text-primary text-[11px] font-black">
          {PART_LABEL[q.part]}
        </span>
        <h2 className="text-[19px] font-black text-title leading-snug whitespace-pre-line">{q.title}</h2>

        <QuestionIllustration src={q.illustration} fallbackEmoji={q.fallbackEmoji} />

        <div className="flex flex-col gap-2.5">
          {q.options.map((opt, idx) => {
            const selected = picks[step] === idx;
            return (
              <button
                key={idx}
                type="button"
                disabled={locked}
                onClick={() => selectMain(idx)}
                className={`w-full text-left rounded-card border px-4 py-3.5 text-[13px] font-bold leading-snug shadow-sm active:scale-[0.98] transition-all ${
                  selected
                    ? 'border-primary bg-primary-light text-primary'
                    : 'border-line bg-surface text-body'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {step > 0 && (
          <button
            type="button"
            onClick={() => !locked && setStep(step - 1)}
            className="self-start text-[12px] font-bold text-sub underline underline-offset-2"
          >
            ← 이전 문항으로
          </button>
        )}

        <p className="text-[10px] text-sub font-semibold text-center mt-2">
          최근 한 달의 내 피부를 떠올리며 답해주세요
        </p>
      </section>
    </div>
  );
}
