# Render 배포 가이드

## 준비물

- GitHub 저장소 연결
- 환경 변수 / Secret File 준비 (`DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, v3: `GOOGLE_APPLICATION_CREDENTIALS`)

## 서비스 생성

1. Render 대시보드 → New → Web Service
2. 리포지토리 선택 → Branch 선택
3. Runtime: Node
4. Build Command: `npm install && npm run build`
5. Start Command(예시): `node dist/bot.js`

## v3 서비스 계정 등록

- 방법 A: Secret File (추천)

  - Environment → Add Secret File → 서비스 계정 JSON 붙여넣기 → 경로 `/etc/secrets/gcp-key.json`
  - Environment Variables → `GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/gcp-key.json`

- 방법 B: Base64 환경변수
  - 로컬에서 Base64 인코딩 후 `GOOGLE_CREDENTIALS_B64` 저장
  - Start Command 수정 예시:
    ```
    sh -lc 'echo $GOOGLE_CREDENTIALS_B64 | base64 -d > /tmp/gcp-key.json && export GOOGLE_APPLICATION_CREDENTIALS=/tmp/gcp-key.json && node dist/bot.js'
    ```

## 환경 변수

- 필수: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`
- 번역(v3): `GOOGLE_APPLICATION_CREDENTIALS` (Secret File 경로 권장)

## 권한·인텐트

- Discord Developer Portal에서 MESSAGE CONTENT INTENT 켜기
- 봇 초대 시 권한: Send Messages, Read Message History, Create/Send in Private Threads

## 배포 후 체크리스트

- Logs에서 봇 로그인 메시지 확인
- 테스트 길드에서 `/auto` 명령 동작 확인
- 오류 시 환경변수/Secret 파일 경로, 권한(Role) 재확인
