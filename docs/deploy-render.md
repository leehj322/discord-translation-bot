# Render 배포 가이드

## 준비물

- GitHub 저장소 연결
- 환경 변수 준비 (`DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DEEPL_AUTH_KEY`)
- 선택: Supabase URL/Key (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE` 또는 `SUPABASE_ANON_KEY`)

## 서비스 생성

1. Render 대시보드 → New → Web Service
2. 리포지토리 선택 → Branch 선택
3. Runtime: Node
4. Build Command: `npm install && npm run build`
5. Start Command: `node dist/bot.js`

## 환경 변수

- 필수: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DEEPL_AUTH_KEY`
- 선택(사용량 영속화): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE`(권장) 또는 `SUPABASE_ANON_KEY`
- 선택(DeepL Pro): `DEEPL_API_BASE=https://api.deepl.com`

## 권한·인텐트

- Discord Developer Portal에서 MESSAGE CONTENT INTENT 켜기
- 봇 초대 시 권한: Send Messages, Read Message History, Create/Send in Private Threads

## 배포 후 체크리스트

- Logs에서 봇 로그인 메시지 확인
- 테스트 길드에서 `/auto` 명령 동작 확인 (ko↔ja 번역)
- `/usage`로 사용량 확인 (Supabase 설정 시 영속화)
- 오류 시 환경변수/권한 재확인
