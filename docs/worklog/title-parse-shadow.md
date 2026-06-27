# 제목 파싱 shadow 비교 (READ-ONLY)

- 일자: 2026-06-27T07:04:24Z
- LLM: ON · gemini-3.1-flash-lite · prompt=v2-bonus-sum
- 대상 distinct 제목: 136 · LLM 채택: 64 · 실제 호출: 0 · 캐시 히트: 69
- route 분포: {"trivial-single":44,"needs-llm":69,"sheet":4,"clean-multipack":19}
- 불일치(old≠new): **25** / 136

> old = 기존 extractPackageFromTitle, new = parsePackage(게이트+LLM). count=개수, vol=본품용량(ml/g), H=heterogeneous, I=needsInspection.

## 🔴 불일치 — old vs new 결과가 다른 케이스 (검토 핵심) (25)
| 제목 | old(cnt/vol/H) | route·method·conf | new(cnt/vol/H/I) | 근거 |
|---|---|---|---|---|
| 메이크프렘 인테카 트러블 수딩 패드 70매, 1개 | 70/—/- | needs-llm·llm·high | 1/—/-/I | 70매 |
| [트러블 진정][+10매+앰플5ml] 비플레인 시카테롤 블레미쉬 패드 70매, 1개 | 70/—/- | needs-llm·llm·high | 1/80/-/- | 70매, [+10매] |
| [트러블/각질케어]메이크프렘 인테카 트러블 수딩 패드 70매 | 70/—/- | needs-llm·llm·high | 1/—/-/I | 70매 |
| [산뜻진정] 더랩바이블랑두 그린 플라보노이드 2.5 패드 90매 기획 (+12매) | 90/—/- | needs-llm·llm·high | 1/—/-/I | 90매 (+12매) |
| [흔적진정] 비플레인 시카테롤 블레미쉬 패드 80매 | 80/—/- | needs-llm·llm·high | 1/—/-/I | 80매 |
| [약알칼리성] 메이크프렘 세이프 미 아미노 리프레시 클렌징폼 150ml 기획 (+50ml) | 1/150/- | needs-llm·llm·high | 1/200/-/- | 150ml 기획 (+50ml) |
| [1등 쿨링진정패드] 에스네이처 아쿠아 오아시스 판테알란 카밍패드 60매 | 60/—/- | needs-llm·llm·high | 1/—/-/I | 60매 |
| [x2더블] 인터미션 레스트업 클렌징세럼 220mlX2 / 무향 저자극 약산성 클렌징젤 / 피 | 2/220/- | needs-llm·llm·high | 2/—/-/I | 220mlX2 |
| 메디힐 더마 토너 패드 티트리, 본품 100매, 1개 | 100/—/- | needs-llm·llm·high | 1/—/-/I | 본품 100매 |
| [포곤콜라보/장벽회복] 리얼베리어 익스트림 크림 70ml 기획 (+30ml+패딩백 키링) | 1/70/- | needs-llm·llm·high | 1/100/-/- | 70ml 기획 (+30ml) |
| 메디필 레드 락토 콜라겐 더블 타이트 패드 70매 모공패드 | 70/—/- | needs-llm·llm·high | 1/—/-/I | 70매 |
| [재입고] 에스네이처 아쿠아 오아시스 판테알란 카밍패드 60매 (190ml) | 60/—/- | needs-llm·llm·high | 1/60/-/- | 60매 (190ml) |
| 에스쁘아 비벨벳 커버 쿠션 13g + 퍼프 2p 세트 | 2/—/- | needs-llm·llm·high | 1/13/-/- | 에스쁘아 비벨벳 커버 쿠션 13g |
| 특대용량 메디큐브 레드 아크네 트러블 바디워시 3.0 비누향, 1L, 1개 | 1/—/- | needs-llm·llm·high | 1/1000/-/- | 1L, 1개 |
| [등드름 바디워시] 메디큐브 레드 아크네 바디워시 3.0 1L | 1/—/- | needs-llm·llm·high | 1/1000/-/- | 바디워시 3.0 1L |
| [장벽보습크림] 닥터지 더모이스처 배리어 D 인텐스 크림 100ml 기획 3종 | 1/100/- | needs-llm·llm·high | 1/—/H/I | 기획 3종 |
| [1등 세럼] 유세린 하이알루론 에피셀린 세럼 30ml 기획 (+에피셀린 세럼 7ml*2) | 1/30/- | needs-llm·llm·high | 1/44/-/- | 30ml 기획 (+에피셀린 세럼 7ml*2) |
| [기름종이쿠션/퍼프 3매 추가 증정 기획] 에스쁘아 비벨벳 세범컷 쿨링 쿠션 15.8g | 3/—/- | needs-llm·llm·high | 1/15.8/-/- | 에스쁘아 비벨벳 세범컷 쿨링 쿠션 15.8g |
| 에스쁘아 NEW 비벨벳 커버 쿠션 리필 13g SPF42 PA++ | 2/13/- | needs-llm·llm·high | 1/13/-/- | 리필 13g |
| [수분촉촉] 라운드랩 자작나무 수분 클렌저 150ml 기획 (+20ml) | 1/150/- | needs-llm·llm·high | 1/170/-/- | 150ml 기획 (+20ml) |
| [여행용 단독증정/저자극 촉촉] 일리윤 젠틀 딥 페이셜 클렌저 기획(250ML+30ML) | 1/—/- | needs-llm·llm·high | 1/280/-/- | 250ML+30ML |
| [1등 속광로션/단독기획] 온그리디언츠 스킨 베리어 카밍 로션 이엑스 220ml 기획 (+80 | 1/220/- | needs-llm·llm·high | 1/300/-/- | 220ml 기획 (+80ml) |
| [new] 닥터지 레드 블레미쉬 포 맨 토너/진정올인원 2종 기획 (+미니어처 2종) | 1/—/- | needs-llm·llm·high | 1/—/H/I | 2종 기획 (+미니어처 2종) |
| 어바웃미 쌀 막걸리 클렌징 오일_195ml | 1/—/- | trivial-single·regex·high | 1/195/-/- | 195ml |
| [탄력수분크림] 바이오던스 포어 퍼펙팅 콜라겐 펩타이드 크림 50ml 기획 (+10ml) | 1/50/- | needs-llm·llm·high | 1/60/-/- | 50ml 기획 (+10ml) |

## 🟢 일치 — 동일 결과 (111)
| 제목 | old(cnt/vol/H) | route·method·conf | new(cnt/vol/H/I) | 근거 |
|---|---|---|---|---|
| 일리윤 젠틀 딥 민감 피부 페이셜 클렌저 250ml | 1/250/- | trivial-single·regex·high | 1/250/-/- | 250ml |
| 메디큐브 PDRN 핑크 시카 수딩 토너 250ml X 2개 | 2/250/- | needs-llm·llm·high | 2/250/-/- | 250ml X 2개 |
| 니들리 마일드 효소 클렌징 파우더 60g | 1/60/- | trivial-single·regex·high | 1/60/-/- | 60g |
| 리얼베리어 익스트림 크림 마스크 10매 | 10/—/- | sheet·regex·high | 10/—/-/- | 10매 |
| [올인원 1+1] 미프 비타맥스 남자 남성 저자극 올인원 화장품 스킨 로션 본품 200ml | 2/200/- | needs-llm·regex·low | 2/200/-/I | 1+1 |
| 바이오가 등드름 바디워시 베타인살리실레이트 1000ml | 1/1000/- | trivial-single·regex·high | 1/1000/-/- | 1000ml |
| 불독 센시티브 쉐이브젤 175ml | 1/175/- | trivial-single·regex·high | 1/175/-/- | 175ml |
| [대용량] 바이오가 등드름 바디워시 베타인살리실레이트 1000ml 기획(+바디미스트 20ml) | 1/1000/- | needs-llm·llm·high | 1/1000/-/- | 1000ml 기획(+바디미스트 20ml) |
| BRTC 스킨랩 퓨리파잉 클렌징 오일 100ml | 1/100/- | trivial-single·regex·high | 1/100/-/- | 100ml |
| [1+1] 닥터지 레드 블레미쉬 수딩 업 선 스틱 21g (SPF50+/PA++++) | 2/21/- | needs-llm·regex·low | 2/21/-/I | [1+1 |
| 닥터지 레드 블레미쉬 포 맨 진정 올인원 | 1/—/- | trivial-single·regex·high | 1/—/-/- |  |
| 메이크프렘 세이프 미 아미노 리프레시 클렌징 밤 100ml, 1개 | 1/100/- | clean-multipack·regex·high | 1/100/-/- | 1개 |
| 닥터지 모이스처 인 바디 5.0 바디워시 500ml | 1/500/- | trivial-single·regex·high | 1/500/-/- | 500ml |
| 비플레인 시카테롤 블레미쉬 패드 185ml | 1/185/- | trivial-single·regex·high | 1/185/-/- | 185ml |
| 아비브 어성초 젤리 콜라겐 겔 마스크 10매입 | 10/—/- | sheet·regex·high | 10/—/-/- | 10매 |
| 더마비 세라엠디 리페어 크림 워시 무향, 400ml, 2개 | 2/400/- | clean-multipack·regex·high | 2/400/-/- | 2개 |
| [흔적말끔] 라운드랩 소나무 진정 시카 크림 플러스 60ml 기획 (+토너 20ml) | 1/60/- | needs-llm·llm·high | 1/60/-/- | 크림 플러스 60ml |
| 스타라이크 피디알엔 스킨 핏 수분 선 크림 SPF 50+ PA++++ | 1/—/- | trivial-single·regex·high | 1/—/-/- |  |
| 라운드랩 소나무 진정 시카 크림 플러스 60ml | 1/60/- | trivial-single·regex·high | 1/60/-/- | 60ml |
| 코스알엑스 더 세라마이드 스킨 베리어 모이스처라이저 / 장벽보습로션 80ml, 1개 | 1/80/- | clean-multipack·regex·high | 1/80/-/- | 1개 |
| 에뛰드 하우스 순정 약산성 5.5 진정 토너, 350ml, 1개 | 1/350/- | clean-multipack·regex·high | 1/350/-/- | 1개 |
| 조선미녀 스테이 프레쉬 톤업 선크림 퍼플 SPF50+ PA++++, 1개, 50ml | 1/50/- | needs-llm·llm·high | 1/50/-/- | 50ml |
| [듀이트리] 하이 아미노 모공 올 딥 클렌징 밤 90ml | 1/90/- | needs-llm·llm·high | 1/90/-/- | 90ml |
| [싱글] 에스트라 에이시카365 흔적진정세럼 pH4.5 40ml x 1개 | 1/40/- | needs-llm·llm·high | 1/40/-/- | 40ml x 1개 |
| [블랙화이트헤드세정] 듀이트리 하이 아미노 올 모공 딥 클렌징밤 90g | 1/90/- | needs-llm·llm·high | 1/90/-/- | 클렌징밤 90g |
| 메디힐 에센셜 마스크 티트리, 10매, 1개 | 10/—/- | needs-llm·llm·high | 10/—/-/I | 10매 |
| 리얼베리어 익스트림 크림 마스크 27ml | 1/27/- | trivial-single·regex·high | 1/27/-/- | 27ml |
| 바이오던스 포어 퍼펙팅 콜라겐 펩타이드 크림 50ml, 1개 | 1/50/- | clean-multipack·regex·high | 1/50/-/- | 1개 |
| 코스알엑스 더 세라마이드 스킨 베리어 모이스처라이징 미스트 120ml | 1/120/- | trivial-single·regex·high | 1/120/-/- | 120ml |
| 에스네이처 수퍼 아쿠아겔 오아시스 앰플 마스크 20매 | 20/—/- | sheet·regex·high | 20/—/-/- | 20매 |
| [수분충전/쿨링진정] 에스네이처 아쿠아 오아시스 수분 젤크림 90ml 기획 (+카밍패드 2매) | 1/90/- | needs-llm·llm·high | 1/90/-/- | 수분 젤크림 90ml |
| 닥터지 레드 블레미쉬 수딩업 선스틱 21g | 1/21/- | trivial-single·regex·high | 1/21/-/- | 21g |
| 유이크 바이옴 레미디 퍼펙트 보송 선스틱 | 1/—/- | trivial-single·regex·high | 1/—/-/- |  |
| 이니스프리 데일리 유브이 톤업 선크림 핑크 SPF50+ PA++++ | 1/—/- | trivial-single·regex·high | 1/—/-/- |  |
| 라운드랩 자작나무 수분 클렌저 150ml | 1/150/- | trivial-single·regex·high | 1/150/-/- | 150ml |
| 싸이닉 병풀 PDRN 시카 엔드 수딩 크림 80ml 2개 | 2/80/- | clean-multipack·regex·high | 2/80/-/- | 2개 |
| 바이오던스 포어 퍼펙팅 콜라겐 펩타이드 크림 | 1/—/- | trivial-single·regex·high | 1/—/-/- |  |
| [1+1] 닥터지 모이스처 인 바디 5.0 바디 워시 500mL | 2/500/- | needs-llm·regex·low | 2/500/-/I | [1+1 |
| 에스네이처 아쿠아 오아시스 토너 300ml | 1/300/- | trivial-single·regex·high | 1/300/-/- | 300ml |
| 닥터지 더모이스처 배리어디 인텐스 크림 | 1/—/- | trivial-single·regex·high | 1/—/-/- |  |
| [아이소이] 스킨케어 비건 쿠션 SPF38 PA++ 21호 (본품13g+리필 13g) | 2/13/- | needs-llm·llm·high | 2/13/-/- | 본품13g+리필 13g |
| Naver API match: 블라이드 인디언머드 팩투폼 모공수축 피지개선 얼음모공팩 2IN1 | 1/120/- | trivial-single·regex·high | 1/120/-/- | 120ml |
| 피지오겔 레드수딩 AI 페이셜 로션 200ml 민감피부장벽 진정 | 1/200/- | trivial-single·regex·high | 1/200/-/- | 200ml |
| 코스노리 판테놀 베리어 에멀전, 150ml, 1개 | 1/150/- | clean-multipack·regex·high | 1/150/-/- | 1개 |
| 후시다인 더마 트러블 징크 카밍 선크림 SPF50+ PA++++ | 1/—/- | trivial-single·regex·high | 1/—/-/- |  |
| 비플레인 녹두 모공 클리어링 라하 토너 | 1/—/- | trivial-single·regex·high | 1/—/-/- |  |
| [더블구성] 이즈앤트리 어니언 프레쉬 라이트 선스틱 22g SFP50 PA++++ 2개 | 2/22/- | needs-llm·llm·high | 2/22/-/- | 선스틱 22g 2개 |
| [광채세럼] 바이오힐보 NAD 프리즈셀 글로우 파워 세럼 30ml [단품/기획] | 1/30/- | needs-llm·llm·high | 1/30/-/- | 30ml |
| 아벤느 안티에이징 HAB3 탄력 액티브 세럼 | 1/—/- | trivial-single·regex·high | 1/—/-/- |  |
| 미샤 래디언스 퍼펙트핏 쿠션 15g | 1/15/- | trivial-single·regex·high | 1/15/-/- | 15g |
| 유이크 바이옴 레미디 퍼펙트 보송 선스틱 18g | 1/18/- | trivial-single·regex·high | 1/18/-/- | 18g |
| 코스알엑스 더 알파-알부틴 2 디스컬러레이션 케어 세럼 50ml, 1개 | 1/50/- | clean-multipack·regex·high | 1/50/-/- | 1개 |
| 닥터올가 약산성 어성초 등드름 바디워시 500ml 2개 | 2/500/- | clean-multipack·regex·high | 2/500/-/- | 2개 |
| 유세린 하이알루론 에피셀린 세럼 30ml | 1/30/- | trivial-single·regex·high | 1/30/-/- | 30ml |
| 닥터지 더모이스처 배리어.D 인텐스 크림 100mL | 1/100/- | trivial-single·regex·high | 1/100/-/- | 100mL |
| 라운드랩 소나무 진정 시카 크림 플러스 | 1/—/- | trivial-single·regex·high | 1/—/-/- |  |
| [단독기획] 토리든 다이브인 포맨 저분자 히알루론산 올인원 200g 더블 기획 | 2/200/- | needs-llm·llm·high | 2/200/-/- | 200g 더블 기획 |
| 조선미녀 스테이프레쉬 톤업 선크림 50ml, 1개 | 1/50/- | clean-multipack·regex·high | 1/50/-/- | 1개 |
| 파넬 시카마누 세럼쿠션 SPF45 PA++ 본품, 21호, 15g | 1/15/- | needs-llm·llm·high | 1/15/-/- | 15g |
| 1+1 몽디에스 쿨링 징크 무기자차 논나노 아기 유아 초등학생 키즈 백탁없는 간편 톡톡 선쿠션 | 2/14/- | needs-llm·regex·low | 2/14/-/I | 1+1 |
| VDL 커버스테인 하이커버 쿠션 13g (SPF35/ PA++) | 1/13/- | trivial-single·regex·high | 1/13/-/- | 13g |
| 마데카21 테카 토닝 크림 50ml, 3개 | 3/50/- | clean-multipack·regex·high | 3/50/-/- | 3개 |
| 에스네이처 아쿠아 오아시스 수분 젤크림 90ml 대용량 | 1/90/- | trivial-single·regex·high | 1/90/-/- | 90ml |
| 더마비 세라엠디 리페어 크림 워시 400ml | 1/400/- | trivial-single·regex·high | 1/400/-/- | 400ml |
| 몰바니 저자극 LHA 율피 젤 클렌저 200ml | 1/200/- | trivial-single·regex·high | 1/200/-/- | 200ml |
| 동화약품 후시다인 더마트러블 징크카밍 (SPF50+) 50ml, 2개 | 2/50/- | clean-multipack·regex·high | 2/50/-/- | 2개 |
| 브링그린 티트리 시카 딥 클렌징폼 120ml, 2개 | 2/120/- | clean-multipack·regex·high | 2/120/-/- | 2개 |
| 몰바니 율피 저자극 LHA 클렌징젤 200ml | 1/200/- | trivial-single·regex·high | 1/200/-/- | 200ml |
| 브링그린 블루빈 B5-PDRN 마일드 크림 100ml (+블루빈 로션 10ml 증정) | 1/100/- | trivial-single·regex·high | 1/100/-/- | 100ml |
| [고밀도효소거품] 브링그린 티트리 시카 딥클렌징폼 기획 (더블/대용량) | 1/—/- | needs-llm·llm·medium | 1/—/-/I | 대용량 |
| 에스트라 에이시카365 흔적진정세럼 pH4.5 40ml 기획 (+세럼 20ml+크림 1ml) | 1/40/- | needs-llm·llm·high | 1/40/-/- | 40ml 기획 |
| [투명미백] 880억/mL 글루타치온 플렉서블 리포좀 30ml, 1개 | 1/30/- | needs-llm·llm·high | 1/30/-/- | 30ml, 1개 |
| [잡티톤업] 퍼셀 880억/mL 글루타치온 플렉서블 리포좀 톤업앰플 20ml | 1/20/- | needs-llm·llm·high | 1/20/-/- | 톤업앰플 20ml |
| [아벤느] 히알루론 액티브 B3 안티에이징 세럼 30ml +부스트 10ml (탄력 액티브 세럼 | 1/—/H | needs-llm·llm·high | 1/—/H/I | 세럼 30ml +부스트 10ml |
| [모공앰플] 아벤느 HAB3 탄력 액티브 안티에이징 세럼 30ml (기획/단품) | 1/30/- | needs-llm·llm·high | 1/30/-/- | 세럼 30ml |
| 토니모리 그린티 수분 저자극 클렌징 오일 200ml, 1개 | 1/200/- | clean-multipack·regex·high | 1/200/-/- | 1개 |
| [속보습] 브링그린 블루빈 B5-PDRN 마일드 크림 100ml (+블루빈로션 10ml) | 1/100/- | needs-llm·llm·high | 1/100/-/- | 크림 100ml |
| 일리윤 젠틀 딥 페이셜 클렌저 | 1/—/- | trivial-single·regex·high | 1/—/-/- |  |
| [속광로션] 온그리디언츠 스킨 베리어 카밍 로션 이엑스 220ml, 1개 | 1/220/- | needs-llm·llm·high | 1/220/-/- | 220ml, 1개 |
| [흔적케어] 코스알엑스 더 알파 - 알부틴 세럼 50ml (펩타이드세럼 30ml증정) | 1/50/- | needs-llm·llm·high | 1/50/-/- | 알부틴 세럼 50ml |
| 피지오겔 레드수딩 AI 진정보습 로션 200ml | 1/200/- | trivial-single·regex·high | 1/200/-/- | 200ml |
| [1+1] 닥터지 레드 블레미쉬 포 맨 진정 올인원 150mL | 2/150/- | needs-llm·regex·low | 2/150/-/I | [1+1 |
| [듀이트리] AC 딥 장벽 진정 보습 앰플 60ml | 1/60/- | needs-llm·llm·high | 1/60/-/- | 앰플 60ml |
| [잡티앰플] 듀이트리 AC 딥 흔적 진정 앰플 60ml 기획 (+잡티패드 6매) | 1/60/- | needs-llm·llm·high | 1/60/-/- | 앰플 60ml 기획 |
| [더블구성] 이즈앤트리 체스트넛 바하 0.9% 클리어 토너 200ml 2EA (증정: 어니언  | 2/200/- | needs-llm·llm·high | 2/200/-/- | 토너 200ml 2EA |
| [속촉촉 진정토너] 에스네이처 아쿠아 오아시스 토너 300ml 기획 (+젤크림 30ml) | 1/300/- | needs-llm·llm·high | 1/300/-/- | 토너 300ml |
| [단독기획]인터미션 레스트업 세럼스킨 290ml | 1/290/- | needs-llm·llm·high | 1/290/-/- | 290ml |
| 스킨유 이노센트 샤워젤 딥머스크 | 1/—/- | trivial-single·regex·high | 1/—/-/- |  |
| 몽디에스 징크 유아 어린이 초등학생 무기자차 이지워시 선크림 SPF50 60ml, 2개 | 2/60/- | clean-multipack·regex·high | 2/60/-/- | 2개 |
| [화잘먹/24시간속보습] 스타라이크 PDRN 스킨 핏 수분 선크림 50ml | 1/50/- | needs-llm·llm·high | 1/50/-/- | 50ml |
| [아이돌선세럼/24시간지속] 아로셀 멜라 TXA 선세럼 40ml | 1/40/- | needs-llm·llm·high | 1/40/-/- | 40ml |
| [파데프리_김아영PICK] 이니스프리 데일리 UV 톤업 노세범 선크림 SPF 50+ PA+++ | 1/50/- | needs-llm·llm·high | 1/50/-/- | 50mL |
| [쿨톤광/필터톤업] 조선미녀 스테이프레쉬 톤업 선크림 50ml (퍼플/그린) | 1/50/- | needs-llm·llm·high | 1/50/-/- | 50ml (퍼플/그린) |
| [파데프리] 넘버즈인 3번 도자기결 톤업베이지 선크림 50ml 기획 2종 (블러/글로우) | 1/50/- | needs-llm·llm·high | 1/50/-/- | 기획 2종 (블러/글로우) |
| 넘버즈인 3번 도자기결 톤업베이지 블러 선크림 50ml(SPF50+), 1개 | 1/50/- | clean-multipack·regex·high | 1/50/-/- | 1개 |
| [흔적미백]메디큐브 PDRN 핑크 시카 수딩 토너 250ml | 1/250/- | needs-llm·llm·high | 1/250/-/- | 토너 250ml |
| [1+1/피지케어] 비플레인 녹두 모공 클리어링 라하 토너 265ml 기획 (+265ml 리필 | 2/265/- | needs-llm·llm·high | 2/265/-/- | 1+1, 265ml 기획 (+265ml 리필팩) |
| [모공비움 토너] 비플레인 녹두 모공 클리어링 라하 토너 265ml, 1개 | 1/265/- | needs-llm·llm·high | 1/265/-/- | 265ml, 1개 |
| [에뛰드] 순정 약산성 5.5 진정 토너 500ml, 1개 | 1/500/- | needs-llm·llm·high | 1/500/-/- | 순정 약산성 5.5 진정 토너 500ml |
| Naver official-store fallback (affiliate kept): 토리든  | 1/200/- | needs-llm·llm·high | 1/200/-/- | 200ml, 1개 |
| 더랩바이블랑두 그린 플라 진정 패드 90매 | 90/—/- | sheet·regex·high | 90/—/-/- | 90매 |
| 어바웃미 쌀 막걸리 클렌징 오일 195ml | 1/195/- | trivial-single·regex·high | 1/195/-/- | 195ml |
| 코스노리 판테놀 베리어 로션 에멀전 150ml, 1개 | 1/150/- | clean-multipack·regex·high | 1/150/-/- | 1개 |
| [10% 추가적립] 100만 유튜버 PICK! 아로셀 멜라 트라넥스 선 세럼 | 1/—/- | needs-llm·llm·high | 1/—/-/I | 아로셀 멜라 트라넥스 선 세럼 |
| 스킨유 이노센트 샤워젤 딥 머스크 | 1/—/- | trivial-single·regex·high | 1/—/-/- |  |
| 에스트라 에이시카365 흔적진정세럼 pH4.5 40ml | 1/40/- | trivial-single·regex·high | 1/40/-/- | 40ml |
| 닥터지 레드 블레미쉬 포 맨 진정 올인원, 150ml, 1개 | 1/150/- | clean-multipack·regex·high | 1/150/-/- | 1개 |
| 코스노리 판테놀 베리어 에멀전 | 1/—/- | trivial-single·regex·high | 1/—/-/- |  |
| 후시다인 더마 트러블 징크 카밍 선크림 SPF50+ PA++++, 50ml, 1개 | 1/50/- | clean-multipack·regex·high | 1/50/-/- | 1개 |
| 미프 비타맥스 남자 올인원 본품 200ml, 1+1개 | 2/200/- | needs-llm·llm·high | 2/200/-/- | 본품 200ml, 1+1개 |
| 조선미녀 스테이 프레쉬 톤업 선크림 퍼플 SPF50+ PA++++ | 1/—/- | trivial-single·regex·high | 1/—/-/- |  |
