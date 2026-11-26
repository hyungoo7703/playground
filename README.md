
## 📄 오픈소스 및 라이선스 고지 (Open Source Notice)

이 프로젝트는 다음의 오픈소스 소프트웨어를 사용하여 제작되었으며, 각 라이선스를 준수합니다.

### 사용된 라이브러리 및 도구
*   **Svelte**: [MIT License](https://github.com/sveltejs/svelte/blob/main/LICENSE.md) - Copyright (c) 2016-2024 Rich Harris and contributors
*   **Tailwind CSS**: [MIT License](https://github.com/tailwindlabs/tailwindcss/blob/master/LICENSE) - Copyright (c) Tailwind Labs, Inc.
*   **Vite**: [MIT License](https://github.com/vitejs/vite/blob/main/LICENSE) - Copyright (c) 2019-present Yuxi (Evan) You and Vite contributors
*   **Svelte Routing**: [MIT License](https://github.com/EmilTholin/svelte-routing/blob/master/LICENSE) - Copyright (c) 2018 Emil Tholin

### 에셋 및 리소스
*   **Icons**: [Heroicons](https://heroicons.com/) (MIT License) - SVG 코드를 직접 사용
*   **Emojis**: Standard Unicode Emojis (System fonts)
*   **Fonts**: 웹 안전 폰트(Sans-serif) 및 시스템 기본 폰트 사용 (별도 폰트 파일 배포 없음)

### 게임(룬 가디언) 이미지: AI 생성물
`public/images/rune`의 모든 이미지는 **Google Gemini로 생성한 AI 생성 이미지**입니다.

*   사람이 그린 그림이나 다른 게임·작품의 이미지를 가져다 쓴 것이 없습니다. 프롬프트에도 특정 작품, 캐릭터, 작가의 이름을 쓰지 않았습니다.
*   생성 뒤에 한 가공은 배경 제거, 잘라내기, 크기 조정, WebP 변환뿐입니다.
*   타이틀·배경·아이콘처럼 그림 전체를 쓰는 이미지에는 Gemini가 넣은 표식(오른쪽 아래 ✦)을 지우지 않고 그대로 두었습니다. Gemini는 생성 이미지에 눈에 보이지 않는 SynthID 워터마크도 넣는데, 위 가공 뒤에도 남아 있는지는 확인하지 않았습니다.
*   게임의 규칙(무작위 소환, 조합, 순환 트랙 방어)은 장르의 일반적인 방식이며, 유닛·적·이름·그림은 이 프로젝트를 위해 새로 만든 것입니다.

### 게임(룬 가디언) 사운드: Pixabay
`public/sound`의 모든 효과음과 음악은 [Pixabay](https://pixabay.com/)에서 받은 것이며 [Pixabay Content License](https://pixabay.com/service/license-summary/)를 따릅니다.

*   이 라이선스는 출처 표시 없이 무료로 쓰는 것을 허용합니다. 아래 표는 의무가 아니라 제작자에 대한 예의와 추적을 위해 적은 것입니다.
*   파일 이름은 받은 그대로입니다. 게임이 앞부분만 쓰는 17개는 쓰는 길이에 맞춰 뒷부분을 잘라냈습니다(다시 인코딩하지 않고 잘라내기만 했습니다). 나머지 12개는 받은 그대로입니다. 어느 파일을 얼마나 잘랐는지는 아래 표에 있습니다.
*   **이 음원들은 이 앱 안에서 쓰기 위해 포함된 것입니다.** Pixabay Content License는 음원을 그 자체로(Standalone) 재배포하거나 판매하는 것을 금지하므로, 이 저장소에서 음원 파일만 따로 떼어 재배포·판매할 수 없습니다. 쓰려면 Pixabay에서 직접 받아 주세요.
*   각 음원의 권리는 Pixabay와 해당 제작자에게 있으며, 이 저장소의 코드에 적용되는 조건과는 별개입니다.

| 파일 | Pixabay 제작자 | Pixabay ID | 가공 |
|---|---|---|---|
| `54427377-sword-slash-476148.mp3` | 54427377 | 476148 | 뒷부분 잘라냄 (4.6초 → 1.0초) |
| `alexis_gaming_cam-alarme-342932.mp3` | alexis_gaming_cam | 342932 | 받은 그대로 |
| `breakzstudios-epic-cinematic-reveal-logo-201065.mp3` | breakzstudios | 201065 | 뒷부분 잘라냄 (12.1초 → 6.5초) |
| `calango_fx_official-game-over-401236.mp3` | calango_fx_official | 401236 | 받은 그대로 |
| `daviddumaisaudio-magical-spell-cast-190272.mp3` | daviddumaisaudio | 190272 | 받은 그대로 |
| `djartmusic-many-arrows-flying-by-306037.mp3` | djartmusic | 306037 | 뒷부분 잘라냄 (6.0초 → 1.5초) |
| `dragon-studio-angel-choir-463220.mp3` | dragon-studio | 463220 | 뒷부분 잘라냄 (18.3초 → 4.5초) |
| `dragon-studio-deep-sea-monster-roar-329857.mp3` | dragon-studio | 329857 | 뒷부분 잘라냄 (6.5초 → 2.5초) |
| `dragon-studio-epic-dragon-roar-364481.mp3` | dragon-studio | 364481 | 받은 그대로 |
| `dragon-studio-epic-spell-impact-478364.mp3` | dragon-studio | 478364 | 뒷부분 잘라냄 (2.1초 → 1.1초) |
| `dragon-studio-heavenly-choir-515273.mp3` | dragon-studio | 515273 | 뒷부분 잘라냄 (18.3초 → 7.5초) |
| `dragon-studio-ice-spell-impact-448563.mp3` | dragon-studio | 448563 | 뒷부분 잘라냄 (4.7초 → 1.4초) |
| `dragon-studio-lightning-spell-386163.mp3` | dragon-studio | 386163 | 받은 그대로 |
| `emand_edroff-fairy-dust-magical-chime-576279.mp3` | emand_edroff | 576279 | 뒷부분 잘라냄 (13.2초 → 3.5초) |
| `freesound_community-anvil-hit-1-103967.mp3` | freesound_community | 103967 | 받은 그대로 |
| `freesound_community-anvil-hit-2-14845.mp3` | freesound_community | 14845 | 받은 그대로 |
| `freesound_community-bow_release-85040.mp3` | freesound_community | 85040 | 받은 그대로 |
| `freesound_community-fizzle-101872.mp3` | freesound_community | 101872 | 뒷부분 잘라냄 (3.8초 → 2.0초) |
| `freesound_community-missile-45075.mp3` | freesound_community | 45075 | 뒷부분 잘라냄 (4.6초 → 2.0초) |
| `kave_msri-war-horn-sfx-319881.mp3` | kave_msri | 319881 | 뒷부분 잘라냄 (15.5초 → 3.5초) |
| `koiroylers-fireball-impact-351961.mp3` | koiroylers | 351961 | 뒷부분 잘라냄 (3.1초 → 1.4초) |
| `koiroylers-small-riser-351977.mp3` | koiroylers | 351977 | 받은 그대로 |
| `openmindaudio-cinematic-action-epic-trailer-iron-vanguard-part-1-short-preview-488562.mp3` | openmindaudio | 488562 | 받은 그대로 |
| `pwlpl-power-up-game-sound-effect-359227.mp3` | pwlpl | 359227 | 뒷부분 잘라냄 (8.1초 → 2.1초) |
| `rescopicsound-elemental-magic-spell-impact-outgoing-228342.mp3` | rescopicsound | 228342 | 뒷부분 잘라냄 (3.2초 → 1.2초) |
| `shidenbeatsmusic-sound-effect-twinklesparkle-115095.mp3` | shidenbeatsmusic | 115095 | 받은 그대로 |
| `universfield-magic-spell-278824.mp3` | universfield | 278824 | 뒷부분 잘라냄 (5.9초 → 2.0초) |
| `universfield-magic-teleport-whoosh-352764.mp3` | universfield | 352764 | 뒷부분 잘라냄 (3.1초 → 1.7초) |
| `universfield-victory-fanfare-152480.mp3` | universfield | 152480 | 받은 그대로 |
