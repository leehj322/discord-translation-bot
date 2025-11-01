## Usage Counters Persistence (Supabase)

선택적으로 Supabase를 연결하면 사용량 카운터를 영속화합니다. 필요한 항목:

- 환경변수: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE` (또는 `SUPABASE_ANON_KEY`)
- 테이블 예시: `usage_counters(id text primary key, kind text, value bigint, updated_at timestamptz default now())`
- RPC 함수 예시(Postgres):

```sql
create or replace function usage_increment(p_key text)
returns void
language plpgsql
as $$
begin
  insert into usage_counters(id, kind, value)
  values (p_key, split_part(p_key, ':', 1), 1)
  on conflict (id)
  do update set value = usage_counters.value + 1, updated_at = now();
end;
$$;
```

앱은 `src/core/supabase.ts`로 클라이언트를 생성하고, `src/features/usage/usage.ts`에서 메모리 카운터와 함께 fire-and-forget 방식으로 RPC를 호출합니다.

# 아키텍처 개요

## 모듈 구조

- `src/config/`: 환경 변수 로딩/검증, 포트 등 런타임 설정
- `src/core/`: 프레임워크/런타임 공통(Discord Client, HTTP Health)
- `src/handlers/`: 이벤트 핸들러 집합(슬래시 명령, 메시지 처리)
- `src/features/`: 도메인 기능
  - `translate/`: 번역 서비스/세션/명령 정의
  - `usage/`: 사용량 카운터
- `src/commands.ts`: 모든 feature 명령을 모아 등록 스크립트에서 사용
- `src/register-commands.ts`: 슬래시 명령 등록(전역/길드 선택)
- `src/bot.ts`: 엔트리포인트

## 의존 방향

`features` → `core`/`config`는 참조하지 않음. `handlers`가 `features`를 사용, `bot.ts`가 `core`/`handlers`/`config`만 참조.

## 확장 가이드

- 새 기능 추가 시 `src/features/<name>/`에 `commands.ts`, `service.ts`(또는 폴더), 필요 시 `sessions.ts` 추가
- 슬래시 명령은 `src/commands.ts`에서 export 목록에 합치기
- 핸들링이 필요하면 `src/handlers/`에 전용 핸들러 추가 또는 기존에 연동

## 자동 번역 세션

- public: 채널 단위(`publicSessions[channelId]`)로 모든 사용자에게 번역 결과를 회신
- private: (제거됨)

세션 종료: `/auto_stop` 또는 채널 삭제 이벤트 발생 시 자동 정리(`channelDelete`)

## 번역 호출 흐름

1. `messageCreate`에서 public 세션 확인
2. 메시지 내용에서 한국어/일본어를 간단 감지, 교차 언어로만 번역(기타 언어 무시)
3. 동일 메시지에 대해 src/tgt 조합별 1회만 `translateText` 호출(중복 제거)
4. 결과를 채널 reply로 전송

## 사용량 집계

- `incrUsage`로 요청 횟수 총합/길드/채널/사용자 단위 카운트 증가
- `addCharUsage`로 문자 수 총합/길드/채널/사용자 단위 카운트 증가
- Supabase 설정 시 RPC `usage_increment`, `usage_add_chars`로 영속화
- `/usage` 명령으로 임베드 UI 표시(요청 수/문자 수)

## 음악 기능 아키텍처

### 목표

- 단일 Render 배포(추가 서비스 없이)에서 YouTube 오디오 재생 지원
- 안정성 확보를 위해 `yt-dlp` + `deno` 조합을 사용하여 오디오 URL 추출
- 오디오 변환은 `ffmpeg-static`을 사용하고, 전송은 `@discordjs/voice`로 수행

### 모듈 구성(`src/features/music/`)

- `ytdlp.ts`: `yt-dlp`(CLI) 호출 래퍼. `deno`가 PATH에 있어야 함
- `player.ts`: 길드별 오디오 연결/플레이어/큐 관리, 스킵/클리어, 30초 유휴 종료, 채널 인원 0명 시 즉시 종료
- `commands.ts`: `/music` 명령군 정의(`play|skip|clear|list`)

### 데이터 구조/상태

- 길드 ID → `{ connection, audioPlayer, queue, nowPlaying }`
- 큐 항목: `{ title, url, duration, isLive, streamFactory }`
- 자동 종료: 큐 소진 후 일정 시간 유휴 시 연결 종료

### 처리 파이프라인

1. `/music play <url|검색어>` 수신
2. `yt-dlp`로 오디오 소스 파악: URL 또는 검색어 → 적절한 포맷 URL/스트림 추출
3. `ffmpeg-static`으로 Discord 호환 PCM/Opus 변환
4. `@discordjs/voice`로 음성 채널에 전송
5. 재생 완료/오류 시 다음 항목으로 전환, 큐가 비면 30초 유휴 타이머 가동
6. 채널 인원 0명(봇 제외) 시 즉시 큐 비우고 종료

### 출력 형식

- `/music play <url|검색어>`: 채널 공개 메시지로 등록 내역 안내(링크 프리뷰 허용)
- `/music list`: 에페메럴 텍스트로 현재곡/경과시간/대기열 표시(임베드 억제)

### 의존성

- 런타임: Node 18+, `deno`(단일 바이너리), `yt-dlp`(단일 바이너리)
- NPM: `@discordjs/voice`, `@discordjs/opus`, `prism-media`, `ffmpeg-static`

### 배포(요약)

- Render Build 단계에서 `./bin/deno`, `./bin/yt-dlp`를 다운로드하여 포함
- Start 단계에서 `PATH="$PWD/bin:$PATH"` 설정 후 봇 실행
