# 0단계 기술 검증 도구

제품 구현 전에 외부 의존성과 실패 경로를 확인하는 무의존성 Node.js 스파이크다. 운영 코드가 아니며 실제 카드 데이터는 저장하지 않는다.

## 실행

```powershell
cd spikes/phase0
npm run verify:claude
npm run verify:sources
npm run verify:telegram
```

다른 URL을 확인하려면 인수로 전달한다.

```powershell
node verify-sources.mjs "https://example.com/article"
```

텔레그램 검증은 현재 PowerShell 세션에 봇 토큰을 설정한 뒤 실행한다. 토큰을 파일이나 명령 기록에 남기지 않는다.

```powershell
$env:TELEGRAM_BOT_TOKEN = Read-Host -MaskInput "Telegram bot token"
npm run verify:telegram
Remove-Item Env:TELEGRAM_BOT_TOKEN
```

외부 HTTPS/CORS 검증용 서버는 임시 비밀값과 함께 실행한다.

```powershell
$env:PROBE_PASSWORD = "temporary-password"
$env:PROBE_SESSION_SECRET = "temporary-session-secret-at-least-16"
$env:ALLOWED_ORIGIN = "https://ian939.github.io"
npm run serve
```

별도 터미널에서 Quick Tunnel을 연결할 수 있다.

```powershell
cloudflared tunnel --url http://127.0.0.1:8787 --no-autoupdate
```

검증이 끝나면 프로세스를 중지하고 환경 변수를 제거한다.
