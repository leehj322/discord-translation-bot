# Google Translate API 가이드 (v2 vs v3)

## 개요

- **v3(현재 코드 기본)**: 서비스 계정 인증(Google Auth), 고급 기능(Glossary 등) 제공.
- **v2(선택)**: 간단한 REST + API Key. 조직 정책상 허용 시에만 사용 권장.

## v3 (Service Account) 사용

1. Console → IAM & Admin → Service Accounts → Create Service Account
   - 역할: Cloud Translation API User (필수)
2. 생성된 서비스 계정 → Keys → Add key → JSON 다운로드
3. 환경 변수 설정
   - 로컬(Windows PowerShell)
     - `setx GOOGLE_APPLICATION_CREDENTIALS "C:\\path\\gcp-key.json"`
   - 로컬(macOS/Linux)
     - `export GOOGLE_APPLICATION_CREDENTIALS=$PWD/gcp-key.json`
4. 앱은 `@google-cloud/translate` v3 클라이언트를 사용해 기본 자격증명으로 인증합니다.

## v2 (API Key) 사용 (선택)

1. Console → APIs & Services → Library → "Cloud Translation API" → Enable
2. APIs & Services → Credentials → Create credentials → API key
3. `.env`

```
GOOGLE_TRANSLATE_API_KEY=your_api_key
```

문제 해결

- Credentials 메뉴가 없거나 Key 생성 제한: 조직 정책일 수 있음 → v3로 사용

## Render/Fly 배포 시 서비스 계정 등록

- Secret File (추천)

  1. 비밀 파일에 서비스 계정 JSON 전체 저장
  2. 경로 예: `/etc/secrets/gcp-key.json`
  3. 환경변수: `GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/gcp-key.json`

- Base64 환경변수(대안)
  1. 로컬에서 Base64 인코딩
  2. `GOOGLE_CREDENTIALS_B64=<인코딩값>` 저장
  3. 시작 스크립트에서 복구: `start.sh` 참고

## 선택 가이드

- 보안/정책상 API Key 금지, 고급기능 필요: v3 + 서비스 계정 권장(현재 기본)
- API Key 허용: v2 사용 가능(코드 일부 수정 필요)
