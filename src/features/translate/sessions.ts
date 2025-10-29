// 번역 세션 인메모리 저장소
// - 채널 단위로 자동 번역 활성 상태를 관리합니다.
// - 프로세스 재시작 시 초기화되며, 현재는 DB에 영속화하지 않습니다.
//
export type PublicSession = { enabledBy: string };

export const publicSessions = new Map<string, PublicSession>();
