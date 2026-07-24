import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  GuiMediaAdapterRegistry,
  GuiMediaPlayer,
  mediaPlayerModule,
} from "../src/modules/media-player/index.js";

test("media player module exposes its component and manifest", () => {
  assert.equal(typeof GuiMediaPlayer, "function");
  assert.equal(mediaPlayerModule.id, "media-player");
  assert.deepEqual(mediaPlayerModule.components, ["gui-media-player"]);
});

test("media player registers only after its browser resources initialize", async () => {
  const source = await readFile(
    new URL("../src/modules/media-player/index.js", import.meta.url),
    "utf8",
  );
  const styles = source.indexOf("const MEDIA_PLAYER_STYLES");
  const automaticRegistration = source.lastIndexOf(
    'customElements.define("gui-media-player", GuiMediaPlayer)',
  );

  assert.ok(styles >= 0);
  assert.ok(automaticRegistration > styles);
});

test("media adapters are selected by priority", () => {
  const registry = new GuiMediaAdapterRegistry();
  registry.register({
    id: "fallback",
    priority: 1,
    canHandle: () => true,
    attach: () => undefined,
  });
  registry.register({
    id: "preferred",
    priority: 10,
    canHandle: (source) => source.type === "custom/live",
    attach: () => undefined,
  });

  assert.equal(
    registry.find({ src: "stream", type: "custom/live" }, {}).id,
    "preferred",
  );
  assert.equal(
    registry.find({ src: "movie.mp4", type: "video/mp4" }, {}).id,
    "fallback",
  );
});

test("media adapter ids are unique and removable", () => {
  const registry = new GuiMediaAdapterRegistry();
  const adapter = {
    id: "adapter",
    canHandle: () => false,
    attach: () => undefined,
  };
  registry.register(adapter);
  assert.throws(() => registry.register(adapter), /already registered/);
  assert.equal(registry.unregister("adapter"), true);
  assert.equal(registry.unregister("adapter"), false);
  assert.deepEqual(registry.list(), []);
});
