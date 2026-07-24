import { createReadStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  GuiConsoleSink,
  GuiLogManager,
} from "../../src/modules/logging/index.js";
import { GuiNodeFileSink } from "../../src/modules/logging/node.js";

const demoDirectory = fileURLToPath(new URL(".", import.meta.url));
const repositoryRoot = normalize(resolve(demoDirectory, "..", ".."));
const runtimeDirectory = resolve(demoDirectory, "runtime");
const logFile = resolve(runtimeDirectory, "full-demo.jsonl");
const port = Number(process.env.GUI_FULL_DEMO_PORT ?? 4174);

const backendLogs = new GuiLogManager({
  level: "trace",
  context: {
    application: "guikit-full-demo",
    process: "node-server",
  },
});
const fileSink = new GuiNodeFileSink(logFile, {
  maxBytes: 2 * 1024 * 1024,
  maxFiles: 3,
});
backendLogs.addSink(new GuiConsoleSink({ minLevel: "info" }));
backendLogs.addSink(fileSink);
const serverLog = backendLogs.createLogger("server");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".vtt": "text/vtt; charset=utf-8",
};

function json(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(data));
}

async function readJsonBody(request, maxBytes = 1_048_576) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error("Request body exceeds the 1 MB demo limit.");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function handleApi(request, response, pathname) {
  if (request.method === "GET" && pathname === "/api/info") {
    json(response, 200, {
      host: "GuiKit Node backend",
      runtime: process.version,
      platform: process.platform,
      logFile,
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/logs") {
    const payload = await readJsonBody(request);
    const candidates = Array.isArray(payload.records) ? payload.records.slice(0, 1_000) : [];
    const records = candidates.filter((record) =>
      record && record.schema === "guikit.log/v1" && typeof record.message === "string");
    if (records.length) await fileSink.writeBatch(records);
    serverLog.info("Frontend log batch accepted", {
      accepted: records.length,
      rejected: candidates.length - records.length,
    });
    json(response, 202, { accepted: records.length });
    return true;
  }

  if (pathname.startsWith("/api/")) {
    json(response, 404, { error: "Unknown demo API endpoint." });
    return true;
  }
  return false;
}

async function handleStatic(response, pathname) {
  const relative = pathname === "/" ? "examples/full-demo/" : pathname.replace(/^\/+/, "");
  const requested = relative.endsWith("/") ? `${relative}index.html` : relative;
  const filePath = normalize(resolve(repositoryRoot, requested));
  const allowedRoot = repositoryRoot.endsWith(sep) ? repositoryRoot : `${repositoryRoot}${sep}`;
  if (filePath !== repositoryRoot && !filePath.startsWith(allowedRoot)) {
    json(response, 403, { error: "Path is outside the demo root." });
    return;
  }

  let fileStats;
  try {
    fileStats = await stat(filePath);
  } catch (error) {
    error.status = error.code === "ENOENT" ? 404 : 500;
    throw error;
  }
  if (!fileStats.isFile()) {
    const error = new Error("File not found.");
    error.status = 404;
    throw error;
  }

  const stream = createReadStream(filePath);
  stream.on("error", (error) => {
    if (!response.headersSent) json(response, error.code === "ENOENT" ? 404 : 500, {
      error: error.code === "ENOENT" ? "File not found." : "Could not read file.",
    });
    else response.destroy(error);
  });
  response.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream",
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
  });
  stream.pipe(response);
}

await mkdir(runtimeDirectory, { recursive: true });

const server = createServer(async (request, response) => {
  const requestLog = serverLog.child("request", {
    requestId: globalThis.crypto.randomUUID(),
    method: request.method,
  });
  try {
    const url = new URL(request.url, "http://127.0.0.1");
    if (await handleApi(request, response, url.pathname)) return;
    await handleStatic(response, decodeURIComponent(url.pathname));
  } catch (error) {
    requestLog.error("Request failed", error);
    const status = error.status ?? 400;
    const message = status === 404 ? "File not found."
      : status >= 500 ? "The demo server could not complete the request."
        : error.message;
    if (!response.headersSent) json(response, status, { error: message });
    else response.destroy(error);
  }
});

server.listen(port, "127.0.0.1", () => {
  serverLog.info("Full demo server started", {
    url: `http://127.0.0.1:${port}/examples/full-demo/`,
    logFile,
  });
  console.log(`GuiKit full demo: http://127.0.0.1:${port}/examples/full-demo/`);
});

async function shutdown(signal) {
  serverLog.info("Full demo server stopping", { signal });
  server.close(async () => {
    await backendLogs.dispose();
    process.exit(0);
  });
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

export { backendLogs, server };
