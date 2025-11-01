# 문서 인덱스

- **환경 변수 설정 가이드**: [environment.md](./environment.md)
- **Discord 봇 발급/설정 가이드**: [setup-discord-bot.md](./setup-discord-bot.md)
- **Render 배포 가이드**: [deploy-render.md](./deploy-render.md)
- **아키텍처 개요**: [ARCHITECTURE.md](./ARCHITECTURE.md)

실행 순서 — (1) Discord 봇/애플리케이션 생성 → (2) `.env`/Secret 파일 구성(DeepL/Supabase) → (3) 커맨드 등록 → (4) 실행/배포

핵심 기능(요약):

- `/usage`: 번역 API 요청 수 요약(총합/채널)
- `/auto`: 한국어↔일본어 자동 감지 후 DeepL 번역
- 동일 메시지에 대한 중복 번역 호출 방지
- 채널 삭제 시 자동 번역 세션 정리
 - 음악: `/music play|skip|clear|list`
