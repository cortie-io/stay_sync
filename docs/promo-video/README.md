# stay-sync 홍보 영상 제작 자료

- [scenario.md](scenario.md): 씬별 시나리오(약 52초), 영상에 넣을 수 있는 사실 확인표, 촬영 전 확인 사항
- [ai-prompts.md](ai-prompts.md): AI 생성이 필요한 컷의 이미지·영상 프롬프트(P1~P8)와 씬 매핑

모든 캡처는 2026-09-28 실서비스(https://kbu.stay-sync.cortie.io)에서 찍었습니다.
- 데스크톱: 1920×1080 뷰포트, 1.5배 해상도 → 2880×1620
- 모바일: 390×844 뷰포트, 3배 해상도

## 폴더 구성

```
promo-video/
├── scenario.md, ai-prompts.md
├── reference/   기존 자료
├── captures/    실제 서비스 캡처(PNG)
│   └── video/   조작 과정 녹화(webm, 1080p)
├── graphics/    모션그래픽 소스(SVG + 미리보기 PNG)
└── logo/        로고·엔드카드(SVG + 미리보기 PNG)
```

## 파일 → 씬 매핑

| 씬 | 파일 | 내용 |
|---|---|---|
| S1 | `reference/S1_hero_site-image.png` | 사이트 메인 히어로 원본(1024²). AI 영상화 시작 프레임 (P1) |
| S1 | `captures/S1_home_hero_desktop.png` | 메인 첫 화면 (매치컷용) |
| S1·S8 | `captures/S1_home_full_desktop.png`, `captures/S1_home_mobile.png` | 메인 전체와 모바일 |
| S3 | `captures/S3_planner_empty_desktop.png` | 빈 플래너와 컨시어지 인사 |
| S3 | `captures/S3_chat_typing_desktop.png` | 첫 문장 입력 |
| S3 | `captures/S3_chat_companion-parsed_desktop.png` | "동행자 유형은 '연인'으로 저장했어요" |
| S3 | `captures/S3_chat_dates-parsed_desktop.png` | 체크인·체크아웃 정리와 야놀자 링크 |
| S4 | `graphics/S4_trend_3years_morning-calm.svg` (.png) | 아침고요수목원 월별 검색량 2023~2025. 연도별 레이어(`year-2023`…) |
| S4 | `captures/S4_region_ranking_gapyeong_desktop.png` | 가평 10월 인기 순위 |
| S4·S7 | `captures/S4_S7_attraction_detail_desktop_full.png` | 상세 전체: 소개, 이용시간, 요금, 사진, 월별 그래프, 주변 |
| S5 | `captures/S5_chat_recommend-cards_desktop.png` | 인기순 5 + 거리순 5 추천 카드 |
| S5 | `captures/S5_chat_cards_added_desktop.png` | 4곳 "담김" 상태 |
| S5 | `captures/S5_planner_selected_gapyeong_desktop.png` | 목록에서 4곳 선택(번호 1~4) |
| S6 | `captures/S6_planner_calculating_desktop.png` | 동선 계산 중 |
| S6 | `graphics/S6_road-network_gapyeong_route.svg` (.png) | 가평 실제 도로망과 결과 동선의 실제 도로 경로. 레이어 분리 |
| S6·S7 | `captures/S6_S7_planner_result_desktop.png` | 결과: 가평 1박 2일 코스, DAY1·DAY2, 카카오맵 버튼 (km 값은 scenario.md 확인 5 참고) |
| S7 | `captures/S7_attraction_detail_mobile_full.png` | 모바일 상세 전체 (스크롤 연출용 세로 이미지) |
| S3~S5 | `captures/video/S3-S5_chat_input-to-cards_1080p.webm` | 채팅 입력 → 추천 카드 녹화 |
| S5 | `captures/video/S5_chat_add-cards_1080p_ends-with-error.webm` | 카드 담기 녹화. **끝부분 오류 메시지는 잘라낼 것** |
| S5~S7 | `captures/video/S5-S7_planner_select-to-route_1080p.webm` | 목록 선택 → AI 상세 일정 결과 녹화 |
| S8 | `logo/S8_endcard_1920x1080.svg` (.png) | 엔드카드 (`wave`, `dot` 레이어로 애니메이션) |
| 공통 | `logo/stay-sync-logo-mark.svg`, `logo/stay-sync-logo-mark-white.svg` | 로고 마크 (밝은 배경용 / 어두운 배경용) |

## 사용 팁

- **SVG:** Illustrator에서 열어 AE로 가져오면 `id` 단위 레이어가 유지됩니다. 동선이나 라인에는 Trim Paths를 쓰세요.
- **webm:** 헤드리스 녹화라 마우스 커서가 없고 화질이 최종본용은 아닙니다. 타이밍 참고용으로 쓰고, 최종 녹화는 OBS 60fps로 다시 하세요. 데모 입력은 scenario.md 하단 참고.
- **라이선스:**
  - 관광지 사진: 한국관광공사 TourAPI 이미지입니다. 전체 화면으로 쓸 때는 공공누리 유형을 확인하세요.
  - 도로망: © OpenStreetMap contributors (영상 크레딧에 표기)
- **폰트:** Noto Serif KR, Noto Sans KR (Google Fonts, 무료)
- **브랜드 색상:** 차콜 `#34322f` · 딥 그린 `#4e6e61` · 밝은 그린 `#8fb5a4` · 회색 `#7a7874` · 배경 `#ffffff` / `#f7f6f3`
