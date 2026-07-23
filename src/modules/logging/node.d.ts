import type { GuiLogLevel, GuiLogRecord, GuiLogSink } from "./index.js";

export class GuiNodeFileSink implements GuiLogSink {
  constructor(filePath: string, options?: {
    minLevel?: GuiLogLevel;
    maxBytes?: number;
    maxFiles?: number;
    encoding?: "utf8" | "utf-8" | "utf16le" | "ucs2" | "ucs-2" | "latin1" | "ascii";
  });
  filePath: string;
  minLevel: GuiLogLevel;
  maxBytes: number;
  maxFiles: number;
  encoding: string;
  write(record: GuiLogRecord): Promise<void>;
  writeBatch(records: GuiLogRecord[]): Promise<void>;
  flush(): Promise<void>;
  dispose(): Promise<void>;
}
