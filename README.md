# 결정의 집

텔레그램과 웹으로 인테리어 자료를 모으고, 부부가 함께 검토해 실제 작업 요청으로 만드는 모바일 우선 칸반 서비스입니다.

- 저장소: <https://github.com/ian939/interior-decision-board>
- 웹: <https://ian939.github.io/interior-decision-board/> — 운영 API 도메인 연결 전에는 데이터 기능이 오프라인입니다.

## 현재 구현 범위

- 두 사용자 로그인과 비밀번호 해시 저장
- `결정 필요 → 확인 중 → 보완/승인 → 반영 요청`, 어느 단계에서든 드롭
- 확인 중 이동 시 공간 필수 지정
- URL·파일 직접 등록
- YouTube, Reels, 블로그, 쇼핑몰, 일반 웹 자동 분류
- 메타데이터·썸네일 수집, 공개 Reels의 `yt-dlp` 보조 추출, 로컬 Claude CLI 요약
- 댓글과 사용자별 좋아요/별로예요/보류
- 보완 URL·파일 첨부와 Claude 비교 초안
- 한 사람 승인 및 승인 이력
- 공간별 작업 요청, 완료 표시, Markdown/CSV 내보내기
- Telegram 전용 봇 개인 채팅 장기 폴링
- SQLite, 로컬 파일 저장, 순환 백업
- GitHub Pages 자동 배포 워크플로
- Windows 로그인 시 로컬 서버·터널 자동 실행 및 일일 백업 예약 스크립트

## 구조

```text
GitHub Pages (React/Vite)
        │ HTTPS
        ▼
집 PC의 Fastify API ── SQLite + uploads
        ├─ Claude CLI 작업 큐
        └─ Telegram Bot 장기 폴링
```

AI 모델 API나 SDK는 사용하지 않습니다. 서버는 로컬에 로그인된 Claude CLI를 제한 모드, 도구 비활성화, 세션 미보존 옵션으로 실행합니다.

## 요구 사항

- Node.js 24 이상
- npm
- 로그인된 Claude CLI
- `yt-dlp`와 FFmpeg
- Git과 GitHub CLI
- 운영 외부 접속 시 `cloudflared`

## 로컬 시작

```powershell
npm install
powershell -ExecutionPolicy Bypass -File scripts/setup.ps1
npm run dev
```

- 웹: `http://127.0.0.1:5173`
- API 상태: `http://127.0.0.1:8787/api/health`

`setup.ps1`은 두 비밀번호와 선택적인 Telegram/터널 정보를 한 번에 받고, Git에서 제외된 `.env`를 만듭니다. 비밀번호는 첫 실행 때만 사용자 생성에 쓰이며 SQLite에는 scrypt 해시만 저장됩니다.

## 검증

```powershell
npm test
npm run typecheck
npm run build
$env:E2E_OWNER_PASSWORD = '설정한 본인 비밀번호'
npm run test:e2e
Remove-Item Env:E2E_OWNER_PASSWORD
npm audit
```

E2E는 설치된 Chrome을 사용하며 `.tmp/e2e`에 로그인·칸반·카드 상세·모바일 화면을 저장합니다.

## Telegram 연결

1. Telegram의 `@BotFather`에서 봇을 만든다.
2. 본인과 배우자의 numeric Telegram user ID를 확인한다.
3. `.env`에 `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_ID`, `TELEGRAM_PARTNER_ID`를 설정한다.
4. 서버를 재시작하고 두 사람이 봇 개인 채팅에 `/start`를 보낸다.

허용된 두 Telegram ID의 메시지만 처리합니다. URL이 여러 개인 메시지는 URL별 카드로 만들며, 사진과 문서도 등록할 수 있습니다.

## GitHub Pages 배포

1. 저장소 Settings → Pages의 Source를 `GitHub Actions`로 설정한다.
2. 저장소 Settings → Secrets and variables → Actions → Variables에 `API_BASE_URL`을 추가한다.
3. 값은 로컬 API의 공개 주소에 `/api`를 붙인 주소다. 예: `https://api.example.com/api`
4. `main` 브랜치에 푸시하면 [`.github/workflows/pages.yml`](.github/workflows/pages.yml)이 웹을 배포한다.

코드 저장소는 공개해도 되지만 `.env`, SQLite, 업로드와 백업은 `.gitignore`로 제외됩니다.

## 외부 HTTPS와 자동 시작

운영에는 주소가 바뀌는 Quick Tunnel 대신 고정 주소의 Cloudflare Named Tunnel 또는 동등한 구성이 필요합니다. 터널을 만든 뒤 이름을 `.env`의 `INTERIOR_TUNNEL_NAME`에 넣습니다.

프로덕션 빌드 후 Windows 시작 작업을 등록할 수 있습니다.

```powershell
npm run build
powershell -ExecutionPolicy Bypass -File scripts/install-startup.ps1
```

이 명령은 로그인 시 서버·터널 시작 작업과 매일 오전 3시 백업 작업을 등록합니다. Windows 예약 작업을 변경하므로 실제 운영 정보가 모두 정해진 뒤 실행합니다.

## 백업

```powershell
npm run backup
```

`backups/<timestamp>`에 SQLite 스냅샷과 업로드 파일을 복사하며, 기본값은 최근 14개 보존입니다. `scripts/install-startup.ps1`이 매일 오전 3시 실행도 함께 등록합니다.

## 폴더

- `apps/web`: React/Vite 웹앱
- `apps/server`: Fastify, SQLite, Claude 작업 큐, Telegram 리스너
- `packages/shared`: 상태·타입·검증 계약
- `scripts`: 설정, E2E, 백업, 자동 시작
- `docs`: 제품 계획과 기술 검증 결과
- `spikes/phase0`: 초기 기술 검증 도구

## 알려진 제한

- 공개 Reels는 `yt-dlp`로 제목·설명·썸네일을 보조 추출합니다. 비공개·로그인 제한·플랫폼 변경으로 추출이 실패하면 원문 링크와 사용자 메모, 직접 첨부한 이미지로 검토합니다.
- 제공된 YouTube Shorts에는 자막 트랙이 없어서 제목·공개 메타데이터를 사용합니다. 자막이 있는 영상은 후속 확장으로 본문 품질을 높일 수 있습니다.
- 집 PC나 터널이 꺼지면 GitHub Pages 화면은 열리지만 카드 데이터 기능은 오프라인입니다.
- Node 24의 내장 SQLite는 현재 실행 시 experimental 경고를 출력할 수 있습니다. 테스트와 실제 통합 흐름은 정상 통과했습니다.
- Telegram 토큰, 운영 도메인과 GitHub Pages 주소는 사용자 소유 정보라 저장소에 포함하지 않습니다.
