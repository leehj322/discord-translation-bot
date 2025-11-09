# GitHub Actions 기반 DigitalOcean 배포 가이드

Render는 UDP를 지원하지 않아 디스코드 음성 기능이 동작하지 않습니다. 이 문서는 GitHub Actions 워크플로우를 이용해 DigitalOcean Droplet에 자동 배포하는 과정을 단계별로 설명합니다.

## 1. 사전 준비

- DigitalOcean 계정
- GitHub 저장소(현재 프로젝트)
- 필수 환경 변수 값: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DEEPL_AUTH_KEY`
- 선택: Supabase 사용 시 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE`
- YouTube 쿠키 파일 `cookies.txt` (필요 시)

## 2. Droplet 준비

1. DigitalOcean 대시보드 → **Create → Droplets**
2. 이미지: Ubuntu 22.04 LTS 권장
3. 플랜: 1vCPU / 1GB RAM 이상
4. 리전: 주요 사용자 또는 Discord 게이트웨이에 가까운 곳
5. 인증: SSH Key 등록(추천)
6. 생성 후 퍼블릭 IP를 기록합니다.

## 3. 서버 초기 세팅 (최초 1회 · Droplet Console 사용)

배포 파이프라인은 Droplet이 이미 준비돼 있다는 전제하에 동작합니다. DigitalOcean 대시보드에서 브라우저 콘솔을 열고 아래 단계를 차례로 진행하세요.

1. **콘솔 접속**

   - DigitalOcean → **Droplets** → 대상 인스턴스 선택 → **Console → Launch Droplet Console**.
   - 접속이 막혀 있다면 SSH 키가 제대로 등록됐는지 확인합니다.

2. **시스템 업데이트 및 필수 패키지 설치**

   ```bash
   apt update && apt upgrade -y
   apt install -y git curl build-essential unzip
   ```

3. **Node.js 20 및 pm2 설치**

   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
   apt install -y nodejs
   npm install -g pm2
   ```

4. **배포 디렉터리 및 쿠키 디렉터리 준비**

   ```bash
   mkdir -p /opt/discord-bot
   chown -R root:root /opt/discord-bot

   mkdir -p /etc/secrets
   chmod 700 /etc/secrets
   ```

5. **설치 검증 (필수)**

   ```bash
   node -v      # v20.x 출력 확인
   npm -v
   pm2 -v
   ls -ld /opt/discord-bot /etc/secrets
   ```

6. **(선택) UFW 기본 규칙 설정**

   ```bash
   ufw allow OpenSSH
   ufw enable    # 활성화할지 확인 질문에 yes
   ```

위 작업이 모두 끝나면 GitHub Actions 워크플로우를 실행할 준비가 완료됩니다.

## 4. GitHub Secrets 설정

GitHub 저장소 설정 → **Secrets and variables → Actions**에서 아래 값을 등록합니다.

| Secret 키               | 내용                                           |
| ----------------------- | ---------------------------------------------- |
| `DO_HOST`               | Droplet IP 주소                                |
| `DO_USER`               | SSH 사용자 (예: `root`)                        |
| `DO_PRIVATE_KEY`        | Droplet 접속용 개인키 (`~/.ssh/id_ed25519` 등) |
| `DISCORD_TOKEN`         | 봇 토큰                                        |
| `DISCORD_CLIENT_ID`     | 봇 애플리케이션 ID                             |
| `DEEPL_AUTH_KEY`        | DeepL API 키                                   |
| `SUPABASE_URL`          | (선택) Supabase URL                            |
| `SUPABASE_SERVICE_ROLE` | (선택) Supabase Service Role Key               |

YouTube 쿠키가 필요한 경우 GitHub Secret에 Base64로 저장해 워크플로우에서 디코딩합니다.

## 5. GitHub Actions 워크플로우 개요

자동 배포는 `.github/workflows/deploy.yml` 파일에서 관리합니다. 핵심 단계만 정리하면 다음과 같습니다.

- `actions/setup-node`로 Node.js 20 환경 준비 후 `npm ci`, `npm run build` 실행
- `ssh-deploy` 액션으로 `/opt/discord-bot` 경로에 파일 동기화
- SSH 키와 `known_hosts` 준비 후 `.env` 갱신(`YTDLP_COOKIES_PATH=/etc/secrets/cookies.txt`, `FFMPEG_PATH=/opt/discord-bot/node_modules/ffmpeg-static/ffmpeg` 포함), 쿠키 파일 디코딩 (`YTDLP_COOKIES_BASE64` 사용 시)  
- 리모트에서 `npm ci --omit=dev` 실행 후 `pm2`로 봇 재시작

세부 설정은 저장소의 `.github/workflows/deploy.yml`을 참고하세요.

## 6. 쿠키 파일 처리 (GitHub Secrets 기반)

1. 로컬 PowerShell에서 `cookies.txt`를 Base64로 인코딩합니다.

   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\cookies.txt")) | Set-Clipboard
   ```

   클립보드에 복사된 문자열을 GitHub Secret에 붙여넣을 수 있습니다.

2. GitHub 저장소 설정 → **Secrets and variables → Actions**에서 `YTDLP_COOKIES_BASE64` Secret을 생성하고 위에서 복사한 Base64 문자열을 저장합니다.

3. 워크플로우 실행 시 `Sync cookies file` 스텝이 자동으로 Secret을 디코딩해 `/etc/secrets/cookies.txt`로 배치하고 권한을 설정합니다.

4. 쿠키가 변경되면 인코딩 → Secret 업데이트 → 워크플로우 재실행 순서로 갱신하세요.

## 7. 배포 흐름

1. `main` 브랜치에 변경 사항을 push/merge하거나 Actions 탭에서 수동 실행(workflow_dispatch)합니다.
2. GitHub Actions가 자동으로 빌드 → 파일 동기화 → `.env` 갱신 → `pm2` 재시작을 수행합니다.
3. `pm2 logs discord-bot` 또는 워크플로우 로그에서 배포 상태를 확인합니다.

## 8. 문제 해결 체크리스트

- `pm2 logs discord-bot`에서 봇 로그인 및 음성 재생 여부 확인
- UDP 방화벽(50000-60000) 열려 있는지 DigitalOcean Firewall 설정 확인
- `.env`와 쿠키 파일이 최신인지 확인
- 슬래시 명령 권한/등록은 `docs/setup-discord-bot.md`를 참고하세요.
