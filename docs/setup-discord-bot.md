# Discord 봇 발급/설정 가이드

## 1) 애플리케이션 생성

1. 브라우저에서 `https://discord.com/developers/applications` 접속
2. New Application → 이름 입력 → Create

## 2) 봇 추가 및 토큰 발급

1. 좌측 Bot 탭 → Add Bot → Yes, do it!
2. Token → Reset Token → 복사해서 `.env`의 `DISCORD_TOKEN`에 저장
3. Privileged Gateway Intents에서 다음 체크
   - MESSAGE CONTENT INTENT: On (메시지 내용 접근)

## 3) OAuth2 초대 링크 생성

1. OAuth2 → URL Generator
2. Scopes: `bot`, `applications.commands`
3. Bot Permissions:

   - View Channels, Send Messages, Read Message History, Embed Links
   - Voice: Connect, Speak

4. 생성된 URL로 길드(서버)에 봇 초대

## 4) Client ID 확인

- General Information → Application ID 복사 → `.env`의 `DISCORD_CLIENT_ID`에 저장

## 5) 슬래시 커맨드 등록

- `.env`가 준비되면 프로젝트 루트에서 실행:

```
npm run register
```

- 전역 등록은 반영까지 수 분 걸릴 수 있음. 테스트 용도로는 Guild 전용 등록 권장
- 빠른 확인: `.env`에 `DISCORD_GUILD_ID=<서버ID>` 추가 후 위 명령 실행 → 즉시 반영
- 서버 ID 확인: 설정 → 고급 → 개발자 모드 ON → 서버 우클릭 → "ID 복사"

## 6) 실행

```
npm run dev
```

봇이 로그인되면 서버에서 `/auto` 명령을 확인할 수 있습니다.

## 8) 음성(오디오) 의존성/Opus 설치 가이드

- 기본값(권장 개발용): 네이티브 Opus 없이 `opusscript` 사용 → 별도 빌드 도구 불필요

  - 이미 `opusscript`가 dependencies에 포함되어 있습니다.
  - 부팅 로그에 `voice dependencies`가 출력되며 어떤 구현을 쓰는지 확인 가능합니다.

- 고성능(권장 운영용): 네이티브 `@discordjs/opus` 사용

  - Windows: Python 3 + Visual Studio C++ Build Tools 필요, `node-gyp` 경로 설정 필요
  - Node 버전은 LTS(예: Node 20.x) 사용 권장. 최신(Node 22)에서는 해당 버전용 사전 빌드가 없을 수 있습니다.
  - Render 등 PaaS에서 Node 버전 고정: 환경변수 `NODE_VERSION=20`

- 문제 해결 체크리스트
  - Application Logs에서 `voice dependencies` 로그 확인
  - `LOG_LEVEL=debug`로 세부 로그 활성화
  - `/music play` 실패 시 `feature: "music"` 에러 로그 확인(연결/권한/오디오 URL 실패 구분)

## 7) 명령 동작 요약

- `/auto`: 채널 전체 공개 번역 활성화(한국어↔일본어 자동 감지)
- `/stop`: 현재 채널의 자동 번역 해제
- `/usage`: 관리자 전용 임베드 UI로 사용량 요약 표시
