const hasDOM = typeof window !== "undefined" && typeof document !== "undefined";
const GuiElement = hasDOM ? HTMLElement : class {};

function dispatch(target, name, detail = {}) {
  if (!hasDOM) return;
  target.dispatchEvent(new CustomEvent(name, {
    bubbles: true,
    composed: true,
    detail,
  }));
}

function normalizeSource(source) {
  if (typeof source === "string") return { src: source };
  if (source && typeof source === "object") return { ...source };
  throw new TypeError("A media source must be a URL string or source object.");
}

function isMediaStream(value) {
  return hasDOM && typeof MediaStream !== "undefined" && value instanceof MediaStream;
}

export class GuiMediaAdapterRegistry {
  #adapters = [];

  register(adapter) {
    if (!adapter?.id || typeof adapter.canHandle !== "function" || typeof adapter.attach !== "function") {
      throw new TypeError("A media adapter requires id, canHandle, and attach.");
    }
    if (this.#adapters.some((candidate) => candidate.id === adapter.id)) {
      throw new Error(`Media adapter "${adapter.id}" is already registered.`);
    }
    const normalized = Object.freeze({
      priority: 0,
      ...adapter,
    });
    this.#adapters.push(normalized);
    this.#adapters.sort((first, second) => second.priority - first.priority);
    return normalized;
  }

  unregister(id) {
    const index = this.#adapters.findIndex((adapter) => adapter.id === id);
    if (index < 0) return false;
    this.#adapters.splice(index, 1);
    return true;
  }

  list() {
    return [...this.#adapters];
  }

  find(source, mediaElement) {
    return this.#adapters.find((adapter) => adapter.canHandle(source, mediaElement));
  }
}

export const mediaAdapters = new GuiMediaAdapterRegistry();

export class GuiMediaPlayer extends GuiElement {
  static observedAttributes = [
    "autoplay",
    "label",
    "live",
    "loop",
    "muted",
    "poster",
    "src",
  ];

  #video;
  #surface;
  #playButton;
  #centerButton;
  #muteButton;
  #seek;
  #volume;
  #time;
  #liveBadge;
  #spinner;
  #error;
  #pipButton;
  #captionButton;
  #rateButton;
  #controlsTimer;
  #source;
  #adapterCleanup;
  #loadToken = 0;
  #tracks = [];

  connectedCallback() {
    this.#ensureView();
    this.#syncAttributes();
    if (this.hasAttribute("src") && this.#source?.src !== this.getAttribute("src")) {
      this.setSource({
        src: this.getAttribute("src"),
        type: this.getAttribute("type") ?? undefined,
        live: this.hasAttribute("live"),
      }).catch(() => {});
    }
    this.#renderState();
  }

