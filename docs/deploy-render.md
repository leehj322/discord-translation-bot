# Render 배포 가이드

## 준비물

- GitHub 저장소 연결
- 환경 변수 준비 (`DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DEEPL_AUTH_KEY`)
- 선택: Supabase URL/Key (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE` 또는 `SUPABASE_ANON_KEY`)

## 서비스 생성

1. Render 대시보드 → New → Web Service
2. 리포지토리 선택 → Branch 선택
3. Runtime: Node
4. Build Command:
   - 음악 기능을 사용할 경우 `deno`(zip)와 `yt-dlp` 바이너리를 빌드 단계에 다운로드합니다.
   - 예시(Linux x86_64 기준):

```
npm install && \
mkdir -p bin && \
curl -fsSL https://github.com/denoland/deno/releases/latest/download/deno-x86_64-unknown-linux-gnu.zip -o /tmp/deno.zip && \
unzip -o -q /tmp/deno.zip -d bin && rm -f /tmp/deno.zip && \
chmod +x bin/deno && \
curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o bin/yt-dlp && chmod +x bin/yt-dlp && \
npm run build
```

5. Start Command:

```
bash -lc 'export PATH="$PWD/bin:$PATH"; node dist/bot.js'
```

## 환경 변수

- 필수: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DEEPL_AUTH_KEY`
- 선택(사용량 영속화): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE`(권장) 또는 `SUPABASE_ANON_KEY`
- 선택(DeepL Pro): `DEEPL_API_BASE=https://api.deepl.com`
- 음악 기능은 추가 환경 변수가 필수는 아니며, 빌드 단계에서 `deno`/`yt-dlp`를 포함하면 동작합니다.

> 권한·인텐트 등의 디스코드 봇 설정은 `setup-discord-bot.md` 문서를 참고하세요.

## 배포 후 체크리스트

- Logs에서 봇 로그인 메시지 확인
- 테스트 길드에서 `/auto` 명령 동작 확인 (ko↔ja 번역)
- `/usage`로 사용량 확인 (Supabase 설정 시 영속화)
- 음악 기능 확인:
  - 음성 채널 접속 후 `/music play <url|검색어>` 동작 확인
  - `/music pause|resume|skip|stop|queue` 정상 작동 확인
- 오류 시 환경변수/권한 재확인
