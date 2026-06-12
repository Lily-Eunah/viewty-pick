import { UIProduct } from '../types';

export const products: UIProduct[] = [
  {
    id: '1',
    slug: 'mongdies-excellent-suncream',
    brand: '몽디에스',
    name: '엑설런트 선크림',
    category: 'sunscreen',
    image: '',
    volume: '50ml',
    description: '무기자차 건성/민감성/온가족용 순한 자외선 차단제',
    skinTypes: ['건성', '민감성'],
    tags: ['무기자차', '온가족용', '순한선크림'],
    badges: ['디렉터파이 추천', '온가족 Top'],
    lowestPrice: 19800,
    previousPrice: 24000,
    priceDropAmount: 4200,
    priceDropRate: 17,
    source: 'directorpi',
    viewtyScore: 92,
    reasonItems: [
      '성분 유해 논란 성분 배제',
      '민감성 피부 자극 테스트 완료',
      '백탁 현상이 적고 부드러운 발림성',
      '온 가족이 안심하고 사용 가능'
    ],
    features: ['SPF50+ PA++++', '무기자차', '피부 저자극'],
    stores: [
      {
        name: '쿠팡',
        sellerSlug: 'coupang',
        price: 19800,
        url: 'https://link.coupang.com/a/euTm1IrprU',
        isBest: true,
        isRocket: true,
        unitPrice: 396
      },
      {
        name: '네이버스토어',
        sellerSlug: 'naver',
        price: 21500,
        url: 'https://brand.naver.com/mongdies/products/13009860683',
        isOfficial: true,
        unitPrice: 430
      }
    ]
  },
  {
    id: '2',
    slug: 'fusidyne-zinc-calming-sunscreen',
    brand: '후시디움 (동화약품)',
    name: '더마 트러블 징크 카밍 선크림',
    category: 'sunscreen',
    image: '',
    volume: '50ml',
    description: '무기자차 수부지/지성/복합성 피부 트러블 진정 선케어',
    skinTypes: ['수부지', '지성', '복합성'],
    tags: ['무기자차', '트러블케어', '징크카밍'],
    badges: ['디렉터파이 추천', '수부지/지성 Top'],
    lowestPrice: 16900,
    previousPrice: 19000,
    priceDropAmount: 2100,
    priceDropRate: 11,
    source: 'directorpi',
    viewtyScore: 89,
    reasonItems: [
      '트러블 피부 진정에 탁월한 징크 성분 함유',
      '피지 조절 및 번들거림 방지 포뮬러',
      '산뜻한 수분 크림 제형으로 끈적임 없음',
      '논코메도제닉 테스트 완료'
    ],
    features: ['SPF50+ PA++++', '무기자차', '트러블 진정'],
    stores: [
      {
        name: '쿠팡',
        sellerSlug: 'coupang',
        price: 16900,
        url: 'https://link.coupang.com/a/euTogOeOKi',
        isBest: true,
        isRocket: true,
        unitPrice: 338
      },
      {
        name: '네이버스토어',
        sellerSlug: 'naver',
        price: 18000,
        url: 'https://brand.naver.com/dongwhafusidyne/products/9999261730',
        isOfficial: true,
        unitPrice: 360
      }
    ]
  },
  {
    id: '3',
    slug: 'starlike-pdrn-skinfit-sunscreen',
    brand: '스타라이크',
    name: '피디알엔 스킨핏 수분 선크림',
    category: 'sunscreen',
    image: '',
    volume: '50ml',
    description: '유기자차 수부지/지성 피부용 촉촉한 PDRN 장벽 물광 선케어',
    skinTypes: ['수부지', '지성'],
    tags: ['유기자차', 'PDRN', '수분장벽'],
    badges: ['디렉터파이 추천', '수부지/지성 Top'],
    lowestPrice: 15400,
    previousPrice: 22000,
    priceDropAmount: 6600,
    priceDropRate: 30,
    source: 'directorpi',
    viewtyScore: 94,
    reasonItems: [
      'PDRN 성분을 통한 피부 장벽 케어',
      '백탁 없는 투명하고 가벼운 흡수력',
      '수분 크림을 바른 듯한 하루 종일 촉촉함',
      '지성 및 복합성 피부에도 답답함 없음'
    ],
    features: ['SPF50+ PA++++', '유기자차', '물광 에센스 제형'],
    stores: [
      {
        name: '올리브영',
        sellerSlug: 'oliveyoung',
        price: 15400,
        url: 'https://oy.run/g1ip6hEbG0GQsu',
        isBest: true,
        promoType: 'sale',
        promoText: '올영단독특가',
        unitPrice: 308
      },
      {
        name: '쿠팡',
        sellerSlug: 'coupang',
        price: 16500,
        url: 'https://link.coupang.com/a/euTq778JA4',
        isRocket: true,
        unitPrice: 330
      },
      {
        name: '지그재그',
        sellerSlug: 'zigzag',
        price: 15900,
        url: 'https://s.zigzag.kr/abr/Lx0jJvYi94',
        unitPrice: 318
      },
      {
        name: '에이블리',
        sellerSlug: 'ably',
        price: 16200,
        url: 'https://applink.a-bly.com/ogk2u3',
        unitPrice: 324
      }
    ]
  },
  {
    id: '4',
    slug: 'arocell-mela-txa-sunserum',
    brand: '아로셀',
    name: '멜라 TXA 선세럼',
    category: 'sunscreen',
    image: '',
    volume: '50ml',
    description: '유기자차 건성/복합성 피부 기미 잡티 완화 기능성 선세럼',
    skinTypes: ['건성', '복합성'],
    tags: ['유기자차', '기미케어', '미백선세럼'],
    badges: ['디렉터파이 추천', '건성/복합성 Top'],
    lowestPrice: 28500,
    previousPrice: 35000,
    priceDropAmount: 6500,
    priceDropRate: 18,
    source: 'directorpi',
    viewtyScore: 91,
    reasonItems: [
      '트라넥사믹애씨드(TXA) 함유로 기미 및 색소침착 완화',
      '고기능성 스킨케어 성분 다량 배합',
      '밀림 없이 스며드는 밀크 에센스 텍스처',
      '피부 속건조를 잡는 풍부한 영양감'
    ],
    features: ['SPF50+ PA++++', '유기자차', '미백/주름/자외선 3중'],
    stores: [
      {
        name: '네이버스토어',
        sellerSlug: 'naver',
        price: 28500,
        url: 'https://naver.me/5zURlN5z',
        isBest: true,
        isOfficial: true,
        unitPrice: 570
      },
      {
        name: '올리브영',
        sellerSlug: 'oliveyoung',
        price: 29000,
        url: 'https://oy.run/nq6hNFFJuXtQ7h',
        unitPrice: 580
      },
      {
        name: '쿠팡',
        sellerSlug: 'coupang',
        price: 29500,
        url: 'https://link.coupang.com/a/euTq778JA4',
        isRocket: true,
        unitPrice: 590
      },
      {
        name: '지그재그',
        sellerSlug: 'zigzag',
        price: 28900,
        url: 'https://s.zigzag.kr/abr/5DvMybQveI',
        unitPrice: 578
      }
    ]
  },
  {
    id: '5',
    slug: 'innisfree-toneup-nosebum-sunscreen',
    brand: '이니스프리',
    name: '데일리 유브이 톤업 노세범 선크림',
    category: 'sunscreen',
    image: '',
    volume: '50ml',
    description: '톤업 보송 톤업 번들거림 없는 지성 추천 톤업 선케어',
    skinTypes: ['지성', '복합성', '민감성'],
    tags: ['톤업선크림', '노세범', '보송피니시'],
    badges: ['디렉터파이 추천', '보송 톤업 Top'],
    lowestPrice: 11900,
    previousPrice: 15000,
    priceDropAmount: 3100,
    priceDropRate: 20,
    source: 'directorpi',
    viewtyScore: 90,
    reasonItems: [
      '피지 컨트롤 특화 파우더 함유로 하루 종일 보송함 유지',
      '화사하고 자연스러운 핑크빛 생기 톤업',
      '무기자차 특유의 모공 블러 효과',
      '끈적임과 무너짐 없는 밀착력'
    ],
    features: ['SPF50+ PA++++', '무기자차', '오일컨트롤'],
    stores: [
      {
        name: '쿠팡',
        sellerSlug: 'coupang',
        price: 11900,
        url: 'https://link.coupang.com/a/euTvIULPLU',
        isBest: true,
        isRocket: true,
        unitPrice: 238
      },
      {
        name: '올리브영',
        sellerSlug: 'oliveyoung',
        price: 12500,
        url: 'https://oy.run/rRbPHHbTfWaDJC',
        unitPrice: 250
      },
      {
        name: '지그재그',
        sellerSlug: 'zigzag',
        price: 12100,
        url: 'https://s.zigzag.kr/abr/FUogL31meU',
        unitPrice: 242
      },
      {
        name: '에이블리',
        sellerSlug: 'ably',
        price: 12300,
        url: 'https://applink.a-bly.com/q27718',
        unitPrice: 246
      },
      {
        name: '네이버스토어',
        sellerSlug: 'naver',
        price: 12900,
        url: 'https://brand.naver.com/innisfree/products/13155811785',
        isOfficial: true,
        unitPrice: 258
      }
    ]
  },
  {
    id: '6',
    slug: 'beautyofjoseon-stayfresh-purple',
    brand: '조선미녀',
    name: '스테이 프레쉬 톤업 선크림 퍼플',
    category: 'sunscreen',
    image: '',
    volume: '50ml',
    description: '톤업 촉촉 보라 톤업 노란 기 보정 및 백탁 없는 생기 선크림',
    skinTypes: ['건성', '민감성', '복합성'],
    tags: ['톤업선크림', '보라톤업', '촉촉밀착'],
    badges: ['디렉터파이 추천', '촉촉 톤업 Top'],
    lowestPrice: 14500,
    previousPrice: 18000,
    priceDropAmount: 3500,
    priceDropRate: 19,
    source: 'directorpi',
    viewtyScore: 93,
    reasonItems: [
      '보라색 포뮬러로 동양인 피부 특유의 노란 기 자연스럽게 커버',
      '수분 크림 바르듯 부드러운 밀착력',
      '오랜 시간 당김 없이 유지되는 촉촉함',
      '저자극 안심 제형'
    ],
    features: ['SPF50+ PA++++', '혼합자차', '톤 보정'],
    stores: [
      {
        name: '네이버스토어',
        sellerSlug: 'naver',
        price: 14500,
        url: 'https://brand.naver.com/beautyofjoseon/products/13518654945',
        isBest: true,
        isOfficial: true,
        unitPrice: 290
      },
      {
        name: '올리브영',
        sellerSlug: 'oliveyoung',
        price: 15000,
        url: 'https://oy.run/gsgwGOxKSzisni',
        unitPrice: 300
      },
      {
        name: '쿠팡',
        sellerSlug: 'coupang',
        price: 15300,
        url: 'https://link.coupang.com/a/euTyhRQ4LQ',
        isRocket: true,
        unitPrice: 306
      }
    ]
  },
  {
    id: '7',
    slug: 'numbuzin-3-porcelain-toneup',
    brand: '넘버즈인',
    name: '3번 도자기결 톤업베이지 선크림',
    category: 'sunscreen',
    image: '',
    volume: '50ml',
    description: '톤업 파데프리 도자기 같은 매끄러운 톤업 베이지 선크림',
    skinTypes: ['민감성', '복합성', '지성', '건성'],
    tags: ['파데프리', '톤업베이지', '도자기결'],
    badges: ['디렉터파이 추천', '파데프리 Top'],
    lowestPrice: 17900,
    previousPrice: 26000,
    priceDropAmount: 8100,
    priceDropRate: 31,
    source: 'directorpi',
    viewtyScore: 96,
    reasonItems: [
      '파운데이션 없이 맑고 매끄러운 피부 결 완성',
      '동양인 스킨톤에 딱 맞는 자연스러운 베이지 컬러',
      '요철 및 모공을 매끄럽게 메우는 프라이머 효과',
      '진정 성분 다량 배합으로 피부가 답답하지 않은 편안함'
    ],
    features: ['SPF50+ PA++++', '혼합자차', '파데프리 톤업'],
    stores: [
      {
        name: '쿠팡',
        sellerSlug: 'coupang',
        price: 17900,
        url: 'https://link.coupang.com/a/euTAD8gTQW',
        isBest: true,
        isRocket: true,
        unitPrice: 358
      },
      {
        name: '네이버스토어',
        sellerSlug: 'naver',
        price: 18900,
        url: 'https://brand.naver.com/numbuzin/products/5788327291',
        isOfficial: true,
        unitPrice: 378
      },
      {
        name: '올리브영',
        sellerSlug: 'oliveyoung',
        price: 18500,
        url: 'https://oy.run/YYKPJc5qEf6uS2',
        unitPrice: 370
      }
    ]
  },
  {
    id: '8',
    slug: 'anua-heartleaf-77-toner',
    brand: '아누아',
    name: '어성초 77 수딩 토너',
    category: 'toner',
    image: '',
    volume: '250ml',
    description: '어성초 추출물 77% 함유로 피부 붉은기 진정에 탁월한 토너',
    skinTypes: ['민감성', '지성', '수부지'],
    tags: ['붉은기진정', '어성초토너', '닦토추천'],
    badges: ['올영 1위', '민감성 진정'],
    lowestPrice: 18900,
    previousPrice: 23000,
    priceDropAmount: 4100,
    priceDropRate: 17,
    source: 'oliveyoung',
    viewtyScore: 91,
    reasonItems: [
      '어성초 추출물 77%의 강력한 진정 효과',
      '논코메도제닉 테스트 완료로 여드름성 피부 추천',
      '가볍고 투명한 워터 타입으로 잔여감 없음',
      '피부 자극도 0.00 검증 완료'
    ],
    features: ['250ml', '약산성', '각질/피지 케어'],
    stores: [
      {
        name: '올리브영',
        sellerSlug: 'oliveyoung',
        price: 18900,
        url: 'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000155253',
        isBest: true,
        promoType: 'sale',
        promoText: '10% 할인',
        unitPrice: 75
      },
      {
        name: '쿠팡',
        sellerSlug: 'coupang',
        price: 19200,
        url: 'https://www.coupang.com',
        isRocket: true,
        unitPrice: 76
      }
    ]
  },
  {
    id: '9',
    slug: 'torriden-dive-in-serum',
    brand: '토리든',
    name: '다이브인 저분자 히알루론산 세럼',
    category: 'serum',
    image: '',
    volume: '50ml',
    description: '3초 수분 충전 속건조 해결 1등 히알루론산 세럼',
    skinTypes: ['수부지', '건성', '복합성'],
    tags: ['속건조세럼', '수분자석', '판테놀'],
    badges: ['화해 1위', '수부지 필수'],
    lowestPrice: 12800,
    previousPrice: 18000,
    priceDropAmount: 5200,
    priceDropRate: 28,
    source: 'hwahae',
    viewtyScore: 95,
    reasonItems: [
      '5D 복합 히알루론산으로 피부 겉부터 속까지 수분 공급',
      '말끔하게 흡수되는 끈적임 없는 포뮬러',
      '디판테놀 성분 함유로 외부 유해 자극으로부터 피부 보호',
      '약산성 보습 장벽 유지'
    ],
    features: ['50ml', '저분자 히알루론산', '비건 인증'],
    stores: [
      {
        name: '쿠팡',
        sellerSlug: 'coupang',
        price: 12800,
        url: 'https://www.coupang.com',
        isBest: true,
        isRocket: true,
        unitPrice: 256
      },
      {
        name: '올리브영',
        sellerSlug: 'oliveyoung',
        price: 13500,
        url: 'https://www.oliveyoung.co.kr',
        unitPrice: 270
      }
    ]
  },
  {
    id: '10',
    slug: 'dr-g-red-blemish-cream',
    brand: '닥터지',
    name: '레드 블레미쉬 클리어 수딩 크림',
    category: 'cream',
    image: '',
    volume: '70ml',
    description: '10가지 시카 성분으로 자극받은 피부를 편안하게 해주는 시카 진정 크림',
    skinTypes: ['지성', '민감성', '수부지'],
    tags: ['수딩크림', '시카진정', '여드름화장품'],
    badges: ['올영 베스트', '여드름 진정'],
    lowestPrice: 21900,
    previousPrice: 32000,
    priceDropAmount: 10100,
    priceDropRate: 31,
    source: 'oliveyoung',
    viewtyScore: 94,
    reasonItems: [
      '10-시카 콤플렉스로 초고속 피부 진정',
      '피부에 모공을 막지 않는 여드름성 피부 사용 적합 제형',
      '촉촉하게 오래 지속되는 에코-시카 보습',
      '모든 피부가 순하게 사용할 수 있는 젤 타입 크림'
    ],
    features: ['70ml', '10-Cica', '논코메도제닉'],
    stores: [
      {
        name: '올리브영',
        sellerSlug: 'oliveyoung',
        price: 21900,
        url: 'https://www.oliveyoung.co.kr',
        isBest: true,
        promoType: 'buy_x_get_y',
        promoText: '1+1 기획',
        unitPrice: 156,
        effectiveUnitPrice: 10950
      },
      {
        name: '쿠팡',
        sellerSlug: 'coupang',
        price: 23200,
        url: 'https://www.coupang.com',
        isRocket: true,
        unitPrice: 331
      }
    ]
  },
  {
    id: '11',
    slug: 'beplain-mungbean-cleansing-foam',
    brand: '비플레인',
    name: '녹두 약산성 클렌징폼',
    category: 'cleansing',
    image: '',
    volume: '160ml',
    description: '녹두 가루와 녹두 추출물로 피부 노폐물을 흡착하는 저자극 약산성 클렌저',
    skinTypes: ['민감성', '복합성', '지성'],
    tags: ['약산성클렌징', '녹두파우더', '모공세정'],
    badges: ['화해 1위', '저자극 폼'],
    lowestPrice: 11500,
    previousPrice: 15900,
    priceDropAmount: 4400,
    priceDropRate: 27,
    source: 'hwahae',
    viewtyScore: 92,
    reasonItems: [
      '노폐물 정화에 우수한 유기농 한국산 녹두 가루 함유',
      '모공 속 초미세먼지 세정 테스트 완료',
      '부드러운 거품으로 세안 후에도 당김 없이 촉촉함 유지',
      '피부 장벽과 유사한 약산성 pH'
    ],
    features: ['160ml', '약산성', '모공/피지 세정'],
    stores: [
      {
        name: '쿠팡',
        sellerSlug: 'coupang',
        price: 11500,
        url: 'https://www.coupang.com',
        isBest: true,
        isRocket: true,
        unitPrice: 71
      },
      {
        name: '올리브영',
        sellerSlug: 'oliveyoung',
        price: 12900,
        url: 'https://www.oliveyoung.co.kr',
        unitPrice: 80
      }
    ]
  },
  {
    id: '12',
    slug: 'clio-kill-cover-cushion',
    brand: '클리오',
    name: '킬커버 더 뉴 펜웨어 쿠션',
    category: 'cushion',
    image: '',
    volume: '15g x 2',
    description: '얇고 가벼운 초밀착 커버로 72시간 끄떡없는 펜웨어 쿠션',
    skinTypes: ['지성', '복합성'],
    tags: ['초밀착쿠션', '72시간밀착', '킬커버'],
    badges: ['올영 1위', '완벽커버'],
    lowestPrice: 22800,
    previousPrice: 34000,
    priceDropAmount: 11200,
    priceDropRate: 32,
    source: 'oliveyoung',
    viewtyScore: 93,
    reasonItems: [
      '한층 얇아진 초슬림 파우더가 피부 굴곡을 메워 밀착',
      '마스크 묻어남 방지 및 지속력 테스트 완료',
      '기미, 모공, 잡티 등을 부드럽게 감싸는 완벽 커버력',
      '피부 굴곡에 최적화된 물방울 퍼프 제공'
    ],
    features: ['15g + 리필 15g', '펜웨어', '밀착커버'],
    stores: [
      {
        name: '올리브영',
        sellerSlug: 'oliveyoung',
        price: 22800,
        url: 'https://www.oliveyoung.co.kr',
        isBest: true,
        promoType: 'sale',
        promoText: '기획세트 특가',
        unitPrice: 760
      },
      {
        name: '쿠팡',
        sellerSlug: 'coupang',
        price: 24500,
        url: 'https://www.coupang.com',
        isRocket: true,
        unitPrice: 816
      }
    ]
  },
  {
    id: '13',
    slug: 'aestura-atobarrier-365-cream',
    brand: '에스트라',
    name: '아토베리어365 크림',
    category: 'cream',
    image: '',
    volume: '80ml',
    description: '세라마이드·콜레스테롤·지방산 더블 캡슐로 100시간 보습력이 지속되는 크림',
    skinTypes: ['건성', '민감성'],
    tags: ['장벽크림', '캡슐보습', '100시간보습'],
    badges: ['올영 1위', '보습장벽 Top'],
    lowestPrice: 23800,
    previousPrice: 31000,
    priceDropAmount: 7200,
    priceDropRate: 23,
    source: 'oliveyoung',
    viewtyScore: 96,
    reasonItems: [
      '피부 장벽과 유사한 구조체의 세·콜·지 더블 캡슐 함유',
      '100시간 동안 이어지는 깊고 풍부한 속 보습력',
      '손상된 장벽 강화 자극 완화 테스트 완료',
      '끈적임 없이 스며드는 고보습 캡슐 크림'
    ],
    features: ['80ml', '더블보습캡슐', '피부 장벽 강화'],
    stores: [
      {
        name: '쿠팡',
        sellerSlug: 'coupang',
        price: 23800,
        url: 'https://www.coupang.com',
        isBest: true,
        isRocket: true,
        unitPrice: 297
      },
      {
        name: '올리브영',
        sellerSlug: 'oliveyoung',
        price: 24500,
        url: 'https://www.oliveyoung.co.kr',
        unitPrice: 306
      }
    ]
  }
];
