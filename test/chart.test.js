import assert from "node:assert/strict";
import test from "node:test";

import { GuiDataBuffer, analyzeChartSignal, decimateMinMax, deriveChartSignal } from "../src/gui.js";

test("ring buffer retains only the newest points at fixed capacity", () => {
  const buffer = new GuiDataBuffer(3);
  buffer.append(1, 10);
  buffer.append(2, 20);
  buffer.append(3, 30);
  buffer.append(4, 40);

  assert.equal(buffer.length, 3);
  assert.deepEqual(
    Array.from({ length: buffer.length }, (_, index) => [
      buffer.xAt(index),
      buffer.yAt(index),
    ]),
    [[2, 20], [3, 30], [4, 40]],
  );
});

test("batch append accepts numbers, tuples, and point objects", () => {
  const buffer = new GuiDataBuffer(10);
  const appended = buffer.appendBatch([
    [1, 5],
    { x: 2, y: 7 },
    9,
    { x: 4, y: Number.NaN },
  ]);

  assert.equal(appended, 3);
  assert.equal(buffer.length, 3);
  assert.equal(buffer.yAt(2), 9);
});

test("resize preserves the newest chronological points", () => {
  const buffer = new GuiDataBuffer(5);
  buffer.appendBatch([[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]]);
  buffer.resize(3);

  assert.equal(buffer.capacity, 3);
  assert.deepEqual(
    Array.from({ length: 3 }, (_, index) => buffer.yAt(index)),
    [3, 4, 5],
  );
});

test("min/max decimation keeps large peaks visible", () => {
  const buffer = new GuiDataBuffer(1_000);
  for (let index = 0; index < 1_000; index += 1) {
    buffer.append(index, index === 501 ? 10_000 : Math.sin(index));
  }

  const indices = decimateMinMax(buffer, 0, buffer.length, 50);
  assert.ok(indices.length <= 102);
  assert.ok(indices.includes(501));
  assert.equal(indices[0], 0);
  assert.equal(indices.at(-1), 999);
});

test("signal analysis reports stable statistics and rates", () => {
  const stats = analyzeChartSignal([[10, 2], [20, 4], [30, 8]]);
  assert.deepEqual(stats, {
    count: 3, min: 2, max: 8, mean: 14 / 3,
    standardDeviation: Math.sqrt(56 / 9), delta: 6, rate: .3,
  });
});

test("derived signals support moving averages, derivatives, integrals, and differences", () => {
  const points = [[0, 2], [10, 4], [20, 8]];
  assert.deepEqual(deriveChartSignal(points, { operation: "moving-average", window: 2 }).map((point) => point.y), [2, 3, 6]);
  assert.deepEqual(deriveChartSignal(points, { operation: "derivative" }).map((point) => point.y), [0, .2, .4]);
  assert.deepEqual(deriveChartSignal(points, { operation: "integral" }).map((point) => point.y), [0, 30, 90]);
  assert.deepEqual(deriveChartSignal(points, { operation: "difference", compare: [[0, 1], [10, 1], [20, 3]] }).map((point) => point.y), [1, 3, 5]);
});
