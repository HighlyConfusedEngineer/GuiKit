# Media player

`<gui-media-player>` provides responsive playback for files, live web streams,
and real-time `MediaStream` sources while keeping protocol-specific decoders
outside the dependency-free core.

## Quick start

```html
<gui-media-player
  src="/media/intro.webm"
  poster="/media/intro-poster.webp"
  label="Product introduction">
</gui-media-player>
```

Or use JavaScript:

```js
const player = document.querySelector("gui-media-player");

await player.setSource({
  src: "/media/live.m3u8",
  type: "application/vnd.apple.mpegurl",
  live: true,
  autoplay: true,
  tracks: [
    {
      src: "/captions/en.vtt",
      kind: "captions",
      srclang: "en",
      label: "English",
      default: true,
    },
  ],
});
```

## Real-time MediaStream playback

Media streams from WebRTC, capture devices, screen sharing, or
`canvas.captureStream()` attach directly:

```js
const stream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true,
});

await player.attachStream(stream, {
  live: true,
  autoplay: true,
  label: "Camera preview",
});

// Stop tracks only when the application owns them.
await player.detach({ stopTracks: true });
```

Camera and screen capture require secure-context browser permissions. GuiKit
never requests those permissions itself; the application remains in control.

## Format support

The native path supports every format exposed by the current browser or
webview engine. This generally includes MP4 or WebM depending on installed
codecs. WebKit engines commonly provide native HLS. Chromium engines generally
need a Media Source Extensions adapter for HLS or DASH.

An unsupported `.m3u8` source produces a clear error instead of silently
failing.

## Adapter API

Adapters let applications integrate hls.js, dash.js, encrypted media, signed
URL refresh, or a proprietary transport without making it a core dependency.

```js
import { mediaAdapters } from "@gui-template/core/media-player";

mediaAdapters.register({
  id: "application-hls",
  priority: 100,

  canHandle(source, video) {
    return source.type === "application/vnd.apple.mpegurl"
      && !video.canPlayType(source.type);
  },

  async attach(source, video) {
    const engine = createApplicationHlsEngine();
    engine.attachMedia(video);
    await engine.loadSource(source.src);

    // Called on source change or component disconnect.
    return () => engine.destroy();
  },
});
```

Higher-priority adapters are tested first. Adapter cleanup is guaranteed when
the source changes; a late async adapter result is immediately destroyed if a
newer source won the race.

## Attributes

| Attribute | Meaning |
| --- | --- |
| `src` | Native media URL |
| `type` | MIME hint, including native HLS detection |
| `poster` | Poster image URL |
| `label` | Accessible player name |
| `autoplay` | Request playback after attachment |
| `muted` | Start or remain muted |
| `loop` | Loop finite media |
| `live` | Display live state and live-edge control |

Autoplay remains subject to browser policy. Muted autoplay has the broadest
support. A blocked attempt emits `gui:media-autoplay-blocked`.

## Methods

- `setSource(urlOrConfiguration)`
- `attachStream(stream, options?)`
- `detach({ stopTracks? })`
- `play()`, `pause()`, and `togglePlayback()`
- `seek(seconds)` and `seekToLive()`
- `setTracks(trackConfigurations)`
- `togglePictureInPicture()`
- `toggleFullscreen()`

The underlying `HTMLVideoElement` is available as the read-only
`mediaElement` property for advanced APIs such as `MediaKeys`.

## Events

Native video events are exposed with a consistent prefix:

- `gui:media-loadedmetadata`
- `gui:media-play`
- `gui:media-playing`
- `gui:media-pause`
- `gui:media-waiting`
- `gui:media-timeupdate`
- `gui:media-durationchange`
- `gui:media-volumechange`
- `gui:media-ended`

Additional framework events:

- `gui:media-source-change`
- `gui:media-error`
- `gui:media-autoplay-blocked`
- `gui:media-captions-change`
- `gui:media-rate-change`

## Keyboard behavior

When focus is on the player surface:

| Key | Action |
| --- | --- |
| Space or K | Play/pause |
| M | Mute/unmute |
| F | Fullscreen |
| P | Picture-in-Picture |
| Left/Right | Seek five seconds |
| Up/Down | Change volume |

Controls remain visible while keyboard focus is inside the player. The chrome
auto-hides only during playback and pointer inactivity.

## Responsive behavior

The host uses a `16 / 9` aspect ratio by default:

```css
gui-media-player {
  --gui-media-aspect-ratio: 4 / 3;
  --gui-media-object-fit: cover;
}
```

Less important controls collapse at narrow widths. Picture-in-Picture is hidden
when the host engine does not expose it.

## Security and lifecycle

- Validate user-entered URLs before loading them in security-sensitive hosts.
- Configure CORS on media and caption resources when origins differ.
- Do not stop shared `MediaStream` tracks unless the player owns them.
- Adapter cleanup must remove listeners, network loaders, workers, and media
  source objects.
- Native hosts should apply their navigation policy to media URLs.
