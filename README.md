# iTero 스캔 다운로드 스킬

로컬 Chrome의 CDP(Remote Debugging) 세션을 이용해 **권한이 있는 MyiTero 계정**에서 iTero intraoral scan STL 내보내기를 내려받는 독립형 Codex 스킬입니다.

MyiTero의 공식 API를 사용하는 프로젝트가 아닙니다. 화면 구조가 바뀌면 선택자와 로그인 흐름이 바뀔 수 있으며, 사용자는 해당 서비스의 이용약관·기관 정책·개인정보보호 의무를 직접 확인해야 합니다.

## 개인정보 보호 원칙

이 저장소에는 다음을 넣지 않습니다.

- 실제 환자 이름·차트번호·생년월일·주문번호·스캔 날짜
- ZIP, STL, PLY, XML, 스크린샷, 네트워크 캡처, Chrome 프로필
- 이메일·비밀번호·세션 쿠키·토큰
- 병원 내부 경로, 내부 파이프라인, 환자 폴더 미러링 코드

다운로드 파일과 실행 로그는 환자정보가 될 수 있으므로 로컬에서만 관리하고, 이 저장소의 작업 트리와 이슈에 올리지 마세요.

## 제공 기능

- Chrome CDP를 통한 전용 브라우저 세션 연결
- 차트번호 또는 이름으로 환자 검색
- 한글 이름의 성·이름 분리 검색 및 후보 행 전체 대조
- `완료`, `완료되었습니다`, `연구소에 도착` 상태 주문 선택
- 기본값으로 환자의 완료 주문 전체 검사
- 명시적 `--endpoints` 사용 시에만 최초·최종 주문 2건 선택
- ZIP 내부 XML의 `OrderID`로 파일명 생성, `ChartNumber`로 대상 차트 검증
- 이미 받은 `OrthoCAD_Export_<OrderID>.zip` 재개 스킵
- Chrome 다운로드 이벤트 누락 시 새로 생긴 파일을 찾는 폴백
- 헤드리스 Chrome 옵션과 headed Chrome 폴백

## 요구사항

- macOS 또는 Chrome CDP를 실행할 수 있는 환경
- Google Chrome
- Node.js 20 이상
- MyiTero 사용 권한이 있는 계정
- `unzip` 명령어

## 설치

```bash
git clone https://github.com/KwanghyoChoi/itero-scan-fetch.git
cd itero-scan-fetch
npm install
```

Codex가 자동으로 찾는 개인 스킬 폴더에 직접 설치하려면 다음처럼 복제할 수도 있습니다.

```bash
git clone https://github.com/KwanghyoChoi/itero-scan-fetch.git ~/.agents/skills/itero-scan-fetch
cd ~/.agents/skills/itero-scan-fetch
npm install
```

## 자격증명 준비

```bash
cp .env.example .env.itero
chmod 600 .env.itero
```

`.env.itero`에는 다음 두 변수만 넣습니다.

```dotenv
MYITERO_EMAIL=your-authorized-account@example.com
MYITERO_PASSWORD=your-password
```

`.env.itero`는 `.gitignore`에 포함되어 있지만, 커밋 전 `git status`로 다시 확인하세요. 비밀번호를 셸 명령줄 인자나 소스 코드에 넣지 마세요.

## Chrome CDP 시작

일상 브라우저와 분리된 프로필·포트로 Chrome을 시작합니다.

```bash
zsh scripts/itero-chrome-cdp.sh
```

환경변수로 경로와 포트를 바꿀 수 있습니다.

```bash
ITERO_CDP_PORT=9444 \
ITERO_PROFILE_DIR="$PWD/.itero-chrome-profile" \
zsh scripts/itero-chrome-cdp.sh
```

기본값은 `9334`입니다. 이미 사용하는 Chrome의 CDP 포트에 연결하지 마세요. 원격 디버깅은 스크립트가 `127.0.0.1`로만 확인하므로 외부 네트워크에 공개하지 마세요.

## 다운로드

### 지정 환자

```bash
node scripts/itero-download.mjs \
  --targets "1234567,홍길동" \
  --dest ./itero-downloads \
  --max-downloads 20
```

이름 검색은 후보 목록을 먼저 전부 읽은 뒤 성·이름이 모두 포함된 행만 엽니다. 동명이인이 남으면 실행을 중단하고 더 정확한 식별자를 사용하세요.

### 환자 목록의 앞에서 N명

```bash
node scripts/itero-download.mjs \
  --patients 1 \
  --dest ./itero-downloads \
  --max-downloads 3
```

`--patients`는 현재 화면의 정렬과 가상 스크롤에 의존하므로, 운영 사용에는 차트번호 지정 방식이 더 안전합니다.

## 주요 옵션

| 옵션 | 기본값 | 설명 |
| --- | --- | --- |
| `--targets LIST` | 없음 | 차트번호·이름을 쉼표로 구분한 대상 |
| `--patients N` | 없음 | 환자 목록 앞에서 N명 처리 |
| `--dest DIR` | `./itero-downloads` | ZIP 저장 위치 |
| `--credentials FILE` | `./.env.itero` | 자격증명 파일 |
| `--max-downloads N` | 제한 없음 | 실행당 최대 새 ZIP 수 |
| `--download-timeout S` | `480` | 주문별 다운로드 대기 초 |
| `--cdp-port PORT` | `9334` | 전용 Chrome CDP 포트 |
| `--endpoints` | 끔 | 최초·최종 주문만 선택 |
| `--help` | - | 도움말 출력 |

