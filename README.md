# 결정의 집

텔레그램과 웹으로 인테리어 자료를 모으고, 부부가 함께 검토해 실제 작업 요청으로 만드는 모바일 우선 칸반 서비스입니다.

- 저장소: <https://github.com/ian939/interior-decision-board>
- 웹: <https://ian939.github.io/interior-decision-board/> — 최초 로컬 설정과 Quick Tunnel 시작 전에는 데이터 기능이 오프라인입니다.

## 현재 구현 범위

- 두 사용자 로그인과 비밀번호 해시 저장
- `결정 필요 → 확인 중 → 보완/승인 → 반영 요청`, 어느 단계에서든 드롭
- 확인 중 이동 시 공간 필수 지정
- URL·파일 직접 등록
- 카드 삭제 시 댓글·보완 자료·반영 요청·업로드 파일 함께 정리
- YouTube, Reels, 블로그, 쇼핑몰, 일반 웹 자동 분류
- 메타데이터·썸네일 수집, 공개 Reels의 `yt-dlp` 보조 추출, 로컬 Claude CLI 요약
- 댓글과 사용자별 좋아요/별로예요/보류
- `우리의 이야기`에 의견과 함께 이미지 또는 이미지만 등록
- 보완 URL·파일 첨부와 Claude 비교 초안
- 한 사람 승인 및 승인 이력
- 공간별 작업 요청, 완료 표시, Markdown/CSV 내보내기
- 도면 2종, 공사 포인트, 디자인 콘셉트와 기존 상세 아이디어 18장을 모은 프로젝트 자료실
- 원본 이미지를 바탕으로 다시 그린 벡터 도면과 외곽·구간 치수선, 원본 겹쳐보기
- 도면 외곽 `12,000 × 12,550mm` 기준의 2D 배치 실험실: 가구 실치수·회전·겹침·사방 통로 여유, A/B안 공유 저장
- Telegram 전용 봇 개인 채팅 장기 폴링
- SQLite, 로컬 파일 저장, 순환 백업
- GitHub Pages 자동 배포 워크플로
- Windows 로그인 시 로컬 서버·터널 자동 실행 및 오전 3시 이후 일일 백업

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

기존 사용자 생성 후 `.env`의 `OWNER_PASSWORD` 또는 `PARTNER_PASSWORD`를 바꿨다면 아래 명령으로 새 값을 SQLite 계정에 다시 해시해 반영한 뒤 서비스를 재시작합니다.

```powershell
npm run sync-passwords
```

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

E2E는 설치된 Chrome을 사용하며 `.tmp/e2e`에 로그인·칸반·카드 상세·도면·배치 실험실·모바일 화면을 저장합니다.

## Telegram 연결

1. Telegram의 `@BotFather`에서 봇 토큰을 새로 발급한다.
2. Telegram을 사용할 사람이 봇 개인 채팅에서 `/start`를 보낸다. 본인만 연결해도 된다.
3. `powershell -ExecutionPolicy Bypass -File scripts/configure-telegram-users.ps1`을 실행한다.
4. 새 토큰을 숨김 입력하고 화면에 표시된 본인의 numeric ID를 선택한다. 배우자가 Telegram을 사용하지 않으면 배우자 ID 입력은 Enter로 건너뛴다. 서비스는 자동 재시작된다.

허용된 Telegram ID의 메시지만 처리합니다. URL이 여러 개인 메시지는 URL별 카드로 만들며, 사진과 문서도 등록할 수 있습니다.

## GitHub Pages 배포

저장소와 Pages는 이미 활성화되어 있습니다. `scripts/start-local.ps1`이 Quick Tunnel의 현재 주소를 감지하고 저장소 변수 `API_BASE_URL`을 갱신한 뒤 [`.github/workflows/pages.yml`](.github/workflows/pages.yml)을 자동 실행합니다.

`main` 브랜치 코드 변경도 같은 워크플로로 배포됩니다.

코드 저장소는 공개해도 되지만 `.env`, SQLite, 업로드와 백업은 `.gitignore`로 제외됩니다.

## 외부 HTTPS와 자동 시작

2주 단기 사용은 무료 Cloudflare Quick Tunnel을 사용합니다. Cloudflare 계정이나 도메인이 필요하지 않습니다. 임시 주소가 바뀌면 감시 스크립트가 GitHub Pages의 API 주소를 자동 갱신하고 재배포합니다.

최초 활성화는 아래 명령 한 번으로 설정 입력, 빌드, Windows 사용자 시작프로그램 등록까지 진행합니다. 관리자 권한은 필요하지 않습니다.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/activate.ps1
```

이 명령은 로그인 시 서버·터널을 감시하는 숨김 프로세스를 사용자 시작프로그램에 등록합니다. 감시 프로세스가 오전 3시 이후 하루 한 번 백업하며, 서버가 종료되면 다시 시작하고 터널만 끊기면 새 Quick Tunnel을 만든 뒤 Pages 주소를 갱신합니다.

사용을 마치면 시작프로그램 바로가기와 실행 프로세스만 제거할 수 있습니다. DB와 첨부파일은 보존됩니다.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/uninstall-startup.ps1
```

## 백업

```powershell
npm run backup
```

`backups/<timestamp>`에 SQLite 스냅샷과 업로드 파일을 복사하며, 기본값은 최근 14개 보존입니다. 자동 실행 중에는 오전 3시가 지난 뒤 그날의 첫 백업을 수행하므로 PC가 절전 상태였다가 깨어나도 누락하지 않습니다.

## 폴더

- `apps/web`: React/Vite 웹앱
- `apps/server`: Fastify, SQLite, Claude 작업 큐, Telegram 리스너
- `packages/shared`: 상태·타입·검증 계약
- `scripts`: 설정, E2E, 백업, 자동 시작
- `docs`: 제품 계획과 기술 검증 결과
- `spikes/phase0`: 초기 기술 검증 도구

## 알려진 제한

- 배치 실험실은 실측 CAD가 아닌 이미지 도면의 외곽 치수로 보정한 검토 도구입니다. 내부 벽, 문 열림, 콘센트, 몰딩은 현장에서 다시 측정한 뒤 구매와 시공을 확정해야 합니다.
- 공개 Reels는 `yt-dlp`로 제목·설명·썸네일을 보조 추출합니다. 비공개·로그인 제한·플랫폼 변경으로 추출이 실패하면 원문 링크와 사용자 메모, 직접 첨부한 이미지로 검토합니다.
- 제공된 YouTube Shorts에는 자막 트랙이 없어서 제목·공개 메타데이터를 사용합니다. 자막이 있는 영상은 후속 확장으로 본문 품질을 높일 수 있습니다.
- 집 PC나 터널이 꺼지면 GitHub Pages 화면은 열리지만 카드 데이터 기능은 오프라인입니다.
- Quick Tunnel은 무료 임시 기능이라 가용성 보장이 없고 재연결 때 Pages 갱신까지 약 1분이 걸릴 수 있습니다. 두 사용자·2주 단기 사용을 전제로 선택했습니다.
- Node 24의 내장 SQLite는 현재 실행 시 experimental 경고를 출력할 수 있습니다. 테스트와 실제 통합 흐름은 정상 통과했습니다.
- Telegram 토큰과 사용자 비밀번호는 저장소에 포함하지 않습니다.
