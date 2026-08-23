import test from "node:test";
import assert from "node:assert/strict";

import { rowMatches, searchForms, splitName } from "../scripts/patient-search.mjs";

test("두 글자 한글 이름도 성과 이름으로 나눈다", () => {
  assert.deepEqual(splitName("가나"), ["가", "나"]);
  assert.deepEqual(searchForms("가나"), ["나", "가 나", "가나", "가"]);
});

test("복성은 두 글자를 성으로 보존한다", () => {
  assert.deepEqual(splitName("남궁민수"), ["남궁", "민수"]);
  assert.deepEqual(searchForms("남궁민수"), ["민수", "남궁 민수", "남궁민수", "남궁"]);
});

test("검색 결과 행은 공백과 표기 순서가 달라도 대조한다", () => {
  assert.equal(rowMatches("나 가 1234567", "가나"), true);
  assert.equal(rowMatches("가 다 7654321", "가나"), false);
  assert.equal(rowMatches("", "가나"), false);
});