기본은 **완료 주문 전체**입니다. 일부 시점만 받으려는 경우에만 `--endpoints`를 명시하세요. `--max-downloads`는 안전한 소량 시험에 유용하지만, 전체 수집을 원하면 충분히 큰 상한을 직접 지정해야 합니다.

## 결과와 재개

성공한 파일은 다음 형식으로 저장됩니다.

```text
itero-downloads/
└── OrthoCAD_Export_<OrderID>.zip
```

파일명보다 ZIP 내부 XML의 `OrderID`와 `ChartNumber`를 신뢰합니다. 숫자 7자리 차트번호로 검색한 경우 XML의 `ChartNumber`가 다르면 파일을 `unverified-...zip`으로 격리하고 정상 결과로 세지 않습니다.

내보내기 요청은 서버에서 비동기로 준비될 수 있습니다. 시간 초과가 곧 서버 측 준비 실패를 의미하지 않을 수 있으므로 다음 순서로 재시도하세요.

1. 같은 `--dest`를 유지한 채 같은 명령을 다시 실행합니다.
2. `--download-timeout 900`처럼 대기 시간을 늘립니다.
3. 헤드리스에서 반복되면 `ITERO_HEADLESS` 없이 headed Chrome으로 재시도합니다.
4. 한 번에 한 실행만 사용하고, 같은 CDP 포트·계정으로 동시 실행하지 않습니다.

이미 정상 파일명이 있는 주문은 건너뛰므로 재시도 시 중복 다운로드를 줄일 수 있습니다.

## 헤드리스 모드

브라우저 창을 띄우지 않으려면 전용 Chrome을 다음처럼 시작합니다.

```bash
ITERO_HEADLESS=1 zsh scripts/itero-chrome-cdp.sh
node scripts/itero-download.mjs --targets "1234567" --dest ./itero-downloads
```

내보내기 준비가 오래 걸리는 주문은 헤드리스에서 시간 초과할 수 있습니다. 이 도구는 다운로드 이벤트와 실제 폴더 착지를 함께 확인하지만, 반복 실패 시 headed 모드가 더 관찰하기 쉽습니다.

## 문제 해결

### `CDP` 연결 실패

- `zsh scripts/itero-chrome-cdp.sh`가 먼저 실행됐는지 확인합니다.
- `--cdp-port`와 `ITERO_CDP_PORT`가 같은지 확인합니다.
- 기존 일상 Chrome이 아니라 이 스크립트가 만든 전용 프로필을 사용합니다.
- `ITERO_CHROME_BIN`으로 Chrome 실행 파일 경로를 지정할 수 있습니다.

### 로그인 흐름이 멈춤

- 처음 한 번은 전용 Chrome 창에서 직접 추가 인증을 완료해야 할 수 있습니다.
- 시작 URL은 `myitero.com`으로 유지합니다. 내부 BFF 주소를 직접 로그인 진입점으로 사용하지 않습니다.
- 계정에 로그인 권한이 있는지 확인하고, 인증정보를 로그나 이슈에 붙이지 않습니다.

### 환자를 찾지 못함

- 차트번호를 우선 사용합니다.
- 이름 검색 시 `성+이름`을 붙여 쓴 한 가지 검색 결과만 믿지 않습니다. 스크립트는 이름·띄어쓰기·성 검색 형태를 순서대로 시도합니다.
- 후보가 여러 명이면 실행을 멈추고 차트번호 등 추가 식별자로 다시 실행합니다.

### 주문이 0건으로 보임

- 주문표가 완전히 렌더링될 때까지 기다리는지 확인합니다.
- 주문 상태가 내보내기 가능한 상태인지 확인합니다.
- `--endpoints`가 실수로 켜져 있지 않은지 확인합니다.
- 화면 구조가 바뀌었을 수 있으므로, 환자 데이터 없이 선택자 회귀 테스트를 먼저 추가합니다.

## 개발 및 테스트

테스트는 합성 이름·차트번호·XML만 사용하며 MyiTero에 접속하지 않습니다.

```bash
npm test
npm run check
```

실제 계정으로 테스트할 때는 별도 비공개 환경에서만 수행하고, ZIP·로그·프로필이 커밋되지 않았는지 확인하세요.

## 범위와 책임

- 이 프로젝트는 Align Technology의 공식 제품이나 공식 API 클라이언트가 아닙니다.
- 임상 측정, 진단, 치료 결정을 수행하지 않습니다.
- 서비스 이용약관, 자동화 허용 여부, 환자정보 처리 근거는 사용자가 확인해야 합니다.
- 자세한 개인정보 취급 원칙은 [`SECURITY.md`](SECURITY.md)를 확인하세요.

## 라이선스

MIT License. 자세한 내용은 [`LICENSE`](LICENSE)를 확인하세요.
