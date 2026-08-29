import assert from "node:assert/strict";
import test from "node:test";

import { classifySearch, hasEmptyMarker } from "../scripts/search-state.mjs";

const FULL_LIST = ["행1 1000001", "행2 1000002", "행3 1000003"];

test("결과 없음 문구를 인식한다", () => {
  assert.equal(hasEmptyMarker("일치 항목을 찾을 수 없습니다"), true);
  assert.equal(hasEmptyMarker("No matching records found"), true);
  assert.equal(hasEmptyMarker("환자 목록"), false);
});

test("검색 전후가 동일하면 '실행되지 않음'이다", () => {
  // 입력만 하고 실행 버튼을 누르지 않으면 전체 목록이 그대로 남는다.
  // 이걸 0건으로 읽으면 「없다」와 「묻지 못했다」를 같은 것으로 취급하게 된다.
  assert.equal(
    classifySearch({ beforeRows: FULL_LIST, afterRows: FULL_LIST, pageText: "환자 목록" }),
    "not-executed",
  );
});

test("결과가 줄어들면 '적용됨'이다", () => {
  assert.equal(
    classifySearch({ beforeRows: FULL_LIST, afterRows: ["행2 1000002"], pageText: "환자 목록" }),
    "applied",
  );
});

test("안내 문구가 있으면 표가 그대로여도 '결과 없음'이다", () => {
  assert.equal(
    classifySearch({
      beforeRows: FULL_LIST,
      afterRows: FULL_LIST,
      pageText: "일치 항목을 찾을 수 없습니다",
    }),
    "empty",
  );
});

test("표가 비었고 이전에 행이 있었으면 '결과 없음'이다", () => {
  assert.equal(
    classifySearch({ beforeRows: FULL_LIST, afterRows: [], pageText: "" }),
    "empty",
  );
});

test("처음부터 표가 없으면 '실행되지 않음'으로 본다", () => {
  // 아직 그리는 중일 수 있으므로 0건이라 단정하지 않는다.
  assert.equal(classifySearch({ beforeRows: [], afterRows: [], pageText: "" }), "not-executed");
});
