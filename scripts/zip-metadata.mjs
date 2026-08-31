import { execFileSync } from "node:child_process";

function readTag(xml, tagName) {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = xml.match(new RegExp(`<(?:(?:[A-Za-z0-9_-]+):)?${escaped}>([^<]*)</`, "u"));
  return match?.[1]?.trim() ?? "";
}

export function parseExportMetadata(xml) {
  const orderId = readTag(String(xml), "OrderID");
  const chartNumber = readTag(String(xml), "ChartNumber");
  if (!orderId || !chartNumber) {
    throw new Error("ZIP XML에 OrderID와 ChartNumber가 모두 필요합니다");
  }
  // OrderID 는 파일 이름을 만드는 데 쓰인다. 숫자가 아니면 경로를 벗어나는 이름이 될 수 있으므로
  // (예: 상위 디렉터리로 올라가는 문자열) 여기서 막는다. 서버가 주는 값이라도 형태는 확인한다.
  if (!/^\d+$/u.test(orderId)) {
    throw new Error(`OrderID 형식이 올바르지 않습니다: ${orderId}`);
  }
  return { orderId, chartNumber };
}

export function readZipMetadata(zipPath) {
  const xml = execFileSync("unzip", ["-p", zipPath, "*.xml"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return parseExportMetadata(xml);
}

export function exportFileName(orderId) {
  return `OrthoCAD_Export_${orderId}.zip`;
}

/**
 * 내려받은 ZIP 이 온전한지 확인한다.
 *
 * "받았다"는 **파일이 열린다**는 뜻이어야 한다. 이 확인이 없으면 중간에 끊긴 ZIP 도
 * 성공으로 기록되고, 나중에 그 파일을 열어야 할 때가 되어서야 문제가 드러난다.
 * 그 시점에는 언제 깨졌는지 알아낼 방법이 없다.
 *
 * @returns {{ok: boolean, reason?: string, stlCount: number}}
 */
export function verifyZipIntegrity(zipPath) {
  try {
    execFileSync("unzip", ["-t", zipPath], { stdio: ["ignore", "ignore", "pipe"], maxBuffer: 8 * 1024 * 1024 });
  } catch (error) {
    return { ok: false, reason: `압축이 손상되었습니다: ${String(error).slice(0, 80)}`, stlCount: 0 };
  }
  let names = [];
  try {
    names = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).split("\n");
  } catch {
    return { ok: false, reason: "압축 목록을 읽지 못했습니다", stlCount: 0 };
  }
  const stlCount = names.filter((name) => /\.stl$/iu.test(name.trim())).length;
  if (stlCount === 0) return { ok: false, reason: "STL 파일이 없습니다", stlCount };
  return { ok: true, stlCount };
}