  disconnectedCallback() {
    clearTimeout(this.#controlsTimer);
    ++this.#loadToken;
    this.#detachCurrent(false).catch(() => {});
  }

  attributeChangedCallback(name, _previous, current) {
    if (!this.isConnected) return;
    if (name === "src" && current && current !== this.#source?.src) {
      this.setSource({
        src: current,
        type: this.getAttribute("type") ?? undefined,
        live: this.hasAttribute("live"),
      }).catch(() => {});
      return;
    }
    this.#syncAttributes();
  }

  get mediaElement() {
    return this.#video;
  }

  get source() {
    return this.#source ? { ...this.#source } : null;
  }

  get live() {
    return this.hasAttribute("live");
  }

  set live(value) {
    this.toggleAttribute("live", Boolean(value));
  }

  get paused() {
    return this.#video?.paused ?? true;
  }

  get currentTime() {
    return this.#video?.currentTime ?? 0;
  }

  set currentTime(value) {
    this.seek(value);
  }

  get duration() {
    return this.#video?.duration ?? Number.NaN;
  }

  get volume() {
    return this.#video?.volume ?? 1;
  }

  set volume(value) {
    if (!this.#video) return;
    this.#video.volume = Math.min(1, Math.max(0, Number(value)));
  }

  get muted() {
    return this.#video?.muted ?? this.hasAttribute("muted");
  }

  set muted(value) {
    this.toggleAttribute("muted", Boolean(value));
    if (this.#video) this.#video.muted = Boolean(value);
  }

  async setSource(source) {
    this.#ensureView();
    const normalized = normalizeSource(source);
    if (!normalized.src) throw new TypeError("A URL media source requires src.");
    const token = ++this.#loadToken;
    this.#setLoading(true);
    this.#clearError();
    await this.#detachCurrent(false);
    if (token !== this.#loadToken) return;

    this.#source = normalized;
    this.live = Boolean(normalized.live);
    if (normalized.poster !== undefined) this.#video.poster = normalized.poster;
    if (normalized.crossOrigin !== undefined) this.#video.crossOrigin = normalized.crossOrigin;
    this.setTracks(normalized.tracks ?? []);

    const adapter = mediaAdapters.find(normalized, this.#video);
    try {
      if (adapter) {
        const result = await adapter.attach(normalized, this.#video, {
          player: this,
          signal: normalized.signal,
        });
        const cleanup = typeof result === "function"
          ? result
          : result?.destroy?.bind(result);
        if (token !== this.#loadToken) {
          cleanup?.();
          return;
        }
        this.#adapterCleanup = cleanup;
      } else {
        this.#assertNativeSupport(normalized);
        this.#video.srcObject = null;
        this.#video.src = normalized.src;
        this.#video.load();
      }

      if (this.hasAttribute("autoplay") || normalized.autoplay) {
        await this.play().catch((error) => {
          dispatch(this, "gui:media-autoplay-blocked", { error });
        });
      }
      dispatch(this, "gui:media-source-change", { source: this.source, adapter: adapter?.id ?? "native" });
    } catch (error) {
      this.#showError(error);
      throw error;
    }
  }

  async attachStream(stream, options = {}) {
    this.#ensureView();
    if (!isMediaStream(stream)) throw new TypeError("attachStream requires a MediaStream.");
    ++this.#loadToken;
    await this.#detachCurrent(false);
    this.#source = {
      kind: "stream",
      live: options.live ?? true,
      label: options.label,
    };
    this.live = this.#source.live;
    this.#video.srcObject = stream;
    this.#video.removeAttribute("src");
    this.#clearError();
    if (this.hasAttribute("autoplay") || options.autoplay) {
      await this.play().catch((error) => {
        dispatch(this, "gui:media-autoplay-blocked", { error });
      });
    }
    dispatch(this, "gui:media-source-change", { source: this.source, adapter: "media-stream" });
  }

  async detach(options = {}) {
    ++this.#loadToken;
    await this.#detachCurrent(Boolean(options.stopTracks));
    this.#source = null;
    this.removeAttribute("src");
    this.live = false;
    this.#clearError();
    this.#renderState();
  }

  async play() {
    if (!this.#video) return;
    return this.#video.play();
  }

  pause() {
    this.#video?.pause();
  }

  togglePlayback() {
    return this.paused ? this.play() : this.pause();
  }

  seek(time) {
    if (!this.#video || !Number.isFinite(this.#video.duration)) return false;
    this.#video.currentTime = Math.min(
      this.#video.duration,
      Math.max(0, Number(time)),
    );
    return true;
  }

  seekToLive() {
    if (!this.#video) return false;
    if (this.#video.seekable.length) {
      this.#video.currentTime = this.#video.seekable.end(this.#video.seekable.length - 1);
      return true;
    }
    if (Number.isFinite(this.#video.duration)) {
      this.#video.currentTime = Math.max(0, this.#video.duration - 0.15);
      return true;
    }
    return false;
  }

  setTracks(tracks = []) {
    this.#tracks = tracks.map((track) => ({ ...track }));
    if (hasDOM) this.#ensureView();
    if (!this.#video) return;
    this.#video?.querySelectorAll("track").forEach((track) => track.remove());
    this.#tracks.forEach((configuration) => {
      const track = document.createElement("track");
      Object.entries(configuration).forEach(([key, value]) => {
        if (key === "default") {
          if (value) track.setAttribute("default", "");
        } else if (value !== undefined) {
          track.setAttribute(key, String(value));
        }
      });
      this.#video.append(track);
    });
    this.#renderCaptions();
  }

  async togglePictureInPicture() {
    if (!hasDOM || !document.pictureInPictureEnabled || !this.#video) return false;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await this.#video.requestPictureInPicture();
      return true;
    } catch (error) {
      dispatch(this, "gui:media-error", { error, operation: "picture-in-picture" });
      return false;
    }
  }

  async toggleFullscreen() {
    if (!hasDOM) return false;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await this.requestFullscreen();
      return true;
    } catch (error) {
      dispatch(this, "gui:media-error", { error, operation: "fullscreen" });
      return false;
    }
  }

  #createView() {
    const root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = MEDIA_PLAYER_STYLES;

    this.#surface = document.createElement("div");
    this.#surface.className = "player";
    this.#surface.tabIndex = 0;
    this.#surface.setAttribute("role", "region");

    this.#video = document.createElement("video");
    this.#video.playsInline = true;
    this.#video.preload = "metadata";
    this.#video.setAttribute("webkit-playsinline", "");
    this.#video.setAttribute("x-webkit-airplay", "allow");

    const chrome = document.createElement("div");
    chrome.className = "chrome";
    this.#liveBadge = document.createElement("button");
    this.#liveBadge.className = "live-badge";
    this.#liveBadge.type = "button";
    this.#liveBadge.textContent = "LIVE";
    this.#liveBadge.addEventListener("click", () => this.seekToLive());

    this.#spinner = document.createElement("div");
    this.#spinner.className = "spinner";
    this.#spinner.setAttribute("aria-label", "Buffering");

    this.#error = document.createElement("div");
    this.#error.className = "error";
    this.#error.setAttribute("role", "alert");

    this.#centerButton = document.createElement("button");
    this.#centerButton.className = "center-play";
    this.#centerButton.type = "button";
    this.#centerButton.setAttribute("aria-label", "Play");
    this.#centerButton.textContent = "▶";
    this.#centerButton.addEventListener("click", this.#toggleFromControls);

    const controls = document.createElement("div");
    controls.className = "controls";
    this.#playButton = this.#controlButton("▶", "Play", this.#toggleFromControls);
    this.#muteButton = this.#controlButton("🔊", "Mute", () => {
      this.muted = !this.muted;
    });
    this.#volume = document.createElement("input");
    this.#volume.className = "volume";
    this.#volume.type = "range";
    this.#volume.min = "0";
    this.#volume.max = "1";
    this.#volume.step = "0.01";
    this.#volume.value = "1";
    this.#volume.setAttribute("aria-label", "Volume");
    this.#volume.addEventListener("input", () => {
      this.volume = this.#volume.value;
      if (this.volume > 0) this.muted = false;
    });

