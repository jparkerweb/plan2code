// The page side of the spec an app's New Session carries: loadSpecCarry() in selectors.js.
import assert from "node:assert/strict";
import test from "node:test";

import { page } from "../src/web-console/public/state.js";
import { loadSpecCarry } from "../src/web-console/public/selectors.js";

const specs = [
  { dir: "specs/a", name: "a", state: "building" },
  { dir: "specs/b", name: "b", state: "planned" },
];

// loadSpecCarry asks once per page, so each case is a fresh module copy.
async function fresh() {
  return (await import(`../src/web-console/public/selectors.js?${Math.random()}`)).loadSpecCarry;
}

function setup({ spec, sel } = {}) {
  page.S = { workflow: "dashboard", scan: { specs } };
  page.local = sel === undefined ? {} : { specSel: sel };
  globalThis.localStorage = { setItem() {}, getItem: () => null, removeItem() {} };
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push([url, init && init.method]);
    return { status: 200, json: async () => ({ spec }) };
  };
  return calls;
}

test("a carried spec the picker lists becomes the pick", async () => {
  setup({ spec: "specs/b" });
  await (await fresh())();
  assert.equal(page.local.specSel, "specs/b");
});

test("a carried spec the picker does not list leaves the default", async () => {
  setup({ spec: "specs/gone" });
  await (await fresh())();
  assert.equal("specSel" in page.local, false);
});

test("a pick the person already made is never replaced, or even asked about", async () => {
  const calls = setup({ spec: "specs/b", sel: null });
  await (await fresh())();
  assert.equal(page.local.specSel, null);
  assert.equal(calls.length, 0);
});

test("it asks once per page", async () => {
  const calls = setup({ spec: undefined });
  const load = await fresh();
  await load();
  await load();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ["/spec-carry", "POST"]);
  assert.equal(typeof loadSpecCarry, "function");
});
