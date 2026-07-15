import React from 'react';

interface RecommendationReasonBoxProps {
  // Normalized product features (첫 항목 = 정체성 구문). Preferred source.
  features?: string[];
  // Fallback checklist when there are no features (badge details or boilerplate).
  reasons: string[];
  // Real curated badge details (디렉터파이 등) — shown as the verified note.
  verifiedNotes?: string[];
}

// Popularity/segment tags rendered as pills, not checklist reasons. Fixed list —
// matches docs/features-normalization.md so a descriptive feature is never mistaken
// for a tag. (온가족 사용 is an audience reason, not a popularity tag — stays a bullet.)
const POPULARITY_TAGS = new Set([
  '올영 인기', '남성 인기', '남성 추천',
  '백화점 Top', '더마 브랜드 TOP', '온라인 브랜드 TOP',
]);

// A reason that says WHO it's for (피부타입/사용층) gets a person icon so the
// "나한테 맞나?" scan lands faster.
function isAudienceReason(s: string): boolean {
  return s.endsWith('추천') || s.includes('온가족');
}

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-success shrink-0 mt-0.5">
    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.14-.082l4-5.6ZM18 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM7.5 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" clipRule="evenodd" />
  </svg>
);

const PersonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-success shrink-0 mt-0.5">
    <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
  </svg>
);

function Checklist({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, idx) => (
        <li key={idx} className="flex items-start gap-2.5 text-[13px] text-body font-semibold leading-relaxed">
          {isAudienceReason(item) ? <PersonIcon /> : <CheckIcon />}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function RecommendationReasonBox({
  features,
  reasons,
  verifiedNotes,
}: RecommendationReasonBoxProps) {
  // Split features into: lead identity phrase, checklist reasons, popularity pills.
  const feats = features ?? [];
  const tags = feats.filter((f) => POPULARITY_TAGS.has(f));
  const core = feats.filter((f) => !POPULARITY_TAGS.has(f));
  // Promote the first item to a lead line only when it reads as an identity phrase
  // (not a bare spec) and there is at least one more reason to list below it.
  const hasLead = core.length > 1 && !/^SPF/i.test(core[0]);
  const lead = hasLead ? core[0] : null;
  const checklist = feats.length > 0 ? (hasLead ? core.slice(1) : core) : reasons;
  const notes = (verifiedNotes ?? []).filter(Boolean);

  return (
    <div className="bg-surface rounded-card p-4.5 border border-line shadow-sm">
      {/* Title */}
      <h3 className="text-title font-black text-[15px] flex items-center gap-1.5 mb-2.5">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0 text-success">
          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm11.378-3.917c-.89-.777-2.366-.777-3.255 0a.75.75 0 0 1-.988-1.114c1.44-1.258 3.796-1.258 5.233 0a.75.75 0 0 1-.99 1.114ZM10.5 11.25a.75.75 0 0 1 .75-.75h.75a.75.75 0 0 1 .75.75v5.25a.75.75 0 0 1-.75.75h-.75a.75.75 0 0 1-.75-.75v-5.25Zm1.5 8.25a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
        </svg>
        <span>추천 이유</span>
      </h3>

      {/* Lead identity phrase */}
      {lead && (
        <p className="inline-block text-[13px] font-black text-primary bg-price-bg rounded-lg px-3 py-1.5 mb-2.5">
          {lead}
        </p>
      )}

      {/* Reason checklist */}
      <Checklist items={checklist} />

      {/* Popularity / segment pills */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-divider">
          {tags.map((tag, idx) => (
            <span key={idx} className="text-[11px] font-extrabold text-discount bg-accent-soft rounded-full px-2.5 py-1">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Verified note from a curated badge (e.g. 디렉터파이) */}
      {notes.length > 0 && (
        <div className="flex flex-col gap-1 mt-3 pt-3 border-t border-divider">
          {notes.map((note, idx) => (
            <div key={idx} className="flex items-start gap-1.5 text-[11px] text-sub font-bold leading-relaxed">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-success shrink-0 mt-0.5">
                <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0 1 12 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 0 1 3.498 1.307 4.491 4.491 0 0 1 1.307 3.497A4.49 4.49 0 0 1 21.75 12a4.49 4.49 0 0 1-1.549 3.397 4.491 4.491 0 0 1-1.307 3.497 4.491 4.491 0 0 1-3.497 1.307A4.49 4.49 0 0 1 12 21.75a4.49 4.49 0 0 1-3.397-1.549 4.49 4.49 0 0 1-3.498-1.306 4.491 4.491 0 0 1-1.307-3.498A4.49 4.49 0 0 1 2.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 0 1 1.307-3.497 4.49 4.49 0 0 1 3.497-1.307Zm7.007 6.387a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
              </svg>
              <span>{note}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
