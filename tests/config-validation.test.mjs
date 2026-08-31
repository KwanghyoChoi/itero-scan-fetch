import assert from "node:assert/strict";
import test from "node:test";

import { assertPort, assertSafeUrl } from "../scripts/config.mjs";

test("허용된 호스트의 주소는 통과한다", () => {
  assert.equal(assertSafeUrl("https://myitero.com", "--base-url"), "https://myitero.com");
  assert.equal(
    assertSafeUrl("https://bff.cloud.myitero.com/doctors/patients", "--patients-url"),
    "https://bff.cloud.myitero.com/doctors/patients",
  );
});

test("허용되지 않은 호스트는 거부한다", () => {
  // 이 주소로는 로그인 정보가 전송된다. 형태만 맞다고 받아들이면 자격 증명이 엉뚱한 곳으로 간다.
  assert.throws(() => assertSafeUrl("https://example.com", "--base-url"), /허용되지 않은 호스트/u);
  assert.throws(() => assertSafeUrl("https://myitero.com.evil.test", "--base-url"), /허용되지 않은 호스트/u);
  assert.throws(() => assertSafeUrl("not-a-url", "--base-url"), /형식이 올바르지 않습니다/u);
});

test("포트는 1024~65535 정수만 받는다", () => {
  assert.equal(assertPort("9334", "--cdp-port"), "9334");
  assert.throws(() => assertPort("80", "--cdp-port"), /1024~65535/u);
  assert.throws(() => assertPort("abc", "--cdp-port"), /1024~65535/u);
  assert.throws(() => assertPort("70000", "--cdp-port"), /1024~65535/u);
});
