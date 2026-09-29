# AI 생성 프롬프트 (stay-sync 홍보 영상)

> 씬 번호는 [scenario.md](scenario.md) 기준입니다. 실제 서비스 화면은 AI로 만들지 말고 `captures/`의 실제 캡처를 쓰세요.
> 권장 워크플로: 이미지 생성(Midjourney / Runway Frames / Imagen 등) → Runway Image-to-Video (Gen-4, 5초)

## 공통 규칙

- **비율:** 16:9 (Midjourney는 `--ar 16:9`)
- **스타일 고정 문구:** 모든 이미지 프롬프트 끝에 붙이세요. 컷끼리 색감이 맞고 브랜드 딥 그린과 어울립니다.
  ```
  cinematic, shot on ARRI Alexa, 35mm lens, natural soft light, muted green and warm earth tones, subtle film grain, photorealistic, 16:9
  ```
- **공통 네거티브:**
  ```
  text, watermark, logo, signage, distorted hands, extra fingers, deformed face, oversaturated, cartoon, 3d render look
  ```
- AI 풍경은 실제 특정 장소가 아닙니다. 자막에 "가평 ○○" 같은 **실제 지명을 붙이지 마세요.**
- 인물 일관성: P7과 P8을 같은 인물로 가려면 P7 결과 이미지를 Runway References(또는 Midjourney `--cref`)에 넣으세요.

---

## P1. S1 인트로 · 경기북부 전경 (5초)

**방법 A (권장): 사이트 히어로 이미지 재사용**

`reference/S1_hero_site-image.png`는 사이트 메인과 같은 이미지라, 영상 첫 컷과 사이트가 매치컷으로 이어집니다. 1024×1024 정사각형이라 먼저 16:9로 확장하세요.

- 확장 (Runway Expand / Photoshop Generative Expand):
  ```
  Extend the scene naturally to the left and right: more layered autumn mountains, continuing forest and mist, same lighting and color
  ```
- Runway 모션 (5초, 모션 강도 낮게):
  ```
  Slow smooth drone pull-back and gentle rise, morning mist drifting across the lake, soft sunlight slowly spreading over the ridgelines, calm and majestic, no cuts
  ```

**방법 B: 새로 생성 (계절을 바꾸고 싶을 때)**

- 이미지:
  ```
  Aerial drone view at dawn over a winding river valley in northern Gyeonggi, South Korea, layered forested mountains, thin morning mist floating over the water, first golden sunlight on the ridgelines, a small road curving along the riverbank
  ```
- 모션은 방법 A와 같습니다.

## P2. S2 문제 제기 · 정보 과부하에 지친 여행자 (5초)

- 이미지:
  ```
  Young Korean woman in her 20s sitting on a sofa at night, lit only by her smartphone screen, scrolling with a tired, overwhelmed expression, laptop open beside her with many browser tabs, dim cozy apartment, shallow depth of field, phone screen facing away from camera
  ```
- Runway 모션:
  ```
  Slow push-in toward her face, her thumb keeps scrolling, she sighs and slightly lowers the phone, subtle flicker of screen light on her face
  ```
- 합성용 카드(블로그·릴스·AD)는 AI로 만들지 말고 AE에서 **가짜 템플릿**으로 만드세요. 실제 블로그나 브랜드 캡처는 저작권 문제가 있습니다.
- 선택: 흐린 썸네일 소스가 필요하면 아래로 생성하세요.
  ```
  Grid of generic travel photo thumbnails, cafes, mountains, lakes, food, blurred and slightly out of focus, social media feed aesthetic, no text
  ```

## P3. S3 (선택) · 조건 해석 배경

UI 캡처 뒤에 깔 추상 배경입니다. 없어도 됩니다.
```
Minimal abstract background, soft off-white paper texture, a few thin deep-green lines connecting small glowing nodes like a constellation, lots of negative space, elegant editorial style
```

## P4. S4 (선택) · 데이터 코어 배경

