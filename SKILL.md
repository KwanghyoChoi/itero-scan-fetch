---
name: itero-scan-fetch
description: Use when an authorized operator needs to download iTero or MyiTero intraoral STL exports through a local Chrome CDP session, including Korean patient search, completed-order selection, download timeouts, or ZIP identity checks.
---

# iTero 스캔 다운로드

이 스킬은 공식 API가 없는 MyiTero 화면에서 **사용자가 권한을 가진 계정으로** STL 내보내기를 수행할 때 사용한다. 브라우저 세션과 산출물은 로컬에만 둔다.

## 실행 전 확인

1. 현재 작업 대상이 허가된 계정과 허가된 환자/차트번호인지 확인한다.
2. 이름을 검색할 때 결과 행을 전부 읽고 성·이름·차트번호를 대조한다. 첫 번째 결과를 바로 열지 않는다.
3. `.env.itero`와 다운로드 폴더가 저장소 밖 또는 `.gitignore` 대상인지 확인한다.
4. `--targets` 또는 `--patients`를 명시한다. 대상 없이 실행하면 첫 환자를 우연히 받지 않는다.

## 표준 절차

```bash
cp .env.example .env.itero
chmod 600 .env.itero
npm install
zsh scripts/itero-chrome-cdp.sh
node scripts/itero-download.mjs \
  --targets "차트번호,이름" \
  --dest ./itero-downloads \
  --max-downloads 20
```

- 기본 동작은 완료된 주문을 전부 검사한다.
- `--endpoints`는 최초·최종 2건만 받을 때만 명시한다.
- ZIP 내부 XML의 `ChartNumber`와 `OrderID`를 최종 식별자로 사용한다.
- 다운로드가 비동기 처리되어 시간 초과하면 같은 명령을 다시 실행한다. 기존 ZIP은 건너뛴다.
- 헤드리스가 필요하면 Chrome 기동 전에 `ITERO_HEADLESS=1`을 설정한다. 타임아웃이 반복되면 headed 모드로 전환한다.

## 금지사항

- 환자 파일, 로그, 브라우저 프로필, 자격증명을 커밋하거나 외부 서비스에 업로드하지 않는다.
- 일상용 Chrome 포트에 연결하지 않는다. 전용 CDP 포트와 전용 프로필을 사용한다.
- XML 식별자가 요청 대상 차트번호와 다르면 결과를 정상 산출물로 취급하지 않는다.
- 이 도구를 공식 Align 제품이나 임상 판단 도구로 소개하지 않는다.

자세한 설치·보안·문제 해결은 저장소의 `README.md`를 읽는다.

## 검색이 "실행됐는지"를 먼저 확인한다 (2026-08-30)

이 화면은 **입력만으로는 필터링되지 않는다.** 실행 버튼(돋보기)을 눌러야 검색이 돈다.
그래서 겉보기 0건에는 뜻이 정반대인 두 가지가 섞인다.

| 화면 | 뜻 | `searchPatients` 반환 |
|---|---|---|
| "일치 항목을 찾을 수 없습니다" 문구가 뜸 | 검색됨, 결과 없음 | `empty` |
| 전체 목록이 그대로 보임 | **검색이 실행되지 않음** | `not-executed` |
| 결과가 줄어듦 | 검색됨, 결과 있음 | `applied` |

`not-executed`를 0건으로 다루면 **「없다」와 「아직 묻지 못했다」를 같은 것으로 취급**하게 된다.
전체 목록을 그대로 훑게 되어 엉뚱한 행을 고르거나 타임아웃이 난다.
`searchPatients`는 이 상태를 반환하므로 호출부는 반드시 값을 확인할 것.

### 한글 입력은 `fill()`로
한 글자씩 입력하면(`pressSequentially`) 한글 IME 조합 중 중복 입력이 생겨
실제로 존재하지 않는 검색어가 만들어진다(예: 두 글자 이름이 세 글자가 된다).

### 이름 표기가 "성, 이름"이다
목록의 이름 칸은 성과 이름 사이에 쉼표+공백이 들어간다. 그래서 **성과 이름을 붙여 쓴 검색어는 걸리지 않는다.**
`searchForms()`가 이름만 / "성 이름" / "성이름" / 성 순으로 여러 형태를 시도하는 이유다.
