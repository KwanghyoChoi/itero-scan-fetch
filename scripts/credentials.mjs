import { readFileSync, statSync } from "node:fs";

export function readCredentials(filePath) {
  const mode = statSync(filePath).mode & 0o777;
  if (mode & 0o077) throw new Error(`${filePath} 권한이 너무 넓습니다. chmod 600을 사용하세요`);
  const values = Object.fromEntries(
    readFileSync(filePath, "utf8")
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        return separator > 0 ? [line.slice(0, separator).trim(), line.slice(separator + 1).trim()] : ["", ""];
      })
      .filter(([key, value]) => key && value),
  );
  if (!values.MYITERO_EMAIL || !values.MYITERO_PASSWORD) {
    throw new Error("자격증명 파일에 MYITERO_EMAIL과 MYITERO_PASSWORD가 필요합니다");
  }
  return { email: values.MYITERO_EMAIL, password: values.MYITERO_PASSWORD };
}
