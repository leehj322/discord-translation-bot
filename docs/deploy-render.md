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

## YouTube 쿠키 설정 가이드 (yt-dlp)

YouTube가 봇 확인을 요구하는 경우(예: “Sign in to confirm you’re not a bot”) 쿠키 없이 재생이 실패할 수 있습니다. 이 프로젝트는 기본적으로 쿠키 없이 시도(옵션 1) 후 실패하면, 환경변수로 제공된 쿠키(옵션 2)로 자동 재시도합니다.

- 기본 시도(옵션 1): `--extractor-args "youtube:player_client=android"`, `--geo-bypass`, `--sleep-requests 1`, `--force-ipv4` 등으로 비계정 접근 시도
- 실패 시 폴백(옵션 2): 아래 환경변수 중 하나가 있으면 자동으로 `--cookies`로 재시도
  - `YTDLP_COOKIES_PATH`: 서버상의 `cookies.txt` 경로
  - `YTDLP_COOKIES_BASE64`: `cookies.txt`의 Base64 인코딩 문자열(서버에 파일 없이도 사용 가능)

주의 사항

- 계정 쿠키 사용은 계정 제재(일시·영구)의 위험이 있습니다. 정말 필요한 경우에만 사용하고, 요청 빈도를 낮추세요.
- 쿠키는 브라우저에서 자주 로테이션됩니다. 아래 방식으로 “인코그니토/시크릿 창”에서 추출하면 안정적입니다.

쿠키 추출 방법(인코그니토 권장)

1. 브라우저 인코그니토/시크릿 창을 열고 YouTube에 로그인
2. 같은 창/탭에서 `https://www.youtube.com/robots.txt` 로 이동(이 창에 YouTube 탭은 이 하나만 유지)
3. 브라우저 확장(yt-dlp FAQ에서 추천하는 확장)을 사용해 `youtube.com` 쿠키를 `cookies.txt`로 내보내기
4. 인코그니토 창을 닫아 세션이 브라우저에서 다시 열리지 않게 합니다

서버에 전달하는 방법

- 경로 전달(`YTDLP_COOKIES_PATH`)
  - Render 등 서버에 `cookies.txt`를 업로드(Secret Files/디스크 마운트 등) 후 경로를 환경변수에 지정

애플리케이션 동작

- 현재 버전은 스트리밍 방식만 사용합니다. `YTDLP_COOKIES_PATH`가 설정되면 스트리밍 추출 시 쿠키를 사용합니다.
- 민감정보 보호: 쿠키 내용은 절대 로그에 남기지 마세요.

## 배포 후 체크리스트

- Logs에서 봇 로그인 메시지 확인
- 테스트 길드에서 `/auto` 명령 동작 확인 (ko↔ja 번역)
- `/usage`로 사용량 확인 (Supabase 설정 시 영속화)
- 음악 기능 확인:
  - 음성 채널 접속 후 `/music play <url|검색어>` 동작 확인
  - `/music pause|resume|skip|stop|queue` 정상 작동 확인
- 오류 시 환경변수/권한 재확인
