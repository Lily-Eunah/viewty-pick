import React from 'react';

interface RecommendationReasonBoxProps {
  // Normalized product features (첫 항목 = 정체성 구문). Preferred source.
  features?: string[];
  // Fallback checklist when there are no features (badge details or boilerplate).
  reasons: string[];
  // Real curated badge details with their source — shown as the verified note.
  verifiedNotes?: { source: string; detail: string }[];
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

// Approx display width in half-em units: CJK counts 1, everything else (ascii,
// digits, spaces, ·) 0.5. A reason at or below the threshold fits half the card.
function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += /[　-鿿가-힣＀-￯]/.test(ch) ? 1 : 0.5;
  return w;
}
const SHORT_MAX = 8;

// Assign each reason a column span. Two consecutive SHORT reasons pair up (half +
// half = one full row); a long reason, or a short reason with no short neighbour,
// spans the full width — so a short item is never left orphaned beside a blank half.
function packSpans(items: string[]): ('full' | 'half')[] {
  const short = items.map((s) => displayWidth(s) <= SHORT_MAX);
  const spans: ('full' | 'half')[] = new Array(items.length).fill('full');
  for (let i = 0; i < items.length; ) {
    if (short[i] && i + 1 < items.length && short[i + 1]) {
      spans[i] = 'half'; spans[i + 1] = 'half'; i += 2;
    } else {
      spans[i] = 'full'; i += 1;
    }
  }
  return spans;
}

// Collapse 남성 인기 + 남성 추천 (near-duplicates to a reader) into one tag, order kept.
function mergeTags(tags: string[]): string[] {
  const has = (t: string) => tags.includes(t);
  if (has('남성 인기') && has('남성 추천')) {
    const out: string[] = [];
    let merged = false;
    for (const t of tags) {
      if (t === '남성 인기' || t === '남성 추천') {
        if (!merged) { out.push('남성 인기·추천'); merged = true; }
      } else out.push(t);
    }
    return out;
  }
  return tags;
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

// Award medal — distinguishes the "수상/랭킹 출처" note from the green reason checks.
const MedalIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-star shrink-0 mt-0.5">
    <path d="M12 2.25a5.25 5.25 0 1 0 0 10.5 5.25 5.25 0 0 0 0-10.5ZM8.4 13.98 6.6 21.3a.6.6 0 0 0 .87.68L12 19.6l4.53 2.38a.6.6 0 0 0 .87-.68l-1.8-7.32a6.72 6.72 0 0 1-7.2 0Z" />
  </svg>
);

function Checklist({ items }: { items: string[] }) {
  const spans = packSpans(items);
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-2">
      {items.map((item, idx) => (
        <li
          key={idx}
          className={`flex items-start gap-2 text-[13px] text-body font-semibold leading-relaxed ${spans[idx] === 'full' ? 'col-span-2' : ''}`}
        >
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
  const feats = features ?? [];
  const tags = mergeTags(feats.filter((f) => POPULARITY_TAGS.has(f)));
  const core = feats.filter((f) => !POPULARITY_TAGS.has(f));
  // Promote the first item to a lead line only when it reads as an identity phrase
  // (not a bare spec) and there is at least one more reason to list below it.
  const hasLead = core.length > 1 && !/^SPF/i.test(core[0]);
  const lead = hasLead ? core[0] : null;
  const checklist = feats.length > 0 ? (hasLead ? core.slice(1) : core) : reasons;
  const notes = (verifiedNotes ?? []).filter((n) => n && n.detail);
  const hasEvidence = tags.length > 0 || notes.length > 0;

  return (
    <div className="bg-surface rounded-card p-4.5 border border-line shadow-sm">
      {/* Title */}
      <h3 className="text-title font-black text-[15px] flex items-center gap-1.5 mb-2.5">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0 text-success">
          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm11.378-3.917c-.89-.777-2.366-.777-3.255 0a.75.75 0 0 1-.988-1.114c1.44-1.258 3.796-1.258 5.233 0a.75.75 0 0 1-.99 1.114ZM10.5 11.25a.75.75 0 0 1 .75-.75h.75a.75.75 0 0 1 .75.75v5.25a.75.75 0 0 1-.75.75h-.75a.75.75 0 0 1-.75-.75v-5.25Zm1.5 8.25a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
        </svg>
        <span>추천 이유</span>
      </h3>

      {/* Lead identity phrase — the only strong (pink) accent in the card */}
      {lead && (
        <p className="inline-block text-[13px] font-black text-primary bg-price-bg rounded-lg px-3 py-1.5 mb-2.5">
          {lead}
        </p>
      )}

      {/* Reason checklist */}
      <Checklist items={checklist} />

      {/* Evidence footer — popularity tags (ghost) + award note (medal), one row, wraps
          the award to its own line when the tags fill the width. */}
      {hasEvidence && (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 mt-3 pt-3 border-t border-divider">
          {tags.map((tag, idx) => (
            <span key={idx} className="whitespace-nowrap text-[11px] font-bold text-sub bg-transparent border border-line rounded-full px-2.5 py-1">
              {tag}
            </span>
          ))}
          {notes.map((note, idx) => (
            <span key={idx} className="whitespace-nowrap inline-flex items-center gap-1.5 text-[11px] text-[#6B5636] font-bold">
              <MedalIcon />
              <span>{note.source ? `${note.source} · ${note.detail}` : note.detail}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
