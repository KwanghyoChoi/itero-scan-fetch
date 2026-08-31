import { join } from "node:path";

export const HELP_TEXT = `
iTero STL 다운로드 (Chrome CDP)

사용법:
  node scripts/itero-download.mjs --targets "차트번호,이름" [옵션]
  node scripts/itero-download.mjs --patients N [옵션]

필수 선택:
  --targets LIST       차트번호 또는 이름을 쉼표로 구분해 지정
  --patients N         환자 목록의 앞에서 N명 처리

옵션:
  --dest DIR           ZIP 저장 폴더 (기본: ./itero-downloads)
  --credentials FILE   MYITERO_EMAIL/PASSWORD 환경파일 (기본: .env.itero)
  --max-downloads N    이번 실행의 최대 ZIP 수 (기본: 제한 없음)
  --download-timeout S 한 주문의 다운로드 대기 초 (기본: 480)
  --cdp-port PORT      전용 Chrome CDP 포트 (기본: 9334)
  --base-url URL       MyiTero 진입점 (기본: https://myitero.com)
  --patients-url URL   환자 목록 URL
  --endpoints          명시할 때만 최초·최종 주문 2건으로 제한
  --help               도움말
`;

function optionValue(argv, name, fallback) {
  const index = argv.indexOf(`--${name}`);
  const value = index >= 0 ? argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : fallback;
}

function positiveInteger(value, optionName) {
  const number = Number.parseInt(String(value), 10);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${optionName}에는 양의 정수를 지정하세요`);
  }
  return number;
}

// 설정으로 받은 주소는 **로그인 정보를 보내는 곳**이다. 형태를 확인하지 않으면
// 잘못된 값 하나로 자격 증명이 엉뚱한 서버로 간다. https 와 허용 호스트만 받는다.
const ALLOWED_HOST_SUFFIXES = ["myitero.com", "iterocloud.com", "aligntech.com"];

export function assertSafeUrl(value, optionName) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    throw new Error(`${optionName} 주소 형식이 올바르지 않습니다: ${value}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${optionName} 는 http/https 만 허용합니다: ${value}`);
  }
  const host = url.hostname.toLowerCase();
  const allowed = ALLOWED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
  if (!allowed) {
    throw new Error(`${optionName} 는 허용되지 않은 호스트입니다: ${host}`);
  }
  return String(value);
}

export function assertPort(value, optionName) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error(`${optionName} 는 1024~65535 사이의 정수여야 합니다: ${value}`);
  }
  return String(port);
}

export function parseArgs(argv, environment = process.env) {
  if (argv.includes("--help")) return { help: true };
  const rawTargets = optionValue(argv, "targets", "");
  const targets = rawTargets.split(",").map((value) => value.trim()).filter(Boolean);
  const patientValue = optionValue(argv, "patients", "");
  if ((targets.length > 0) === Boolean(patientValue)) {
    throw new Error("--targets 또는 --patients 중 하나를 지정하세요");
  }
  const destination = optionValue(
    argv,
    "dest",
    environment.ITERO_DEST || join(process.cwd(), "itero-downloads"),
  );
  const maxValue = optionValue(argv, "max-downloads", "");
  const timeoutValue = optionValue(argv, "download-timeout", "480");
  return {
    help: false,
    targets,
    patientCount: patientValue ? positiveInteger(patientValue, "--patients") : 0,
    destination,
    credentialsFile: optionValue(argv, "credentials", environment.ITERO_CREDENTIALS_FILE || join(process.cwd(), ".env.itero")),
    maxDownloads: maxValue ? positiveInteger(maxValue, "--max-downloads") : Number.POSITIVE_INFINITY,
    downloadTimeoutMs: positiveInteger(timeoutValue, "--download-timeout") * 1000,
    cdpPort: assertPort(optionValue(argv, "cdp-port", environment.ITERO_CDP_PORT || "9334"), "--cdp-port"),
    baseUrl: assertSafeUrl(optionValue(argv, "base-url", environment.ITERO_BASE_URL || "https://myitero.com"), "--base-url"),
    patientsUrl: assertSafeUrl(optionValue(argv, "patients-url", environment.ITERO_PATIENTS_URL || "https://bff.cloud.myitero.com/doctors/patients"), "--patients-url"),
    endpoints: argv.includes("--endpoints"),
  };
}
