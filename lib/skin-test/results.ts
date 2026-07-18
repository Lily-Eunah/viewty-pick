/**
 * 피부타입 테스트 — 결과 유형 카피·캐릭터 에셋·사이트 연결.
 *
 * 캐릭터 에셋은 public/images/skin-test/ (시트에서 누끼 완료).
 * skinName은 products.skin_types 필터 값, skinSlug는 /skin/[type]/[category] 허브 경로.
 * 중성(투게더 바닐라)은 전용 필터가 없어 전체 인기템(/best)으로 연결한다.
 */
import { BaseKey, ToppingKey } from './quizData';

export interface BaseResult {
  /** 캐릭터(아이스크림) 이름 — 결과 카드의 주인공. */
  flavor: string;
  /** 진단명 — "피지활발 지성" 등. */
  typeName: string;
  tagline: string;
  desc: string;
  care: string[];
  asset: string;
  /** 제품 칩 필터용 skin_types 값. null이면 전체 인기템. */
  skinName: string | null;
  /** 스킨 허브 경로 조각(/skin/[slug]/sunscreen). null이면 /best. */
  skinSlug: string | null;
}

export interface ToppingResult {
  petName: string;
  concern: string;
  copy: string;
  asset: string;
  heroClassName: string;
}

export const BASE_RESULTS: Record<BaseKey, BaseResult> = {
  normal: {
    flavor: '투게더 바닐라',
    typeName: '균형 중성',
    tagline: '기본기가 탄탄한 클래식 밸런스',
    desc:
      '유분도 수분도 넘치거나 모자라지 않은, 모두가 부러워하는 균형 피부예요. 클래식 바닐라처럼 기본에 충실한 타입 — 지금의 밸런스를 지키는 게 최고의 케어입니다.',
    care: [
      '루틴을 크게 흔들지 않기 — 잦은 신제품 실험이 오히려 균형을 깨요',
      '계절이 바뀔 때 보습 강도만 미세 조정',
      '자외선 차단은 균형 피부에게도 유일한 필수 숙제',
    ],
    asset: '/images/skin-test/v2/base-normal.png',
    skinName: null,
    skinSlug: null,
  },
  'normal-dehydrated': {
    flavor: '요맘때 블루베리',
    typeName: '수분부족 중성',
    tagline: '겉은 무난, 속은 촉촉함이 고픈 타입',
    desc:
      '겉보기엔 무난한데 속은 은근히 당기는 수분부족형이에요. 요거트 바처럼 산뜻하게 — 무거운 크림보다 가벼운 수분을 겹겹이 채우는 게 답입니다.',
    care: [
      '가벼운 수분 토너·에센스를 2~3겹 레이어링',
      '에어컨·히터 앞에선 미스트보다 수분크림 덧바르기',
      '각질 제거는 주 1회 이하로 순하게',
    ],
    asset: '/images/skin-test/v2/base-normal-dehydrated.png',
    skinName: '수부지',
    skinSlug: 'dehydrated',
  },
  dry: {
    flavor: '빵또아',
    typeName: '유분부족 건성',
    tagline: '빵 이불이 필요한 포근 보습파',
    desc:
      '유분과 수분이 모두 부족해지기 쉬운 건성이에요. 빵또아가 폭신한 빵을 이불처럼 두르듯, 유분기 있는 보습막으로 포근하게 감싸주는 케어가 핵심입니다.',
    care: [
      '세라마이드·스쿠알란 등 유분 보습 크림은 필수',
      '세안 후 물기가 마르기 전 3분 안에 보습',
      '겨울엔 슬리핑팩·페이스오일로 한 겹 더',
    ],
    asset: '/images/skin-test/v2/base-dry.png',
    skinName: '건성',
    skinSlug: 'dry',
  },
  'dry-sensitive': {
    flavor: '캔디바',
    typeName: '민감 건성',
    tagline: '순한 것만 허락하는 소심 보들파',
    desc:
      '자극에 약한 속살을 하늘색 보호막이 감싸고 있는 캔디바 타입 — 예민함과 건조함이 함께 오는 피부예요. 순하고 심플한 루틴으로 장벽부터 지켜주세요.',
    care: [
      '무향·저자극, 성분 리스트가 짧은 제품 위주로',
      '새 제품은 턱·귀 뒤에 2~3일 테스트 후 도입',
      '세라마이드·판테놀 등 장벽 강화 성분 최우선',
    ],
    asset: '/images/skin-test/v2/base-dry-sensitive.png',
    skinName: '민감성',
    skinSlug: 'sensitive',
  },
  oily: {
    flavor: '폴라포 포도',
    typeName: '피지활발 지성',
    tagline: '얼음처럼 쿨한 유분 부자',
    desc:
      '피지선이 부지런한 지성 피부예요. 폴라포처럼 차갑고 청량하게 — 유분은 걷어내되 수분은 가볍게 채우는 산뜻한 밸런스가 어울립니다.',
    care: [
      '보습은 젤·에센스 등 가벼운 수분 제형으로',
      '주 1~2회 BHA로 모공·피지 결 정리',
      '과한 세안은 피지 리바운드 — 하루 2회면 충분',
    ],
    asset: '/images/skin-test/v2/base-oily.png',
    skinName: '지성',
    skinSlug: 'oily',
  },
  'oily-dehydrated': {
    flavor: '탱크보이',
    typeName: '수분부족 지성 (수부지)',
    tagline: '겉번들 속당김, 반전의 물주머니',
    desc:
      '겉은 번들거리는데 속은 당기는 수부지예요. 탱크보이의 배즙처럼 — 유분을 억지로 걷어내기보다 가벼운 수분을 계속 채워주는 게 진짜 해법입니다.',
    care: [
      '유분 제거보다 수분 공급이 먼저',
      '알코올 비중 높은 토너·하루 3회 이상 세안 금지',
      '가벼운 수분크림을 얇게, 필요하면 여러 번',
    ],
    asset: '/images/skin-test/v2/base-oily-dehydrated.png',
    skinName: '수부지',
    skinSlug: 'dehydrated',
  },
  combo: {
    flavor: '월드콘',
    typeName: 'T존 복합성',
    tagline: '위는 크림, 아래는 콘 — 구역이 다른 얼굴',
    desc:
      '이마·코는 번들, 볼·턱은 건조 — 월드콘처럼 위아래가 확실히 다른 복합성이에요. 여름엔 지성 같고 겨울엔 건성 같아 정체성 혼란이 오지만, 부위별로 다르게 대하면 됩니다.',
    care: [
      'T존은 산뜻하게, 볼은 촉촉하게 — 부위별 이원화',
      '클렌징은 T존 위주로 꼼꼼히, 볼은 가볍게',
      '밸런싱 토너로 전체 결을 고르게 정리',
    ],
    asset: '/images/skin-test/v2/base-combo.png',
    skinName: '복합성',
    skinSlug: 'combination',
  },
  'combo-sensitive': {
    flavor: '스크류바',
    typeName: '민감 복합성',
    tagline: '두 색이 꼬여 있는 예민 복합파',
    desc:
      '유수분 고민과 예민함이 스크류바처럼 꼬여 있는 타입이에요. 이럴 땐 순서가 중요합니다 — 자극 관리가 먼저, 유수분 밸런스는 그다음이에요.',
    care: [
      '진정 성분(시카·마데카소사이드) 중심 루틴',
      '각질 제거·고농도 액티브는 컨디션 좋은 날만',
      '피부가 뒤집어진 주엔 루틴을 반으로 줄이기',
    ],
    asset: '/images/skin-test/v2/base-combo-sensitive.png',
    skinName: '민감성',
    skinSlug: 'sensitive',
  },
};

