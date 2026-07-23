export interface GuiMediaSource {
  src: string;
  type?: string;
  live?: boolean;
  autoplay?: boolean;
  poster?: string;
  crossOrigin?: string;
  tracks?: GuiMediaTrack[];
  signal?: AbortSignal;
  [key: string]: unknown;
}

export interface GuiMediaTrack {
  src: string;
  kind?: "subtitles" | "captions" | "descriptions" | "chapters" | "metadata";
  srclang?: string;
  label?: string;
  default?: boolean;
}

export interface GuiMediaAdapter {
  id: string;
  priority?: number;
  canHandle(source: GuiMediaSource, mediaElement: HTMLVideoElement): boolean;
  attach(
    source: GuiMediaSource,
    mediaElement: HTMLVideoElement,
    context: { player: GuiMediaPlayer; signal?: AbortSignal },
  ): void | (() => void) | { destroy(): void } | Promise<void | (() => void) | { destroy(): void }>;
}

export class GuiMediaAdapterRegistry {
  register(adapter: GuiMediaAdapter): Readonly<GuiMediaAdapter>;
  unregister(id: string): boolean;
  list(): Readonly<GuiMediaAdapter>[];
  find(source: GuiMediaSource, mediaElement: HTMLVideoElement): Readonly<GuiMediaAdapter> | undefined;
}

export const mediaAdapters: GuiMediaAdapterRegistry;

export class GuiMediaPlayer extends HTMLElement {
  readonly mediaElement: HTMLVideoElement;
  readonly source: GuiMediaSource | { kind: "stream"; live: boolean; label?: string } | null;
  live: boolean;
  readonly paused: boolean;
  currentTime: number;
  readonly duration: number;
  volume: number;
  muted: boolean;
  setSource(source: string | GuiMediaSource): Promise<void>;
  attachStream(
    stream: MediaStream,
    options?: { live?: boolean; autoplay?: boolean; label?: string },
  ): Promise<void>;
  detach(options?: { stopTracks?: boolean }): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  togglePlayback(): Promise<void> | void;
  seek(time: number): boolean;
  seekToLive(): boolean;
  setTracks(tracks?: GuiMediaTrack[]): void;
  togglePictureInPicture(): Promise<boolean>;
  toggleFullscreen(): Promise<boolean>;
}

export const mediaPlayerModule: {
  readonly id: "media-player";
  readonly version: string;
  readonly description: string;
  readonly dependencies: readonly ["core"];
  readonly components: readonly ["gui-media-player"];
  setup(): {
    GuiMediaPlayer: typeof GuiMediaPlayer;
    mediaAdapters: GuiMediaAdapterRegistry;
  };
};

declare global {
  interface HTMLElementTagNameMap {
    "gui-media-player": GuiMediaPlayer;
  }
}
