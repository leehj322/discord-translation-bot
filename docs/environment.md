# 환경 변수 설정 가이드

## 기본(.env) 예시

```
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID= # 선택: 길드 전용 명령 등록 시 사용(즉시 반영)

# DeepL
DEEPL_AUTH_KEY=
DEEPL_API_BASE= # 선택: pro 사용 시 https://api.deepl.com

# Supabase (선택: 사용량 영속화)
SUPABASE_URL= # 예: https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE= # 권장: 서버 전용 키(외부 노출 금지)
# 또는
# SUPABASE_ANON_KEY=
```

- DISCORD_TOKEN: Discord 봇 토큰
- DISCORD_CLIENT_ID: Discord 애플리케이션(봇) ID
- DISCORD_GUILD_ID: 특정 서버에만 명령을 등록(개발 속도↑, 즉시 반영)
- DEEPL_AUTH_KEY: DeepL API 키
- DEEPL_API_BASE: DeepL 엔드포인트(기본: https://api-free.deepl.com)
- SUPABASE_URL: Supabase Project URL(예: https://xxxx.supabase.co)
- SUPABASE_SERVICE_ROLE: 서버 전용 서비스 롤 키(권장)
- SUPABASE_ANON_KEY: 대안. 보안 정책에 따라 사용

## Render에서의 설정

- Environment → Add Environment Variable 로 위 변수 등록
- 서비스 롤 키는 절대 클라이언트에 노출하지 마세요

## 검증

- 개발 실행: `npm run dev`
- 커맨드 등록: `npm run register`
- 빌드/실행: `npm run build && npm start`

문제 해결

- 로그인/등록 401·403: DISCORD_TOKEN 또는 DISCORD_CLIENT_ID 확인
- 번역 오류: DEEPL_AUTH_KEY/DEEPL_API_BASE 확인, DeepL 콘솔에서 사용량 확인
- 사용량 미집계: SUPABASE_URL/키 확인, usage_increment RPC/테이블 생성 여부 확인
