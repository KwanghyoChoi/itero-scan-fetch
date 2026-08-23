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
