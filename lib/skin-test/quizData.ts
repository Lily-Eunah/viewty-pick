/**
 * 피부타입 테스트 — 문항·선택지·배점 데이터.
 *
 * 축 구조: 유분(Q1~4, 4지선다) → 수분(Q5~6) → 민감(Q7~9) → 고민 토핑(Q10 자가선택).
 * 배점·라우팅 규칙은 scoring.ts, 결과 카피·에셋은 results.ts 참고.
 */

export type OilAxis = 'dry' | 'combo' | 'normal' | 'oily';

export type ToppingKey = 'trouble' | 'pores' | 'texture' | 'redness' | 'elasticity';
export type ToppingSlug = ToppingKey | 'none';

export type BaseKey =
  | 'normal'
  | 'normal-dehydrated'
  | 'dry'
  | 'dry-sensitive'
  | 'oily'
  | 'oily-dehydrated'
  | 'combo'
  | 'combo-sensitive';

export interface OptionEffect {
  oil?: Partial<Record<OilAxis, number>>;
  water?: number;
  sensitive?: number;
  /** 결과지에 "피부과 상담 권장" 라인을 띄우는 강한 증상 응답 (Q8③·Q9①). */
  care?: boolean;
  /** 토핑 보조 신호 — Q10 선택과 일치하면 결과지에 정합성 멘트. */
  hint?: ToppingKey;
}

export interface QuizOption {
  label: string;
  effect: OptionEffect;
  /** Q10 전용 — 이 선택지가 확정하는 고민 토핑. */
  topping?: ToppingSlug;
}

export interface QuizQuestion {
  id: string;
  part: 'oil' | 'water' | 'sensitive' | 'topping';
  title: string;
  /** 운영자 제작 일러스트 경로 — 파일이 없으면 fallbackEmoji가 표시된다. */
  illustration: string;
  fallbackEmoji: string;
  options: QuizOption[];
}

const ILLUST = '/images/skin-test/questions';

