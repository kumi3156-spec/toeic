# 회독 TOEIC

폰 브라우저에서 쓰는 개인용 토익 영단어 회독 앱입니다. 한 챕터 안에서 모르는 단어가 없어질 때까지 반복해서 봅니다.

- 단어 5,001개 · 167챕터 · 난이도 4단계 (`public/data/toeic_vocab_chapters.json`)
- 서버 없는 정적 사이트 (Vite + React + TypeScript)
- 학습 기록은 브라우저 localStorage에 저장, JSON으로 내보내기/불러오기
- PWA: 홈 화면에 추가 가능, 오프라인 동작 (단어 데이터와 폰트까지 미리 저장)

## 사용법

| 동작 | 방법 |
| --- | --- |
| 알고있음 | 오른쪽 버튼 또는 카드를 오른쪽으로 스와이프 (PC: →) |
| 모르겠음 | 왼쪽 버튼 또는 카드를 왼쪽으로 스와이프 (PC: ←) |
| 다음 | "다음" 버튼, 알고있음 뒤에는 화면 탭 (PC: Space / Enter) |
| 되돌리기 | 오른쪽 위 ↶ 버튼, 직전 답 1개 취소 (PC: Z) |
| 발음 | 단어 아래 스피커 버튼, 설정에서 자동 발음 켜기 |

**회독 방식**

1. 챕터를 시작하면 단어 전체를 섞어서 대기열을 만듭니다.
2. **알고있음**을 누른 단어는 이번 회독에서 다시 나오지 않습니다.
3. **모르겠음**을 누른 단어는 이번 바퀴의 남은 단어 뒤로 갑니다.
4. 한 바퀴가 끝나면 남은 모르겠음 단어들을 다시 섞어서 다음 바퀴를 시작합니다 ("2바퀴째 · 남은 단어 8개"). 직전에 본 단어가 바로 다시 나오지는 않습니다.
5. 남은 단어가 없으면 챕터 완료, 회독 수 +1. 학습 도중 앱을 닫아도 그대로 이어집니다.

## 개발

Node.js 20 이상이 필요합니다.

```bash
npm install
npm run dev        # http://localhost:5173/toeic/
npm test           # 회독 로직 단위 테스트 (Vitest)
npm run build      # dist/ 에 정적 파일 생성
npm run preview    # 빌드 결과 확인 (http://localhost:4173/toeic/)
```

폰에서 개발 서버를 보려면 PC와 폰을 같은 Wi-Fi에 연결하고 `npm run dev -- --host`로 실행한 뒤, 터미널에 나오는 `Network:` 주소로 접속하세요. 서비스 워커(오프라인)는 `npm run build` 결과에서만 동작합니다.

### 폴더 구조

```
public/
  data/toeic_vocab_chapters.json   단어 데이터 (앱 시작 시 fetch)
  favicon.svg, pwa-*.png           아이콘
src/
  core/session.ts                  회독 로직 (순수 함수) + session.test.ts
  storage/progress.ts              학습 기록 저장/검증/내보내기 + 테스트
  data/vocab.ts                    데이터 타입, 로딩, 품사 한글 표시
  lib/                             해시 라우터, 발음(Web Speech API), 예문 강조
  app/actions.ts                   세션과 기록을 함께 갱신하는 동작
  screens/                         Home, Study, Complete, Weak(자주 틀리는 단어), Settings
  styles.css                       스타일 (다크 모드는 시스템 설정 따라감)
```

## GitHub Pages 배포

`vite.config.ts`의 `base`는 기본값이 `/toeic/`입니다 (`https://<사용자>.github.io/toeic/`). 저장소 이름이 다르면 `BASE_PATH` 환경변수로 바꿀 수 있습니다. GitHub Actions 워크플로는 저장소 이름을 자동으로 사용합니다.

### 방법 1: GitHub Actions (권장)

1. 이 코드를 `main` 브랜치에 올립니다.
2. GitHub 저장소 → **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 바꿉니다.
3. `main`에 push할 때마다 `.github/workflows/deploy.yml`이 테스트 → 빌드 → 배포를 실행합니다. (Actions 탭에서 수동 실행도 가능)
4. 몇 분 뒤 `https://<사용자>.github.io/toeic/`에서 열립니다.

> 무료 계정에서는 GitHub Pages를 쓰려면 저장소가 public이어야 합니다.

### 방법 2: 직접 빌드해서 올리기

```bash
npm run build
# dist/ 폴더 내용을 gh-pages 브랜치에 올리고, Settings → Pages에서 Source를 해당 브랜치로 지정
npx gh-pages -d dist
```

### 업데이트

새 버전을 배포하면 앱을 다시 열 때 서비스 워커가 자동으로 새 버전을 받습니다. 바로 반영되지 않으면 앱을 완전히 닫았다가 다시 여세요. 학습 기록은 localStorage에 있어서 업데이트해도 유지됩니다.

## 폰 홈 화면에 추가

배포된 주소를 폰 브라우저로 한 번 연 뒤:

- **iPhone (Safari)**: 아래쪽 공유 버튼 → **홈 화면에 추가** → 추가
- **Android (Chrome)**: 오른쪽 위 ⋮ 메뉴 → **홈 화면에 추가** (또는 **앱 설치**) → 설치

홈 화면 아이콘으로 열면 주소창 없이 앱처럼 실행되고, 한 번 연 뒤에는 오프라인에서도 동작합니다.

> 주의: iPhone에서는 Safari와 홈 화면 앱이 저장소를 따로 씁니다. 홈 화면에 추가한 뒤에는 홈 화면 앱에서만 공부하세요. 옮길 때는 설정 → 기록 백업의 내보내기/불러오기를 사용하세요.

## 학습 기록 백업

설정 → **기록 백업**에서

- **내보내기**: `hoedok-backup-YYYY-MM-DD.json` 파일 저장 (회독 수, 진행 중 학습, 단어별 틀린 횟수, 설정)
- **불러오기**: 백업 파일을 골라 현재 기록을 덮어씀 (확인 창이 뜸)

브라우저 데이터를 지우면 기록도 지워지니 가끔 내보내기를 해 두세요.
