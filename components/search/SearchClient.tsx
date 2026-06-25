'use client';

import React, { useState, useMemo, useRef, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ProductListCard from '../product/ProductListCard';
import ProductImage from '../common/ProductImage';
import PriceText from '../common/PriceText';
import {
  SearchableProduct,
  searchProducts,
  suggestKeywords,
  suggestProducts,
  popularKeywords,
  addRecentSearch,
  removeRecentSearch,
  parseRecentSearches,
  RECENT_SEARCHES_KEY,
} from '../../lib/search';

interface Props {
  items: SearchableProduct[];
  initialQuery?: string;
}

// ── Recent searches as an external store (localStorage) ──────────────────────
// Read via useSyncExternalStore so the first client render matches the server
// (empty), then syncs after hydration — no hydration warning, no setState-in-effect.
const RECENT_EVENT = 'viewtypick:recent-searches-changed';
const EMPTY_RECENT: string[] = [];
let cachedRaw: string | null = null;
let cachedList: string[] = EMPTY_RECENT;

function getRecentSnapshot(): string[] {
  if (typeof window === 'undefined') return EMPTY_RECENT;
  const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
  // Return a stable reference while the raw blob is unchanged (useSyncExternalStore
  // compares with Object.is and loops forever on a fresh array each call).
  if (raw === cachedRaw) return cachedList;
  cachedRaw = raw;
  cachedList = parseRecentSearches(raw);
  return cachedList;
}
function getServerRecent(): string[] {
  return EMPTY_RECENT;
}
function subscribeRecent(onChange: () => void): () => void {
  window.addEventListener(RECENT_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(RECENT_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}
function writeRecent(next: string[]): void {
  try {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable → no-op */
  }
  window.dispatchEvent(new Event(RECENT_EVENT));
}

export default function SearchClient({ items, initialQuery = '' }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  const recent = useSyncExternalStore(subscribeRecent, getRecentSnapshot, getServerRecent);

  // Save a term into recent searches (called on search execution).
  const commit = (term: string) => {
    const t = term.trim();
    if (!t) return;
    writeRecent(addRecentSearch(recent, t));
    // Keep the URL shareable (?q=) without a full navigation.
    router.replace(`/search?q=${encodeURIComponent(t)}`, { scroll: false });
  };

  const applyKeyword = (keyword: string) => {
    setQuery(keyword);
    commit(keyword);
    inputRef.current?.focus();
  };

  const trimmed = query.trim();
  const hasQuery = trimmed.length > 0;

  const results = useMemo(() => searchProducts(items, query), [items, query]);
  const keywordSuggestions = useMemo(() => suggestKeywords(items, query), [items, query]);
  const productSuggestions = useMemo(() => suggestProducts(items, query), [items, query]);
  const popular = useMemo(() => popularKeywords(items), [items]);

  return (
    <>
      {/* Search input — editable, drives the live filter */}
      <section className="px-4 py-2.5 bg-bg sticky top-0 z-30 border-b border-line">
        <div className="flex items-center w-full h-[50px] bg-surface border border-line rounded-btn px-4 gap-3 transition-all duration-200 focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgba(202,155,170,0.25)]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.2}
            stroke="currentColor"
            className="w-5 h-5 text-[#6F6667] shrink-0"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (e.nativeEvent.isComposing) return;
                commit(query);
                inputRef.current?.blur();
              }
            }}
            placeholder="제품명, 브랜드, 카테고리 검색"
            className="flex-grow bg-transparent text-title placeholder-sub font-semibold text-[14px] outline-none border-none"
            aria-label="검색"
          />
          {hasQuery && (
            <button
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="shrink-0 text-[#A8A0A0] hover:text-primary active:scale-90 transition"
              aria-label="검색어 지우기"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M10 8.586 5.707 4.293 4.293 5.707 8.586 10l-4.293 4.293 1.414 1.414L10 11.414l4.293 4.293 1.414-1.414L11.414 10l4.293-4.293-1.414-1.414L10 8.586Z" />
              </svg>
            </button>
          )}
        </div>
      </section>

      {/* ── Query state: suggestions + results ───────────────────────── */}
      {hasQuery ? (
        <>
          {/* Autocomplete keyword chips (brand · category) */}
          {keywordSuggestions.length > 0 && (
            <section className="px-4 pt-3 pb-1 bg-bg">
              <div className="flex flex-wrap gap-2">
                {keywordSuggestions.map((s) => (
                  <button
                    key={`${s.kind}:${s.keyword}`}
                    onClick={() => applyKeyword(s.keyword)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-pill border border-line bg-surface text-[12.5px] font-bold text-body hover:bg-accent-soft hover:text-primary hover:border-accent active:scale-95 transition"
                  >
                    <span className="text-[10px] text-sub font-extrabold">{s.kind === 'brand' ? '브랜드' : '카테고리'}</span>
                    {s.keyword}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Quick-jump product suggestions */}
          {productSuggestions.length > 0 && (
            <section className="px-4 pt-2 pb-1 bg-bg">
              <h3 className="text-[11px] font-black text-sub tracking-tight mb-1.5">바로가기</h3>
              <div className="flex flex-col">
                {productSuggestions.map((p) => (
                  <Link
                    key={p.id}
                    href={`/p/${p.slug}`}
                    onClick={() => commit(query)}
                    className="flex items-center gap-3 py-2 border-b border-divider last:border-b-0 active:bg-bg-warm rounded-lg transition"
                  >
                    <ProductImage src={p.image} alt={p.name} brand={p.brand} className="w-10 h-10 rounded-md shrink-0 overflow-hidden" category={p.category} />
                    <div className="flex-grow min-w-0">
                      <span className="block text-[10px] font-extrabold text-sub leading-none">{p.brand}</span>
                      <span className="block text-[13px] font-bold text-title truncate mt-0.5">{p.name}</span>
                    </div>
                    {p.hasAnyPrice === false ? (
                      <span className="text-[12px] font-black text-sub shrink-0">판매처 보기</span>
                    ) : (
                      <PriceText price={p.lowestPrice} size="sm" className="shrink-0" />
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Result grid */}
          <section className="px-4 py-4 bg-bg flex-grow">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-black text-title tracking-tight">
                검색 결과 <span className="text-primary">{results.length}</span>건
              </h3>
            </div>
            {results.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {results.map((prod) => (
                  <ProductListCard key={prod.id} product={prod} />
                ))}
              </div>
            ) : (
              <EmptyResult />
            )}
          </section>
        </>
      ) : (
        /* ── Idle state: recent searches + popular keywords ───────────── */
        <section className="px-4 py-4 bg-bg flex-grow flex flex-col gap-6">
          {recent.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-[13px] font-black text-title tracking-tight">최근 검색어</h3>
                <button onClick={() => writeRecent([])} className="text-[11px] text-[#A8A0A0] hover:text-primary font-bold transition">
                  전체삭제
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recent.map((term) => (
                  <span
                    key={term}
                    className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-pill border border-line bg-surface text-[12.5px] font-bold text-body"
                  >
                    <button onClick={() => applyKeyword(term)} className="hover:text-primary transition">
                      {term}
                    </button>
                    <button
                      onClick={() => writeRecent(removeRecentSearch(recent, term))}
                      className="text-[#C9C2C2] hover:text-primary active:scale-90 transition"
                      aria-label={`${term} 삭제`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M10 8.586 5.707 4.293 4.293 5.707 8.586 10l-4.293 4.293 1.414 1.414L10 11.414l4.293 4.293 1.414-1.414L11.414 10l4.293-4.293-1.414-1.414L10 8.586Z" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Popular keywords / categories */}
          {popular.length > 0 && (
            <div>
              <h3 className="text-[13px] font-black text-title tracking-tight mb-2.5">인기 카테고리</h3>
              <div className="flex flex-wrap gap-2">
                {popular.map((kw) => (
                  <button
                    key={kw}
                    onClick={() => applyKeyword(kw)}
                    className="inline-flex items-center px-3.5 py-1.5 rounded-pill border border-line bg-surface text-[12.5px] font-bold text-body hover:bg-accent-soft hover:text-primary hover:border-accent active:scale-95 transition"
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}

function EmptyResult() {
  return (
    <div className="w-full flex flex-col items-center gap-3 py-16 text-center">
      <div className="text-[15px] font-black text-title">검색 결과가 없어요</div>
      <p className="text-[12px] text-sub font-semibold leading-relaxed">
        다른 검색어로 다시 시도하거나
        <br />
        카테고리에서 둘러보세요.
      </p>
      <Link
        href="/c"
        className="mt-1 px-5 py-2.5 rounded-btn bg-primary text-white text-[13px] font-black active:scale-95 transition"
      >
        카테고리로 이동
      </Link>
    </div>
  );
}