export const QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    part: 'oil',
    title: '세안 후 머리 말리고 옷 챙기다 보면\n스킨케어가 20~30분 늦어지는 날, 내 피부는?',
    illustration: `${ILLUST}/q01.png`,
    fallbackEmoji: '🧼',
    options: [
      { label: '얼굴 전체가 쨍쨍하게 당긴다. 웃으면 큰일 날 것 같다', effect: { oil: { dry: 2 } } },
      { label: '볼·눈가는 당기는데 코·이마는 아무렇지 않다', effect: { oil: { combo: 2 } } },
      { label: '솔직히… 별 느낌 없다', effect: { oil: { normal: 2 } } },
      { label: '그 새를 못 참고 코부터 유분이 올라와 있다', effect: { oil: { oily: 2 } } },
    ],
  },
  {
    // 선택지 방향 역순(지성→건성) — 패턴 간파로 인한 습관성 응답 방지.
    id: 'q2',
    part: 'oil',
    title: '오후 3시, 엘리베이터 거울에 비친 내 얼굴은?',
    illustration: `${ILLUST}/q02.png`,
    fallbackEmoji: '🪞',
    options: [
      { label: '온 얼굴 유광 코팅. 조명 반사가 나를 향한다', effect: { oil: { oily: 2 } } },
      { label: '이마·코만 번쩍, 볼은 매트', effect: { oil: { combo: 2 } } },
      { label: '아침이랑 크게 다르지 않다', effect: { oil: { normal: 2 } } },
      { label: '푸석하다. 화장을 했다면 각질째 들떠 있다', effect: { oil: { dry: 2 }, hint: 'texture' } },
    ],
  },
  {
    id: 'q3',
    part: 'oil',
    title: '거울을 가까이서 봤을 때 모공은?',
    illustration: `${ILLUST}/q03.png`,
    fallbackEmoji: '🔍',
    options: [
      { label: '모공보다 푸석함·잔각질이 먼저 보인다', effect: { oil: { dry: 2 }, hint: 'texture' } },
      { label: '코 주변만 도드라진다', effect: { oil: { combo: 2 }, hint: 'pores' } },
      { label: '딱히 눈에 안 띈다', effect: { oil: { normal: 2 } } },
      { label: '코는 물론 볼까지 또렷, 블랙헤드도 상주 중', effect: { oil: { oily: 2 }, hint: 'pores' } },
    ],
  },
  {
    id: 'q4',
    part: 'oil',
    title: '번들거림, 닦고 싶어지는 순간은?',
    illustration: `${ILLUST}/q04.png`,
    fallbackEmoji: '🧻',
    options: [
      { label: '남 얘기. 내 가방엔 오히려 미스트·립밤이 있다', effect: { oil: { dry: 2 } } },
      { label: '코·이마만 가끔 신경 쓰인다', effect: { oil: { combo: 2 } } },
      { label: '번들거릴 일이 별로 없어서 닦을 생각도 안 해봤다', effect: { oil: { normal: 2 } } },
      { label: '하루 두 번은 닦아야 한다. 기름종이 없으면 티슈로라도', effect: { oil: { oily: 2 } } },
    ],
  },
  {
    id: 'q5',
    part: 'water',
    title: '"겉은 번들거리거나 멀쩡한데 속은 당기는"\n속당김을 느낀 적 있나요?',
    illustration: `${ILLUST}/q05.png`,
    fallbackEmoji: '💧',
    options: [
      { label: '자주. 번들거리는데 당긴다는 게 이상하지만 내가 그렇다', effect: { water: 2 } },
      { label: '세안 직후나 에어컨·히터 아래서만 가끔', effect: { water: 1 } },
      { label: '거의 없다', effect: {} },
    ],
  },
  {
    id: 'q6',
    part: 'water',
    title: '수분크림을 바르면?',
    illustration: `${ILLUST}/q06.png`,
    fallbackEmoji: '🧴',
    options: [
      { label: '바를 땐 촉촉한데 한두 시간이면 도로 당긴다 — 밑 빠진 독', effect: { water: 2 } },
      { label: '촉촉함이 오래간다', effect: {} },
      { label: '수분크림도 부담. 더 번들거려서 얇게 바르거나 건너뛴다', effect: { oil: { oily: 1 } } },
    ],
  },
  {
    id: 'q7',
    part: 'sensitive',
    title: '새 스킨케어 제품을 처음 쓸 때 나는?',
    illustration: `${ILLUST}/q07.png`,
    fallbackEmoji: '🎁',
    options: [
      { label: '웬만하면 무난하게 적응한다', effect: {} },
      { label: '따가워서 쓰다 만 제품이 한두 개 있다', effect: { sensitive: 1 } },
      { label: "'순한 것'만 골라 사는데도 종종 뒤집어진다. 새 제품은 공포", effect: { sensitive: 2 } },
    ],
  },
  {
    id: 'q8',
    part: 'sensitive',
    title: '사우나, 매운 음식, 추운 데서 실내로 들어온 순간 —\n내 얼굴은?',
    illustration: `${ILLUST}/q08.png`,
    fallbackEmoji: '🌶️',
    options: [
      { label: '남들만큼 붉어졌다 금방 돌아온다', effect: {} },
      { label: '쉽게 빨개지고, 붉은기가 10분 넘게 간다', effect: { sensitive: 1, hint: 'redness' } },
      { label: '붉어지는 걸 넘어 화끈거리고 따갑다', effect: { sensitive: 2, hint: 'redness', care: true } },
    ],
  },
  {
    id: 'q9',
    part: 'sensitive',
    title: '환절기·밤샘·스트레스로 컨디션이 무너지면\n내 피부는?',
    illustration: `${ILLUST}/q09.png`,
    fallbackEmoji: '😴',
    options: [
      { label: '쓰던 화장품마저 따갑고 화끈거린다', effect: { sensitive: 2, care: true } },
      { label: '울긋불긋해지거나 가렵고 거칠어진다', effect: { sensitive: 1 } },
      { label: '뾰루지가 하나둘 올라오는 정도, 따갑진 않다', effect: { hint: 'trouble' } },
      { label: '피부는 꿋꿋한 편', effect: {} },
    ],
  },
  {
    id: 'q10',
    part: 'topping',
    title: '피부 요정님이 딱 하나만 해결해준다면?',
    illustration: `${ILLUST}/q10.png`,
    fallbackEmoji: '🍨',
    options: [
      { label: '예고 없이 톡톡 올라오는 뾰루지', effect: {}, topping: 'trouble' },
      { label: '도드라진 모공·블랙헤드', effect: {}, topping: 'pores' },
      { label: '까끌한 각질, 들뜨는 화장', effect: {}, topping: 'texture' },
      { label: '가라앉지 않는 붉은기', effect: {}, topping: 'redness' },
      { label: '처짐·잔주름, 힘없는 피부', effect: {}, topping: 'elasticity' },
      { label: '딱히 없는데?', effect: {}, topping: 'none' },
    ],
  },
];

/** 민감 축 4점 이상일 때만 노출되는 조건부 보너스 문항. */
export const BONUS_QUESTION = {
  id: 'bonus',
  title: '마지막 하나만 더 —\n그 예민함은 언제부터였나요?',
  illustration: `${ILLUST}/bonus.png`,
  fallbackEmoji: '🕰️',
  options: [
    { label: '어릴 때부터 쭉 그랬다', value: 'always' as const },
    { label: '최근 몇 달 사이 생겼다', value: 'recent' as const },
  ],
};

export type BonusAnswer = (typeof BONUS_QUESTION.options)[number]['value'];
