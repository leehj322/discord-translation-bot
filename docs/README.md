# 문서 인덱스

- **환경 변수 설정 가이드**: [environment.md](./environment.md)
- **Discord 봇 발급/설정 가이드**: [setup-discord-bot.md](./setup-discord-bot.md)
- **Google Translate API 가이드 (v2/v3)**: [setup-google-translate.md](./setup-google-translate.md)
- **Render 배포 가이드**: [deploy-render.md](./deploy-render.md)
- **아키텍처 개요**: [ARCHITECTURE.md](./ARCHITECTURE.md)

참고: 실행 순서 — (1) Discord 봇/애플리케이션 생성 → (2) Google 번역(v2 또는 v3) 준비 → (3) `.env`/Secret 파일 구성 → (4) 커맨드 등록 → (5) 실행/배포

핵심 기능 변경사항(요약):

- `/usage`는 임베드 UI로 표시되며 총합/이 채널만 노출됩니다.
- `/auto`는 public 모드만 지원하며 한국어↔일본어만 자동 감지/번역합니다.
- 동일 메시지에 대한 번역은 src/tgt 조합별 1회만 호출되어 결과가 공유됩니다.
- 채널 삭제 시 해당 채널의 자동 번역 세션이 자동으로 해제됩니다.
