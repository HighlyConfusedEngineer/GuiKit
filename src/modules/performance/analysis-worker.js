function normalize(point, fallbackX = 0) {
  if (typeof point === "number") return { x: fallbackX, y: point };
  if (Array.isArray(point)) return { x: Number(point[0]), y: Number(point[1]) };
  return point && typeof point === "object" ? { x: Number(point.x ?? fallbackX), y: Number(point.y) } : null;
}

function analyze(points) {
  const values = (points ?? []).map(normalize).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (!values.length) return { count: 0, min: null, max: null, mean: null, standardDeviation: null, delta: null, rate: null };
  const total = values.reduce((sum, point) => sum + point.y, 0);
  const mean = total / values.length;
  const first = values[0]; const last = values.at(-1);
  return {
    count: values.length,
    min: Math.min(...values.map((point) => point.y)), max: Math.max(...values.map((point) => point.y)), mean,
    standardDeviation: Math.sqrt(values.reduce((sum, point) => sum + ((point.y - mean) ** 2), 0) / values.length),
    delta: last.y - first.y, rate: last.x === first.x ? null : (last.y - first.y) / (last.x - first.x),
  };
}

self.addEventListener("message", (event) => {
  const { id, type, payload } = event.data ?? {};
  try {
    if (type === "analyze") self.postMessage({ id, result: analyze(payload?.points) });
    else throw new Error(`Unknown GuiKit analysis worker task "${type}".`);
  } catch (error) { self.postMessage({ id, error: String(error?.message ?? error) }); }
});
