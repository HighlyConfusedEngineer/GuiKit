import { appendFile, mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Ordered JSONL writer with size-based rotation for Node backend processes.
 */
export class GuiNodeFileSink {
  #pending = Promise.resolve();
  #size = null;
  #closed = false;

  constructor(filePath, options = {}) {
    if (!filePath) throw new TypeError("GuiNodeFileSink requires a file path.");
    this.filePath = filePath;
    this.minLevel = options.minLevel ?? "trace";
    this.maxBytes = Math.max(1_024, options.maxBytes ?? 10 * 1_024 * 1_024);
    this.maxFiles = Math.max(1, options.maxFiles ?? 5);
    this.encoding = options.encoding ?? "utf8";
  }

  write(record) {
    return this.writeBatch([record]);
  }

  writeBatch(records) {
    if (this.#closed) return Promise.reject(new Error("The log file sink is closed."));
    if (!records.length) return this.#pending;
    const chunk = `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
    this.#pending = this.#pending.then(() => this.#append(chunk));
    return this.#pending;
  }

  async #append(chunk) {
    await mkdir(dirname(this.filePath), { recursive: true });
    if (this.#size == null) {
      this.#size = await stat(this.filePath).then((value) => value.size).catch((error) => {
        if (error.code === "ENOENT") return 0;
        throw error;
      });
    }
    const bytes = Buffer.byteLength(chunk, this.encoding);
    if (this.#size > 0 && this.#size + bytes > this.maxBytes) await this.#rotate();
    await appendFile(this.filePath, chunk, { encoding: this.encoding });
    this.#size += bytes;
  }

  async #rotate() {
    await rm(`${this.filePath}.${this.maxFiles}`, { force: true });
    for (let index = this.maxFiles - 1; index >= 1; index -= 1) {
      await rename(`${this.filePath}.${index}`, `${this.filePath}.${index + 1}`)
        .catch((error) => {
          if (error.code !== "ENOENT") throw error;
        });
    }
    await rename(this.filePath, `${this.filePath}.1`).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    this.#size = 0;
  }

  flush() {
    return this.#pending;
  }

  async dispose() {
    await this.flush();
    this.#closed = true;
  }
}
