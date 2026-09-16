// Run with:  node --test lib/recall.test.ts   (Node 24 strips types natively)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildTopicPool,
  drawTopic,
  mocLabel,
  frameworkLabel,
  normalizeKey,
  MIN_CLUSTER,
  type RecallNote,
} from "./recall.ts";

// --- fixtures ----------------------------------------------------------------

function note(partial: Partial<RecallNote> & { name: string }): RecallNote {
  return {
    title: partial.name,
    type: "concept",
    tags: [],
    foundation: false,
    category: "Uncategorized",
    wikilinks: [],
    ...partial,
  };
}

// A small world-like garden: one MOC over three concepts, a framework tag over
// three others, and a couple of standalone foundation theses.
function sampleGarden(): RecallNote[] {
  return [
    note({
      name: "State system MOC",
      title: "State system MOC",
      type: "moc",
      tags: ["#moc"],
      foundation: true,
      wikilinks: ["Sovereignty", "The Montevideo test", "Quasi-states", "Nonexistent Note"],
    }),
    note({ name: "Sovereignty", type: "concept", foundation: true }),
    note({ name: "The Montevideo test", type: "fact" }),
    note({ name: "Quasi-states", type: "concept" }),

    note({ name: "Centrality", type: "concept", tags: ["#framework/network-power"] }),
    note({ name: "Chokepoints", type: "fact", tags: ["#framework/network-power"] }),
    note({ name: "Dependency networks", type: "concept", tags: ["#framework/network-power"] }),

    note({ name: "Events happen, structures matter", type: "concept", foundation: true }),
    note({ name: "Borders are constructed", type: "concept", foundation: true }),
  ];
}

// --- label helpers -----------------------------------------------------------

test("mocLabel strips the MOC token", () => {
  assert.equal(mocLabel("State system MOC"), "State system");
  assert.equal(mocLabel("Economic Development Arc MOC"), "Economic Development Arc");
  assert.equal(mocLabel("World MOC"), "World");
});

test("frameworkLabel humanizes the tag's last segment", () => {
  assert.equal(frameworkLabel("#framework/network-power"), "Network power");
  assert.equal(frameworkLabel("framework/power"), "Power");
});

test("normalizeKey collapses to a comparable key", () => {
  assert.equal(normalizeKey("Network power"), "network power");
  assert.equal(normalizeKey("State system"), "state system");
});

// --- cluster building --------------------------------------------------------

test("MOC cluster resolves members, skips missing links and non-member types", () => {
  const pool = buildTopicPool(sampleGarden());
  const state = pool.find((t) => t.label === "State system");
  assert.ok(state, "expected a 'State system' cluster");
  assert.equal(state.kind, "cluster");
  assert.equal(state.source, "moc");
  // 3 real members; "Nonexistent Note" is dropped (unresolved).
  assert.deepEqual(
    state.members.map((m) => m.name).sort(),
    ["Quasi-states", "Sovereignty", "The Montevideo test"]
  );
});

test("framework tag forms a cluster", () => {
  const pool = buildTopicPool(sampleGarden());
  const net = pool.find((t) => t.label === "Network power");
  assert.ok(net, "expected a 'Network power' cluster");
  assert.equal(net.source, "framework");
  assert.equal(net.members.length, 3);
});

test("clusters below MIN_CLUSTER are excluded (hidden gate)", () => {
  const small = [
    note({ name: "Tiny MOC", title: "Tiny MOC", type: "moc", wikilinks: ["A", "B"] }),
    note({ name: "A", type: "concept" }),
    note({ name: "B", type: "concept" }),
  ];
  assert.equal(MIN_CLUSTER, 3);
  const pool = buildTopicPool(small);
  assert.equal(pool.filter((t) => t.kind === "cluster").length, 0);
});

test("MOC label wins over an overlapping framework tag (dedupe)", () => {
  const notes = [
    note({
      name: "Network power MOC",
      title: "Network power MOC",
      type: "moc",
      wikilinks: ["Centrality", "Chokepoints", "Dependency networks"],
    }),
    note({ name: "Centrality", type: "concept", tags: ["#framework/network-power"] }),
    note({ name: "Chokepoints", type: "fact", tags: ["#framework/network-power"] }),
    note({ name: "Dependency networks", type: "concept", tags: ["#framework/network-power"] }),
  ];
  const pool = buildTopicPool(notes);
  const net = pool.filter((t) => normalizeKey(t.label) === "network power");
  assert.equal(net.length, 1, "MOC and framework tag should collapse to one topic");
  assert.equal(net[0].source, "moc");
});

