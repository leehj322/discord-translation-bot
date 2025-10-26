# 환경 변수 설정 가이드

## 기본(.env) 예시

```
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID= # 선택: 길드 전용 명령 등록 시 사용(즉시 반영)
# v2를 쓸 때만 필요
GOOGLE_TRANSLATE_API_KEY=
# v3를 쓸 때 JSON 경로 지정
GOOGLE_APPLICATION_CREDENTIALS=
```

- `DISCORD_TOKEN`: Discord 봇 토큰
- `DISCORD_CLIENT_ID`: Discord 애플리케이션(봇) ID
- `DISCORD_GUILD_ID`: 특정 서버에만 명령을 등록(개발 속도↑, 즉시 반영)
- `GOOGLE_TRANSLATE_API_KEY`: Translation v2용 API Key
- `GOOGLE_APPLICATION_CREDENTIALS`: Translation v3용 서비스 계정 JSON 파일 경로

## OS별 설정 예시

- Windows (PowerShell)
  - `setx GOOGLE_APPLICATION_CREDENTIALS "C:\\path\\gcp-key.json"`
- macOS/Linux (bash/zsh)
  - `export GOOGLE_APPLICATION_CREDENTIALS=$PWD/gcp-key.json`

## Render에서의 설정

- Secret File (추천)
  - 파일 경로 예: `/etc/secrets/gcp-key.json`
  - 환경변수: `GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/gcp-key.json`
- Base64 환경변수(대안)
  - `GOOGLE_CREDENTIALS_B64=<인코딩값>`
  - Start Command에서 파일 복구 후 `GOOGLE_APPLICATION_CREDENTIALS` 지정

## 검증

- 개발 실행: `npm run dev`
- 커맨드 등록: `npm run register`
- 빌드/실행: `npm run build && npm start`

문제 해결

- 로그인/등록 401·403: `DISCORD_TOKEN` 또는 `DISCORD_CLIENT_ID` 확인
- 번역 4xx/권한: v2는 API Key 유효성, v3는 JSON 경로/역할(Cloud Translation API User) 확인
