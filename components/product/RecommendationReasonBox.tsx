import React from 'react';

interface RecommendationReasonBoxProps {
  reasons: string[];
}

export default function RecommendationReasonBox({
  reasons,
}: RecommendationReasonBoxProps) {
  return (
    <div className="bg-primary-light rounded-card p-4.5 border border-[#DEEAD4]">
      {/* Title */}
      <h3 className="text-primary-dark font-black text-[15px] flex items-center gap-1.5 mb-2.5">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm11.378-3.917c-.89-.777-2.366-.777-3.255 0a.75.75 0 0 1-.988-1.114c1.44-1.258 3.796-1.258 5.233 0a.75.75 0 0 1-.99 1.114ZM10.5 11.25a.75.75 0 0 1 .75-.75h.75a.75.75 0 0 1 .75.75v5.25a.75.75 0 0 1-.75.75h-.75a.75.75 0 0 1-.75-.75v-5.25Zm1.5 8.25a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
        </svg>
        <span>왜 추천되었나요?</span>
      </h3>

      {/* Bullet Checklist */}
      <ul className="flex flex-col gap-2">
        {reasons.map((reason, idx) => (
          <li key={idx} className="flex items-start gap-2.5 text-[13px] text-body font-semibold leading-relaxed">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-primary shrink-0 mt-0.5">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.14-.082l4-5.6ZM18 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM7.5 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" clipRule="evenodd" />
            </svg>
            <span>{reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