    this.#time = document.createElement("span");
    this.#time.className = "time";
    this.#seek = document.createElement("input");
    this.#seek.className = "seek";
    this.#seek.type = "range";
    this.#seek.min = "0";
    this.#seek.max = "1000";
    this.#seek.value = "0";
    this.#seek.setAttribute("aria-label", "Seek");
    this.#seek.addEventListener("input", () => {
      if (Number.isFinite(this.duration)) {
        this.seek((Number(this.#seek.value) / 1000) * this.duration);
      }
    });

    this.#rateButton = this.#controlButton("1×", "Playback speed", () => this.#cycleRate());
    this.#captionButton = this.#controlButton("CC", "Toggle captions", () => this.#toggleCaptions());
    this.#pipButton = this.#controlButton("▣", "Picture in picture", () => this.togglePictureInPicture());
    const fullscreen = this.#controlButton("⛶", "Fullscreen", () => this.toggleFullscreen());
    controls.append(
      this.#playButton,
      this.#muteButton,
      this.#volume,
      this.#time,
      this.#seek,
      this.#rateButton,
      this.#captionButton,
      this.#pipButton,
      fullscreen,
    );

    chrome.append(this.#liveBadge, this.#spinner, this.#error, this.#centerButton, controls);
    this.#surface.append(this.#video, chrome);
    root.append(style, this.#surface);

    this.#surface.addEventListener("pointermove", this.#showControls);
    this.#surface.addEventListener("pointerleave", this.#scheduleControls);
    this.#surface.addEventListener("focusin", this.#showControls);
    this.#surface.addEventListener("keydown", this.#onKeyDown);
    this.#video.addEventListener("click", this.#toggleFromControls);
    this.#video.addEventListener("dblclick", () => this.toggleFullscreen());

    [
      "durationchange",
      "ended",
      "loadedmetadata",
      "pause",
      "play",
      "playing",
      "progress",
      "timeupdate",
      "volumechange",
      "waiting",
    ].forEach((name) => {
      this.#video.addEventListener(name, () => {
        this.#renderState();
        dispatch(this, `gui:media-${name}`, this.#mediaState());
      });
    });
    this.#video.addEventListener("error", () => {
      const error = new Error(this.#video.error?.message ?? "The media could not be played.");
      this.#showError(error);
    });
  }