test("the garden's root MOC is dropped (a ToC, not a topic)", () => {
  const notes = [
    note({
      name: "World MOC",
      title: "World MOC",
      type: "moc",
      wikilinks: ["Geographic Determinism", "Technology reprices geography", "Markets"],
    }),
    note({ name: "Geographic Determinism", type: "concept" }),
    note({ name: "Technology reprices geography", type: "concept" }),
    note({ name: "Markets", type: "fact" }),
  ];
  const pool = buildTopicPool(notes, "world");
  assert.ok(!pool.some((t) => normalizeKey(t.label) === "world"));
});

test("framework cluster overlapping a MOC is dropped by member overlap", () => {
  const notes = [
    note({
      name: "Economic Development Arc MOC",
      title: "Economic Development Arc MOC",
      type: "moc",
      wikilinks: ["Catch-up growth", "Manufacturing transition", "Services layer"],
    }),
    note({ name: "Catch-up growth", type: "concept", tags: ["#framework/development-arc"] }),
    note({ name: "Manufacturing transition", type: "fact", tags: ["#framework/development-arc"] }),
    note({ name: "Services layer", type: "concept", tags: ["#framework/development-arc"] }),
  ];
  const pool = buildTopicPool(notes);
  // Only the MOC survives; the near-identical "Development arc" tag is dropped.
  const arcs = pool.filter((t) => t.kind === "cluster");
  assert.equal(arcs.length, 1);
  assert.equal(arcs[0].source, "moc");
});

test("reference-style titles are not offered as theses", () => {
  const notes = [
    note({ name: "Structural power (Susan Strange)", type: "concept", foundation: true }),
    note({ name: "yen-carry-trade-and-current-impact", type: "concept", foundation: true }),
    note({ name: "Events happen, structures matter", type: "concept", foundation: true }),
  ];
  const theses = buildTopicPool(notes)
    .filter((t) => t.kind === "thesis")
    .map((t) => t.label);
  assert.deepEqual(theses, ["Events happen, structures matter"]);
});

test("thesis pool = foundation concept notes, minus cluster labels", () => {
  const pool = buildTopicPool(sampleGarden());
  const theses = pool.filter((t) => t.kind === "thesis").map((t) => t.label);
  assert.ok(theses.includes("Events happen, structures matter"));
  assert.ok(theses.includes("Borders are constructed"));
  // "Sovereignty" is a foundation concept but it's a member of a cluster, not a
  // cluster label, so it still qualifies as a thesis. It must, however, not be
  // a *cluster*.
  assert.ok(!pool.some((t) => t.kind === "cluster" && t.label === "Sovereignty"));
});

// --- drawing -----------------------------------------------------------------

test("drawTopic returns null for an empty pool", () => {
  assert.equal(drawTopic([]), null);
});

test("drawTopic favors clusters when thesisChance is 0", () => {
  const pool = buildTopicPool(sampleGarden());
  const t = drawTopic(pool, { thesisChance: 0, rng: () => 0 });
  assert.ok(t);
  assert.equal(t.kind, "cluster");
});

test("drawTopic draws a thesis when thesisChance is 1", () => {
  const pool = buildTopicPool(sampleGarden());
  const t = drawTopic(pool, { thesisChance: 1, rng: () => 0 });
  assert.ok(t);
  assert.equal(t.kind, "thesis");
});

test("drawTopic honors the exclude list", () => {
  const pool = buildTopicPool(sampleGarden());
  const clusters = pool.filter((t) => t.kind === "cluster");
  const excluded = clusters[0].key;
  // rng=0 would otherwise pick the first cluster; excluding it must yield another.
  const t = drawTopic(pool, { thesisChance: 0, exclude: [excluded], rng: () => 0 });
  assert.ok(t);
  assert.notEqual(t.key, excluded);
});

test("drawTopic relaxes exclusion rather than returning null", () => {
  const pool = buildTopicPool(sampleGarden());
  const allKeys = pool.map((t) => t.key);
  const t = drawTopic(pool, { exclude: allKeys, rng: () => 0 });
  assert.ok(t, "should still draw something when everything is excluded");
});
