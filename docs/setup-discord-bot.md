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
   - Connect, Speak, Use Voice Activity (음성 채널)

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

봇이 로그인되면 서버에서 `/auto`(번역)와 `/music`(음악) 명령을 확인할 수 있습니다.

### 음악 기능 빠른 점검

- 음성 채널에 접속 후 다음을 테스트하세요:
  - `/music play <url|검색어>`: 재생 시작
  - `/music pause` / `/music resume`: 일시정지/재개
  - `/music skip` / `/music stop`: 스킵/정지
  - `/music queue`: 큐 확인

## 7) 명령 동작 요약

- `/auto`: 채널 전체 공개 번역 활성화(한국어↔일본어 자동 감지)
- `/stop`: 현재 채널의 자동 번역 해제
- `/usage`: 관리자 전용 임베드 UI로 사용량 요약 표시