  #ensureView() {
    if (!hasDOM) {
      throw new Error("GuiMediaPlayer requires a browser or webview DOM.");
    }
    if (!this.shadowRoot) this.#createView();
  }

  #controlButton(text, label, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", () => {
      Promise.resolve(action()).catch((error) => this.#showError(error));
    });
    return button;
  }

  #syncAttributes() {
    if (!this.#video) return;
    this.#surface.setAttribute("aria-label", this.getAttribute("label") ?? "Media player");
    this.#video.autoplay = this.hasAttribute("autoplay");
    this.#video.loop = this.hasAttribute("loop");
    this.#video.muted = this.hasAttribute("muted");
    this.#video.poster = this.getAttribute("poster") ?? "";
    this.#renderState();
  }

  #assertNativeSupport(source) {
    const isHls = source.type === "application/vnd.apple.mpegurl"
      || /\.m3u8(?:$|\?)/i.test(source.src);
    if (isHls && !this.#video.canPlayType("application/vnd.apple.mpegurl")) {
      throw new Error(
        "This engine does not provide native HLS playback. Register an HLS media adapter.",
      );
    }
  }

  async #detachCurrent(stopTracks) {
    this.pause();
    this.#destroyAdapter();
    const stream = this.#video?.srcObject;
    if (stopTracks && isMediaStream(stream)) {
      stream.getTracks().forEach((track) => track.stop());
    }
    if (this.#video) {
      this.#video.srcObject = null;
      this.#video.removeAttribute("src");
      this.#video.querySelectorAll("source, track").forEach((element) => element.remove());
      this.#video.load();
    }
  }

  #destroyAdapter() {
    try {
      this.#adapterCleanup?.();
    } finally {
      this.#adapterCleanup = null;
    }
  }

  #mediaState() {
    return {
      currentTime: this.currentTime,
      duration: this.duration,
      live: this.live,
      muted: this.muted,
      paused: this.paused,
      volume: this.volume,
    };
  }

  #renderState() {
    if (!this.#video) return;
    const playing = !this.#video.paused && !this.#video.ended;
    this.#surface.dataset.playing = String(playing);
    this.#surface.dataset.controls = this.#surface.dataset.controls ?? "true";
    this.#playButton.textContent = playing ? "❚❚" : "▶";
    this.#playButton.setAttribute("aria-label", playing ? "Pause" : "Play");
    this.#centerButton.hidden = playing;
    this.#centerButton.setAttribute("aria-label", playing ? "Pause" : "Play");
    this.#muteButton.textContent = this.muted || this.volume === 0 ? "🔇" : "🔊";
    this.#muteButton.setAttribute("aria-label", this.muted ? "Unmute" : "Mute");
    this.#volume.value = String(this.volume);
    this.#liveBadge.hidden = !this.live;
    this.#pipButton.hidden = !document.pictureInPictureEnabled
      || typeof this.#video.requestPictureInPicture !== "function";
    this.#setLoading(this.#video.readyState < 3 && !this.#video.paused);

    const duration = this.duration;
    if (Number.isFinite(duration) && duration > 0) {
      this.#seek.disabled = false;
      this.#seek.value = String(Math.round((this.currentTime / duration) * 1000));
      this.#time.textContent = `${formatTime(this.currentTime)} / ${formatTime(duration)}`;
    } else {
      this.#seek.disabled = true;
      this.#seek.value = "1000";
      this.#time.textContent = this.live ? "LIVE" : formatTime(this.currentTime);
    }
    this.#renderCaptions();
    if (playing) this.#scheduleControls();
    else this.#showControls();
  }

  #renderCaptions() {
    if (!this.#captionButton || !this.#video) return;
    const available = this.#video.textTracks.length > 0 || this.#tracks.length > 0;
    this.#captionButton.hidden = !available;
    const showing = [...this.#video.textTracks].some((track) => track.mode === "showing");
    this.#captionButton.dataset.active = String(showing);
  }

  #toggleCaptions() {
    const tracks = [...this.#video.textTracks];
    if (!tracks.length) return;
    const showing = tracks.some((track) => track.mode === "showing");
    tracks.forEach((track, index) => {
      track.mode = !showing && index === 0 ? "showing" : "disabled";
    });
    this.#renderCaptions();
    dispatch(this, "gui:media-captions-change", { showing: !showing });
  }

  #cycleRate() {
    const rates = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const current = rates.indexOf(this.#video.playbackRate);
    const next = rates[(current + 1) % rates.length];
    this.#video.playbackRate = next;
    this.#rateButton.textContent = `${next}×`;
    dispatch(this, "gui:media-rate-change", { playbackRate: next });
  }

  #setLoading(loading) {
    if (this.#spinner) this.#spinner.hidden = !loading;
  }

  #showError(error) {
    this.#setLoading(false);
    this.#error.textContent = error.message;
    this.#error.hidden = false;
    dispatch(this, "gui:media-error", { error, operation: "playback" });
  }

  #clearError() {
    if (!this.#error) return;
    this.#error.hidden = true;
    this.#error.textContent = "";
  }

  #showControls = () => {
    clearTimeout(this.#controlsTimer);
    if (this.#surface) this.#surface.dataset.controls = "true";
  };

  #scheduleControls = () => {
    clearTimeout(this.#controlsTimer);
    if (this.paused) return;
    this.#controlsTimer = setTimeout(() => {
      if (!this.#surface.matches(":focus-within")) this.#surface.dataset.controls = "false";
    }, 2_200);
  };

  #onKeyDown = (event) => {
    if (event.target.matches("button, input")) return;
    const key = event.key.toLowerCase();
    if (key === " " || key === "k") {
      event.preventDefault();
      this.#toggleFromControls();
    } else if (key === "m") {
      this.muted = !this.muted;
    } else if (key === "f") {
      this.toggleFullscreen();
    } else if (key === "p") {
      this.togglePictureInPicture();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      this.seek(this.currentTime - 5);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      this.seek(this.currentTime + 5);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      this.volume = this.volume + 0.05;
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      this.volume = this.volume - 0.05;
    }
  };

  #toggleFromControls = () => {
    Promise.resolve(this.togglePlayback()).catch((error) => this.#showError(error));
  };
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const value = Math.floor(seconds);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remaining = value % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${minutes}:${String(remaining).padStart(2, "0")}`;
}

export const mediaPlayerModule = Object.freeze({
  id: "media-player",
  version: "0.1.0",
  description: "Responsive video and live MediaStream playback with extensible adapters.",
  dependencies: ["core"],
  components: ["gui-media-player"],
  setup() {
    if (hasDOM && !customElements.get("gui-media-player")) {
      customElements.define("gui-media-player", GuiMediaPlayer);
    }
    return { GuiMediaPlayer, mediaAdapters };
  },
});

if (hasDOM && !customElements.get("gui-media-player")) {
  customElements.define("gui-media-player", GuiMediaPlayer);
}

const MEDIA_PLAYER_STYLES = `
  :host {
    display: block;
    width: 100%;
    min-width: 0;
    aspect-ratio: var(--gui-media-aspect-ratio, 16 / 9);
    overflow: hidden;
    border-radius: var(--gui-radius-lg, 1rem);
    background: #050609;
    color: white;
    box-shadow: var(--gui-shadow-lg, 0 20px 48px rgb(0 0 0 / .3));
  }
  *, *::before, *::after { box-sizing: border-box; }
  [hidden] { display: none !important; }

  .player {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    outline: none;
    background:
      radial-gradient(circle at 50% 35%, #252a36, #08090d 58%);
  }

  .player:focus-visible {
    box-shadow: inset 0 0 0 3px var(--gui-focus, rgb(139 140 255 / .48));
  }

  video {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: var(--gui-media-object-fit, contain);
    background: #050609;
  }

  .chrome {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .chrome::after {
    position: absolute;
    inset: auto 0 0;
    height: 42%;
    background: linear-gradient(transparent, rgb(0 0 0 / .78));
    content: "";
    opacity: 1;
    transition: opacity 240ms;
  }

  .player[data-controls="false"] {
    cursor: none;
  }

  .player[data-controls="false"] .controls,
  .player[data-controls="false"] .chrome::after,
  .player[data-controls="false"] .live-badge {
    opacity: 0;
    transform: translateY(.6rem);
    pointer-events: none;
  }

  .controls {
    position: absolute;
    right: .8rem;
    bottom: .7rem;
    left: .8rem;
    z-index: 3;
    display: grid;
    grid-template-columns: auto auto minmax(3rem, 6rem) auto minmax(5rem, 1fr) auto auto auto auto;
    align-items: center;
    gap: .5rem;
    padding: .55rem;
    border: 1px solid rgb(255 255 255 / .12);
    border-radius: .8rem;
    background: rgb(12 14 19 / .66);
    backdrop-filter: blur(16px);
    opacity: 1;
    pointer-events: auto;
    transition: opacity 220ms, transform 280ms cubic-bezier(.22, 1, .36, 1);
  }

  button {
    display: grid;
    min-width: 2rem;
    height: 2rem;
    place-items: center;
    padding: 0 .42rem;
    border: 0;
    border-radius: .5rem;
    background: transparent;
    color: white;
    cursor: pointer;
    font: 750 .75rem/1 var(--gui-font, ui-sans-serif, system-ui);
  }
  button:hover, button[data-active="true"] { background: rgb(255 255 255 / .16); }
  button:focus-visible { outline: 2px solid #aeb0ff; outline-offset: 1px; }

  input[type="range"] {
    height: 1rem;
    margin: 0;
    accent-color: var(--gui-accent, #8b8cff);
    cursor: pointer;
  }
  .seek { width: 100%; }
  .volume { width: 100%; }
  .time {
    min-width: max-content;
    color: rgb(255 255 255 / .78);
    font: 650 .68rem/1 var(--gui-font, ui-sans-serif, system-ui);
    font-variant-numeric: tabular-nums;
  }

  .center-play {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 2;
    width: 4rem;
    height: 4rem;
    border: 1px solid rgb(255 255 255 / .22);
    border-radius: 50%;
    background: rgb(13 15 21 / .66);
    box-shadow: 0 12px 36px rgb(0 0 0 / .3);
    font-size: 1.25rem;
    backdrop-filter: blur(14px);
    pointer-events: auto;
    transform: translate(-50%, -50%);
    transition: transform 220ms cubic-bezier(.22, 1, .36, 1), background 160ms;
  }
  .center-play:hover {
    background: color-mix(in srgb, var(--gui-accent, #8b8cff) 76%, transparent);
    transform: translate(-50%, -50%) scale(1.08);
  }

  .live-badge {
    position: absolute;
    top: .75rem;
    left: .75rem;
    z-index: 3;
    min-width: auto;
    height: 1.7rem;
    padding: 0 .55rem;
    border-radius: 999px;
    background: #e0354f;
    box-shadow: 0 6px 18px rgb(0 0 0 / .24);
    font-size: .65rem;
    letter-spacing: .08em;
    pointer-events: auto;
    transition: opacity 220ms, transform 280ms cubic-bezier(.22, 1, .36, 1);
  }

  .spinner {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 4;
    width: 2.5rem;
    height: 2.5rem;
    border: 3px solid rgb(255 255 255 / .25);
    border-top-color: white;
    border-radius: 50%;
    animation: media-spin .8s linear infinite;
    transform: translate(-50%, -50%);
  }

  .error {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 5;
    width: min(28rem, calc(100% - 2rem));
    padding: .8rem 1rem;
    border: 1px solid rgb(255 125 145 / .32);
    border-radius: .75rem;
    background: rgb(45 8 15 / .86);
    color: #ffdce2;
    font: .82rem/1.4 var(--gui-font, ui-sans-serif, system-ui);
    text-align: center;
    transform: translate(-50%, -50%);
  }

  @keyframes media-spin {
    to { transform: translate(-50%, -50%) rotate(360deg); }
  }

  @media (max-width: 42rem) {
    .controls {
      grid-template-columns: auto auto auto minmax(5rem, 1fr) auto auto;
    }
    .volume, .time, .rate { display: none; }
    .controls > :nth-child(3),
    .controls > :nth-child(4),
    .controls > :nth-child(6) { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: .01ms !important;
      transition-duration: .01ms !important;
    }
  }
`;