export const TOPPING_RESULTS: Record<ToppingKey, ToppingResult> = {
  trouble: {
    petName: '별난바',
    concern: '트러블·여드름',
    copy:
      '팝핑캔디처럼 예고 없이 톡톡 올라오는 트러블 메이트. 손대지 않기 + 진정 스팟 케어가 기본이고, 염증성 여드름이 잦다면 피부과가 가장 빠른 길이에요.',
    asset: '/images/skin-test/v2/pet-trouble.png',
    heroClassName: '-right-11 bottom-1 h-20 -rotate-3',
  },
  pores: {
    petName: '돼지바',
    concern: '모공·피지',
    copy:
      '크런치처럼 도드라진 모공·블랙헤드 짝꿍. 억지로 짜기보다 BHA·클레이로 녹여내고, 유분 컨트롤과 자외선 차단으로 모공 늘어짐을 막아주세요.',
    asset: '/images/skin-test/v2/pet-pores.png',
    heroClassName: '-right-14 bottom-0 h-[72px] rotate-0',
  },
  texture: {
    petName: '쿠키오',
    concern: '각질·피부결',
    copy:
      '부스러기를 흘리고 다니는 까끌 각질 메이트. 벅벅 밀기보다 순한 각질 케어를 주기적으로, 그리고 그 직후엔 보습을 두 배로 챙기는 게 결 관리의 정석이에요.',
    asset: '/images/skin-test/v2/pet-texture.png',
    heroClassName: '-right-16 bottom-0 h-16 -rotate-[2deg]',
  },
  redness: {
    petName: '수박바',
    concern: '홍조·붉어짐',
    copy:
      '볼이 새빨개지는 수박바 단짝. 온도차·자극을 줄이고 진정·쿨링 케어를 기본으로 — 붉은기가 몇 주째 가라앉지 않는다면 피부과 상담이 정답입니다.',
    asset: '/images/skin-test/v2/pet-redness.png',
    heroClassName: '-right-10 bottom-0 h-20 rotate-0',
  },
  elasticity: {
    petName: '찰떡 트윈스',
    concern: '탄력·영양',
    copy:
      '눌러도 다시 통통해지는 찰떡 같은 탄력을 위해 — 보습·영양·자외선 차단 삼박자가 핵심이에요. 특히 자외선 차단이 최고의 안티에이징입니다.',
    asset: '/images/skin-test/v2/pet-elasticity.png',
    heroClassName: '-right-13 bottom-[-2px] h-[74px] rotate-0',
  },
};

export const BASE_KEYS = Object.keys(BASE_RESULTS) as BaseKey[];
export const TOPPING_SLUGS = [...(Object.keys(TOPPING_RESULTS) as ToppingKey[]), 'none'] as const;