`graphics/S4_trend_3years_morning-calm.svg`의 실제 추이 라인을 이 위에 얹으세요.
```
Abstract minimal data visualization background, thin glowing deep-green lines converging into a soft luminous core, floating tiny particles, off-white paper-textured background, elegant editorial style, lots of negative space
```
- 사이트 톤(화이트와 세리프)에 맞추려고 일부러 **밝은 배경**입니다. 다크 블루로 가면 서비스 캡처와 톤이 튑니다.

## P5. (예비) · 날씨 인서트

날씨 연동이 고쳐졌을 때만 S4에 씁니다.
```
Close-up of rain drops falling on a calm lake surface surrounded by misty green mountains, overcast soft light, moody and calm
```

## P6. S6 도입 · 3D 지형 무드 (2초)

- 이미지:
  ```
  Top-down aerial view of mountainous terrain with a river winding through valleys at blue hour, road network faintly glowing as thin light lines following the terrain, 3D relief map feel, calm and precise
  ```
- Runway 모션:
  ```
  Slow top-down camera descent, the road lines gently brighten one by one
  ```
- **주의:** AI가 그린 도로는 실제 도로가 아닙니다. 처음 1~2초 무드용으로만 쓰고, 곧바로 `graphics/S6_road-network_gapyeong_route.svg`(실제 OSM 도로망)로 크로스페이드하세요.

## P7. S7 교차 편집 · 폰을 보며 웃는 커플 (2~3초)

- 이미지:
  ```
  Korean couple in their 20s sitting in a parked car by a lakeside road, the woman holding a smartphone and showing it to the man, both smiling, warm afternoon light through the windshield, autumn trees outside, side angle, phone screen facing away from camera
  ```
- Runway 모션:
  ```
  Gentle handheld feel, the man leans in to look at the phone and nods with a smile, natural subtle movement
  ```
- 폰 화면 클로즈업은 AI로 만들지 마세요. `captures/S7_attraction_detail_mobile_full.png`를 폰 목업에 합성하세요.

## P8. S8 아웃트로 · 노을 전망대 (4초)

- 이미지:
  ```
  Back view of a young Korean couple standing at a wooden observation deck at sunset, overlooking a calm lake surrounded by layered mountains, warm golden-orange sky, silhouettes, the woman pointing at the horizon, peaceful and emotional
  ```
- Runway 모션:
  ```
  Slow dolly forward past the couple toward the sunset horizon, soft lens flare, gentle breeze in their hair, then a very slow fade
  ```
- 친구 여행 버전: `a young Korean couple` → `three friends in their 20s`

## (선택) 폰 목업

S7 모바일 화면을 합성할 폰 프레임이 필요하면 아래로 생성하세요.
```
Hand holding a modern smartphone vertically against a soft blurred autumn background, screen is pure flat green (#00FF00) for chroma key, natural light, shallow depth of field
```
- 크로마키로 화면을 빼고 `captures/S7_attraction_detail_mobile_full.png`를 넣으면 됩니다.

---

## 씬별 자료 매핑 요약

| 씬 | AI 프롬프트 | 실제 캡처·그래픽 |
|---|---|---|
| S1 | P1 | `reference/S1_hero_site-image.png`, `captures/S1_home_hero_desktop.png` |
| S2 | P2 (+ 카드는 AE) | – |
| S3 | P3 (선택) | `captures/S3_*`, `captures/video/S3-S5_chat_input-to-cards_1080p.webm` |
| S4 | P4 (선택), P5 (예비) | `graphics/S4_trend_3years_morning-calm.svg`, `captures/S4_*` |
| S5 | – | `captures/S5_*`, `captures/video/S5_chat_add-cards_*.webm` |
| S6 | P6 | `graphics/S6_road-network_gapyeong_route.svg`, `captures/S6_*` |
| S7 | P7, 폰 목업 | `captures/S6_S7_planner_result_desktop.png`, `captures/S7_attraction_detail_mobile_full.png` |
| S8 | P8 | `logo/S8_endcard_1920x1080.svg`, `logo/stay-sync-logo-mark*.svg` |
