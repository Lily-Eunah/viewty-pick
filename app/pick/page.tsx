import React from 'react';
import Link from 'next/link';
import AppShell from '../../components/layout/AppShell';
import Header from '../../components/layout/Header';
import Badge from '../../components/common/Badge';

interface CurationCard {
  badgeSlug: string;
  categorySlug: string;
  badgeName: string;
  categoryName: string;
  title: string;
  desc: string;
  emoji: string;
  gradient: string;
  tag: string;
}

const curationsList: CurationCard[] = [
  {
    badgeSlug: 'directorpi',
    categorySlug: 'sunscreen',
    badgeName: '디렉터파이',
    categoryName: '선크림',
    title: '성분 합격 추천 선크림 리스트',
    desc: '유해 우려 성분 배제는 기본, 백탁과 눈시림 없는 데일리 안심 선크림 성분 분석 비교',
    emoji: '🧴',
    gradient: 'linear-gradient(135deg, #F6E7EC 0%, #FBF7F1 100%)',
    tag: '성분 안심',
  },
  {
    badgeSlug: 'hwahae',
    categorySlug: 'sunscreen',
    badgeName: '화해 랭킹',
    categoryName: '선크림',
    title: '실시간 평점 랭킹 베스트 선크림',
    desc: '사용자 리얼 리뷰 평점과 유해 성분 정보로 신뢰도를 높인 최저가 선케어 비교',
    emoji: '☀️',
    gradient: 'linear-gradient(135deg, #EAF0F3 0%, #FBF7F1 100%)',
    tag: '평점 베스트',
  },
  {
    badgeSlug: 'directorpi',
    categorySlug: 'skincare',
    badgeName: '디렉터파이',
    categoryName: '스킨케어',
    title: '수분 진정 및 장벽 강화 스킨케어',
    desc: '속건조 해결과 피부 진정에 최적화된 토너, 로션, 크림 검증 합격 뷰티템 리스트',
    emoji: '💦',
    gradient: 'linear-gradient(135deg, #F6E7EC 0%, #FFFDF9 50%, #EAF0F3 100%)',
    tag: '장벽 개선',
  },
  {
    badgeSlug: 'directorpi',
    categorySlug: 'cleansing-care',
    badgeName: '디렉터파이',
    categoryName: '클렌징',
    title: '피부 자극 없는 순한 클렌징 픽',
    desc: '세정력과 보습력을 갖춘 약산성 폼클렌저, 젤, 오일 등 저자극 세안 가이드',
    emoji: '🧼',
    gradient: 'linear-gradient(135deg, #F7EFE7 0%, #FAEEF2 100%)',
    tag: '약산성/저자극',
  },
];

export default function PickListPage() {
  return (
    <AppShell activeTab="home">
      <Header showBack title="큐레이션 가이드 목록" />

      {/* Hero Header */}
      <section className="bg-bg px-4 py-6 border-b border-line">
        <div className="flex flex-col gap-1.5">
          <Badge type="accent" className="w-fit">
            Original Pick
          </Badge>
          <h2 className="text-[20px] font-black text-title leading-tight tracking-tight mt-1">
            뷰티 PICK 전체 가이드
          </h2>
          <p className="text-[12px] text-body opacity-85 mt-1.5 font-semibold leading-relaxed">
            성분 검증 전문가의 합격 픽부터 화해 랭킹 인기 상품까지, 신뢰할 수 있는 가이드를 한곳에서 확인하고 실시간 판매처별 최저가를 비교해 보세요.
          </p>
        </div>
      </section>

      {/* Grid of curations */}
      <section className="px-4 py-5 bg-bg flex-grow">
        <div className="flex flex-col gap-4">
          {curationsList.map((item) => (
            <Link
              key={`${item.badgeSlug}-${item.categorySlug}`}
              href={`/pick/${item.badgeSlug}/${item.categorySlug}`}
              className="relative flex flex-col justify-between p-5 rounded-[22px] border border-line bg-surface shadow-[0_8px_24px_rgba(65,0,22,0.06)] active:scale-[0.99] transition-transform duration-200 min-h-[160px] overflow-hidden"
              style={{ background: item.gradient }}
            >
              <div className="flex flex-col gap-1.5 z-10 max-w-[80%]">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-primary bg-primary-soft px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    {item.badgeName}
                  </span>
                  <span className="text-[10.5px] font-black text-[#6F838F] bg-[#EAF0F3] px-2 py-0.5 rounded-full">
                    {item.tag}
                  </span>
                </div>
                
                <h3 className="text-[16px] font-black text-title leading-snug tracking-tight mt-1">
                  {item.title}
                </h3>
                
                <p className="text-[11.5px] text-text-secondary font-semibold leading-relaxed mt-1 line-clamp-2">
                  {item.desc}
                </p>
              </div>

              {/* Icon Decoration */}
              <div className="absolute right-4 bottom-4 w-16 h-16 opacity-90 pointer-events-none select-none flex items-end justify-center">
                <span className="text-[52px] leading-none">{item.emoji}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
